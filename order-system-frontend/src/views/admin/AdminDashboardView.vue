<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { apiClient } from '@/services/api';
import { useUserStore } from '@/stores/user.store';
import { socketService } from '@/services/socket';

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
  }
});
const loading = ref(true);

const fetchData = async () => {
  try {
    const [res, revRes] = await Promise.all([
      apiClient.get('/admin/dashboard'),
      apiClient.get('/admin/revenue')
    ]);
    dashboardData.value = { ...res.data, revenue: revRes.data };
  } catch (error) {
    console.error('Failed to load dashboard data', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchData();
  
  // Realtime Socket updates
  socketService.connect();
  socketService.onDashboardUpdated(() => {
    fetchData(); // Trigger silent refresh when any order state changes
  });
});

onUnmounted(() => {
  socketService.offDashboardUpdated();
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
      <div v-if="loading" class="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center text-primary">
        <span class="material-symbols-outlined text-4xl animate-spin">autorenew</span>
      </div>

      <!-- Header -->
      <header class="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
        <div class="flex items-center gap-4 flex-1 max-w-xl">
          <div class="relative w-full">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
            <input class="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-500" placeholder="Search analytics..." type="text"/>
          </div>
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
              <div class="flex items-center justify-between mb-8">
                <div>
                  <h3 class="text-lg font-bold">Revenue Over Time</h3>
                  <p class="text-sm text-slate-500 font-medium">Daily performance analysis (Last 7 Days)</p>
                </div>
              </div>
              
              <!-- Simple Bar Chart Logic -->
              <div class="flex-1 relative mt-4 flex items-end justify-between gap-2 px-2 pb-8">
                <div class="absolute inset-0 flex flex-col justify-between mb-8">
                  <div class="w-full border-t border-slate-100 dark:border-slate-800 border-dashed h-px"></div>
                  <div class="w-full border-t border-slate-100 dark:border-slate-800 border-dashed h-px"></div>
                  <div class="w-full border-t border-slate-100 dark:border-slate-800 border-dashed h-px"></div>
                  <div class="w-full border-t border-slate-100 dark:border-slate-800 border-dashed h-px"></div>
                </div>

                <!-- Bars -->
                <div 
                  v-for="(day, index) in [...dashboardData.revenueByDay].reverse()" 
                  :key="index"
                  class="flex-1 flex flex-col items-center justify-end z-10 h-full group"
                >
                  <div class="relative w-full max-w-[40px] bg-primary/20 hover:bg-primary transition-colors rounded-t-lg mx-auto flex items-end"
                       :style="{ height: `${Math.max((day.revenue / (Math.max(...dashboardData.revenueByDay.map(d => d.revenue)) || 1)) * 100, 5)}%` }">
                    <div class="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold py-1 px-2 rounded whitespace-nowrap transition-opacity">
                      {{ formatCurrency(day.revenue) }}
                    </div>
                  </div>
                  <span class="absolute bottom-0 text-[10px] sm:text-xs text-slate-500 font-bold whitespace-nowrap mt-2 translate-y-full">{{ day.date }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Top Items Column -->
          <div class="space-y-6">
            <div class="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col">
              <h3 class="text-lg font-bold mb-6">Top Selling Items</h3>
              <div class="space-y-4 flex-1">
                <div v-for="(item, index) in dashboardData.topItems" :key="item.id" class="flex gap-4 items-center p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
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
                
                <div v-if="dashboardData.topItems.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                  <span class="material-symbols-outlined text-4xl mb-2">trending_down</span>
                  <span class="text-sm font-bold">No sales data yet</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
