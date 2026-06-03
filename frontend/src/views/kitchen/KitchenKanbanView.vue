<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useOrderStore } from '@/stores/order.store';
import { socketService } from '@/services/socket';
import { useUserStore } from '@/stores/user.store';
import { useRouter } from 'vue-router';
import { toast } from 'vue3-toastify';
import { orderService } from '@/services/order.service';

const orderStore = useOrderStore();
const userStore = useUserStore();
const router = useRouter();

const activeTab = ref<'active' | 'history'>('active');
const now = ref(new Date());
let clockTimer: ReturnType<typeof setInterval> | null = null;

const fetchData = async () => {
  await orderStore.fetchOrderHistory(true);
};

onMounted(async () => {
  if (!userStore.isAuthenticated) {
    router.replace('/login');
    return;
  }
  await fetchData();
  
  socketService.connect();
  socketService.joinKitchen();
  
  socketService.onOrderConfirmed(() => fetchData());
  socketService.onOrderUpdated(() => fetchData());
  socketService.on('tableUpdated', () => fetchData());
  socketService.onItemStatusChanged(() => fetchData());
  socketService.on('paymentCompleted', () => fetchData());

  clockTimer = setInterval(() => { now.value = new Date(); }, 1000);
});

onUnmounted(() => {
  socketService.offOrderConfirmed();
  socketService.offOrderUpdated();
  socketService.off('tableUpdated');
  socketService.offItemStatusChanged();
  socketService.off('paymentCompleted');
  if (clockTimer) clearInterval(clockTimer);
});

// ===== KITCHEN KANBAN LAYOUT ITEMS =====
interface KitchenItem {
  id: string;
  orderId: string;
  tableName: string;
  name: string;
  quantity: number;
  note: string | null;
  status: string;
  createdAt: string;
  menuItem?: any;
}

const allActiveItems = computed((): KitchenItem[] => {
  const itemsList: KitchenItem[] = [];
  orderStore.orderHistory.forEach(order => {
    if (order.items) {
      order.items.forEach((item: any) => {
        if (['confirmed', 'preparing', 'ready'].includes(item.status)) {
          itemsList.push({
            id: item.id,
            orderId: order.id,
            tableName: getTableName(order),
            name: item.menuItem?.name || item.name,
            quantity: item.quantity,
            note: item.note,
            status: item.status,
            createdAt: order.createdAt,
            menuItem: item.menuItem,
          });
        }
      });
    }
  });
  return itemsList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
});

const confirmedItems = computed(() => allActiveItems.value.filter(i => i.status === 'confirmed'));
const preparingItems = computed(() => allActiveItems.value.filter(i => i.status === 'preparing'));
const readyItems = computed(() => allActiveItems.value.filter(i => i.status === 'ready'));

const isUpdatingStatus = ref<string | null>(null);

const handleUpdateItemStatus = async (orderId: string, itemId: string, newStatus: string, itemName: string) => {
  if (isUpdatingStatus.value === itemId) return;
  isUpdatingStatus.value = itemId;
  try {
    await orderService.updateItemStatus(orderId, itemId, newStatus);
    const labels: Record<string, string> = {
      preparing: 'Đang nấu',
      ready: 'Hoàn thành',
    };
    toast.success(`✅ ${itemName} — ${labels[newStatus] || 'Cập nhật thành công'}!`);
    await fetchData();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Lỗi cập nhật trạng thái');
  } finally {
    isUpdatingStatus.value = null;
  }
};

// ===== HISTORY (ready today) =====
const historyOrders = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return orderStore.orderHistory
    .filter(o => o.items && o.items.some((i: any) => i.status === 'ready') && new Date(o.updatedAt || o.createdAt) >= today)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
});

// ===== HISTORY: Table filter =====
const historyTableFilter = ref<number | null>(null);

const availableTables = computed(() => {
  const tableMap = new Map<number, string>();
  historyOrders.value.forEach(order => {
    const tid = order.tableId;
    if (!tableMap.has(tid)) {
      tableMap.set(tid, getTableName(order));
    }
  });
  return Array.from(tableMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => Number(a.name) - Number(b.name) || a.name.localeCompare(b.name));
});

