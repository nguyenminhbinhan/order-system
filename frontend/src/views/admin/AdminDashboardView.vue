<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { apiClient } from '@/services/api';
import { useUserStore } from '@/stores/user.store';
import { socketService } from '@/services/socket';
import NotificationBell from '@/components/NotificationBell.vue';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'vue-chartjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
};

const userStore = useUserStore();

const dashboardData = ref({
  totalRevenueToday: 0,
  totalOrdersToday: 0,
  activeTables: 0,
  topItems: [] as any[],
  revenueByDay: [] as any[],
  revenue: {
    totalRevenue: 0,
    totalSessions: 0,
    revenueByTable: [] as any[]
  },
  analytics: {
    revenueByHour: Array(24).fill(0),
    ordersByTable: [] as any[],
    topItems: [] as any[]
  }
});
const loading = ref(true);

// Revenue Analytics state
const revenuePresets = ref({
  today: { totalRevenue: 0, totalOrders: 0 },
  month: { totalRevenue: 0, totalOrders: 0 },
  year:  { totalRevenue: 0, totalOrders: 0 },
});
const revenueLoading = ref(false);

const dateFrom = ref('');
const dateTo = ref('');
const rangeResult = ref<{ totalRevenue: number, totalOrders: number, avgOrderValue: number } | null>(null);
const rangeLoading = ref(false);

const revenueChartRaw = ref<{ labels: string[], data: number[] }>({ labels: [], data: [] });

const fetchData = async () => {
  try {
    const [res, revRes, analyticsRes] = await Promise.all([
      apiClient.get('/admin/dashboard'),
      apiClient.get('/admin/revenue'),
      apiClient.get('/admin/analytics')
    ]);
    dashboardData.value = { ...res.data, revenue: revRes.data, analytics: analyticsRes.data };
  } catch (error) {
    console.error('Failed to load dashboard data', error);
  } finally {
    loading.value = false;
  }
};

const fetchRevenuePresets = async () => {
  revenueLoading.value = true;
  try {
    const res = await apiClient.get('/admin/revenue-presets');
    revenuePresets.value = res.data;
  } catch (error) {
    console.error('Failed to load revenue presets', error);
  } finally {
    revenueLoading.value = false;
  }
};

const fetchRevenueChart = async () => {
  try {
    const params: any = {};
    if (dateFrom.value) params.from = dateFrom.value;
    if (dateTo.value) params.to = dateTo.value;
    const res = await apiClient.get('/admin/revenue-chart', { params });
    revenueChartRaw.value = res.data;
  } catch (error) {
    console.error('Failed to load revenue chart', error);
  }
};

const queryDateRange = async () => {
  if (!dateFrom.value || !dateTo.value) return;
  rangeLoading.value = true;
  try {
    const res = await apiClient.get('/admin/revenue-analytics', {
      params: { from: dateFrom.value, to: dateTo.value }
    });
    rangeResult.value = res.data;
    await fetchRevenueChart();
  } catch (error) {
    console.error('Failed to query revenue', error);
  } finally {
    rangeLoading.value = false;
  }
};

const hoursLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

const revenueChartData = computed(() => ({
  labels: hoursLabels,
  datasets: [
    {
      label: 'Doanh thu (₫)',
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      borderColor: '#6366f1',
      borderWidth: 2,
      pointBackgroundColor: '#6366f1',
      fill: true,
      tension: 0.4,
      data: dashboardData.value.analytics?.revenueByHour || Array(24).fill(0)
    }
  ]
}));

const dailyRevenueChartData = computed(() => ({
  labels: revenueChartRaw.value.labels.map(d => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }),
  datasets: [
    {
      label: 'Doanh thu theo ngày (₫)',
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      borderColor: '#10b981',
      borderWidth: 2,
      pointBackgroundColor: '#10b981',
      pointRadius: 3,
      fill: true,
      tension: 0.3,
      data: revenueChartRaw.value.data
    }
  ]
}));

const ordersChartData = computed(() => {
  const tables = dashboardData.value.analytics?.ordersByTable || [];
  return {
    labels: tables.map((t: any) => `Bàn ${t.tableName}`),
    datasets: [
      {
        label: 'Số lượng món',
        backgroundColor: '#f59e0b',
        borderRadius: 4,
        data: tables.map((t: any) => t.orders)
      }
    ]
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.05)' }
    },
    x: {
      grid: { display: false }
    }
  }
};

