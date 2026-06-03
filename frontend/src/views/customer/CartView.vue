<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useCartStore } from '@/stores/cart.store';
import { useOrderStore } from '@/stores/order.store';
import CartItem from '@/components/customer/CartItem.vue';
import ChatBox from '@/components/customer/ChatBox.vue';
import ThankYouOverlay from '@/components/customer/ThankYouOverlay.vue';
import { toast } from 'vue3-toastify';
import { apiClient } from '@/services/api';
import { orderService } from '@/services/order.service';
import { socketService } from '@/services/socket';

const showThankYou = ref(false);
const isTableLocked = ref(false);

const router = useRouter();
const cartStore = useCartStore();
const orderStore = useOrderStore();

const activeTable = ref<any>(null);
const activeSection = ref<'cart' | 'tracking'>('cart');

const unreadMessagesCount = ref(0);
const isChatOpen = ref(false);

watch(isChatOpen, (newVal) => {
  if (newVal) {
    unreadMessagesCount.value = 0;
  }
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
};

// ===== DATA FETCHING =====
const fetchTableOrders = async () => {
  if (orderStore.activeTableId) {
    await orderStore.fetchActiveTableOrders(orderStore.activeTableId);
  }
};

const cancellingItemId = ref<string | null>(null);

onMounted(async () => {
  // 1. Connect socket first (idempotent, safe to call multiple times)
  socketService.connect();

  // 2. Validate session on mount (Fix #2)
  if (orderStore.activeTableId) {
    const sessionStatus = await orderStore.validateSession();
    if (!sessionStatus.active) {
      const endedSessionId = sessionStatus.sessionId;
      cartStore.clearStorage(orderStore.activeTableId);
      cartStore.clearCart();
      orderStore.clearTableId();
      orderStore.clearOrderId();
      if (endedSessionId) {
        router.replace({ path: '/customer', query: { thankyou: 'true', sessionId: endedSessionId } });
      } else {
        router.replace({ path: '/customer', query: { thankyou: 'true' } });
      }
      return;
    }

    // Join the table socket room for room-specific events (e.g. tableLocked)
    socketService.joinTable(Number(orderStore.activeTableId));

    // 3. Load persisted cart (Fix #2)
    cartStore.loadFromStorage(orderStore.activeTableId);

    await fetchTableOrders();
    try {
      const res = await apiClient.get(`/tables/${orderStore.activeTableId}`);
      activeTable.value = res.data;
      isTableLocked.value = !!res.data.isLocked;
    } catch(e) {}
  }

  // Auto-switch to tracking if cart is empty but orders exist
  if (cartStore.items.length === 0 && orderStore.activeTableOrders.length > 0) {
    activeSection.value = 'tracking';
  }

  // 4. Register socket listeners AFTER connect (deduplicated by socket service)
  socketService.onOrderUpdated(() => fetchTableOrders());
  socketService.onOrderConfirmed(() => fetchTableOrders());
  socketService.onItemStatusChanged(() => fetchTableOrders());
  socketService.on('tableUpdated', () => fetchTableOrders());

  socketService.on('paymentCompleted', (payload: any) => {
    if (Number(payload.tableId) === Number(tableId.value)) {
      cartStore.clearCart();
      if (orderStore.activeTableId) {
        cartStore.clearStorage(orderStore.activeTableId);
        socketService.leaveTable(orderStore.activeTableId);
      }
      orderStore.clearTableId();
      orderStore.clearOrderId();
      router.replace({ path: '/customer', query: { thankyou: 'true', sessionId: payload.sessionId } });
    }
  });

  socketService.onNewMessage('CartView', (msg: any) => {
    if (msg.tableId === Number(tableId.value) && msg.sender === 'service') {
      if (!isChatOpen.value) {
        unreadMessagesCount.value++;
      }
    }
  });

  // 5. Listen for table lock changes
  socketService.onTableLocked((payload) => {
    if (Number(payload.tableId) === Number(tableId.value)) {
      isTableLocked.value = payload.isLocked;
    }
  });
});

onUnmounted(() => {
  if (orderStore.activeTableId) {
    socketService.leaveTable(Number(orderStore.activeTableId));
  }
  socketService.offOrderUpdated();
  socketService.offOrderConfirmed();
  socketService.offItemStatusChanged();
  socketService.off('tableUpdated');
  socketService.off('paymentCompleted');
  socketService.offTableLocked();
  socketService.offNewMessage('CartView');
});

// === Cart persistence: save to localStorage on every mutation ===
// This is critical because CustomerView (which has its own watcher) is UNMOUNTED
// when navigating to CartView. Without this, cart changes on CartView are lost on refresh.
watch(
  () => cartStore.items,
  () => {
    if (orderStore.activeTableId) {
      cartStore.saveToStorage(orderStore.activeTableId);
    }
  },
  { deep: true }
);

// ===== CALL WAITER / PAYMENT =====
const isCallingWaiter = ref(false);
const handleCallWaiter = async () => {
  if (!orderStore.activeTableId) return;
  isCallingWaiter.value = true;
  try {
    await apiClient.post(`/tables/${orderStore.activeTableId}/call-waiter`);
    toast.success('Đã gọi nhân viên hỗ trợ.');
  } catch(e) {} 
  finally { isCallingWaiter.value = false; }
};

const isRequestingPayment = ref(false);
const hasRequestedPayment = ref(false);

const handleRequestPayment = async () => {
  if (!orderStore.activeTableId || hasRequestedPayment.value) return;
  isRequestingPayment.value = true;
  try {
    await apiClient.post(`/tables/${orderStore.activeTableId}/request-payment`);
    toast.success('Yêu cầu thanh toán đã được gửi tới nhân viên.');
    hasRequestedPayment.value = true;
    setTimeout(() => {
      hasRequestedPayment.value = false;
    }, 3000); // 3-second debounce cooldown
  } catch(e) {
    toast.error('Lỗi khi gửi yêu cầu thanh toán. Vui lòng thử lại.');
  } finally {
    isRequestingPayment.value = false;
  }
};

// ===== CART LOGIC =====
const tableId = computed(() => orderStore.activeTableId);
const hasOrders = computed(() => orderStore.activeTableOrders.length > 0);

const grandTotal = computed(() => cartStore.totalPrice);

// Session total: only count non-cancelled items for accurate bill display
const sessionTotal = computed(() => {
  if (!orderStore.activeTableOrders) return 0;
  let total = 0;
  for (const order of orderStore.activeTableOrders) {
    if (!order.items) { total += Number(order.totalAmount || 0); continue; }
    for (const item of order.items) {
      if (item.status !== 'cancelled') {
        total += Number(item.price || 0) * item.quantity;
      }
    }
  }
  return total;
});

// Customer should only see non-cancelled items per order
// Cancelled items DISAPPEAR from customer view (but remain in DB for waiter/admin)
const getVisibleItems = (order: any) => {
  if (!order.items) return [];
  return order.items.filter((item: any) => item.status !== 'cancelled');
};

// Check if an order has any visible (non-cancelled) items
const orderHasVisibleItems = (order: any) => getVisibleItems(order).length > 0;

// Calculate visible order total (excluding cancelled items)
const getVisibleOrderTotal = (order: any) => {
  return getVisibleItems(order).reduce((sum: number, item: any) => sum + Number(item.price || 0) * item.quantity, 0);
};

const handleCheckout = async () => {
  if (orderStore.loading) return; // Spam guard: prevent duplicate submissions
  if (cartStore.items.length === 0) return;
  if (!tableId.value) {
    toast.error('Vui lòng quét mã QR trên bàn.');
    return;
  }
  if (isTableLocked.value) {
    toast.error('Bàn đang bị khóa. Không thể đặt món.');
    return;
  }
  
  try {
    const orderData = {
      tableId: tableId.value,
      totalAmount: grandTotal.value,
      items: cartStore.items.map(item => ({
        menuItemId: item.id,
        quantity: item.quantity,
        note: item.note
      }))
    };
    
    await orderStore.placeOrder(orderData);
    cartStore.clearCart();
    cartStore.clearStorage(orderStore.activeTableId);
    await fetchTableOrders();
    
    // Switch to tracking view after placing order
    activeSection.value = 'tracking';
    toast.success('Đã gửi đơn đến bếp!');
  } catch (error) {
    toast.error('Không thể đặt món. Vui lòng thử lại.');
  }
};

// ===== ORDER TRACKING HELPERS =====
const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending_confirmation: 'Chờ xác nhận',
    confirmed: 'Đang nấu',
    ready: 'Đã nấu',
    cancelled: 'Đã huỷ',
  };
  return map[status] || status;
};

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    pending_confirmation: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return map[status] || 'bg-slate-100 text-slate-500';
};