const filteredHistoryOrders = computed(() => {
  if (!historyTableFilter.value) return historyOrders.value;
  return historyOrders.value.filter(o => o.tableId === historyTableFilter.value);
});

// ===== HISTORY: Group by table, then by time =====
interface HistoryTableGroup {
  tableId: number;
  tableName: string;
  timeGroups: Record<string, any[]>;
  totalItems: number;
}

const historyByTable = computed((): HistoryTableGroup[] => {
  const tableMap = new Map<number, HistoryTableGroup>();
  
  filteredHistoryOrders.value.forEach(order => {
    const tid = order.tableId;
    if (!tableMap.has(tid)) {
      tableMap.set(tid, {
        tableId: tid,
        tableName: getTableName(order),
        timeGroups: {},
        totalItems: 0,
      });
    }
    const group = tableMap.get(tid)!;
    const time = new Date(order.updatedAt || order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    if (!group.timeGroups[time]) group.timeGroups[time] = [];
    group.timeGroups[time].push(order);
    group.totalItems += order.items?.filter((i: any) => i.status === 'ready').length || 0;
  });

  return Array.from(tableMap.values());
});

const getTableName = (order: any) => {
  return order.table?.name?.replace('Table', '').trim() || order.table?.number || order.tableId;
};

const formatTime = (date: string) => {
  return new Date(date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const getElapsedMinutes = (date: string) => {
  return Math.floor((now.value.getTime() - new Date(date).getTime()) / 60000);
};

const getUrgencyColor = (minutes: number) => {
  if (minutes >= 15) return 'text-red-400';
  if (minutes >= 10) return 'text-orange-400';
  if (minutes >= 5) return 'text-yellow-400';
  return 'text-emerald-400';
};

const getUrgencyBorder = (minutes: number) => {
  if (minutes >= 15) return 'border-red-500/40 shadow-red-500/10';
  if (minutes >= 10) return 'border-orange-500/40 shadow-orange-500/10';
  return 'border-orange-500/20 shadow-orange-500/5';
};

const getProgressColor = (minutes: number) => {
  if (minutes >= 15) return 'bg-red-500';
  if (minutes >= 10) return 'bg-orange-500';
  if (minutes >= 5) return 'bg-yellow-500';
  return 'bg-emerald-500';
};

// Total items count for active orders
const totalActiveItems = computed(() => 
  activeOrders.value.reduce((sum, o) => 
    sum + (o.items?.filter((i: any) => i.status === 'confirmed').length || 0), 
    0
  )
);



const handleLogout = () => {
  userStore.logout();
};
</script>

<template>
  <div class="h-screen flex flex-col bg-slate-950 text-white font-display overflow-hidden">
    
    <!-- Header -->
    <header class="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-orange-400 text-[28px]" style="font-variation-settings: 'FILL' 1;">soup_kitchen</span>
          <div>
            <h1 class="text-lg font-black tracking-tight leading-tight">MÀN HÌNH BẾP</h1>
            <p class="text-[10px] text-slate-500 font-medium">Quán ăn Bình An</p>
          </div>
        </div>
        <div class="bg-orange-500/10 text-orange-400 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 ml-2">
          <span class="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
          Trực tiếp
        </div>
      </div>
      
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Clock -->
        <span class="text-sm font-mono text-slate-400 hidden sm:inline">
          {{ now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}
        </span>

        <!-- Tab Switcher -->
        <div class="flex bg-slate-800 rounded-lg p-0.5">
          <button 
            @click="activeTab = 'active'" 
            :class="['px-3 sm:px-4 py-1.5 rounded-md text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap', activeTab === 'active' ? 'bg-orange-500/20 text-orange-400' : 'text-slate-500 hover:text-slate-300']"
          >
            🔥 Cần nấu ({{ activeOrders.length }})
          </button>
          <button 
            @click="activeTab = 'history'" 
            :class="['px-3 sm:px-4 py-1.5 rounded-md text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap', activeTab === 'history' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300']"
          >
            Lịch sử ({{ historyOrders.length }})
          </button>
        </div>

        <button @click="handleLogout" class="p-2 hover:bg-slate-800 rounded-lg transition-colors" title="Đăng xuất">
          <span class="material-symbols-outlined text-slate-500 text-[20px]">logout</span>
        </button>
      </div>
    </header>

    <!-- ===== ACTIVE ORDERS — KANBAN BOARD ===== -->
    <main v-if="activeTab === 'active'" class="flex-1 overflow-hidden p-4 sm:p-6 flex flex-col">
      
      <!-- Empty State -->
      <div v-if="allActiveItems.length === 0" class="h-full flex flex-col items-center justify-center text-slate-650 p-8 animate-fade-in">
        <div class="w-24 h-24 bg-emerald-500/5 rounded-full flex items-center justify-center mb-5">
          <span class="material-symbols-outlined text-6xl text-emerald-500/30" style="font-variation-settings: 'FILL' 1;">check_circle</span>
        </div>
        <p class="text-xl font-black text-slate-400">Bếp đang rảnh</p>
        <p class="text-sm text-slate-600 mt-1">Chờ đơn mới từ phục vụ...</p>
      </div>

      <!-- Kanban Columns -->
      <div v-else class="flex-1 flex gap-5 overflow-hidden w-full">
        
        <!-- Column 1: Chờ nấu -->
        <div class="flex-1 min-w-[280px] bg-slate-900/40 rounded-2xl border border-slate-800/80 flex flex-col overflow-hidden">
          <div class="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <h3 class="font-bold text-sm text-slate-200 uppercase tracking-tight">Chờ nấu ({{ confirmedItems.length }})</h3>
            </div>
            <span class="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-bold tracking-wider uppercase">Queue</span>
          </div>
          
          <div class="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            <div v-if="confirmedItems.length === 0" class="h-full flex flex-col items-center justify-center text-slate-600 py-12">
              <span class="material-symbols-outlined text-4xl mb-2 opacity-35">hourglass_empty</span>
              <p class="text-xs font-bold text-slate-500">Không có món nào chờ nấu</p>
            </div>
            
            <div 
              v-for="item in confirmedItems" :key="item.id"
              :class="[
                'bg-slate-900/90 rounded-xl p-4 border shadow-md flex flex-col gap-2 relative transition-all hover:border-blue-500/30',
                getUrgencyBorder(getElapsedMinutes(item.createdAt))
              ]"
            >
              <div class="flex justify-between items-start">
                <span class="bg-blue-500/10 text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Bàn {{ item.tableName }}
                </span>
                <span :class="['text-[10px] font-mono font-bold flex items-center gap-1', getUrgencyColor(getElapsedMinutes(item.createdAt))]">
                  <span class="material-symbols-outlined text-[12px]">schedule</span>
                  {{ getElapsedMinutes(item.createdAt) }}m
                </span>
              </div>
              
              <div class="flex-1">
                <p class="text-base font-bold text-white leading-tight">
                  <span class="text-lg text-orange-400 font-black mr-1">{{ item.quantity }}×</span>
                  {{ item.name }}
                </p>
                <div v-if="item.note" class="mt-2 flex items-start gap-1.5 bg-red-500/15 px-2.5 py-2 rounded-lg border border-red-500/20">
                  <span class="material-symbols-outlined text-red-400 text-[16px] mt-0.5 shrink-0" style="font-variation-settings: 'FILL' 1;">warning</span>
                  <p class="text-xs text-red-300 font-bold leading-normal">{{ item.note }}</p>
                </div>
              </div>
              
              <div class="mt-2 pt-2 border-t border-slate-800/40 flex justify-end">
                <button
                  @click="handleUpdateItemStatus(item.orderId, item.id, 'preparing', item.name)"
                  :disabled="isUpdatingStatus === item.id"
                  class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-all shadow-md active:scale-95 disabled:opacity-50 min-h-[32px]"
                >
                  <span v-if="isUpdatingStatus === item.id" class="material-symbols-outlined animate-spin text-[12px]">autorenew</span>
                  <span v-else class="material-symbols-outlined text-[14px]">local_fire_department</span>
                  Bắt đầu làm
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Column 2: Đang nấu -->
        <div class="flex-1 min-w-[280px] bg-slate-900/40 rounded-2xl border border-slate-800/80 flex flex-col overflow-hidden">
          <div class="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
              <h3 class="font-bold text-sm text-slate-200 uppercase tracking-tight">Đang nấu ({{ preparingItems.length }})</h3>
            </div>
            <span class="text-[9px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full font-bold tracking-wider uppercase">Cooking</span>
          </div>

          <div class="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            <div v-if="preparingItems.length === 0" class="h-full flex flex-col items-center justify-center text-slate-600 py-12">
              <span class="material-symbols-outlined text-4xl mb-2 opacity-35">soup_kitchen</span>
              <p class="text-xs font-bold text-slate-500">Không có món nào đang nấu</p>
            </div>

            <div 
              v-for="item in preparingItems" :key="item.id"
              class="bg-slate-900/95 rounded-xl p-4 border border-orange-500/20 shadow-lg flex flex-col gap-2 relative transition-all hover:border-orange-500/40"
            >
              <div class="flex justify-between items-start">
                <span class="bg-orange-500/15 text-orange-400 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Bàn {{ item.tableName }}
                </span>
                <span class="text-[10px] font-mono text-slate-500 font-bold flex items-center gap-1">
                  <span class="material-symbols-outlined text-[12px]">schedule</span>
                  {{ getElapsedMinutes(item.createdAt) }}m
                </span>
              </div>
              
              <div class="flex-1">
                <p class="text-base font-bold text-white leading-tight">
                  <span class="text-lg text-orange-400 font-black mr-1">{{ item.quantity }}×</span>
                  {{ item.name }}
                </p>
                <div v-if="item.note" class="mt-2 flex items-start gap-1.5 bg-red-500/15 px-2.5 py-2 rounded-lg border border-red-500/20">
                  <span class="material-symbols-outlined text-red-400 text-[16px] mt-0.5 shrink-0" style="font-variation-settings: 'FILL' 1;">warning</span>
                  <p class="text-xs text-red-300 font-bold leading-normal">{{ item.note }}</p>
                </div>
              </div>

              <div class="mt-2 pt-2 border-t border-slate-800/40 flex justify-end">
                <button
                  @click="handleUpdateItemStatus(item.orderId, item.id, 'ready', item.name)"
                  :disabled="isUpdatingStatus === item.id"
                  class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-all shadow-md active:scale-95 disabled:opacity-50 min-h-[32px]"
                >
                  <span v-if="isUpdatingStatus === item.id" class="material-symbols-outlined animate-spin text-[12px]">autorenew</span>
                  <span v-else class="material-symbols-outlined text-[14px]">check</span>
                  Hoàn thành
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Column 3: Hoàn thành -->
        <div class="flex-1 min-w-[280px] bg-slate-900/40 rounded-2xl border border-slate-800/80 flex flex-col overflow-hidden">
          <div class="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h3 class="font-bold text-sm text-slate-200 uppercase tracking-tight">Hoàn thành ({{ readyItems.length }})</h3>
            </div>
            <span class="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold tracking-wider uppercase">Done</span>
          </div>

          <div class="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            <div v-if="readyItems.length === 0" class="h-full flex flex-col items-center justify-center text-slate-600 py-12">
              <span class="material-symbols-outlined text-4xl mb-2 opacity-35">check_circle</span>
              <p class="text-xs font-bold text-slate-500">Chưa hoàn thành món nào hôm nay</p>
            </div>

            <div 
              v-for="item in readyItems" :key="item.id"
              class="bg-slate-900/60 rounded-xl p-4 border border-slate-800/80 shadow flex flex-col gap-2 relative transition-all opacity-60"
            >
              <div class="flex justify-between items-start">
                <span class="bg-slate-800 text-slate-400 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Bàn {{ item.tableName }}
                </span>
                <span class="text-[10px] font-mono text-slate-650 font-bold">
                  {{ formatTime(item.createdAt) }}
                </span>
              </div>
              
              <div class="flex-1">
                <p class="text-base font-bold text-slate-350 leading-tight line-through">
                  <span class="text-lg text-slate-500 font-black mr-1">{{ item.quantity }}×</span>
                  {{ item.name }}
                </p>
                <div v-if="item.note" class="mt-2 flex items-start gap-1.5 bg-slate-800/40 px-2.5 py-1.5 rounded-lg">
                  <span class="material-symbols-outlined text-slate-500 text-[14px] mt-0.5 shrink-0">sticky_note_2</span>
                  <p class="text-xs text-slate-500 leading-normal">{{ item.note }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>

    <!-- ===== HISTORY VIEW — Grouped by Table + Time, with Filter ===== -->
    <main v-else class="flex-1 flex flex-col overflow-hidden">
      
      <!-- History Toolbar -->
      <div class="px-4 sm:px-6 py-3 bg-slate-900/50 border-b border-slate-800 flex items-center gap-3 shrink-0">
        <span class="material-symbols-outlined text-slate-500 text-[18px]">filter_list</span>
        <select 
          v-model="historyTableFilter"
          class="bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500 outline-none"
        >
          <option :value="null">Tất cả bàn ({{ historyOrders.length }})</option>
          <option v-for="t in availableTables" :key="t.id" :value="t.id">
            Bàn {{ t.name }} ({{ historyOrders.filter(o => o.tableId === t.id).length }})
          </option>
        </select>
        <span class="text-xs text-slate-600 ml-auto">{{ filteredHistoryOrders.length }} đơn hôm nay</span>
      </div>

      <!-- History Content -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        <div v-if="filteredHistoryOrders.length === 0" class="h-full flex flex-col items-center justify-center text-slate-600 animate-fade-in">
          <span class="material-symbols-outlined text-4xl mb-3 opacity-30">history</span>
          <p class="font-bold text-slate-500">Chưa có lịch sử</p>
        </div>

        <div v-else class="max-w-5xl mx-auto space-y-6">
          <!-- Table Group -->
          <div v-for="tableGroup in historyByTable" :key="tableGroup.tableId" class="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
            
            <!-- Table Header -->
            <div class="px-5 py-3 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-orange-400 text-[20px]">table_restaurant</span>
                <h3 class="text-lg font-black text-orange-400">Bàn {{ tableGroup.tableName }}</h3>
              </div>
              <span class="text-[10px] text-slate-500 font-bold bg-slate-700/50 px-2 py-0.5 rounded-full">
                {{ tableGroup.totalItems }} món
              </span>
            </div>

            <!-- Time Groups within Table -->
            <div class="divide-y divide-slate-800/50">
              <div v-for="(orders, time) in tableGroup.timeGroups" :key="time" class="px-5 py-3">
                
                <!-- Time Marker -->
                <div class="flex items-center gap-2 mb-3">
                  <span class="material-symbols-outlined text-slate-600 text-[14px]">schedule</span>
                  <span class="text-[11px] font-black text-slate-500 uppercase tracking-wider">{{ time }}</span>
                  <div class="flex-1 h-px bg-slate-800/40"></div>
                </div>

                <!-- Orders in this time slot -->
                <div class="space-y-2 pl-5">
                  <div 
                    v-for="order in orders" :key="order.id"
                    class="bg-slate-800/30 rounded-lg p-3 border border-slate-800/50"
                  >
                    <!-- Order header -->
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-[10px] font-mono text-slate-600">#{{ order.id.substring(0, 6) }}</span>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400">
                        🍳 Đã nấu
                      </span>
                    </div>
                    
                    <!-- Items with NOTES -->
                    <div class="space-y-1.5">
                      <div v-for="item in order.items.filter((i: any) => i.status === 'ready')" :key="item.id" class="flex flex-col">
                        <p class="text-sm text-slate-300 font-medium">
                          <span class="text-slate-500 font-bold mr-1">{{ item.quantity }}×</span>
                          {{ item.menuItem?.name || item.name }}
                        </p>
                        <p v-if="item.note" class="text-xs text-amber-400/80 font-medium pl-5 mt-0.5 flex items-center gap-1">
                          <span class="material-symbols-outlined text-[12px]">sticky_note_2</span>
                          {{ item.note }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>

  </div>
</template>
