<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useOrderStore } from '@/stores/order.store';
import { useCartStore } from '@/stores/cart.store';
import { socketService } from '@/services/socket';
import ThankYouOverlay from '@/components/customer/ThankYouOverlay.vue';

const showThankYou = ref(false);

const route = useRoute();
const router = useRouter();
const orderStore = useOrderStore();
const cartStore = useCartStore();

const orderId = route.params.id as string;
const orderData = ref<any>(null);
const loading = ref(true);
const error = ref('');

const fetchOrder = async () => {
  try {
    const data = await orderStore.fetchOrderById(orderId);
    orderData.value = data;
    if (data.status === 'completed' || data.status === 'cancelled') {
        orderStore.clearOrderId();
        orderStore.clearTableId();
    }
    loading.value = false;
  } catch (err: any) {
    error.value = 'Failed to load order details. It may not exist.';
    orderStore.clearOrderId();
    loading.value = false;
  }
};

onMounted(() => {
  fetchOrder();
  
  // Realtime Socket Connection
  socketService.connect();
  socketService.joinCustomer(orderId);
  
  socketService.onOrderUpdated((payload) => {
    if (orderData.value && orderData.value.id === payload.orderId) {
      orderData.value.status = payload.status;
      if (payload.status === 'completed' || payload.status === 'cancelled') {
         orderStore.clearOrderId();
         orderStore.clearTableId();
      }
    }
  });

  // Listen for payment completion
  socketService.on('paymentCompleted', (payload: any) => {
    if (orderData.value && Number(payload.tableId) === Number(orderData.value.tableId)) {
      showThankYou.value = true;
    }
  });
});

onUnmounted(() => {
  socketService.offOrderUpdated();
  socketService.off('paymentCompleted');
  socketService.disconnect();
});

const handleSessionEnd = () => {
  cartStore.clearCart();
  orderStore.clearTableId();
  orderStore.clearOrderId();
  // Stay on terminal screen — do NOT redirect
};

const handleRestart = () => {
  const tableId = orderData.value?.tableId;
  cartStore.clearCart();
  orderStore.clearTableId();
  orderStore.clearOrderId();
  showThankYou.value = false;
  if (tableId) {
    window.location.href = `/customer?tableId=${tableId}`;
  } else {
    window.location.href = '/';
  }
};

// Map status to UI elements
const statusInfo = computed(() => {
  const status = orderData.value?.status || 'pending';
  switch (status) {
    case 'pending': 
      return { text: 'Order Received', color: 'bg-slate-500', progress: 10, msg: 'Waiting for kitchen to accept.' };
    case 'preparing': 
      return { text: 'Preparing', color: 'bg-primary', progress: 50, msg: 'Chef is preparing your meal!' };
    case 'ready': 
      return { text: 'Ready for Pickup', color: 'bg-green-500', progress: 100, msg: 'Your food is ready!' };
    case 'completed': 
      return { text: 'Completed', color: 'bg-slate-800', progress: 100, msg: 'Order finished.' };
    case 'cancelled': 
      return { text: 'Cancelled', color: 'bg-red-500', progress: 0, msg: 'Order was cancelled.' };
    default: 
      return { text: 'Unknown', color: 'bg-slate-500', progress: 0, msg: '' };
  }
});
</script>

<template>
  <div class="max-w-md mx-auto min-h-screen flex flex-col bg-white dark:bg-slate-900 shadow-xl overflow-hidden relative">
    
    <!-- Header -->
    <header class="flex items-center px-4 py-6 justify-between border-b border-slate-100 dark:border-slate-800">
      <button 
        @click="router.push('/customer')"
        class="text-slate-900 dark:text-slate-100 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
      >
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <h1 class="text-lg font-bold tracking-tight">Order Tracking</h1>
      <div class="w-8"></div> <!-- Spacer for flex alignment -->
    </header>

    <main class="flex-1 overflow-y-auto">
      
      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center p-12">
        <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p class="mt-4 text-slate-500 font-medium">Loading your order...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center justify-center p-12 text-center">
        <span class="material-symbols-outlined text-red-500 text-5xl mb-4">error</span>
        <h3 class="text-xl font-bold mb-2">Order Not Found</h3>
        <p class="text-slate-500 mb-6">{{ error }}</p>
        <button 
          @click="router.push('/customer')"
          class="bg-primary text-white font-bold py-2 px-6 rounded-xl hover:bg-primary/90 transition-colors"
        >
          Return to Menu
        </button>
      </div>

      <!-- Order Tracking Data -->
      <template v-else-if="orderData">
        
        <!-- Order Status Card -->
        <div class="px-6 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div class="flex justify-between items-start mb-2">
            <div>
              <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Order #{{ orderData.id }}</p>
              <h2 class="text-2xl font-bold mt-1" :class="`text-${statusInfo.color.split('-')[1]}-500`">
                {{ statusInfo.text }}
              </h2>
            </div>
          </div>
          <div class="mt-8">
            <div class="flex justify-between items-center mb-3">
              <span class="text-sm font-semibold" :class="`text-${statusInfo.color.split('-')[1]}-500`">{{ statusInfo.text }}</span>
              <span class="text-sm font-bold">{{ statusInfo.progress }}%</span>
            </div>
            <div class="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
              <div 
                :class="['h-full rounded-full transition-all duration-500', statusInfo.color]" 
                :style="{ width: `${statusInfo.progress}%` }"
              ></div>
            </div>
            <p class="text-slate-500 dark:text-slate-400 text-xs mt-3 italic text-center">{{ statusInfo.msg }}</p>
          </div>
        </div>
        
        <!-- Items List -->
        <div class="px-6 py-6 border-t border-slate-100 dark:border-slate-800 pb-24">
          <h3 class="font-bold mb-4">Items in this order</h3>
          <div class="space-y-4">
            
            <div 
              v-for="item in orderData.items" 
              :key="item.id"
              class="flex items-center justify-between border-b pb-2 last:border-0 border-slate-50 dark:border-slate-800"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                  <span class="text-sm font-bold">{{ item.quantity }}×</span>
                </div>
                <div>
                  <p class="text-sm font-semibold">{{ item.menuItem?.name || 'Item' }}</p>
                  <p v-if="item.note" class="text-xs text-slate-500">Note: {{ item.note }}</p>
                </div>
              </div>
              <span class="text-sm font-bold">{{ new Intl.NumberFormat('vi-VN').format(Number(item.price) * item.quantity) }} ₫</span>
            </div>
            
            <div class="pt-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-700">
              <span class="font-bold text-lg">Total Amount</span>
              <span class="font-bold text-lg text-primary">{{ new Intl.NumberFormat('vi-VN').format(Number(orderData.totalAmount)) }} ₫</span>
            </div>

          </div>
        </div>
      </template>

    </main>

    <!-- Thank You Overlay -->
    <ThankYouOverlay 
      :visible="showThankYou" 
      @complete="handleSessionEnd" 
      @restart="handleRestart" 
    />
  </div>
</template>
