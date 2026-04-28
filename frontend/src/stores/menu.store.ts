import { defineStore } from 'pinia';
import { ref } from 'vue';
import { menuService } from '@/services/menu.service';

export const useMenuStore = defineStore('menu', () => {
  const menuItems = ref<any[]>([]);
  const categories = ref<any[]>([]);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  async function fetchMenuItems(forceRefresh = false) {
    if (!forceRefresh && menuItems.value.length > 0 && categories.value.length > 0) {
      return; // Use cached data
    }
    
    loading.value = true;
    error.value = null;
    try {
      const [itemsData, catsData] = await Promise.all([
        menuService.getMenuItems(),
        menuService.getCategories()
      ]);
      menuItems.value = itemsData;
      categories.value = catsData;
      console.log('--- DEBUG: FETCHED MENU ITEMS ---', itemsData);
      console.log('--- DEBUG: FETCHED CATEGORIES ---', catsData);
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch menu data';
    } finally {
      loading.value = false;
    }
  }

  return { menuItems, categories, loading, error, fetchMenuItems };
});
