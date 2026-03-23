<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useMenuStore } from '@/stores/menu.store';
import { useUserStore } from '@/stores/user.store';
import { apiClient } from '@/services/api';
import { toast } from 'vue3-toastify';

const menuStore = useMenuStore();
const userStore = useUserStore();
const showAddModal = ref(false);
const isEditing = ref(false);
const isSaving = ref(false);

const formData = ref({
  id: '',
  name: '',
  description: '',
  price: 0,
  categoryId: '',
  isAvailable: true,
});
const imageFile = ref<File | null>(null);

onMounted(async () => {
  await menuStore.fetchMenuItems();
});

const activeCategory = ref('All');

const categoryMap: Record<string, string> = {
  'All': 'Tất cả',
  'Category 1': 'Món chính',
  'Category 2': 'Món phụ',
  'Category 3': 'Tráng miệng',
  'Category 4': 'Nước uống'
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
};

const getCategoryDisplayName = (name: string) => {
  return categoryMap[name] || name;
};

const categories = computed(() => {
  return [{ id: 'All', name: 'Tất cả' }, ...((menuStore as any).categories || []).map((cat: any) => ({
    ...cat,
    displayName: getCategoryDisplayName(cat.name)
  }))];
});

const filteredItems = computed(() => {
  if (activeCategory.value === 'All') return menuStore.menuItems;
  return menuStore.menuItems.filter((item: any) => item.categoryId === activeCategory.value);
});

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    imageFile.value = target.files[0];
  }
};

const handleEdit = (item: any) => {
  isEditing.value = true;
  formData.value = {
    id: item.id,
    name: item.name,
    description: item.description || '',
    price: item.price,
    categoryId: item.categoryId || '',
    isAvailable: item.isAvailable !== false,
  };
  imageFile.value = null;
  showAddModal.value = true;
};

const openAddModal = () => {
  isEditing.value = false;
  formData.value = { id: '', name: '', description: '', price: 0, categoryId: '', isAvailable: true };
  imageFile.value = null;
  showAddModal.value = true;
};

const deleteItem = async (id: string) => {
  if (confirm('Are you sure you want to delete this menu item?')) {
    try {
      await apiClient.delete(`/menu-items/${id}`);
      await menuStore.fetchMenuItems();
      toast.success('Item deleted successfully.');
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Failed to delete item because it may be bound to order history.');
    }
  }
};

const submitForm = async () => {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    if (!userStore.user?.id) {
      toast.error('Session expired. Please log in again to save items.');
      isSaving.value = false;
      return;
    }

    const form = new FormData();
    form.append('name', formData.value.name);
    form.append('description', formData.value.description);
    // @ts-ignore: bypass strict DOM string requirement directly enforcing literal formulation
    form.append('price', Number(formData.value.price));
    form.append('available', formData.value.isAvailable ? 'true' : 'false');
    form.append('userId', userStore.user.id);
    
    if (formData.value.categoryId) {
       form.append('categoryId', formData.value.categoryId);
    }

    if (imageFile.value) {
      form.append('image', imageFile.value);
    }

    const config = { headers: { 'Content-Type': 'multipart/form-data' } };

    if (isEditing.value) {
      await apiClient.put(`/menu-items/${formData.value.id}`, form, config);
      toast.success('Menu item successfully updated');
    } else {
      await apiClient.post('/menu-items', form, config);
      toast.success('New menu item created');
    }

    showAddModal.value = false;
    await menuStore.fetchMenuItems();
  } catch (err: any) {
    console.error('Save failed:', err);
    toast.error(err.response?.data?.message || 'Failed to save menu item');
  } finally {
    isSaving.value = false;
  }
};

const getImageUrl = (filename: any) => {
  if (!filename) return 'https://placehold.co/400x300?text=No+Image';
  return `http://localhost:3000/uploads/images/${filename}`;
};

