<template>
  <Transition name="thankyou">
    <div v-if="visible" class="fixed inset-0 z-[999] flex flex-col bg-white dark:bg-slate-950 overflow-y-auto">
      
      <!-- Receipt Content -->
      <div class="flex-1 max-w-lg mx-auto w-full p-6">
        
        <!-- Header: Thank You -->
        <div class="text-center pt-6 pb-8">
          <div class="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full mb-5">
            <span class="material-symbols-outlined text-4xl text-emerald-500" style="font-variation-settings: 'FILL' 1;">check_circle</span>
          </div>
          <h1 class="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
            Cảm ơn quý khách đã ghé quán Bình An!
          </h1>
          <p class="text-slate-500 text-sm">Thanh toán đã hoàn tất</p>
        </div>

        <!-- Restaurant Info Card -->
        <div class="bg-slate-50 dark:bg-slate-900 rounded-2xl p-5 mb-6 border border-slate-100 dark:border-slate-800">
          <h3 class="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Thông tin quán</h3>
          <div class="space-y-2.5">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-primary text-[18px]">restaurant</span>
              <span class="text-sm font-bold text-slate-800 dark:text-slate-200">Quán ăn Bình An</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-slate-400 text-[18px]">location_on</span>
              <span class="text-sm text-slate-600 dark:text-slate-400">70 Hoàng Dư Khương, Cẩm Lệ, Đà Nẵng</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-blue-500 text-[18px]">chat</span>
              <span class="text-sm text-slate-600 dark:text-slate-400">Zalo: <span class="font-bold text-slate-800 dark:text-slate-200">0935124062</span></span>
            </div>
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-red-500 text-[18px]">mail</span>
              <span class="text-sm text-slate-600 dark:text-slate-400 break-all">annguyen020403@gmail.com</span>
            </div>
          </div>
        </div>

        <!-- Divider with receipt dots -->
        <div class="flex items-center gap-0 mb-6 -mx-6">
          <div class="w-4 h-4 bg-white dark:bg-slate-950 rounded-full -ml-2 border-r border-slate-200 dark:border-slate-800"></div>
          <div class="flex-1 border-t-2 border-dashed border-slate-200 dark:border-slate-800"></div>
          <div class="w-4 h-4 bg-white dark:bg-slate-950 rounded-full -mr-2 border-l border-slate-200 dark:border-slate-800"></div>
        </div>

        <!-- Order History / Snapshot -->
        <div class="mb-8">
          <h3 class="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-[14px]">receipt_long</span>
            Chi tiết đơn hàng
          </h3>

          <!-- Loading State -->
          <div v-if="isLoadingSnapshot" class="text-center py-10">
            <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p class="text-slate-400 text-xs">Đang tải hóa đơn chi tiết...</p>
          </div>

          <!-- Snapshot Format (Preferred) -->
          <div v-else-if="snapshotData" class="space-y-4">
            <!-- Session metadata -->
            <div class="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
              <div class="flex justify-between items-center">
                <span class="text-slate-400 font-bold">BÀN:</span>
                <span class="text-slate-800 dark:text-white font-black text-sm">Bàn {{ snapshotData.tableNumber }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-slate-400 font-bold">GIỜ VÀO:</span>
                <span class="text-slate-700 dark:text-slate-300 font-bold">{{ formatTime(snapshotData.startedAt) }} - {{ formatDate(snapshotData.startedAt) }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-slate-400 font-bold">THANH TOÁN:</span>
                <span class="text-slate-700 dark:text-slate-300 font-bold">{{ formatTime(snapshotData.paidAt) }} - {{ formatDate(snapshotData.paidAt) }}</span>
              </div>
            </div>

            <!-- Aggregated Cooked Items -->
            <div class="space-y-2.5">
              <div v-for="(item, idx) in snapshotData.items" :key="idx" class="flex justify-between items-start py-1 border-b border-slate-50 dark:border-slate-900 last:border-none">
                <div class="flex-1 pr-3">
                  <p class="text-sm font-bold text-slate-800 dark:text-slate-200">
                    <span class="text-slate-400 font-medium mr-1">{{ item.quantity }}×</span>
                    {{ item.name }}
                  </p>
                  <p v-if="item.note" class="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                    <span class="material-symbols-outlined text-[10px]">sticky_note_2</span>
                    {{ item.note }}
                  </p>
                </div>
                <span class="text-sm font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {{ formatCurrency(Number(item.price) * item.quantity) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Fallback: Grouped by Time (Unchecked/Stale Cache) -->
          <div v-else-if="orderHistory.length > 0" class="space-y-4">
            <div v-for="(orders, time) in groupedByTime" :key="time">
              <!-- Time marker -->
              <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-slate-400 text-[12px]">schedule</span>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{{ time }}</span>
                <div class="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
              </div>

              <!-- Items in this order group -->
              <div v-for="order in orders" :key="order.id" class="space-y-1.5">
                <div v-for="item in order.items" :key="item.id" class="flex justify-between items-start py-1.5">
                  <div class="flex-1 pr-3">
                    <p class="text-sm font-medium text-slate-800 dark:text-slate-200">
                      <span class="text-slate-400 mr-1">{{ item.quantity }}×</span>
                      {{ item.name || item.menuItem?.name || 'Món' }}
                    </p>
                    <p v-if="item.note" class="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                      <span class="material-symbols-outlined text-[11px]">sticky_note_2</span>
                      {{ item.note }}
                    </p>
                  </div>
                  <span class="text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {{ formatCurrency(Number(item.price) * item.quantity) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty Case -->
          <div v-else class="text-center py-6">
            <p class="text-slate-400 text-sm">Không có dữ liệu đơn hàng</p>
          </div>

          <!-- Total -->
          <div class="mt-4 pt-4 border-t-2 border-dashed border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span class="text-lg font-black text-slate-900 dark:text-white">Tổng cộng</span>
            <span class="text-xl font-black text-primary">{{ formatCurrency(totalAmount) }}</span>
          </div>
        </div>

        <!-- Session ended note -->
        <div class="text-center pb-8">
          <p class="text-xs text-slate-400">Hẹn gặp lại quý khách lần sau! 🎉</p>
        </div>
      </div>

    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { apiClient } from '@/services/api';

const props = defineProps<{
  visible: boolean;
  orders?: any[];
  sessionId?: string;
}>();

const emit = defineEmits<{
  (e: 'complete'): void;
}>();

const STORAGE_KEY = 'binh_an_order_history';

const route = useRoute();
const snapshotData = ref<any>(null);
const isLoadingSnapshot = ref(false);
const orderHistory = ref<any[]>([]);

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
};

const formatTime = (dateStr: string | Date) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateStr: string | Date) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('vi-VN');
};

