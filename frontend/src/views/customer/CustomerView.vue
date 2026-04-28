<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useMenuStore } from '@/stores/menu.store';
import { useCartStore } from '@/stores/cart.store';
import FoodCard from '@/components/customer/FoodCard.vue';
import CategoryFilter from '@/components/customer/CategoryFilter.vue';
import ThankYouOverlay from '@/components/customer/ThankYouOverlay.vue';
import { useRouter, useRoute } from 'vue-router';
import { useOrderStore } from '@/stores/order.store';
import { socketService } from '@/services/socket';
import { toast } from 'vue3-toastify';

const showThankYou = ref(false);

const menuStore = useMenuStore();
const cartStore = useCartStore();
const orderStore = useOrderStore();
const router = useRouter();
const route = useRoute();

const searchQuery = ref('');
const activeCategoryId = ref<string | null>(null);

const categoryMap: Record<string, string> = {
  'All': 'Tất cả',
  'Category 1': 'Món chính',
  'Category 2': 'Món phụ',
  'Category 3': 'Tráng miệng',
  'Category 4': 'Nước uống'
};

const getCategoryDisplayName = (name: string) => {
  return categoryMap[name] || name;
};

// Extract unique categories from menu items
const categories = computed(() => {
  const catsMap = new Map();
  menuStore.menuItems.forEach(item => {
    if (item.category) {
      catsMap.set(item.category.id, {
        ...item.category,
        displayName: getCategoryDisplayName(item.category.name)
      });
    }
  });
  // Sort categories by sortOrder if available
  return Array.from(catsMap.values()).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
});

// Filter items by category and search
const filteredMenuItems = computed(() => {
  let items = menuStore.menuItems;
  
  if (activeCategoryId.value) {
    items = items.filter(item => item.categoryId === activeCategoryId.value);
  }
  
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    items = items.filter(item => item.name.toLowerCase().includes(q) || (item.description && item.description.toLowerCase().includes(q)));
  }
  
  return items;
});

onMounted(() => {
  if (route.query.tableId) {
    orderStore.setTableId(Number(route.query.tableId));
    // Optionally remove the query param from URL so it doesn't stay there, but keeping it is fine.
  }
  
  if (orderStore.activeTableId) {
    menuStore.fetchMenuItems();
    
    // Listen for payment completion to show Thank You screen
    socketService.on('paymentCompleted', (payload: any) => {
      if (Number(payload.tableId) === Number(orderStore.activeTableId)) {
        showThankYou.value = true;
      }
    });
  }
});

onUnmounted(() => {
  socketService.off('paymentCompleted');
});

// Called when countdown finishes — clear state but DO NOT redirect.
// The overlay stays visible in its terminal state.
const handleSessionEnd = () => {
  cartStore.clearCart();
  orderStore.clearTableId();
  orderStore.clearOrderId();
  // Do NOT set showThankYou = false — overlay stays in terminal state
  // Do NOT redirect — session is ended, screen stays as-is
};

// Called when user explicitly clicks "Quét lại để gọi món"
const handleRestart = () => {
  const tableId = orderStore.activeTableId || Number(route.query.tableId);
  cartStore.clearCart();
  orderStore.clearTableId();
  orderStore.clearOrderId();
  showThankYou.value = false;
  // Navigate to a clean customer page — setTableId will create a new session
  // only if the cooldown has passed
  if (tableId) {
    window.location.href = `/customer?tableId=${tableId}`;
  } else {
    window.location.href = '/';
  }
};
</script>

