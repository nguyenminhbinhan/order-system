<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useOrderStore } from '@/stores/order.store';
import { socketService } from '@/services/socket';
import { toast } from 'vue3-toastify';

const orderStore = useOrderStore();

onMounted(async () => {
  await orderStore.fetchOrderHistory();
  
  // Realtime Socket Connection
  socketService.connect();
  socketService.joinKitchen();
  
  // Remove verbose logs
  socketService.onOrderConfirmed((payload) => {
    orderStore.fetchOrderHistory(); // Ensure full hydration
  });
  
  // Remove verbose logs
  socketService.onOrderUpdated((payload) => {
    const index = orderStore.orderHistory.findIndex(o => o.id === payload.id);
    if (index !== -1) {
      orderStore.orderHistory[index].status = payload.status;
    } else {
      // It might be a newly transitioned order we don't have yet locally
      orderStore.fetchOrderHistory();
    }
  });
});

onUnmounted(() => {
  socketService.offOrderConfirmed();
  socketService.offOrderUpdated();
  socketService.disconnect();
});

const getOrdersByStatus = (status: string) => {
  return orderStore.orderHistory.filter(o => o.status === status);
};

const pendingOrders = computed(() => getOrdersByStatus('confirmed'));
const preparingOrders = computed(() => getOrdersByStatus('preparing'));
const readyOrders = computed(() => getOrdersByStatus('ready'));

const updateStatus = async (orderId: string, newStatus: string) => {
  try {
    // Note: Depends on updateOrderStatus in orderService returning the updated order
    await orderStore.updateOrderStatus(orderId, newStatus);
    
    // We optionally don't need to manually update local state if the socket broadcast bounces back, 
    // but updating locally first makes the UI feel instantly responsive (optimistic UI).
    const index = orderStore.orderHistory.findIndex(o => o.id === orderId);
    if (index !== -1) {
      orderStore.orderHistory[index].status = newStatus;
    }
  } catch (err) {
    console.error('Failed to update status', err);
    toast.error('Failed to update status. Please try again.');
  }
};
</script>

