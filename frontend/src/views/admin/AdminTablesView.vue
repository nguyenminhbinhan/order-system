<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { apiClient } from '@/services/api';
import { useUserStore } from '@/stores/user.store';
import { toast } from 'vue3-toastify';

const userStore = useUserStore();
const tables = ref<any[]>([]);
const loading = ref(true);
const showDeleted = ref(false);

const showModal = ref(false);
const isEditing = ref(false);
const isSaving = ref(false);

const formData = ref({
  id: null as number | null,
  name: '',
  qrCode: '',
  status: 'empty',
});

const fetchTables = async () => {
  loading.value = true;
  try {
    const res = await apiClient.get(`/tables?includeDeleted=${showDeleted.value}`);
    tables.value = res.data;
  } catch (error) {
    console.error('Failed to load tables', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchTables();
});

const activeFilter = ref('All');

const filteredTables = computed(() => {
  if (activeFilter.value === 'All') return tables.value;
  return tables.value.filter(t => t.computedState === activeFilter.value);
});

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'available':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'waiting_confirm':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'occupied':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'paying':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  }
};

const openAddModal = () => {
  isEditing.value = false;
  formData.value = { id: null, name: '', qrCode: '', status: 'empty' };
  showModal.value = true;
};

const handleEdit = (table: any) => {
  isEditing.value = true;
  formData.value = {
    id: table.id,
    name: table.name,
    qrCode: table.qrCode,
    status: table.computedState || table.status,
  };
  showModal.value = true;
};

const handleDelete = async (tableId: number) => {
  if (confirm('Are you sure you want to delete this table?')) {
    try {
      await apiClient.delete(`/tables/${tableId}`);
      await fetchTables();
      toast.success('Xóa bàn thành công');
    } catch (e: any) {
      console.error(e);
      if (e.response?.data?.message === 'TABLE_HAS_ACTIVE_SESSION') {
        toast.error('Không thể xoá bàn đang có khách');
      } else if (e.response?.status === 400) {
        toast.error('Cannot delete table because it has active orders');
      } else {
        toast.error('Failed to delete table. Check if it has active orders.');
      }
    }
  }
};

const handleRestore = async (tableId: number) => {
  try {
    await apiClient.patch(`/tables/${tableId}/restore`);
    toast.success('Table restored successfully');
    await fetchTables();
  } catch (e: any) {
    console.error(e);
    toast.error('Failed to restore table');
  }
};

