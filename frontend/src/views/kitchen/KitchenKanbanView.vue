<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useOrderStore } from '@/stores/order.store';
import { socketService } from '@/services/socket';
import { toast } from 'vue3-toastify';

const orderStore = useOrderStore();

const fetchData = async () => {
  await orderStore.fetchOrderHistory();
};

onMounted(async () => {
  await fetchData();
  
  // Realtime Socket Connection
  socketService.connect();
  socketService.joinKitchen();
  
  socketService.onOrderConfirmed((payload) => {
    fetchData(); // Ensure full hydration
  });
  
  socketService.onOrderUpdated((payload) => {
    fetchData();
  });

  socketService.on('tableUpdated', () => {
    fetchData();
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

// Simplified Rule: One state. Orders mapped from 'confirmed' wait to be completed.
// We display 'confirmed', 'preparing', 'ready' all in one view essentially, but we can just filter by active states.
const activeKitchenOrders = computed(() => {
  return orderStore.orderHistory.filter(o => 
    ['confirmed', 'preparing', 'ready'].includes(o.status)
  );
});

const updateStatus = async (orderId: string, newStatus: string) => {
  try {
    await orderStore.updateOrderStatus(orderId, newStatus);
    await fetchData();
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
        <h1 class="text-xl font-bold tracking-tight">Kitchen Orders (Simplified)</h1>
        <div class="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Live
        </div>
      </div>
      <div class="text-sm text-slate-500 font-medium">
        {{ activeKitchenOrders.length }} Active Orders
      </div>
    </header>

    <!-- Unified Order Grid -->
    <main class="flex-1 overflow-y-auto p-6">
      <div v-if="activeKitchenOrders.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
        <span class="material-symbols-outlined text-4xl mb-4 text-emerald-500/50">soup_kitchen</span>
        <p class="text-lg font-bold text-slate-600 dark:text-slate-300">Kitchen is clear</p>
        <p class="text-sm">Waiting for new orders...</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div 
          v-for="order in activeKitchenOrders" 
          :key="order.id"
          class="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border-2 border-slate-200 dark:border-slate-800 flex flex-col"
        >
          <div class="flex justify-between items-start mb-4">
            <span class="text-xs font-bold text-orange-500 uppercase">{{ new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
            <span class="text-xs font-medium text-slate-400">#{{ order.id.slice(0, 8) }}</span>
          </div>
          
          <h4 class="text-2xl font-black mb-4 text-primary">Table {{ order.table?.number || order.table?.name?.replace('Table', '') || order.tableId }}</h4>
          
          <div class="space-y-3 mb-6 flex-1">
            <div v-for="item in order.items" :key="item.id" class="flex flex-col border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0 last:pb-0">
              <p class="text-base text-slate-900 dark:text-slate-100 flex justify-between font-bold">
                <span>{{ item.quantity }}x {{ item.menuItem?.name || item.name || 'Item' }}</span>
              </p>
              <p v-if="item.note" class="text-sm text-red-500 font-medium italic mt-1 bg-red-50 dark:bg-red-900/10 p-1.5 rounded">
                Ghi chú: {{ item.note }}
              </p>
            </div>
          </div>

          <button 
            @click="updateStatus(order.id, 'completed')"
            class="w-full py-4 bg-primary text-white hover:bg-primary/90 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            <span>DONE</span>
            <span class="material-symbols-outlined pb-0.5">check_circle</span>
          </button>
        </div>
      </div>
    </main>

  </div>
</template>
