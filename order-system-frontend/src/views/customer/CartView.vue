<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useCartStore } from '@/stores/cart.store';
import { useOrderStore } from '@/stores/order.store';
import CartItem from '@/components/customer/CartItem.vue';
import ChatBox from '@/components/customer/ChatBox.vue';
import { toast } from 'vue3-toastify';

const router = useRouter();
const cartStore = useCartStore();
const orderStore = useOrderStore();

const activeTable = ref<any>(null);

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
};

onMounted(async () => {
  if (orderStore.activeTableId) {
    orderStore.fetchActiveTableOrders(orderStore.activeTableId);
    try {
      const res = await fetch(`http://localhost:3000/tables/${orderStore.activeTableId}`);
      if (res.ok) {
        activeTable.value = await res.json();
      }
    } catch(e) {}
  }
});

const isCallingWaiter = ref(false);
const handleCallWaiter = async () => {
  if (!orderStore.activeTableId) return;
  isCallingWaiter.value = true;
  try {
    await fetch(`http://localhost:3000/tables/${orderStore.activeTableId}/call-waiter`, { method: 'POST' });
    toast.success('Waiter has been called to your table.');
  } catch(e) { toast.error('Failed to call waiter'); }
  finally { isCallingWaiter.value = false; }
};

const isRequestingPayment = ref(false);
const handleRequestPayment = async () => {
  if (!orderStore.activeTableId) return;
  isRequestingPayment.value = true;
  try {
    await fetch(`http://localhost:3000/tables/${orderStore.activeTableId}/request-payment`, { method: 'POST' });
    toast.success('Payment requested! The waiter is on their way.');
  } catch(e) { toast.error('Failed to request payment'); }
  finally { isRequestingPayment.value = false; }
};

// Bind tableId from Pinia session
const tableId = computed(() => orderStore.activeTableId);

const deliveryFee = 2.00; // Mock fee or from config

const tax = computed(() => {
  return cartStore.totalPrice * 0.08;
});

const grandTotal = computed(() => {
  return cartStore.totalPrice + deliveryFee + tax.value;
});

const sessionTotal = computed(() => {
  if (!orderStore.activeTableOrders) return 0;
  return orderStore.activeTableOrders.reduce((sum: number, order: any) => sum + Number(order.totalAmount || 0), 0);
});

const handleCheckout = async () => {
  if (cartStore.items.length === 0) return;
  if (!tableId.value) {
    toast.error('Please scan a QR code to bind your table before checkout.');
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
    
    // Call the API via Order Store
    const createdOrder = await orderStore.placeOrder(orderData);
    
    // Clear the cart purely locally 
    cartStore.clearCart();
    
    // Refresh the Active Orders session tab entirely via Network without Page dropping UI
    await orderStore.fetchActiveTableOrders(tableId.value);
    toast.success('Order sent to kitchen!');
  } catch (error) {
    toast.error('Failed to place order. Please try again.');
  }
};
</script>

