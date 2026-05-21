<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useMenuStore } from '@/stores/menu.store';
import { useCartStore } from '@/stores/cart.store';
import FoodCard from '@/components/customer/FoodCard.vue';
import CategoryFilter from '@/components/customer/CategoryFilter.vue';
import ThankYouOverlay from '@/components/customer/ThankYouOverlay.vue';
import { useRouter, useRoute } from 'vue-router';
import { useOrderStore } from '@/stores/order.store';
import { socketService } from '@/services/socket';
import { apiClient } from '@/services/api';
import { toast } from 'vue3-toastify';

const showThankYou = ref(false);
const isTableLocked = ref(false);

const menuStore = useMenuStore();
const cartStore = useCartStore();
const orderStore = useOrderStore();
const router = useRouter();
const route = useRoute();

const searchQuery = ref('');
const activeCategoryId = ref<string | null>(null);

const categoryMap: Record<string, string> = {
  'All': 'Tất cả',
  'Category 1': 'Món chính',
  'Category 2': 'Món phụ',
  'Category 3': 'Tráng miệng',
  'Category 4': 'Nước uống'
};

const getCategoryDisplayName = (name: string) => {
  return categoryMap[name] || name;
};

// Extract unique categories from menu items
const categories = computed(() => {
  const catsMap = new Map();
  menuStore.menuItems.forEach(item => {
    if (item.category) {
      catsMap.set(item.category.id, {
        ...item.category,
        displayName: getCategoryDisplayName(item.category.name)
      });
    }
  });
  // Sort categories by sortOrder if available
  return Array.from(catsMap.values()).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
});

// Filter items by category and search
const filteredMenuItems = computed(() => {
  let items = menuStore.menuItems;
  
  if (activeCategoryId.value) {
    items = items.filter(item => item.categoryId === activeCategoryId.value);
  }
  
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    items = items.filter(item => item.name.toLowerCase().includes(q) || (item.description && item.description.toLowerCase().includes(q)));
  }
  
  return items;
});

const tableName = ref('');

const formatTableName = (name: string) => name ? 'Bàn ' + name.replace(/Table|Bàn/gi, '').trim() : '';

// Watch for thankyou query parameter to invalidate active session and show overlay
watch(
  () => route.query.thankyou,
  (newVal) => {
    if (newVal === 'true') {
      showThankYou.value = true;
      cartStore.clearCart();
      if (orderStore.activeTableId) {
        cartStore.clearStorage(orderStore.activeTableId);
      }
      orderStore.clearTableId();
      orderStore.clearOrderId();
    }
  },
  { immediate: true }
);

onMounted(async () => {
  if (route.query.thankyou === 'true') {
    return; // Exit early: watcher handles overlay and state clearing
  }
  // === STEP 1: Resolve table identity ===
  // Support both /table/:token (new) and ?tableId= (legacy)
  if (route.params.token) {
    // Token-based QR route: /table/:token
    const result = await orderStore.setTableByToken(route.params.token as string);
    if (result?.isLocked) {
      isTableLocked.value = true;
      // Don't return — still load menu, just block ordering
    } else if (result?.sessionEnded) {
      showThankYou.value = true;
      return;
    }
    if (result?.error) {
      toast.error('Mã QR không hợp lệ hoặc bàn không tồn tại.');
      return;
    }
  } else if (route.query.tableId) {
    // Legacy route: /customer?tableId=
    const result = await orderStore.setTableId(Number(route.query.tableId));
    if (result?.isLocked) {
      isTableLocked.value = true;
    } else if (result?.sessionEnded) {
      showThankYou.value = true;
      return;
    }
  }

  // === STEP 2: Validate session on reload (Fix #2) ===
  if (orderStore.activeTableId) {
    const sessionStatus = await orderStore.validateSession();
    if (!sessionStatus.active) {
      // Session ended (paid/expired) — show ThankYou and clear stale state
      showThankYou.value = true;
      cartStore.clearStorage(orderStore.activeTableId);
      return;
    }

    // === STEP 3: Load persisted cart (Fix #2) ===
    cartStore.loadFromStorage(orderStore.activeTableId);

    // === STEP 4: Load menu and connect socket ===
    menuStore.fetchMenuItems();
    socketService.connect();
    socketService.joinTable(orderStore.activeTableId);

    // === STEP 5: Check table lock state ===
    try {
      const tableRes = await apiClient.get(`/tables/${orderStore.activeTableId}`);
      isTableLocked.value = !!tableRes.data.isLocked;
      tableName.value = tableRes.data.name || '';
    } catch(e) {}

    // Listen for payment completion
    socketService.on('paymentCompleted', (payload: any) => {
      if (Number(payload.tableId) === Number(orderStore.activeTableId)) {
        cartStore.clearCart();
        if (orderStore.activeTableId) {
          cartStore.clearStorage(orderStore.activeTableId);
        }
        orderStore.clearTableId();
        orderStore.clearOrderId();
        router.replace({ path: '/customer', query: { thankyou: 'true' } });
      }
    });

    // Listen for table lock changes
    socketService.onTableLocked((payload) => {
      if (Number(payload.tableId) === Number(orderStore.activeTableId)) {
        isTableLocked.value = payload.isLocked;
        if (payload.isLocked) {
          toast.warning('Bàn đã bị khóa bởi nhân viên.', { autoClose: 5000 });
        } else {
          toast.success('Bàn đã được mở khóa.', { autoClose: 3000 });
        }
      }
    });
  }
});