const getStatusIcon = (status: string) => {
  const map: Record<string, string> = {
    pending_confirmation: 'schedule',
    confirmed: 'local_fire_department',
    ready: 'done_all',
    cancelled: 'cancel',
  };
  return map[status] || 'info';
};

// Per-ITEM status helpers (distinct from per-ORDER)
const itemStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    preparing: 'Đang nấu',
    ready: 'Đã nấu xong',
    cancelled: 'Đã hủy',
  };
  return map[status] || status;
};

const itemStatusColor = (status: string) => {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    preparing: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return map[status] || 'bg-slate-100 text-slate-500';
};

// Check if there are any payable (non-cancelled) items across orders
const hasPayableItems = computed(() => {
  return orderStore.activeTableOrders.some((order: any) =>
    order.items?.some((item: any) => item.status !== 'cancelled')
  );
});

// BUSINESS RULE: Payment/Call Waiter buttons only appear when
// at least one item has been confirmed by waiter.
// Pending-only orders = no buttons (restaurant hasn't accepted the order yet)
const hasConfirmedItems = computed(() => {
  const confirmedStatuses = ['confirmed', 'preparing', 'ready'];
  return orderStore.activeTableOrders.some((order: any) =>
    order.items?.some((item: any) => confirmedStatuses.includes(item.status))
  );
});