<template>
  <div class="h-screen flex flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display overflow-hidden">
    
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold tracking-tight">Kitchen Orders</h1>
        <div class="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Live
        </div>
      </div>
      <div class="text-sm text-slate-500 font-medium">
        {{ pendingOrders.length }} Pending • {{ preparingOrders.length }} Preparing
      </div>
    </header>

    <!-- Kanban Board -->
    <main class="flex-1 overflow-x-auto overflow-y-hidden p-6">
      <div class="flex h-full gap-6 min-w-max">
        
        <!-- PENDING COLUMN -->
        <div class="flex flex-col w-[350px] bg-slate-100/50 dark:bg-slate-800/20 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0">
          <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/50">
            <h2 class="font-bold flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-orange-500"></span>
              Pending
            </h2>
            <span class="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold px-2 py-1 rounded-md">{{ pendingOrders.length }}</span>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <!-- Cards -->
            <div 
              v-for="order in pendingOrders" 
              :key="order.id"
              class="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 cursor-pointer hover:shadow-md transition-shadow group border-l-4 border-l-transparent hover:border-l-orange-500"
            >
              <div class="flex justify-between items-start mb-3">
                <span class="text-xs font-bold text-orange-500 uppercase">Wait: {{ new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
                <span class="text-xs font-medium text-slate-400">#{{ order.id.slice(0, 8) }}</span>
              </div>
              <h4 class="text-xl font-extrabold mb-1">Table {{ order.table?.number || order.tableId }}</h4>
              <div class="space-y-1 mb-4">
                <p v-for="item in order.items" :key="item.id" class="text-sm text-slate-600 dark:text-slate-400 flex justify-between">
                  <span>{{ item.quantity }}x {{ item.menuItem?.name || 'Item' }}</span>
                  <span v-if="item.note" class="material-symbols-outlined text-xs text-red-500" title="Has Note">warning</span>
                </p>
              </div>
              <button 
                @click="updateStatus(order.id, 'preparing')"
                class="w-full py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                <span>Start Preparing</span>
                <span class="material-symbols-outlined text-sm">play_arrow</span>
              </button>
            </div>
            <div v-if="pendingOrders.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <span class="material-symbols-outlined text-4xl mb-2">inbox</span>
              <p class="text-sm font-medium">No pending orders</p>
            </div>
          </div>
        </div>

        <!-- PREPARING COLUMN -->
        <div class="flex flex-col w-[350px] bg-slate-100/50 dark:bg-slate-800/20 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0">
          <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/50">
            <h2 class="font-bold flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-primary animate-pulse"></span>
              Preparing
            </h2>
            <span class="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-bold">{{ preparingOrders.length }}</span>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <!-- Cards -->
            <div 
              v-for="order in preparingOrders" 
              :key="order.id"
              class="bg-white dark:bg-slate-900 border-l-4 border-l-primary border-y border-r border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm"
            >
              <div class="flex justify-between items-start mb-3">
                <span class="text-xs font-bold text-primary uppercase">Prep: {{ new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
                <span class="text-xs font-medium text-slate-400">#{{ order.id.slice(0, 8) }}</span>
              </div>
              <h4 class="text-xl font-extrabold mb-1">Table {{ order.table?.number || order.tableId }}</h4>
              
              <div class="space-y-1 mb-4">
                <p v-for="item in order.items" :key="item.id" class="text-sm text-slate-600 dark:text-slate-400 flex justify-between">
                  <span><span class="font-bold">{{ item.quantity }}x</span> {{ item.menuItem?.name || 'Item' }}</span>
                </p>
              </div>

              <button 
                @click="updateStatus(order.id, 'ready')"
                class="w-full py-2 bg-primary text-white hover:bg-primary/90 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                <span>Mark Ready</span>
                <span class="material-symbols-outlined text-sm">check_circle</span>
              </button>
            </div>
            <div v-if="preparingOrders.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <span class="material-symbols-outlined text-4xl mb-2">soup_kitchen</span>
              <p class="text-sm font-medium">Kitchen is clear</p>
            </div>
          </div>
        </div>
        
        <!-- READY COLUMN -->
        <div class="flex flex-col w-[350px] bg-slate-100/50 dark:bg-slate-800/20 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0 opacity-70">
          <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/50">
            <h2 class="font-bold flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-green-500"></span>
              Ready
            </h2>
            <span class="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs px-2 py-0.5 rounded-full font-bold">{{ readyOrders.length }}</span>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <!-- Cards -->
            <div 
              v-for="order in readyOrders" 
              :key="order.id"
              class="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800"
            >
              <div class="flex justify-between items-start mb-3">
                <span class="text-xs font-bold text-green-500 uppercase">Ready: {{ new Date(order.updatedAt || order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
                <span class="text-xs font-medium text-slate-400">#{{ order.id.slice(0, 8) }}</span>
              </div>
              <h4 class="text-xl font-extrabold mb-1">Table {{ order.table?.number || order.tableId }}</h4>
              
              <div class="space-y-1 mb-4">
                <p v-for="item in order.items" :key="item.id" class="text-sm text-slate-600 dark:text-slate-400 line-through">
                  {{ item.quantity }}x {{ item.menuItem?.name || 'Item' }}
                </p>
              </div>
              <div class="flex items-center justify-center bg-green-500/10 text-green-600 py-2 rounded-lg text-sm font-bold gap-2">
                <span class="material-symbols-outlined text-[18px]">done_all</span> Waiting for Waiter Pickup
              </div>
            </div>
             <div v-if="readyOrders.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <span class="material-symbols-outlined text-4xl mb-2">done_all</span>
              <p class="text-sm font-medium">No completed orders yet</p>
            </div>
          </div>
        </div>

      </div>
    </main>

  </div>
</template>