<template>
  <div class="relative flex h-full w-full max-w-md mx-auto flex-col bg-background-light dark:bg-background-dark overflow-x-hidden shadow-2xl min-h-screen pb-20">
    
    <!-- No Table Warning -->
    <div v-if="!orderStore.activeTableId" class="flex flex-col items-center justify-center p-8 mt-20 text-center h-full my-auto">
      <div class="w-24 h-24 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-6">
        <span class="material-symbols-outlined text-5xl">qr_code_scanner</span>
      </div>
      <h3 class="text-xl font-bold mb-2">Table Not Found</h3>
      <p class="text-slate-500 mb-8">Please scan the QR code on your table to access the menu and start ordering.</p>
    </div>

    <!-- Main Menu Content -->
    <template v-else>
      <!-- Header -->
      <div class="flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-20 border-b border-primary/10">
      <div class="text-slate-900 dark:text-slate-100 flex size-12 shrink-0 items-center justify-start">
        <span class="material-symbols-outlined cursor-pointer">menu</span>
      </div>
      <h2 class="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Menu</h2>
      <div class="flex w-12 items-center justify-end">
        <button 
          @click="router.push('/customer/cart')"
          class="relative flex cursor-pointer items-center justify-center rounded-lg h-12 w-12 bg-transparent text-slate-900 dark:text-slate-100 p-0"
        >
          <span class="material-symbols-outlined">shopping_cart</span>
          <span 
            v-if="cartStore.totalItems > 0"
            class="absolute top-2 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white font-bold"
          >
            {{ cartStore.totalItems }}
          </span>
        </button>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="px-4 py-4 sticky top-[64px] bg-background-light dark:bg-background-dark z-10 w-full">
      <label class="flex flex-col min-w-40 h-12 w-full">
        <div class="flex w-full flex-1 items-stretch rounded-xl h-full overflow-hidden shadow-sm border border-primary/5">
          <div class="text-slate-500 dark:text-slate-400 flex bg-white dark:bg-slate-800 items-center justify-center pl-4">
            <span class="material-symbols-outlined">search</span>
          </div>
          <input 
            v-model="searchQuery"
            class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden text-slate-900 dark:text-slate-100 focus:outline-0 focus:ring-0 border-none bg-white dark:bg-slate-800 h-full placeholder:text-slate-400 px-4 pl-2 text-base font-normal leading-normal" 
            placeholder="Search for food, drinks, etc." 
          />
        </div>
      </label>
    </div>

    <!-- Category Tabs -->
    <CategoryFilter 
      :categories="categories" 
      :activeCategoryId="activeCategoryId" 
      @select="(id) => activeCategoryId = id" 
    />

    <!-- UI State: Loading -->
    <div v-if="menuStore.loading" class="flex flex-col items-center justify-center p-8 mt-10">
      <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p class="mt-4 text-slate-500 font-medium">Loading delicious items...</p>
    </div>

    <!-- UI State: Error -->
    <div v-else-if="menuStore.error" class="flex flex-col items-center justify-center p-8 mt-10 text-center">
      <div class="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-4">
        <span class="material-symbols-outlined text-3xl">error</span>
      </div>
      <p class="text-slate-900 dark:text-slate-100 font-bold mb-2">Oops!</p>
      <p class="text-slate-500 text-sm">{{ menuStore.error }}</p>
      <button @click="menuStore.fetchMenuItems()" class="mt-4 px-4 py-2 bg-primary text-white rounded-lg font-bold">Retry</button>
    </div>

    <!-- UI State: Empty -->
    <div v-else-if="filteredMenuItems.length === 0" class="flex flex-col items-center justify-center p-8 mt-10 text-center">
      <div class="w-20 h-20 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mb-4">
        <span class="material-symbols-outlined text-4xl">restaurant_menu</span>
      </div>
      <p class="text-slate-900 dark:text-slate-100 font-bold mb-2">Không có dữ liệu</p>
      <p class="text-slate-500 text-sm">Try adjusting your filters or search query.</p>
    </div>

    <!-- Product Grid -->
    <div v-else class="grid grid-cols-2 gap-4 p-4 mb-20">
      <FoodCard 
        v-for="item in filteredMenuItems" 
        :key="item.id" 
        :item="item" 
      />
    </div>
    </template>

    <!-- Thank You Overlay -->
    <ThankYouOverlay 
      :visible="showThankYou" 
      @complete="handleSessionEnd" 
      @restart="handleRestart" 
    />
  </div>
</template>