<template>
  <div class="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark group/design-root overflow-x-hidden max-w-2xl mx-auto shadow-xl">
    
    <!-- Top App Bar -->
    <div class="sticky top-0 z-10 flex items-center bg-white/80 dark:bg-background-dark/80 backdrop-blur-md p-4 pb-2 justify-between border-b border-slate-200 dark:border-slate-800">
      <div 
        @click="router.push('/customer')"
        class="text-slate-900 dark:text-slate-100 flex size-12 shrink-0 items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors justify-center"
      >
        <span class="material-symbols-outlined">arrow_back</span>
      </div>
      <h2 class="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">
         Bàn số: {{ activeTable ? activeTable.name.replace('Table', '').trim() : (tableId || '?') }}
      </h2>
    </div>

    <!-- No Table Warning (Strict Enforcement) -->
    <div v-if="!orderStore.activeTableId" class="flex flex-col items-center justify-center p-8 mt-20 text-center h-full my-auto">
      <div class="w-24 h-24 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-6">
        <span class="material-symbols-outlined text-5xl">qr_code_scanner</span>
      </div>
      <h3 class="text-xl font-bold mb-2">QR Code Required</h3>
      <p class="text-slate-500 mb-8">Please scan the physical QR code located at your table to access your cart and place orders.</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="cartStore.items.length === 0 && orderStore.activeTableOrders.length === 0" class="flex-1 flex flex-col items-center justify-center p-8 mt-20 text-center">
      <div class="w-24 h-24 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mb-6">
        <span class="material-symbols-outlined text-5xl">shopping_cart</span>
      </div>
      <h3 class="text-xl font-bold mb-2">Your cart is empty</h3>
      <p class="text-slate-500 mb-8">Looks like you haven't added anything to your cart yet.</p>
      <button 
        @click="router.push('/customer')"
        class="bg-primary text-white font-bold py-3 px-8 rounded-xl hover:bg-primary/90 transition-colors"
      >
        Browse Menu
      </button>
    </div>

    <!-- Populated Cart -->
    <template v-else>
      <div class="flex-1 overflow-y-auto">
        <!-- Delivery Address / Table Section -->
        <div class="p-4 bg-white dark:bg-background-dark mb-2 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Dining at</span>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span class="material-symbols-outlined">table_restaurant</span>
            </div>
            <div class="flex-1">
              <p class="text-sm font-bold">Table {{ tableId || '?' }}</p>
              <p class="text-xs text-slate-500">Active Session</p>
            </div>
            <div v-if="sessionTotal > 0" class="text-right">
              <p class="text-[10px] uppercase font-bold text-slate-500 mb-0.5 tracking-wider">Tổng tạm tính bàn</p>
              <p class="text-primary font-black">{{ formatCurrency(sessionTotal) }}</p>
            </div>
          </div>
        </div>

        <!-- Active Orders Section (Tab) -->
        <div v-if="orderStore.activeTableOrders.length > 0" class="p-6 bg-white dark:bg-background-dark mb-2 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-slate-900 dark:text-slate-100 text-base font-bold uppercase tracking-wider text-xs text-slate-500">Your Active Tab</h3>
            <span class="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-md">{{ orderStore.activeTableOrders.length }} Orders</span>
          </div>
          
          <div class="space-y-4">
            <div v-for="order in orderStore.activeTableOrders" :key="order.id" class="p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50">
               <div class="flex justify-between items-center mb-2">
                 <span class="text-xs font-bold text-slate-500">Order #{{ order.id.substring(0,6) }}</span>
                 <span class="text-xs font-bold uppercase" :class="order.status === 'ready' ? 'text-emerald-500' : 'text-primary'">{{ order.status.replace('_', ' ') }}</span>
               </div>
               <div v-for="item in order.items" :key="item.id" class="flex justify-between text-sm py-1 border-b border-slate-100 border-dashed dark:border-slate-800 last:border-0">
                 <span class="font-medium">{{ item.quantity }}x {{ item.name || item.menuItem?.name || 'Item' }}</span>
                 <span class="text-slate-500">{{ formatCurrency(item.price * item.quantity) }}</span>
               </div>
            </div>
          </div>
          
          <div class="flex gap-3 mt-6">
            <button @click="handleCallWaiter" :disabled="isCallingWaiter" class="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors disabled:opacity-50">
               <span class="material-symbols-outlined text-sm">room_service</span> Waiter
            </button>
            <button @click="handleRequestPayment" :disabled="isRequestingPayment" class="flex-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
               <span class="material-symbols-outlined text-sm">payments</span> Pay Bill
            </button>
          </div>
        </div>

        <div v-if="cartStore.items.length === 0 && orderStore.activeTableOrders.length > 0" class="p-8 text-center flex flex-col items-center pb-32">
          <p class="text-slate-500 mb-6">Your shopping cart is empty. Would you like to order more?</p>
          <button 
            @click="router.push('/customer')"
            class="bg-primary text-white font-bold py-3 px-8 rounded-xl hover:bg-primary/90 transition-colors"
          >
            Browse Menu
          </button>
        </div>

        <!-- Sticky Chat Interface Box -->
        <ChatBox v-if="tableId" :tableId="tableId" class="mx-4 mb-4" />

        <!-- Cart Items Section -->
        <div class="bg-white dark:bg-background-dark">
          <CartItem 
            v-for="item in cartStore.items" 
            :key="item.id" 
            :item="item" 
          />
        </div>

        <!-- Promo Code Section -->
        <div class="p-4 mt-2 bg-white dark:bg-background-dark border-y border-slate-100 dark:border-slate-800">
          <div class="relative">
            <input class="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-xl py-3 px-4 pr-24 text-sm focus:ring-2 focus:ring-primary/50" placeholder="Promo code" type="text"/>
            <button class="absolute right-2 top-1.5 bottom-1.5 px-4 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors">Apply</button>
          </div>
        </div>

        <!-- Summary Section -->
        <div class="p-6 bg-white dark:bg-background-dark mt-2 pb-32">
          <h3 class="text-slate-900 dark:text-slate-100 text-base font-bold mb-4 uppercase tracking-wider text-xs text-slate-500">Order Summary</h3>
          <div class="space-y-3">
            <div class="flex justify-between">
              <p class="text-slate-500 dark:text-slate-400 text-sm">Subtotal</p>
              <p class="text-slate-900 dark:text-slate-100 text-sm font-bold">{{ formatCurrency(cartStore.totalPrice) }}</p>
              <p class="text-slate-500 dark:text-slate-400 text-sm">Service Fee</p>
              <p class="text-slate-900 dark:text-slate-100 text-sm font-bold">{{ formatCurrency(deliveryFee) }}</p>
            </div>
            <div class="flex justify-between">
              <p class="text-slate-500 dark:text-slate-400 text-sm">Tax (8%)</p>
              <p class="text-slate-900 dark:text-slate-100 text-sm font-bold">{{ formatCurrency(tax) }}</p>
            </div>
            <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <p class="text-slate-900 dark:text-slate-100 text-lg font-bold">Total</p>
              <p class="text-primary text-xl font-extrabold">{{ formatCurrency(grandTotal) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Sticky Checkout Action (Only if Cart is Populated) -->
      <div v-if="cartStore.items.length > 0" class="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto p-4 bg-white/90 dark:bg-background-dark/90 backdrop-blur-lg border-t border-slate-100 dark:border-slate-800 z-20">
        <div class="flex flex-col gap-3">
          <button 
            @click="handleCheckout"
            :disabled="orderStore.loading || !tableId"
            class="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="orderStore.loading" class="material-symbols-outlined animate-spin">refresh</span>
            <span v-else>Checkout • {{ formatCurrency(grandTotal) }}</span>
            <span v-if="!orderStore.loading" class="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>
    </template>
    
  </div>
</template>