const submitForm = async () => {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    if (isEditing.value && formData.value.id !== null) {
      const payload: any = {
        name: formData.value.name,
        qrCode: formData.value.qrCode,
      };
      await apiClient.put(`/tables/${formData.value.id}`, payload);
      toast.success('Table updated');
    } else {
      // For new tables, send only what the user explicitly filled in.
      // Backend auto-generates name and QR code if empty.
      const payload: any = {};
      if (formData.value.name) payload.name = formData.value.name;
      if (formData.value.qrCode) payload.qrCode = formData.value.qrCode;
      await apiClient.post('/tables', payload);
      toast.success('Table created');
    }

    showModal.value = false;
    await fetchTables();
  } catch (err) {
    console.error('Save failed:', err);
    toast.error('Failed to save table.');
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100">
    <!-- Sidebar Navigation -->
    <aside class="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
      <div class="p-6 flex items-center gap-3">
        <div class="size-10 rounded-xl bg-primary flex items-center justify-center text-white">
          <span class="material-symbols-outlined">table_restaurant</span>
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

    <main class="flex-1 overflow-y-auto relative">
      <div v-if="loading" class="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center text-primary">
        <span class="material-symbols-outlined text-4xl animate-spin">autorenew</span>
      </div>

      <div class="p-8 max-w-[1100px] mx-auto w-full">
        <!-- Page Title & CTA -->
        <div class="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div class="flex flex-col gap-1">
            <h1 class="text-slate-900 dark:text-slate-100 text-4xl font-extrabold leading-tight tracking-tight">Table Management</h1>
            <p class="text-slate-500 dark:text-slate-400 text-base font-normal">Configure restaurant tables and their physical mappings.</p>
          </div>
          <button @click="openAddModal" class="flex items-center justify-center gap-2 rounded-lg h-11 px-6 bg-primary text-white text-sm font-bold transition-transform active:scale-95 shadow-lg shadow-primary/20">
            <span class="material-symbols-outlined text-[20px]">add</span>
            <span>Add New Table</span>
          </button>
        </div>

        <!-- Quick Filter Tabs -->
        <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div class="flex gap-2 overflow-x-auto pb-2">
            <button @click="activeFilter = 'All'" :class="activeFilter === 'All' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'" class="px-5 py-2 rounded-full border text-sm font-semibold whitespace-nowrap transition-colors">All Tables ({{ tables.length }})</button>
            <button @click="activeFilter = 'available'" :class="activeFilter === 'available' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'" class="px-5 py-2 rounded-full border text-sm font-semibold whitespace-nowrap transition-colors">Empty</button>
            <button @click="activeFilter = 'waiting_confirm'" :class="activeFilter === 'waiting_confirm' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'" class="px-5 py-2 rounded-full border text-sm font-semibold whitespace-nowrap transition-colors">Waiting Orders</button>
            <button @click="activeFilter = 'occupied'" :class="activeFilter === 'occupied' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'" class="px-5 py-2 rounded-full border text-sm font-semibold whitespace-nowrap transition-colors">Occupied</button>
            <button @click="activeFilter = 'paying'" :class="activeFilter === 'paying' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'" class="px-5 py-2 rounded-full border text-sm font-semibold whitespace-nowrap transition-colors">Needs Payment</button>
          </div>
          
          <div class="flex items-center gap-2">
            <input type="checkbox" id="showDeleted" v-model="showDeleted" @change="fetchTables" class="rounded border-slate-300 text-primary focus:ring-primary size-4" />
            <label for="showDeleted" class="text-sm font-bold text-slate-600 dark:text-slate-400">Show Deleted Tables</label>
          </div>
        </div>

        <!-- Table Component -->
        <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                  <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Table Entity</th>
                  <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">State</th>
                  <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">QR Generation URL</th>
                  <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="table in filteredTables" :key="table.id" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group" :class="{ 'opacity-50 grayscale bg-slate-50 dark:bg-slate-800/50': table.isDeleted }">
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <div class="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold uppercase">
                        {{ table.id }}
                      </div>
                      <div>
                        <p class="font-bold text-slate-900 dark:text-slate-100">
                          {{ table.name }}
                          <span v-if="table.isDeleted" class="ml-2 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">Deleted</span>
                        </p>
                        <p class="text-xs text-slate-500">ID: {{ table.id }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase', getStatusBadgeClass(table.computedState)]">
                      {{ (table.computedState || '').replace('_', ' ') }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-mono text-xs w-64 truncate block">{{ table.qrCode }}</td>
                  <td class="px-6 py-4 text-right">
                    <button v-if="!table.isDeleted" @click="handleEdit(table)" class="p-2 text-slate-400 hover:text-primary transition-colors" title="Edit Table">
                      <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button v-if="!table.isDeleted" @click="handleDelete(table.id)" class="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Archive Table">
                      <span class="material-symbols-outlined">archive</span>
                    </button>
                    <button v-if="table.isDeleted" @click="handleRestore(table.id)" class="p-2 text-slate-400 hover:text-emerald-500 transition-colors" title="Restore Table">
                      <span class="material-symbols-outlined shrink-0 align-middle mr-1">unarchive</span>
                      <span class="text-xs font-bold uppercase align-middle">Restore</span>
                    </button>
                  </td>
                </tr>
                <tr v-if="filteredTables.length === 0">
                  <td colspan="5" class="px-6 py-12 text-center text-slate-500">
                    <span class="material-symbols-outlined text-4xl mb-2">table_restaurant</span>
                    <p>Không có dữ liệu</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>

    <!-- Modal Form -->
    <div v-if="showModal" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div class="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 class="text-lg font-bold">{{ isEditing ? 'Edit Table' : 'Create New Table' }}</h3>
          <button @click="showModal = false" class="text-slate-400 hover:text-red-500 transition-colors">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <form @submit.prevent="submitForm" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Table Name</label>
            <input v-model="formData.name" type="text" :placeholder="isEditing ? '' : 'Auto-generated (e.g. Table 5)'" class="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:border-primary focus:ring-primary shadow-sm" />
            <p v-if="!isEditing" class="text-xs text-slate-400 mt-1">Leave blank to auto-generate the next table number</p>
          </div>
          <div>
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">QR Generation URL</label>
            <input v-model="formData.qrCode" type="text" :placeholder="isEditing ? '' : 'Auto-generated'" class="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:border-primary focus:ring-primary shadow-sm text-xs font-mono" />
            <p v-if="!isEditing" class="text-xs text-slate-400 mt-1">Leave blank to auto-generate from table ID</p>
          </div>
          
          <div class="pt-4 flex gap-3">
            <button type="button" @click="showModal = false" class="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" :disabled="isSaving">Cancel</button>
            <button type="submit" class="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-bold shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50" :disabled="isSaving">
              <span v-if="isSaving" class="material-symbols-outlined animate-spin align-middle mr-1 text-[18px]">autorenew</span>
              {{ isSaving ? 'Saving...' : 'Save Table' }}
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>
