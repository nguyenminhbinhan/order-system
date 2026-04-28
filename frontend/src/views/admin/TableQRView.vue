<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { tableService } from '@/services/table.service';
import { useUserStore } from '@/stores/user.store';
import QrcodeVue from 'qrcode.vue';

const userStore = useUserStore();

const tables = ref<any[]>([]);
const loading = ref(true);

const fetchTables = async () => {
  loading.value = true;
  try {
    tables.value = await tableService.getTables();
  } catch (error) {
    console.error('Failed to fetch tables', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchTables();
});

const generateQRUrl = (tableId: number) => {
  return `http://localhost:5173/menu?tableId=${tableId}`;
};
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100">
    <!-- Sidebar Navigation -->
    <aside class="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
      <div class="p-6 flex items-center gap-3">
        <div class="size-10 rounded-xl bg-primary flex items-center justify-center text-white">
          <span class="material-symbols-outlined">qr_code_2</span>
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
      </div>
    </aside>

    <!-- Content -->
    <main class="flex-1 overflow-y-auto relative p-8">
      <div class="max-w-[1100px] mx-auto w-full">
        <!-- Header Actions -->
        <div class="flex items-end justify-between gap-4 mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div class="flex flex-col gap-1">
            <h1 class="text-slate-900 dark:text-slate-100 text-4xl font-extrabold leading-tight tracking-tight">Table QR Codes</h1>
            <p class="text-slate-500 dark:text-slate-400 text-base font-normal">Generate physical table locators for the customer portal.</p>
          </div>
          <button @click="fetchTables" class="flex items-center justify-center gap-2 rounded-lg h-11 px-6 bg-primary/10 text-primary text-sm font-bold transition-transform active:scale-95 shadow-sm hover:bg-primary/20">
            <span class="material-symbols-outlined text-[20px]">refresh</span>
            <span>Refresh Status</span>
          </button>
        </div>
      
      <div v-if="loading" class="flex flex-col items-center justify-center p-12 text-slate-500">
        <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        Loading tables...
      </div>
      
      <div v-else-if="tables.length === 0" class="flex flex-col items-center justify-center p-12 text-slate-500">
        <span class="material-symbols-outlined text-4xl mb-2">table_restaurant</span>
        Không có dữ liệu
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-8 gap-6 max-w-7xl mx-auto">
        
        <div 
          v-for="table in tables" 
          :key="table.id"
          class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col items-center p-6 transition-all hover:shadow-md"
        >
          <!-- Table Header -->
          <div class="w-full flex justify-between items-start mb-6">
            <div>
              <h3 class="font-bold text-xl">{{ table.name }}</h3>
              <p class="text-xs text-slate-500 mt-1">ID: {{ table.id }}</p>
            </div>
            
            <!-- Status Badge -->
            <span 
              v-if="table.computedState === 'available'"
              class="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-bold rounded-full border border-green-500/20"
            >
              Available
            </span>
            <span 
              v-else-if="table.computedState === 'occupied' || table.computedState === 'paying'"
              class="px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold rounded-full border border-red-500/20"
            >
              Occupied
            </span>
            <span 
              v-else
              class="px-3 py-1 bg-slate-500/10 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-full border border-slate-500/20"
            >
              {{ table.computedState }}
            </span>
          </div>

          <!-- QR Code -->
          <div class="bg-white p-4 rounded-xl shadow-inner border border-slate-100 flex items-center justify-center mb-6">
            <qrcode-vue :value="generateQRUrl(table.id)" :size="180" level="H" />
          </div>

          <!-- URL helper -->
          <div class="w-full text-center">
             <a :href="generateQRUrl(table.id)" target="_blank" class="text-xs text-primary hover:underline truncate block px-4 opacity-70">
               {{ generateQRUrl(table.id) }}
             </a>
          </div>

        </div>
      </div>
      </div>
    </main>

  </div>
</template>