// === Cart persistence: save to localStorage on every mutation ===
watch(
  () => cartStore.items,
  () => {
    if (orderStore.activeTableId) {
      cartStore.saveToStorage(orderStore.activeTableId);

      // Emit cart activity to service (Fix #3) — throttled
      socketService.emitCartUpdate({
        tableId: orderStore.activeTableId,
        tableName: `Bàn ${orderStore.activeTableId}`,
        itemCount: cartStore.totalItems,
        description: `Khách đang chọn món (${cartStore.totalItems} món)`,
      });
    }
  },
  { deep: true }
);

onUnmounted(() => {
  socketService.off('paymentCompleted');
  socketService.offTableLocked();
  if (orderStore.activeTableId) {
    socketService.leaveTable(orderStore.activeTableId);
  }
});

// Called when payment completes — clear state. Screen stays as receipt.
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
  <div class="relative flex h-full w-full max-w-lg mx-auto flex-col bg-background-light dark:bg-background-dark overflow-x-hidden shadow-2xl min-h-screen pb-24 sm:pb-20">
    
    <!-- No Table Warning -->
    <div v-if="!orderStore.activeTableId" class="flex flex-col items-center justify-center px-6 sm:p-8 mt-20 text-center h-full my-auto animate-fade-in">
      <div class="w-20 h-20 sm:w-24 sm:h-24 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-5">
        <span class="material-symbols-outlined text-4xl sm:text-5xl">qr_code_scanner</span>
      </div>
      <h3 class="text-lg sm:text-xl font-bold mb-2">Chưa chọn bàn</h3>
      <p class="text-slate-500 mb-8 text-sm leading-relaxed max-w-[280px]">Vui lòng quét mã QR trên bàn để truy cập thực đơn và bắt đầu gọi món.</p>
    </div>

    <!-- Main Menu Content -->
    <template v-else>

      <!-- TABLE LOCKED OVERLAY -->
      <div v-if="isTableLocked" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-sm text-center shadow-2xl animate-fade-in">
          <div class="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span class="material-symbols-outlined text-3xl">lock</span>
          </div>
          <h3 class="text-lg font-bold mb-2 text-slate-800 dark:text-slate-200">Phiên bàn đã bị khóa</h3>
          <p class="text-sm text-slate-500 mb-1">Bàn này đang bị khóa bởi nhân viên.</p>
          <p class="text-sm text-slate-500">Không thể đặt món hoặc thay đổi đơn hàng.</p>
          <p class="text-xs text-slate-400 mt-4">Vui lòng liên hệ nhân viên để được hỗ trợ.</p>
        </div>
      </div>
      <!-- Restaurant Branding Header — compact on mobile -->
      <div class="bg-gradient-to-r from-primary to-blue-600 px-4 sm:px-5 py-3 sm:py-4 text-white sticky top-0 z-20">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5 sm:gap-3">
            <div class="w-9 h-9 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <span class="material-symbols-outlined text-[20px] sm:text-[22px]" style="font-variation-settings: 'FILL' 1;">restaurant</span>
            </div>
            <div>
              <h1 class="text-[15px] sm:text-base font-black tracking-tight leading-tight flex items-center gap-1.5">
                Bình An
                <span v-if="orderStore.activeTableId" class="bg-white/20 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full select-none">
                  {{ formatTableName(tableName || String(orderStore.activeTableId)) }}
                </span>
              </h1>
              <p class="text-[10px] text-white/70 font-medium">Thực đơn • Gọi món tại bàn</p>
            </div>
          </div>
          <button 
            @click="router.push('/customer/cart')"
            class="relative flex items-center justify-center rounded-xl h-10 w-10 bg-white/15 hover:bg-white/25 backdrop-blur-sm transition-colors active:scale-95"
          >
            <span class="material-symbols-outlined text-[22px]">shopping_cart</span>
            <span 
              v-if="cartStore.totalItems > 0"
              class="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-black shadow-lg shadow-red-500/30 animate-scale-in"
            >
              {{ cartStore.totalItems }}
            </span>
          </button>
        </div>
      </div>

    <!-- Search Bar — taller touch target on mobile -->
    <div class="px-3 sm:px-4 py-2.5 sm:py-3 sticky top-[60px] sm:top-[72px] bg-background-light dark:bg-background-dark z-10 w-full">
      <div class="flex w-full items-stretch rounded-xl h-12 sm:h-11 overflow-hidden bg-white dark:bg-slate-800 shadow-sm border border-slate-200/60 dark:border-slate-700">
        <div class="text-slate-400 flex items-center justify-center pl-3.5">
          <span class="material-symbols-outlined text-[20px]">search</span>
        </div>
        <input 
          v-model="searchQuery"
          class="flex w-full min-w-0 flex-1 text-slate-900 dark:text-slate-100 focus:outline-none border-none bg-transparent h-full placeholder:text-slate-400 px-3 text-sm font-medium" 
          placeholder="Tìm món ăn, đồ uống..." 
        />
        <button 
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="px-3.5 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>

    <!-- Category Tabs -->
    <CategoryFilter 
      :categories="categories" 
      :activeCategoryId="activeCategoryId" 
      @select="(id) => activeCategoryId = id" 
    />

    <!-- UI State: Loading — responsive skeleton grid -->
    <div v-if="menuStore.loading" class="p-3 sm:p-4 space-y-4 animate-fade-in">
      <div class="grid grid-cols-2 gap-3 sm:gap-4">
        <div v-for="i in 6" :key="i" class="rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50">
          <div class="aspect-[4/3] skeleton"></div>
          <div class="p-3 space-y-2">
            <div class="h-4 skeleton w-3/4"></div>
            <div class="h-3 skeleton w-1/2"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- UI State: Error -->
    <div v-else-if="menuStore.error" class="flex flex-col items-center justify-center px-6 mt-10 text-center animate-fade-in">
      <div class="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-4">
        <span class="material-symbols-outlined text-3xl">error</span>
      </div>
      <p class="text-slate-900 dark:text-slate-100 font-bold mb-2">Có lỗi xảy ra</p>
      <p class="text-slate-500 text-sm mb-4">Không thể tải thực đơn. Vui lòng thử lại.</p>
      <button @click="menuStore.fetchMenuItems()" class="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors min-h-[48px]">Thử lại</button>
    </div>

    <!-- UI State: Empty -->
    <div v-else-if="filteredMenuItems.length === 0" class="flex flex-col items-center justify-center px-6 mt-10 text-center animate-fade-in">
      <div class="w-20 h-20 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mb-4">
        <span class="material-symbols-outlined text-4xl">search_off</span>
      </div>
      <p class="text-slate-900 dark:text-slate-100 font-bold mb-2">Không tìm thấy món</p>
      <p class="text-slate-500 text-sm">Thử tìm kiếm hoặc chọn danh mục khác.</p>
    </div>

    <!-- Product Grid — 2 columns always, responsive gap -->
    <div v-else class="grid grid-cols-2 gap-2.5 sm:gap-3.5 p-3 sm:p-4 pb-28 sm:pb-24">
      <FoodCard 
        v-for="item in filteredMenuItems" 
        :key="item.id" 
        :item="item" 
      />
    </div>
    </template>

    <!-- Floating Cart Button — larger touch target on mobile -->
    <div 
      v-if="cartStore.totalItems > 0 && orderStore.activeTableId && !showThankYou" 
      class="fixed bottom-5 sm:bottom-6 left-1/2 -translate-x-1/2 max-w-lg w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] z-30 animate-slide-up"
    >
      <button 
        @click="router.push('/customer/cart')"
        class="w-full bg-primary hover:bg-primary/90 text-white py-4 sm:py-3.5 rounded-2xl font-bold shadow-xl shadow-primary/25 flex items-center justify-center gap-2.5 sm:gap-3 active:scale-[0.98] transition-all text-[15px] sm:text-base"
      >
        <span class="material-symbols-outlined text-[20px]">shopping_cart</span>
        <span class="hidden xs:inline">Xem giỏ hàng •</span>
        <span class="xs:hidden">Giỏ hàng •</span>
        {{ cartStore.totalItems }} món
        <span class="bg-white/20 px-2.5 py-0.5 rounded-lg text-sm font-black ml-1">
          {{ new Intl.NumberFormat('vi-VN').format(cartStore.totalPrice) }} ₫
        </span>
      </button>
    </div>

    <!-- Thank You Overlay -->
    <ThankYouOverlay 
      :visible="showThankYou" 
      @complete="handleSessionEnd" 
    />
  </div>
</template>
