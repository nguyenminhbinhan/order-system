<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { apiClient } from '@/services/api';
import { useUserStore } from '@/stores/user.store';
import { toast } from 'vue3-toastify';

const userStore = useUserStore();
const users = ref<any[]>([]);
const loading = ref(true);

const showModal = ref(false);
const isEditing = ref(false);
const isSaving = ref(false);

const formData = ref({
  id: '',
  name: '',
  email: '',
  password: '',
  role: 'service',
});

const fetchUsers = async () => {
  loading.value = true;
  try {
    const res = await apiClient.get('/users');
    users.value = res.data;
  } catch (error) {
    console.error('Failed to load users', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchUsers();
});

const activeFilter = ref('All');

const filteredUsers = computed(() => {
  if (activeFilter.value === 'All') return users.value;
  return users.value.filter(u => u.role.toLowerCase() === activeFilter.value.toLowerCase());
});

const getRoleBadgeClass = (role: string) => {
  switch (role.toLowerCase()) {
    case 'admin':
    case 'manager':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'service':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'kitchen':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  }
};

const openAddModal = () => {
  isEditing.value = false;
  formData.value = { id: '', name: '', email: '', password: '', role: 'service' };
  showModal.value = true;
};

const handleEdit = (user: any) => {
  isEditing.value = true;
  formData.value = {
    id: user.id,
    name: user.name,
    email: user.email,
    password: '', // blank for edit
    role: user.role,
  };
  showModal.value = true;
};

const handleDelete = async (userId: string) => {
  if (confirm('Are you sure you want to delete this user?')) {
    try {
      await apiClient.delete(`/users/${userId}`);
      await fetchUsers();
      toast.success('User deleted successfully!');
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Failed to delete user.');
    }
  }
};

const submitForm = async () => {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const payload: any = {
      name: formData.value.name,
      email: formData.value.email,
      role: formData.value.role,
    };
    
    if (formData.value.password) {
      payload.password = formData.value.password;
    }

    if (isEditing.value) {
      await apiClient.put(`/users/${formData.value.id}`, payload);
      toast.success('User updated successfully!');
    } else {
      if (!payload.password) return toast.error("Password required for new users");
      await apiClient.post('/users', payload);
      toast.success('User created successfully!');
    }

    showModal.value = false;
    await fetchUsers();
  } catch (err: any) {
    console.error('Save failed:', err);
    toast.error(err.response?.data?.message || 'Failed to save user.');
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
          <span class="material-symbols-outlined">shield_person</span>
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
            <h1 class="text-slate-900 dark:text-slate-100 text-4xl font-extrabold leading-tight tracking-tight">User Management</h1>
            <p class="text-slate-500 dark:text-slate-400 text-base font-normal">Configure staff roles, permissions, and platform access levels.</p>
          </div>
          <button @click="openAddModal" class="flex items-center justify-center gap-2 rounded-lg h-11 px-6 bg-primary text-white text-sm font-bold transition-transform active:scale-95 shadow-lg shadow-primary/20">
            <span class="material-symbols-outlined text-[20px]">person_add</span>
            <span>Add Staff Member</span>
          </button>
        </div>

        <!-- Quick Filter Tabs -->
        <div class="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button @click="activeFilter = 'All'" :class="activeFilter === 'All' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'" class="px-5 py-2 rounded-full border text-sm font-semibold whitespace-nowrap transition-colors">All Staff ({{ users.length }})</button>
          <button @click="activeFilter = 'admin'" :class="activeFilter === 'admin' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'" class="px-5 py-2 rounded-full border text-sm font-semibold whitespace-nowrap transition-colors">Admins</button>
          <button @click="activeFilter = 'kitchen'" :class="activeFilter === 'kitchen' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'" class="px-5 py-2 rounded-full border text-sm font-semibold whitespace-nowrap transition-colors">Kitchen</button>
          <button @click="activeFilter = 'service'" :class="activeFilter === 'service' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'" class="px-5 py-2 rounded-full border text-sm font-semibold whitespace-nowrap transition-colors">Service (Waiters)</button>
        </div>

        <!-- Table Component -->
        <div class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                  <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Staff Member</th>
                  <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Role</th>
                  <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</th>
                  <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <div class="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold uppercase">
                        {{ user.name?.substring(0,2) || user.email?.substring(0,2) }}
                      </div>
                      <div>
                        <p class="font-bold text-slate-900 dark:text-slate-100">{{ user.name }}</p>
                        <p class="text-xs text-slate-500">ID: {{ user.id.substring(0, 8) }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase', getRoleBadgeClass(user.role)]">
                      {{ user.role }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{{ user.email }}</td>
                  <td class="px-6 py-4 text-right">
                    <button @click="handleEdit(user)" class="p-2 text-slate-400 hover:text-primary transition-colors">
                      <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button @click="handleDelete(user.id)" class="p-2 text-slate-400 hover:text-red-500 transition-colors" :disabled="user.id === userStore.user?.userId">
                      <span class="material-symbols-outlined">delete</span>
                    </button>
                  </td>
                </tr>
                <tr v-if="filteredUsers.length === 0">
                  <td colspan="5" class="px-6 py-12 text-center text-slate-500">
                    <span class="material-symbols-outlined text-4xl mb-2">person_off</span>
                    <p>No staff members found.</p>
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
          <h3 class="text-lg font-bold">{{ isEditing ? 'Edit User' : 'Create Staff Member' }}</h3>
          <button @click="showModal = false" class="text-slate-400 hover:text-red-500 transition-colors">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <form @submit.prevent="submitForm" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
            <input v-model="formData.name" required type="text" class="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:border-primary focus:ring-primary shadow-sm" />
          </div>
          <div>
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
            <input v-model="formData.email" required type="email" class="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:border-primary focus:ring-primary shadow-sm" />
          </div>
          <div>
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Password <span v-if="isEditing" class="text-xs font-normal text-slate-400">(leave blank to keep current)</span></label>
            <input v-model="formData.password" :required="!isEditing" type="password" class="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:border-primary focus:ring-primary shadow-sm" />
          </div>
          <div>
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Role Assignment</label>
            <select v-model="formData.role" required class="w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 focus:border-primary focus:ring-primary shadow-sm">
              <option value="admin">System Admin</option>
              <option value="manager">Manager</option>
              <option value="service">Service (Waiter)</option>
              <option value="kitchen">Kitchen (Chef)</option>
            </select>
          </div>
          
          <div class="pt-4 flex gap-3">
            <button type="button" @click="showModal = false" class="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" :disabled="isSaving">Cancel</button>
            <button type="submit" class="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-bold shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50" :disabled="isSaving">
              <span v-if="isSaving" class="material-symbols-outlined animate-spin align-middle mr-1 text-[18px]">autorenew</span>
              {{ isSaving ? 'Saving...' : 'Save User' }}
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>
