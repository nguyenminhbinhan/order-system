<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useOrderStore } from '@/stores/order.store';
import { socketService } from '@/services/socket';
import { useUserStore } from '@/stores/user.store';
import { useRouter } from 'vue-router';
import { toast } from 'vue3-toastify';

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

// ===== ACTIVE ORDERS (confirmed = waiting to be cooked) =====
const activeOrders = computed(() => 
  orderStore.orderHistory
    .filter(o => o.items && o.items.some((i: any) => i.status === 'confirmed'))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
);

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

    <!-- ===== ACTIVE ORDERS — READ-ONLY ===== -->
    <main v-if="activeTab === 'active'" class="flex-1 overflow-y-auto p-4 sm:p-6">
      
      <!-- Empty State -->
      <div v-if="activeOrders.length === 0" class="h-full flex flex-col items-center justify-center text-slate-600 p-8 animate-fade-in">
        <div class="w-24 h-24 bg-emerald-500/5 rounded-full flex items-center justify-center mb-5">
          <span class="material-symbols-outlined text-6xl text-emerald-500/30" style="font-variation-settings: 'FILL' 1;">check_circle</span>
        </div>
        <p class="text-xl font-black text-slate-400">Bếp đang rảnh</p>
        <p class="text-sm text-slate-600 mt-1">Chờ đơn mới từ phục vụ...</p>
      </div>

      <!-- Active Orders Grid -->
      <div v-else>
        <!-- Summary bar -->
        <div class="flex items-center justify-between mb-4 px-1">
          <p class="text-xs text-slate-500 font-bold">{{ activeOrders.length }} đơn • {{ totalActiveItems }} món cần nấu</p>
          <span class="text-xs font-mono text-slate-600">
            {{ now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) }}
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div 
            v-for="order in activeOrders" :key="order.id"
            :class="[
              'bg-slate-900 rounded-2xl p-5 border-2 shadow-lg flex flex-col animate-slide-up',
              getUrgencyBorder(getElapsedMinutes(order.createdAt))
            ]"
          >
            <!-- Table & Time -->
            <div class="flex justify-between items-start mb-4">
              <div>
                <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">BÀN</p>
                <h3 class="text-4xl font-black text-orange-400 leading-none">
                  {{ getTableName(order) }}
                </h3>
              </div>
              <div class="text-right">
                <span class="text-xs font-bold text-slate-500 block">{{ formatTime(order.createdAt) }}</span>
                <span :class="[
                  'text-sm font-black block mt-0.5',
                  getUrgencyColor(getElapsedMinutes(order.createdAt))
                ]">
                  {{ getElapsedMinutes(order.createdAt) }} phút
                </span>
              </div>
            </div>

            <div class="h-px bg-slate-800 mb-4"></div>
            
            <!-- Items -->
            <div class="space-y-3 flex-1">
              <div v-for="item in order.items.filter((i: any) => i.status === 'confirmed')" :key="item.id" class="flex flex-col">
                <div class="flex justify-between items-center">
                  <p class="text-lg font-bold leading-snug text-white">
                    <span class="font-black text-xl mr-1.5 text-orange-400">{{ item.quantity }}×</span>
                    {{ item.menuItem?.name || item.name }}
                  </p>
                  <div class="flex items-center gap-2 shrink-0 ml-2">
                    <span class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-blue-500/20 text-blue-400">Xác nhận</span>
                  </div>
                </div>
                <!-- Note with high visibility -->
                <div v-if="item.note" class="mt-2 flex items-start gap-2 bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/20">
                  <span class="material-symbols-outlined text-red-400 text-[16px] mt-0.5 shrink-0" style="font-variation-settings: 'FILL' 1;">warning</span>
                  <p class="text-sm text-red-300 font-bold leading-snug">{{ item.note }}</p>
                </div>
              </div>
            </div>

            <!-- Timer Progress Bar -->
            <div class="mt-4 pt-3 border-t border-slate-800">
              <div class="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div 
                  :class="['h-full rounded-full transition-all duration-1000', getProgressColor(getElapsedMinutes(order.createdAt))]"
                  :style="{ width: Math.min(100, (getElapsedMinutes(order.createdAt) / 20) * 100) + '%' }"
                ></div>
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
