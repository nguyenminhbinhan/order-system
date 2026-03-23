<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { tableService } from '@/services/table.service';
import { orderService } from '@/services/order.service';
import { socketService } from '@/services/socket';
import { toast } from 'vue3-toastify';
import ChatModal from '@/components/service/ChatModal.vue';

const tables = ref<any[]>([]);
const activeOrders = ref<any[]>([]);
const loading = ref(true);

const selectedTable = ref<any>(null);
const selectedOrder = ref<any>(null);
const showModal = ref(false);
const showPaymentModal = ref(false);
const isProcessingPayment = ref(false);
const isConfirmingOrder = ref(false);

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
};

const chatTableId = ref<number | null>(null);
const chatTableName = ref('');
const notifications = ref<Record<number, { unreadCount: number, lastType: string, lastMessage: string }>>({});

const openChat = (tableId: number, tableName: string) => {
  chatTableId.value = tableId;
  chatTableName.value = tableName;
  if (notifications.value[tableId]) {
    notifications.value[tableId].unreadCount = 0;
  }
};

const handleTableClickEvent = (tableId: number) => {
  if (notifications.value[tableId]) {
    notifications.value[tableId].unreadCount = 0;
  }
  openTableModal(tableId);
};

const fetchData = async () => {
  loading.value = true;
  try {
    const [tablesData, ordersData] = await Promise.all([
      tableService.getTables(),
      orderService.getOrders()
    ]);
    tables.value = tablesData;
    activeOrders.value = ordersData.filter((o: any) => !['completed', 'cancelled'].includes(o.status));
  } catch (error) {
    console.error('Failed to fetch dashboard data', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchData();

  socketService.connect();
  socketService.joinService(); // Waiters join the service room

  socketService.onNewOrderCreated((order) => {
    activeOrders.value.push(order);
    const tbl = tables.value.find(t => t.id === order.tableId);
    if (tbl) tbl.status = 'waiting_confirmation';
  });

  socketService.onOrderUpdated((payload) => {
    const index = activeOrders.value.findIndex(o => o.id === payload.id);
    if (index !== -1) {
      if (['completed', 'cancelled'].includes(payload.status)) {
        activeOrders.value.splice(index, 1);
        const tbl = tables.value.find(t => t.id === payload.tableId);
        if (tbl && payload.status === 'completed') {
           tbl.status = 'empty';
           if (notifications.value[tbl.id]) {
             notifications.value[tbl.id] = { unreadCount: 0, lastType: '', lastMessage: '' };
           }
        }
      } else {
        activeOrders.value[index] = payload;
      }
    }
  });

  socketService.on('tableNotification', (data) => {
    if (!notifications.value[data.tableId]) {
      notifications.value[data.tableId] = { unreadCount: 0, lastType: '', lastMessage: '' };
    }
    
    if (chatTableId.value !== data.tableId) {
      notifications.value[data.tableId].unreadCount++;
    }
    
    notifications.value[data.tableId].lastType = data.type;
    notifications.value[data.tableId].lastMessage = data.message;
    
    const tableContext = tables.value.find(t => t.id === data.tableId);
    const tableName = tableContext ? tableContext.name.replace('Table', '').trim() : data.tableId;
    toast.info(`Bàn ${tableName}: ${data.message}`, { autoClose: 3000, theme: 'colored' });
  });
});

onUnmounted(() => {
  socketService.offNewOrderCreated();
  socketService.offOrderUpdated();
  socketService.off('tableNotification');
  socketService.leaveService();
});

// Computed properties for Table Grid
const displayTables = computed(() => {
  return tables.value.map(table => {
    // Find highest priority active order for this table
    const tableOrders = activeOrders.value.filter(o => o.tableId === table.id);
    const activeOrder = tableOrders.length > 0 ? tableOrders[0] : null;

    let colorClass, badgeClass, statusText, icon;

    const hasWaitingConfirm = tableOrders.some(o => o.status === 'pending_confirmation');

    if (hasWaitingConfirm) {
      colorClass = 'bg-white dark:bg-slate-900 border-2 border-yellow-500/30 hover:border-yellow-500';
      badgeClass = 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
      statusText = 'Needs Confirm';
      icon = 'notifications_active';
    } else if (table.status === 'occupied' || table.status === 'needs_payment') {
      if (table.status === 'needs_payment') {
        colorClass = 'bg-purple-600 text-white shadow-lg shadow-purple-600/20';
        badgeClass = 'bg-white/20 text-white';
        statusText = 'Payment Due';
        icon = 'payments';
      } else {
        colorClass = 'bg-red-500 text-white shadow-lg shadow-red-500/20';
        badgeClass = 'bg-white/20 text-white';
        statusText = 'Occupied';
        icon = 'restaurant';
      }
    } else {
      colorClass = 'bg-white dark:bg-slate-900 border-2 border-green-500/30 hover:border-green-500';
      badgeClass = 'bg-green-500/10 text-green-500';
      statusText = 'Available';
      icon = 'check_circle';
    }

    return {
      ...table,
      activeOrder,
      colorClass,
      badgeClass,
      statusText,
      icon,
      guestCount: 2 // Mock generic data
    };
  });
});

const stats = computed(() => {
  return {
    available: tables.value.filter(t => t.status === 'empty').length,
    occupied: tables.value.filter(t => ['occupied', 'needs_payment'].includes(t.status)).length,
    waiting: tables.value.filter(t => {
      const tableOrders = activeOrders.value.filter(o => o.tableId === t.id);
      return tableOrders.some(o => o.status === 'pending_confirmation');
    }).length,
  };
});

const openTableModal = (tableId: number) => {
  const table = displayTables.value.find(t => t.id === tableId);
  if (table) {
    selectedTable.value = table;
    selectedOrder.value = table.activeOrder;
    showModal.value = true;
  }
};

const handleConfirmOrder = async () => {
  if (!selectedOrder.value || isConfirmingOrder.value) return;
  
  isConfirmingOrder.value = true;
  try {
    await orderService.updateOrder(selectedOrder.value.id, { status: 'confirmed' });
    showModal.value = false;
    fetchData();
    toast.success('Order confirmed and sent to Kitchen');
  } catch (error) {
    toast.error('Failed to confirm order.');
  } finally {
    isConfirmingOrder.value = false;
  }
};

const openPaymentModal = () => {
  showPaymentModal.value = true;
};

const confirmAndProcessPayment = async () => {
  if (!selectedOrder.value) return;
  
  isProcessingPayment.value = true;

  try {
    await orderService.updateOrder(selectedOrder.value.id, { status: 'completed' });
    showPaymentModal.value = false;
    showModal.value = false;
    fetchData();
    toast.success('Payment completed. Table is now available.');
  } catch (error) {
    toast.error('Failed to process payment.');
  } finally {
    isProcessingPayment.value = false;
  }
};

</script>

<template>
  <div class="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 antialiased font-display max-w-[1600px] mx-auto">
    
    <!-- Header -->
    <header class="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
      <div class="flex items-center p-4 justify-between max-w-7xl mx-auto w-full">
        <div class="flex items-center gap-3">
          <div class="bg-primary/10 p-2 rounded-lg text-primary">
            <span class="material-symbols-outlined">grid_view</span>
          </div>
          <h2 class="text-xl font-bold leading-tight tracking-tight">Table Management</h2>
        </div>
        <div class="flex items-center gap-2">
          <button @click="fetchData" class="flex size-10 items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <span class="material-symbols-outlined" :class="{ 'animate-spin': loading }">refresh</span>
          </button>
        </div>
      </div>
      
      <!-- Tab Navigation -->
      <div class="px-4 max-w-7xl mx-auto w-full">
        <div class="flex gap-6 overflow-x-auto no-scrollbar">
          <a class="flex flex-col items-center justify-center border-b-2 border-primary text-primary pb-3 pt-2 whitespace-nowrap" href="#">
            <p class="text-sm font-bold">All Tables</p>
          </a>
          <a class="flex flex-col items-center justify-center border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 pb-3 pt-2 whitespace-nowrap" href="#">
            <p class="text-sm font-bold">Available ({{ stats.available }})</p>
          </a>
          <a class="flex flex-col items-center justify-center border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 pb-3 pt-2 whitespace-nowrap" href="#">
            <p class="text-sm font-bold">Occupied/Paying ({{ stats.occupied }})</p>
          </a>
          <a class="flex flex-col items-center justify-center border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 pb-3 pt-2 whitespace-nowrap" href="#">
            <p class="text-sm font-bold">Waiting Confirm ({{ stats.waiting }})</p>
          </a>
        </div>
      </div>
    </header>

    <!-- Main Grid -->
    <main class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div v-if="loading && tables.length === 0" class="flex flex-col items-center justify-center p-12 text-slate-500">
        <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        Loading tables...
      </div>
      
      <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        
        <div 
          v-for="table in displayTables" 
          :key="table.id"
          @click="handleTableClickEvent(table.id)"
          :class="['group relative flex flex-col rounded-xl p-4 aspect-square justify-between cursor-pointer transition-all', table.colorClass]"
        >
          <div class="flex justify-between items-start z-10">
            <span class="text-3xl font-black tracking-tighter">{{ table.name.replace('Table', '').trim() || table.id }}</span>
            <div class="flex flex-col items-end gap-1">
              <div :class="['px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest', table.badgeClass]">
                {{ table.statusText }}
              </div>
              <div v-if="notifications[table.id] && notifications[table.id].unreadCount > 0" class="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm">
                 <span class="material-symbols-outlined text-[12px]">notifications_active</span>
                 <span>{{ notifications[table.id].unreadCount }}</span>
              </div>
            </div>
          </div>
          
          <div class="z-10">
            <div class="flex items-center gap-1.5 mb-1" :class="{ 'text-slate-500 dark:text-slate-400': !table.colorClass.includes('text-white') }">
              <span class="material-symbols-outlined text-sm">groups</span>
              <span class="text-sm font-bold">{{ table.guestCount }} Persons</span>
            </div>
            <div class="flex items-center gap-1.5" :class="{ 'text-slate-400 dark:text-slate-500': !table.colorClass.includes('text-white') }">
              <span class="material-symbols-outlined text-sm">{{ table.icon }}</span>
              <span class="text-sm font-medium">{{ table.activeOrder ? `Ord #${table.activeOrder.id.substring(0,6)}` : 'Ready to seat' }}</span>
            </div>
            
            <button @click.stop="openChat(table.id, table.name)" class="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all w-full justify-center relative shadow-sm border" :class="table.colorClass.includes('text-white') ? 'bg-white/20 hover:bg-white/30 border-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 border-slate-200 text-slate-700 dark:text-slate-300'">
               <span class="material-symbols-outlined text-sm">chat</span>
               Open Chat
               <span v-if="notifications[table.id] && notifications[table.id].unreadCount > 0" class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
                 <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                 <span class="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-[9px] font-bold items-center justify-center">{{ notifications[table.id].unreadCount }}</span>
               </span>
            </button>
          </div>
          
          <div v-if="table.colorClass.includes('text-white')" class="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
            <span class="material-symbols-outlined text-9xl">restaurant</span>
          </div>
        </div>

      </div>
    </main>

    <!-- Modal for Waiter Actions -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div class="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <!-- Modal Header -->
        <div class="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 class="text-2xl font-bold">{{ selectedTable?.name }}</h3>
            <p class="text-sm text-slate-500">{{ selectedTable?.statusText }}</p>
          </div>
          <button @click="showModal = false" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <!-- Modal Body (Orders) -->
        <div class="p-6 overflow-y-auto max-h-[60vh]">
          <div v-if="!selectedOrder" class="text-center text-slate-500 p-8">
            <span class="material-symbols-outlined text-4xl mb-2">event_seat</span>
            <p>Table is currently empty.</p>
          </div>
          <div v-else>
            <div class="flex justify-between items-center mb-4">
              <h4 class="font-bold">Order #{{ selectedOrder.id.substring(0,8) }}</h4>
              <span class="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-bold uppercase">{{ selectedOrder.status }}</span>
            </div>
            
            <div class="space-y-3 mb-6">
              <div v-for="item in selectedOrder.items" :key="item.id" class="flex justify-between items-start pb-3 border-b border-slate-50 dark:border-slate-800/50">
                <div>
                  <p class="font-bold text-sm">{{ item.quantity }}x {{ item.name || item.menuItem?.name || 'Item' }}</p>
                  <p v-if="item.note" class="text-xs text-red-500 font-semibold flex items-center gap-1 mt-0.5">
                    <span class="material-symbols-outlined text-[12px]">warning</span> {{ item.note }}
                  </p>
                </div>
                <span class="text-sm font-bold text-slate-600 dark:text-slate-400">{{ formatCurrency(item.price * item.quantity) }}</span>
              </div>
            </div>
            
            <div class="flex justify-between items-center text-xl font-black">
              <span>Total</span>
              <span class="text-primary">{{ formatCurrency(selectedOrder.totalAmount) }}</span>
            </div>
          </div>
        </div>

        <!-- Modal Actions -->
        <div v-if="selectedOrder" class="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 gap-2">
          
          <button 
            v-if="selectedTable?.status === 'waiting_confirmation'" 
            @click="handleConfirmOrder"
            :disabled="isConfirmingOrder"
            class="w-full py-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isConfirmingOrder" class="material-symbols-outlined animate-spin text-sm">autorenew</span>
            <span v-else class="material-symbols-outlined">thumb_up</span> 
            {{ isConfirmingOrder ? 'Confirming...' : 'Confirm Order & Send to Kitchen' }}
          </button>

          <button 
            v-else-if="selectedOrder.status === 'ready' || selectedTable?.status === 'needs_payment'" 
            @click="openPaymentModal"
            class="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <span class="material-symbols-outlined">payments</span> Process Payment
          </button>

          <div v-else class="w-full py-4 bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-xl font-bold flex items-center justify-center gap-2 cursor-not-allowed">
            <span class="material-symbols-outlined">hourglass_empty</span> Kitchen is Processing...
          </div>

        </div>
      </div>
    </div>

    <!-- Final Payment Confirmation Modal -->
    <div v-if="showPaymentModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div class="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col transform scale-100 animate-in zoom-in-95 duration-200">
        <div class="p-6 text-center">
          <div class="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 mx-auto rounded-full flex items-center justify-center mb-4">
            <span class="material-symbols-outlined text-3xl">payments</span>
          </div>
          <h3 class="text-2xl font-black text-slate-900 dark:text-slate-100 mb-1">Confirm Payment</h3>
          <p class="text-slate-500 text-sm">Review the items before clearing the table.</p>
        </div>

        <div class="bg-slate-50 dark:bg-slate-800/50 p-6 mx-4 rounded-xl mb-4">
          <div class="flex justify-between items-center mb-3 text-sm text-slate-500">
            <span>{{ selectedOrder?.items?.length || 0 }} Items</span>
            <span>Table {{ selectedTable?.name.replace('Table', '').trim() }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-lg font-bold">Total Amount:</span>
            <span class="text-2xl font-black text-primary">{{ formatCurrency(selectedOrder?.totalAmount) }}</span>
          </div>
        </div>

        <div class="p-4 flex gap-3 border-t border-slate-100 dark:border-slate-800">
          <button 
            @click="showPaymentModal = false" 
            :disabled="isProcessingPayment"
            class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            @click="confirmAndProcessPayment" 
            :disabled="isProcessingPayment"
            class="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isProcessingPayment" class="material-symbols-outlined animate-spin text-sm">autorenew</span>
            <span v-else class="material-symbols-outlined text-sm">check_circle</span>
            {{ isProcessingPayment ? 'Processing...' : 'Confirm' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Live Waiter Chat Interface -->
    <ChatModal v-if="chatTableId" :tableId="chatTableId" :tableName="chatTableName" @close="chatTableId = null" />

  </div>
</template>
