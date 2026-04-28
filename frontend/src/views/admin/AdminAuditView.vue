<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiClient } from '@/services/api';
import { toast } from 'vue3-toastify';

const logs = ref<any[]>([]);
const totalLogs = ref(0);
const loading = ref(true);

const filters = ref({
  action: '',
  startDate: '',
  endDate: '',
  page: 1
});

const totalPages = ref(1);

const fetchLogs = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filters.value.action) params.append('action', filters.value.action);
    if (filters.value.startDate) params.append('startDate', filters.value.startDate);
    if (filters.value.endDate) params.append('endDate', filters.value.endDate);
    params.append('page', filters.value.page.toString());

    const { data } = await apiClient.get(`/admin/audit-logs?${params.toString()}`);
    logs.value = data.data;
    totalLogs.value = data.meta.total;
    totalPages.value = data.meta.lastPage;
  } catch (error) {
    toast.error('Failed to fetch audit logs');
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('vi-VN');
};

const handleFilter = () => {
  filters.value.page = 1;
  fetchLogs();
};

const nextPage = () => {
  if (filters.value.page < totalPages.value) {
    filters.value.page++;
    fetchLogs();
  }
};

const prevPage = () => {
  if (filters.value.page > 1) {
    filters.value.page--;
    fetchLogs();
  }
};

const getActionBadge = (action: string) => {
  switch (action) {
    case 'CREATE_ORDER': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'CONFIRM_ORDER': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'CALL_WAITER': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'REQUEST_PAYMENT': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    case 'CHECKOUT': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  }
};

onMounted(() => {
  fetchLogs();
});
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-300">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Audit Logs</h2>
        <p class="text-slate-500">System activity and staff tracking.</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-end">
      <div class="flex flex-col gap-1.5 min-w-[200px] flex-1">
        <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Action</label>
        <select v-model="filters.action" class="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary w-full">
          <option value="">All Actions</option>
          <option value="CREATE_ORDER">Create Order</option>
          <option value="CONFIRM_ORDER">Confirm Order</option>
          <option value="CALL_WAITER">Call Waiter</option>
          <option value="REQUEST_PAYMENT">Request Payment</option>
          <option value="CHECKOUT">Checkout</option>
        </select>
      </div>

      <div class="flex flex-col gap-1.5 flex-1 min-w-[150px]">
        <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Start Date</label>
        <input type="date" v-model="filters.startDate" class="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary w-full" />
      </div>

      <div class="flex flex-col gap-1.5 flex-1 min-w-[150px]">
        <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">End Date</label>
        <input type="date" v-model="filters.endDate" class="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary w-full" />
      </div>

      <button @click="handleFilter" class="px-6 py-2 bg-primary flex items-center gap-2 hover:bg-primary/90 text-white rounded-lg font-bold transition-colors">
        <span class="material-symbols-outlined text-[18px]">filter_alt</span> Filter
      </button>
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th class="px-6 py-4 font-bold">Time</th>
              <th class="px-6 py-4 font-bold">Action</th>
              <th class="px-6 py-4 font-bold">User</th>
              <th class="px-6 py-4 font-bold">Table ID</th>
              <th class="px-6 py-4 font-bold">Metadata</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="px-6 py-12 text-center text-slate-500">
                <span class="material-symbols-outlined animate-spin text-3xl mb-2">refresh</span>
                <p>Loading audit logs...</p>
              </td>
            </tr>
            <tr v-else-if="logs.length === 0">
              <td colspan="5" class="px-6 py-12 text-center text-slate-500">
                <span class="material-symbols-outlined text-4xl mb-2 opacity-50">history</span>
                <p>Không có dữ liệu</p>
              </td>
            </tr>
            <tr v-else v-for="log in logs" :key="log.id" class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 focus:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap">{{ formatDate(log.createdAt) }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="['px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-max', getActionBadge(log.action)]">
                  <span class="material-symbols-outlined text-[12px] opacity-70">commit</span>
                  {{ log.action.replace('_', ' ') }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div v-if="log.user" class="flex flex-col">
                  <span class="font-medium text-slate-900 dark:text-slate-100">{{ log.user.email.split('@')[0] }}</span>
                  <span class="text-[10px] text-slate-500 uppercase font-black tracking-widest">{{ log.user.role }}</span>
                </div>
                <div v-else class="flex flex-col">
                  <span class="text-slate-400 italic font-medium">System</span>
                  <span class="text-[10px] text-slate-500 uppercase font-black tracking-widest">CUSTOMER</span>
                </div>
              </td>
              <td class="px-6 py-4 font-medium text-primary">#{{ log.tableId || '-' }}</td>
              <td class="px-6 py-4 text-xs font-mono text-slate-500 bg-slate-50/50 dark:bg-slate-800/50 border-l border-slate-100 dark:border-slate-800">
                {{ log.metadata ? JSON.stringify(log.metadata) : '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination -->
      <div v-if="totalPages > 1" class="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
        <span class="text-sm text-slate-500">Page <span class="font-black text-primary">{{ filters.page }}</span> of {{ totalPages }}</span>
        <div class="flex gap-2">
          <button @click="prevPage" :disabled="filters.page === 1" class="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-bold disabled:opacity-50 transition-all shadow-sm flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px]">chevron_left</span> Prev
          </button>
          <button @click="nextPage" :disabled="filters.page === totalPages" class="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-bold disabled:opacity-50 transition-all shadow-sm flex items-center gap-1">
            Next <span class="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