const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement;
  target.src = 'https://placehold.co/400x300?text=No+Image';
};
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100">
    <!-- Sidebar Navigation -->
    <aside class="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
      <div class="p-6 flex items-center gap-3">
        <div class="size-10 rounded-xl bg-primary flex items-center justify-center text-white">
          <span class="material-symbols-outlined">restaurant_menu</span>
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

    <main class="flex-1 overflow-y-auto relative p-8">
      <div class="max-w-[1100px] mx-auto w-full">
      <!-- Title -->
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-3xl font-extrabold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-400">Menu Management</h1>
          <p class="text-slate-500">Manage your restaurant offerings and inventory.</p>
        </div>
        <button @click="openAddModal" class="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg font-bold shadow-lg hover:shadow-primary/30 transition-shadow">
          <span class="material-symbols-outlined">add</span> New Item
        </button>
      </div>

      <!-- Filters -->
      <div class="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-800">
        <button 
          v-for="cat in categories" 
          :key="cat.id" 
          @click="activeCategory = cat.id"
          class="pb-3 px-2 font-medium transition-colors"
          :class="activeCategory === cat.id ? 'text-primary border-b-2 border-primary font-bold' : 'text-slate-500 hover:text-slate-700'"
        >
          {{ cat.displayName || cat.name }}
        </button>
      </div>

      <!-- Table -->
      <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Name</th>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Price</th>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            <tr v-for="item in filteredItems" :key="item.id" class="hover:bg-slate-50 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 shadow-sm">
                    <img :src="getImageUrl(item.imageFilename)" @error="handleImageError" class="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p class="text-sm font-bold text-slate-900">{{ item.name }}</p>
                    <p class="text-xs text-slate-500 line-clamp-1 w-64">{{ item.description }}</p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 font-semibold">{{ formatCurrency(item.price) }}</td>
              <td class="px-6 py-4">
                <span v-if="item.isAvailable" class="inline-flex items-center bg-green-50 text-green-700 px-2 py-1 rounded-md text-xs font-bold border border-green-200">Active</span>
                <span v-else class="inline-flex items-center bg-slate-100 text-slate-500 px-2 py-1 rounded-md text-xs font-bold border border-slate-200">Inactive</span>
              </td>
              <td class="px-6 py-4 text-right">
                <button @click="handleEdit(item)" class="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-slate-100 rounded-lg">
                  <span class="material-symbols-outlined text-[20px]">edit</span>
                </button>
                <button @click="deleteItem(item.id)" class="p-2 text-slate-400 hover:text-red-500 transition-colors hover:bg-slate-100 rounded-lg ml-1">
                  <span class="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div v-if="filteredItems.length === 0" class="p-12 text-center text-slate-500">
          <span class="material-symbols-outlined text-4xl mb-2 opacity-50">fastfood</span>
          <p class="font-medium">No menu items found.</p>
        </div>
      </div>
      </div>
    </main>

    <!-- Modal Form -->
    <div v-if="showAddModal" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div class="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 class="text-lg font-bold">{{ isEditing ? 'Edit Item' : 'Create Menu Item' }}</h3>
          <button @click="showAddModal = false" class="text-slate-400 hover:text-red-500">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <form @submit.prevent="submitForm" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-bold text-slate-700 mb-1">Name</label>
            <input v-model="formData.name" required type="text" class="w-full rounded-lg border-slate-200 focus:border-primary focus:ring-primary shadow-sm" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1">Price ($)</label>
              <input v-model="formData.price" required type="number" step="0.01" min="0" class="w-full rounded-lg border-slate-200 focus:border-primary focus:ring-primary shadow-sm" />
            </div>
            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1">Category</label>
              <select v-model="formData.categoryId" required class="w-full rounded-lg border-slate-200 focus:border-primary focus:ring-primary shadow-sm">
                <option value="" disabled>Select category</option>
                <option v-for="cat in menuStore.categories" :key="cat.id" :value="cat.id">{{ getCategoryDisplayName(cat.name) }}</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-sm font-bold text-slate-700 mb-1">Description</label>
            <textarea v-model="formData.description" rows="2" class="w-full rounded-lg border-slate-200 focus:border-primary focus:ring-primary shadow-sm"></textarea>
          </div>
          <div>
            <label class="block text-sm font-bold text-slate-700 mb-1">Image <span class="text-xs font-normal text-slate-400">(Upload new)</span></label>
            <input type="file" @change="handleFileUpload" accept="image/jpeg, image/png" class="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
          </div>
          <div class="flex items-center mt-2">
            <input v-model="formData.isAvailable" type="checkbox" id="available" class="rounded border-slate-300 text-primary focus:ring-primary text-lg size-5 translate-y-[2px]" />
            <label for="available" class="ml-2 text-sm font-medium text-slate-700">Item is available for order</label>
          </div>
          
          <div class="pt-4 flex gap-3">
            <button type="button" @click="showAddModal = false" class="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50 transition-colors" :disabled="isSaving">Cancel</button>
            <button type="submit" class="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-bold shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isSaving">
              <span v-if="isSaving" class="material-symbols-outlined animate-spin align-middle mr-1 text-[18px]">autorenew</span>
              {{ isSaving ? 'Saving...' : 'Save Item' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