const hasReadyItems = computed(() => {
  return orderStore.activeTableOrders.some((order: any) =>
    order.items?.some((item: any) => item.status === 'ready')
  );
});

const formatTime = (date: string) => {
  return new Date(date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

// Group orders by time for history display
const ordersGroupedByTime = computed(() => {
  const groups: Record<string, any[]> = {};
  const orders = [...orderStore.activeTableOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  orders.forEach(order => {
    const time = formatTime(order.createdAt);
    if (!groups[time]) groups[time] = [];
    groups[time].push(order);
  });
  return groups;
});

// ===== ORDER ITEM CANCELLATION (Fix #4) =====
const handleCancelItem = async (orderId: string, itemId: string, itemName: string) => {
  if (cancellingItemId.value) return; // Prevent double-click
  
  const confirmed = confirm(`Bạn có chắc chắn muốn hủy "${itemName}"?`);
  if (!confirmed) return;

  cancellingItemId.value = itemId;
  try {
    await orderService.cancelOrderItem(orderId, itemId, 'customer');
    toast.success(`Đã hủy: ${itemName}`);
    await fetchTableOrders();
  } catch (error: any) {
    const msg = error?.response?.data?.message || 'Không thể hủy món. Vui lòng thử lại.';
    toast.error(msg);
  } finally {
    cancellingItemId.value = null;
  }
};

// ===== SESSION LIFECYCLE =====
const handleSessionEnd = () => {
  if (orderStore.activeTableId) {
    cartStore.clearStorage(orderStore.activeTableId);
  }
  cartStore.clearCart();
  orderStore.clearTableId();
  orderStore.clearOrderId();
};
</script>

<template>
  <div class="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark group/design-root overflow-x-hidden max-w-lg mx-auto shadow-xl">
    
    <!-- Top App Bar -->
    <div class="sticky top-0 z-10 flex items-center bg-white/80 dark:bg-background-dark/80 backdrop-blur-md px-2 sm:px-4 py-2 sm:py-2 justify-between border-b border-slate-200 dark:border-slate-800">
      <div 
        @click="router.push('/customer')"
        class="text-slate-900 dark:text-slate-100 flex size-11 sm:size-12 shrink-0 items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors justify-center active:scale-90"
      >
        <span class="material-symbols-outlined">arrow_back</span>
      </div>
      <h2 class="text-slate-900 dark:text-slate-100 text-base sm:text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-11 sm:pr-12">
         Bàn số: {{ activeTable ? activeTable.name.replace(/Table|Bàn/gi, '').trim() : (tableId || '?') }}
      </h2>
    </div>

    <!-- No Table Warning -->
    <div v-if="!orderStore.activeTableId" class="flex flex-col items-center justify-center p-8 mt-20 text-center h-full my-auto">
      <div class="w-24 h-24 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-6">
        <span class="material-symbols-outlined text-5xl">qr_code_scanner</span>
      </div>
      <h3 class="text-xl font-bold mb-2">Quét mã QR</h3>
      <p class="text-slate-500 mb-8">Vui lòng quét mã QR trên bàn để xem giỏ hàng và đặt món.</p>
    </div>

    <!-- Empty State: no cart items AND no orders -->
    <div v-else-if="cartStore.items.length === 0 && orderStore.activeTableOrders.length === 0" class="flex-1 flex flex-col items-center justify-center p-8 mt-20 text-center">
      <div class="w-24 h-24 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mb-6">
        <span class="material-symbols-outlined text-5xl">shopping_cart</span>
      </div>
      <h3 class="text-xl font-bold mb-2">Giỏ hàng trống</h3>
      <p class="text-slate-500 mb-8">Bạn chưa thêm món nào vào giỏ hàng.</p>
      <button 
        @click="router.push('/customer')"
        class="bg-primary text-white font-bold py-3 px-8 rounded-xl hover:bg-primary/90 transition-colors"
      >
        Xem thực đơn
      </button>
    </div>

    <!-- Main Content -->
    <template v-else>
      <div class="flex-1 overflow-y-auto pb-28">
        
        <!-- Table Info Bar -->
        <div class="p-3 sm:p-4 bg-white dark:bg-background-dark border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span class="material-symbols-outlined">table_restaurant</span>
            </div>
            <div class="flex flex-col flex-1">
              <p class="text-sm font-bold">Bàn {{ activeTable ? activeTable.name.replace('Table', '').trim() : (tableId || '?') }}</p>
              <div class="flex items-center gap-2">
                 <p class="text-xs text-slate-500">Đang phục vụ</p>
                 <span v-if="hasRequestedPayment" class="bg-orange-100 text-orange-600 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">Đã yêu cầu TT</span>
              </div>
            </div>
            <div v-if="sessionTotal > 0" class="text-right">
              <p class="text-[10px] uppercase font-bold text-slate-500 mb-0.5 tracking-wider">Tổng bàn</p>
              <p class="text-primary font-black">{{ formatCurrency(sessionTotal) }}</p>
            </div>
          </div>
        </div>

        <!-- Section Tabs (only show if there are orders) -->
        <div v-if="hasOrders" class="flex bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-3 sm:px-4 pt-1.5 sm:pt-2">
          <button 
            @click="activeSection = 'tracking'" 
            :class="['flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all min-h-[40px]', 
              activeSection === 'tracking' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600']"
          >
            <span class="material-symbols-outlined text-[14px] mr-1 align-middle">receipt_long</span>
            Món đã đặt ({{ orderStore.activeTableOrders.length }})
          </button>
          <button 
            v-if="cartStore.items.length > 0"
            @click="activeSection = 'cart'" 
            :class="['flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all min-h-[40px]', 
              activeSection === 'cart' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600']"
          >
            <span class="material-symbols-outlined text-[14px] mr-1 align-middle">shopping_cart</span>
            Giỏ hàng ({{ cartStore.totalItems }})
          </button>
        </div>

        <!-- ========== ORDER TRACKING SECTION ========== -->
        <div v-if="activeSection === 'tracking' && hasOrders" class="p-3 sm:p-4 space-y-3 sm:space-y-4">
          
          <!-- Lock Warning Banner -->
          <div v-if="isTableLocked" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-3">
            <span class="material-symbols-outlined text-red-500 text-[20px]">lock</span>
            <div>
              <p class="text-sm font-bold text-red-700 dark:text-red-400">Bàn đang bị khóa</p>
              <p class="text-xs text-red-500">Đặt món và hủy món tạm thời bị vô hiệu hóa.</p>
            </div>
          </div>

          <!-- Action Buttons: ONLY appear when at least one item is confirmed by waiter -->
          <div v-if="hasConfirmedItems" class="flex flex-col gap-3">
            <div class="flex gap-3">
              <button @click="handleCallWaiter" :disabled="isCallingWaiter" class="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors disabled:opacity-50 min-h-[48px] active:scale-[0.97]">
                 <span v-if="isCallingWaiter" class="material-symbols-outlined animate-spin text-sm">refresh</span>
                 <span v-else class="material-symbols-outlined text-sm">room_service</span> 
                 {{ isCallingWaiter ? 'Đang gọi...' : 'Gọi nhân viên' }}
              </button>
              <button v-if="hasReadyItems" @click="handleRequestPayment" :disabled="isRequestingPayment || hasRequestedPayment || isTableLocked" class="flex-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 min-h-[48px] active:scale-[0.97]">
                 <span v-if="isRequestingPayment" class="material-symbols-outlined animate-spin text-sm">refresh</span>
                 <span v-else class="material-symbols-outlined text-sm">payments</span> 
                 {{ hasRequestedPayment ? 'Đã gửi yêu cầu' : 'Thanh toán' }}
              </button>
            </div>
            <!-- Chat Button for Tracking section -->
            <button 
              @click="isChatOpen = true" 
              class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors min-h-[48px] active:scale-[0.97] relative"
            >
              <span class="material-symbols-outlined text-sm">chat</span>
              Chat với nhân viên
              <!-- Unread Badge -->
              <span v-if="unreadMessagesCount > 0" class="absolute top-1/2 -translate-y-1/2 right-4 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white dark:border-slate-900 animate-bounce">
                {{ unreadMessagesCount }}
              </span>
            </button>
          </div>

          <!-- Pending-only status indicator (no buttons yet) -->
          <div v-else class="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-xl p-3 flex items-center gap-3">
            <span class="material-symbols-outlined text-yellow-500 text-[20px] animate-pulse">hourglass_top</span>
            <div>
              <p class="text-sm font-bold text-yellow-700 dark:text-yellow-400">Đang chờ nhân viên xác nhận</p>
              <p class="text-xs text-yellow-600/70">Nút thanh toán sẽ xuất hiện sau khi món được xác nhận.</p>
            </div>
          </div>

          <!-- Orders grouped by time -->
          <div v-for="(orders, time) in ordersGroupedByTime" :key="time">
            <div class="flex items-center gap-2 mb-3">
              <span class="material-symbols-outlined text-slate-400 text-[14px]">schedule</span>
              <span class="text-[11px] font-black text-slate-400 uppercase tracking-wider">{{ time }}</span>
              <div class="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
            </div>

            <div class="space-y-3">
              <!-- Only show orders that have visible (non-cancelled) items -->
              <div v-for="order in orders" :key="order.id" v-show="orderHasVisibleItems(order)" class="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                
                <!-- Order Header -->
                <div class="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-[10px] font-mono text-slate-400">ĐƠN #{{ order.id.substring(0,6).toUpperCase() }}</span>
                  <span :class="['text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1', getStatusColor(order.status)]">
                    <span class="material-symbols-outlined text-[12px]">{{ getStatusIcon(order.status) }}</span>
                    {{ getStatusLabel(order.status) }}
                  </span>
                </div>

                <!-- Order Items: ONLY show non-cancelled items to customer -->
                <div class="divide-y divide-slate-50 dark:divide-slate-800/50">
                  <div v-for="item in getVisibleItems(order)" :key="item.id" class="px-4 py-3">
                    <div class="flex justify-between items-start gap-2">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <p class="text-sm font-bold text-slate-800 dark:text-slate-200">
                            <span class="text-primary font-black mr-1">{{ item.quantity }}×</span>
                            {{ item.name || item.menuItem?.name || 'Item' }}
                          </p>
                          <span :class="['text-[9px] px-1.5 py-0.5 rounded font-bold uppercase', itemStatusColor(item.status)]">{{ itemStatusLabel(item.status) }}</span>
                        </div>
                        <!-- Note display -->
                        <p v-if="item.note" class="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1 flex items-center gap-1">
                          <span class="material-symbols-outlined text-[12px]">sticky_note_2</span>
                          {{ item.note }}
                        </p>
                      </div>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <span class="text-sm font-bold text-slate-400">{{ formatCurrency(Number(item.price) * item.quantity) }}</span>
                        <!-- Cancel button: customer can only cancel 'pending' items, not when locked -->
                        <button
                          v-if="item.status === 'pending' && order.status !== 'cancelled' && !isTableLocked"
                          @click.stop="handleCancelItem(order.id, item.id, item.name || item.menuItem?.name || 'Item')"
                          :disabled="cancellingItemId === item.id"
                          class="flex items-center justify-center w-8 h-8 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all disabled:opacity-40"
                          title="Hủy món"
                        >
                          <span v-if="cancellingItemId === item.id" class="material-symbols-outlined text-[14px] animate-spin">refresh</span>
                          <span v-else class="material-symbols-outlined text-[14px]">close</span>
                        </button>
                        <!-- Lock indicator for non-cancellable items -->
                        <span v-else-if="item.status !== 'pending'" class="material-symbols-outlined text-[14px] text-slate-300" title="Không thể hủy">lock</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Order Total (recalculated without cancelled items) -->
                <div class="px-4 py-2 bg-slate-50 dark:bg-slate-800/30 flex justify-between items-center border-t border-slate-100 dark:border-slate-800">
                  <span class="text-xs text-slate-400 font-bold">Tổng đơn</span>
                  <span class="text-sm font-black text-slate-700 dark:text-slate-300">{{ formatCurrency(getVisibleOrderTotal(order)) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Add more items button -->
          <button 
            @click="router.push('/customer')"
            class="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-500 hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-2 mt-4"
          >
            <span class="material-symbols-outlined text-[18px]">add_circle</span>
            Gọi thêm món
          </button>
        </div>

        <!-- ========== CART SECTION ========== -->
        <div v-if="activeSection === 'cart' || !hasOrders">
          
          <!-- Chat Button for Cart section -->
          <div v-if="tableId && hasConfirmedItems" class="mx-4 my-4">
            <button 
              @click="isChatOpen = true" 
              class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors min-h-[48px] active:scale-[0.97] relative"
            >
              <span class="material-symbols-outlined text-sm">chat</span>
              Chat với nhân viên
              <!-- Unread Badge -->
              <span v-if="unreadMessagesCount > 0" class="absolute top-1/2 -translate-y-1/2 right-4 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white dark:border-slate-900 animate-bounce">
                {{ unreadMessagesCount }}
              </span>
            </button>
          </div>

          <!-- Cart Items -->
          <div v-if="cartStore.items.length > 0" class="bg-white dark:bg-background-dark">
            <CartItem 
              v-for="item in cartStore.items" 
              :key="item.cartItemId || item.id" 
              :item="item" 
            />
          </div>

          <!-- Empty cart (when on cart tab but items empty) -->
          <div v-else-if="hasOrders" class="p-8 text-center flex flex-col items-center">
            <p class="text-slate-400 mb-4 font-medium">Giỏ hàng đang trống</p>
            <button 
              @click="router.push('/customer')"
              class="bg-primary text-white font-bold py-3 px-8 rounded-xl hover:bg-primary/90 transition-colors"
            >
              Xem thực đơn
            </button>
          </div>

          <!-- Summary Section (only if cart has items) -->
          <div v-if="cartStore.items.length > 0" class="p-6 bg-white dark:bg-background-dark mt-2 pb-32">
            <h3 class="text-xs font-bold mb-4 uppercase tracking-wider text-slate-500">Chi tiết đơn</h3>
            <div class="space-y-3">
              <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <p class="text-slate-900 dark:text-slate-100 text-lg font-bold">Tổng cộng</p>
                <p class="text-primary text-xl font-extrabold">{{ formatCurrency(grandTotal) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sticky Checkout Button (Only if cart has items) -->
      <div v-if="cartStore.items.length > 0" class="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-3 sm:p-4 bg-white/90 dark:bg-background-dark/90 backdrop-blur-lg border-t border-slate-100 dark:border-slate-800 z-20">
        <div class="flex flex-col gap-3">
          <button 
            @click="handleCheckout"
            :disabled="orderStore.loading || !tableId"
            class="w-full bg-primary text-white py-4 rounded-xl font-bold text-base sm:text-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[56px]"
          >
            <span v-if="orderStore.loading" class="material-symbols-outlined animate-spin">refresh</span>
            <span v-if="orderStore.loading">Đang xử lý...</span>
            <span v-else>Đặt món • {{ formatCurrency(grandTotal) }}</span>
            <span v-if="!orderStore.loading" class="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>
    </template>

    <!-- Thank You Overlay -->
    <ThankYouOverlay 
      :visible="showThankYou" 
      :orders="orderStore.activeTableOrders"
      @complete="handleSessionEnd" 
    />

    <!-- Chat Modal Overlay -->
    <div 
      v-if="isChatOpen" 
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity"
      @click.self="isChatOpen = false"
    >
      <div 
        class="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl shadow-2xl flex flex-col overflow-hidden transform transition-transform duration-300"
        style="height: 80vh;"
      >
        <!-- Modal Header -->
        <div class="px-6 py-4 bg-primary text-white flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined">support_agent</span>
            <span class="font-bold text-base">Chat với nhân viên</span>
          </div>
          <button 
            @click="isChatOpen = false"
            class="text-white hover:bg-white/15 p-1.5 rounded-full transition-colors flex items-center justify-center"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <!-- Chat Content -->
        <div class="flex-1 overflow-hidden">
          <ChatBox :tableId="Number(tableId)" :fullHeight="true" :hideHeader="true" />
        </div>
      </div>
    </div>
  </div>
</template>