const totalAmount = computed(() => {
  if (snapshotData.value) {
    return Number(snapshotData.value.total || snapshotData.value.subtotal || 0);
  }
  return orderHistory.value.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
});

const groupedByTime = computed(() => {
  const groups: Record<string, any[]> = {};
  const sorted = [...orderHistory.value].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  sorted.forEach(order => {
    const time = formatTime(order.createdAt);
    if (!groups[time]) groups[time] = [];
    groups[time].push(order);
  });
  return groups;
});

const saveToLocalStorage = (orders: any[]) => {
  try {
    const record = {
      timestamp: new Date().toISOString(),
      tableId: orders[0]?.tableId || null,
      orders: orders.map(o => ({
        id: o.id,
        createdAt: o.createdAt,
        totalAmount: o.totalAmount,
        status: o.status,
        items: o.items?.map((i: any) => ({
          id: i.id,
          name: i.name || i.menuItem?.name,
          quantity: i.quantity,
          price: i.price,
          note: i.note,
        })) || []
      })),
      total: orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0),
    };

    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    existing.unshift(record);
    if (existing.length > 20) existing.length = 20;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.warn('Failed to save order history to localStorage', e);
  }
};

const fetchSnapshot = async (id: string) => {
  try {
    isLoadingSnapshot.value = true;
    const res = await apiClient.get(`/tables/sessions/${id}/bill-snapshot`);
    if (res.data) {
      snapshotData.value = res.data;
      try {
        localStorage.setItem('last_bill_snapshot', JSON.stringify(res.data));
      } catch (e) {}
    }
  } catch (e) {
    console.error('Failed to fetch bill snapshot', e);
  } finally {
    isLoadingSnapshot.value = false;
  }
};

const loadFallbackSnapshot = () => {
  try {
    const cached = localStorage.getItem('last_bill_snapshot');
    if (cached) {
      snapshotData.value = JSON.parse(cached);
    } else {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (existing.length > 0) {
        const latestRecord = existing[0];
        orderHistory.value = latestRecord.orders || [];
      }
    }
  } catch (e) {
    console.warn('Failed to load fallback from localStorage', e);
  }
};

const loadSnapshotData = () => {
  const sId = props.sessionId || (route.query.sessionId as string);
  if (sId) {
    fetchSnapshot(sId);
  } else {
    loadFallbackSnapshot();
  }
};

watch(() => props.visible, (val) => {
  if (val) {
    loadSnapshotData();
    emit('complete');
  }
});

onMounted(() => {
  if (props.visible) {
    loadSnapshotData();
  }
});
</script>

<style scoped>
.thankyou-enter-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.thankyou-leave-active {
  transition: all 0.3s ease-in;
}
.thankyou-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.thankyou-leave-to {
  opacity: 0;
}
</style>