onMounted(() => {
  fetchData();
  fetchRevenuePresets();
  fetchRevenueChart();
  
  // Realtime Socket updates
  socketService.connect();
  socketService.onDashboardUpdated(() => {
    fetchData(); // Trigger silent refresh when any order state changes
  });

  // Real-time revenue refresh on payment
  socketService.on('paymentCompleted', () => {
    fetchRevenuePresets();
    if (dateFrom.value && dateTo.value) {
      queryDateRange();
    } else {
      fetchRevenueChart();
    }
  });
});

onUnmounted(() => {
  socketService.offDashboardUpdated();
  socketService.off('paymentCompleted');
  socketService.disconnect();
});
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100">
    <!-- Sidebar Navigation -->
    <aside class="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
      <div class="p-6 flex items-center gap-3">
        <div class="size-10 rounded-xl bg-primary flex items-center justify-center text-white">
          <span class="material-symbols-outlined">analytics</span>
        </div>
        <div>
          <h1 class="text-sm font-bold tracking-tight">SaaS Dashboard</h1>
          <p class="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Admin Panel</p>
        </div>
      </div>
      <nav class="flex-1 px-4 space-y-2 mt-4 text-sm font-semibold">
        <router-link to="/admin/dashboard" class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" exact-active-class="bg-primary/10 text-primary !text-primary">
          <span class="material-symbols-outlined text-[20px]">dashboard</span>
          <span>Dashboard</span>
        </router-link>
        <router-link to="/admin/menu" class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" exact-active-class="bg-primary/10 text-primary !text-primary">
          <span class="material-symbols-outlined text-[20px]">restaurant_menu</span>
          <span>Menu</span>
        </router-link>
        <router-link to="/admin/users" class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" exact-active-class="bg-primary/10 text-primary !text-primary">
          <span class="material-symbols-outlined text-[20px]">group</span>
          <span>Users</span>
        </router-link>
        <router-link to="/admin/tables" class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" exact-active-class="bg-primary/10 text-primary !text-primary">
          <span class="material-symbols-outlined text-[20px]">table_restaurant</span>
          <span>Tables</span>
        </router-link>
        <router-link to="/admin/qr" class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" exact-active-class="bg-primary/10 text-primary !text-primary">
          <span class="material-symbols-outlined text-[20px]">qr_code_2</span>
          <span>QR Generator</span>
        </router-link>
      </nav>
      <div class="p-4 border-t border-slate-200 dark:border-slate-800">
        <button @click="userStore.logout" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-semibold">
          <span class="material-symbols-outlined text-[20px]">logout</span>
          <span class="text-sm">Sign Out</span>
        </button>
        <div class="mt-4 flex items-center gap-3 px-3">
          <div class="size-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center text-slate-500 font-bold">
            {{ userStore.user?.email?.charAt(0).toUpperCase() || 'A' }}
          </div>
          <div class="flex-1 overflow-hidden">
            <p class="text-xs font-bold truncate uppercase">{{ userStore.user?.role || 'Admin' }}</p>
            <p class="text-[10px] text-slate-500 truncate">{{ userStore.user?.email || 'admin@restaurant.com' }}</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
      <div v-if="loading" class="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-primary gap-4">
        <span class="material-symbols-outlined text-4xl animate-spin text-primary">autorenew</span>
        <div class="flex gap-2">
          <div class="h-2 w-2 bg-primary rounded-full animate-bounce" style="animation-delay: 0s"></div>
          <div class="h-2 w-2 bg-primary rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
          <div class="h-2 w-2 bg-primary rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
        </div>
      </div>

      <!-- Header -->
      <header class="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
        <div class="flex items-center gap-4 flex-1 max-w-xl">
          <div class="relative w-full">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
            <input class="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-500" placeholder="Search analytics..." type="text"/>
          </div>
        </div>
        <div class="flex items-center gap-4 pl-4 ml-auto">
          <NotificationBell />
        </div>
      </header>
      
      <div class="p-8 space-y-8 max-w-7xl mx-auto w-full">
        <!-- Page Title -->
        <div class="flex flex-col gap-1">
          <h2 class="text-3xl font-black tracking-tight">Dashboard Overview</h2>
          <p class="text-slate-500 font-medium">Welcome back. Here's what's happening today.</p>
        </div>

        <!-- Metrics Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- Revenue Card -->
          <div class="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div class="flex items-center justify-between mb-4">
              <div class="size-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
                <span class="material-symbols-outlined">payments</span>
              </div>
            </div>
            <p class="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-1">Total Revenue Today</p>
            <h3 class="text-3xl font-extrabold text-green-600 dark:text-green-500">{{ formatCurrency(dashboardData.revenue?.totalRevenue || dashboardData.totalRevenueToday) }}</h3>
          </div>
          
          <!-- Sessions Card -->
          <div class="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div class="flex items-center justify-between mb-4">
              <div class="size-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <span class="material-symbols-outlined">history</span>
              </div>
            </div>
            <p class="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-1">Total Sessions</p>
            <h3 class="text-3xl font-extrabold text-blue-600 dark:text-blue-500">{{ dashboardData.revenue?.totalSessions }}</h3>
          </div>

          <!-- Orders Card -->
          <div class="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div class="flex items-center justify-between mb-4">
              <div class="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <span class="material-symbols-outlined">receipt_long</span>
              </div>
            </div>
            <p class="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-1">Orders Today</p>
            <h3 class="text-3xl font-extrabold text-primary">{{ dashboardData.totalOrdersToday }}</h3>
          </div>

          <!-- Tables Card -->
          <div class="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div class="flex items-center justify-between mb-4">
              <div class="size-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <span class="material-symbols-outlined">table_restaurant</span>
              </div>
            </div>
            <p class="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-1">Active Tables (Occupied)</p>
            <h3 class="text-3xl font-extrabold text-amber-500">{{ dashboardData.activeTables }}</h3>
          </div>
        </div>

        <!-- Main Section: Charts and Recent Activity -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Chart Column -->
          <div class="lg:col-span-2 space-y-6">
            <div class="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-[400px] flex flex-col">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-lg font-bold">Revenue by Hour</h3>
                  <p class="text-sm text-slate-500 font-medium">Daily performance analysis</p>
                </div>
              </div>
              <div class="flex-1 relative w-full min-h-[300px] h-full">
                <Line v-if="!loading" :data="revenueChartData" :options="chartOptions" />
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-[400px] flex flex-col">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-lg font-bold">Orders per Table</h3>
                  <p class="text-sm text-slate-500 font-medium">Activity distribution across tables</p>
                </div>
              </div>
              <div class="flex-1 relative w-full min-h-[300px] h-full">
                <Bar v-if="!loading" :data="ordersChartData" :options="chartOptions" />
              </div>
            </div>
          </div>
          
          <!-- Top Items Column -->
          <div class="space-y-6">
            <div class="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col">
              <h3 class="text-lg font-bold mb-6">Top Selling Items</h3>
              <div class="space-y-4 flex-1">
                <div v-for="(item, index) in dashboardData.analytics?.topItems" :key="item.id" class="flex gap-4 items-center p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                  <div class="size-8 rounded-full bg-slate-200 dark:bg-slate-700 font-black text-slate-500 flex items-center justify-center flex-shrink-0">
                    {{ index + 1 }}
                  </div>
                  <div class="flex-1 overflow-hidden">
                    <p class="text-sm font-bold truncate">{{ item.name }}</p>
                  </div>
                  <div class="text-primary font-black bg-primary/10 px-2 py-1 rounded">
                    {{ item.sold }}
                  </div>
                </div>
                
                <div v-if="dashboardData.analytics?.topItems?.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                  <span class="material-symbols-outlined text-4xl mb-2">trending_down</span>
                  <span class="text-sm font-bold">Không có dữ liệu</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════ -->
        <!-- REVENUE ANALYTICS SECTION (BELOW EXISTING DASHBOARD) -->
        <!-- ═══════════════════════════════════════════════════════ -->
        <div class="border-t border-slate-200 dark:border-slate-800 pt-8">
          <div class="flex flex-col gap-1 mb-6">
            <div class="flex items-center gap-3">
              <div class="size-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <span class="material-symbols-outlined">monitoring</span>
              </div>
              <div>
                <h2 class="text-2xl font-black tracking-tight">Revenue Analytics</h2>
                <p class="text-slate-500 text-sm font-medium">Detailed revenue breakdown by period</p>
              </div>
            </div>
          </div>

          <!-- Preset Revenue Cards: Today / Month / Year -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <!-- Today -->
            <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-xl shadow-lg shadow-emerald-500/10 text-white relative overflow-hidden">
              <div class="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
                <span class="material-symbols-outlined text-[100px]">today</span>
              </div>
              <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-emerald-200 text-[20px]">today</span>
                <p class="text-emerald-100 text-sm font-bold uppercase tracking-wider">Today</p>
              </div>
              <h3 class="text-3xl font-extrabold mb-1">{{ formatCurrency(revenuePresets.today.totalRevenue) }}</h3>
              <p class="text-emerald-200 text-sm font-medium">{{ revenuePresets.today.totalOrders }} sessions paid</p>
            </div>

            <!-- This Month -->
            <div class="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-lg shadow-blue-500/10 text-white relative overflow-hidden">
              <div class="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
                <span class="material-symbols-outlined text-[100px]">calendar_month</span>
              </div>
              <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-blue-200 text-[20px]">calendar_month</span>
                <p class="text-blue-100 text-sm font-bold uppercase tracking-wider">This Month</p>
              </div>
              <h3 class="text-3xl font-extrabold mb-1">{{ formatCurrency(revenuePresets.month.totalRevenue) }}</h3>
              <p class="text-blue-200 text-sm font-medium">{{ revenuePresets.month.totalOrders }} sessions paid</p>
            </div>

            <!-- This Year -->
            <div class="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl shadow-lg shadow-purple-500/10 text-white relative overflow-hidden">
              <div class="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
                <span class="material-symbols-outlined text-[100px]">event_note</span>
              </div>
              <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-purple-200 text-[20px]">event_note</span>
                <p class="text-purple-100 text-sm font-bold uppercase tracking-wider">This Year</p>
              </div>
              <h3 class="text-3xl font-extrabold mb-1">{{ formatCurrency(revenuePresets.year.totalRevenue) }}</h3>
              <p class="text-purple-200 text-sm font-medium">{{ revenuePresets.year.totalOrders }} sessions paid</p>
            </div>
          </div>

          <!-- Date Range Filter + Results -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <!-- Filter Card -->
            <div class="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-[20px]">date_range</span>
                Custom Date Range
              </h3>
              <div class="space-y-3">
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">From</label>
                  <input v-model="dateFrom" type="date" class="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:border-primary focus:ring-primary shadow-sm text-sm" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">To</label>
                  <input v-model="dateTo" type="date" class="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:border-primary focus:ring-primary shadow-sm text-sm" />
                </div>
                <button
                  @click="queryDateRange"
                  :disabled="rangeLoading || !dateFrom || !dateTo"
                  class="w-full mt-2 flex items-center justify-center gap-2 rounded-lg h-10 bg-primary text-white text-sm font-bold transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="rangeLoading" class="material-symbols-outlined animate-spin text-[18px]">autorenew</span>
                  <span class="material-symbols-outlined text-[18px]" v-else>search</span>
                  {{ rangeLoading ? 'Querying...' : 'Check Revenue' }}
                </button>
              </div>
            </div>

            <!-- Results Card -->
            <div class="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-emerald-500 text-[20px]">query_stats</span>
                Query Results
              </h3>

              <div v-if="!rangeResult" class="h-[140px] flex flex-col items-center justify-center text-slate-400 opacity-50">
                <span class="material-symbols-outlined text-4xl mb-2">analytics</span>
                <span class="text-sm font-bold">Select a date range and click "Check Revenue"</span>
              </div>

              <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                  <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Total Revenue</p>
                  <h4 class="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">{{ formatCurrency(rangeResult.totalRevenue) }}</h4>
                </div>
                <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                  <p class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Total Sessions</p>
                  <h4 class="text-2xl font-extrabold text-blue-700 dark:text-blue-300">{{ rangeResult.totalOrders }}</h4>
                </div>
                <div class="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                  <p class="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Average per Session</p>
                  <h4 class="text-2xl font-extrabold text-amber-700 dark:text-amber-300">{{ formatCurrency(rangeResult.avgOrderValue) }}</h4>
                </div>
              </div>
            </div>
          </div>

          <!-- Daily Revenue Chart -->
          <div class="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-[400px] flex flex-col">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-lg font-bold">Daily Revenue Trend</h3>
                <p class="text-sm text-slate-500 font-medium">{{ revenueChartRaw.labels.length > 0 ? `${revenueChartRaw.labels[0]} → ${revenueChartRaw.labels[revenueChartRaw.labels.length - 1]}` : 'This month' }}</p>
              </div>
            </div>
            <div class="flex-1 relative w-full min-h-[300px] h-full">
              <Line v-if="revenueChartRaw.labels.length > 0" :data="dailyRevenueChartData" :options="chartOptions" />
              <div v-else class="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                <span class="material-symbols-outlined text-4xl mb-2">show_chart</span>
                <span class="text-sm font-bold">No revenue data available</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
