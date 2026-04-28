<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCartStore } from '@/stores/cart.store';

const props = defineProps<{
  item: any;
}>();

const cartStore = useCartStore();
const imageLoaded = ref(false);

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
};

const imageUrl = computed(() => {
  const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  let imgFilename = props.item.imageFilename;
  
  if (!imgFilename && props.item.images && props.item.images.length > 0) {
    imgFilename = props.item.images[0].image;
  }
  
  if (imgFilename) {
    if (imgFilename.startsWith('http')) {
        return imgFilename;
    }
    
    // Always strip old prefix artifacts safely before assembling the final URL
    const cleanName = imgFilename.replace('/uploads/images/', '').replace('/uploads/', '');
    return `${BASE_URL}/uploads/${cleanName}`;
  }
  
  return 'https://placehold.co/300x300?text=No+Image';
});

const addToCart = () => {
  cartStore.addItem({ ...props.item, price: Number(props.item.price) }, 1);
};

const handleImageError = (e: Event) => {
  imageLoaded.value = true;
  (e.target as HTMLImageElement).src = 'https://placehold.co/300x300?text=No+Image';
};
</script>

<template>
  <div class="flex flex-col gap-3 pb-3 bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-primary/5 group">
    <div class="w-full aspect-square relative overflow-hidden rounded-t-xl bg-slate-100 dark:bg-slate-700">
      <div v-if="!imageLoaded" class="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-600"></div>
      <img 
        :src="imageUrl" 
        :alt="item.name"
        @load="imageLoaded = true"
        @error="handleImageError"
        class="absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
        :class="{ 'opacity-0': !imageLoaded }"
      />
    </div>
    <div class="p-3">
      <p class="text-slate-900 dark:text-slate-100 text-base font-bold leading-tight line-clamp-1">{{ item.name }}</p>
      <p class="text-slate-500 dark:text-slate-400 text-xs mb-3 line-clamp-1">{{ item.description || 'No description available' }}</p>

      <div class="flex items-center justify-between">
        <p class="text-primary text-base font-bold leading-normal">{{ formatCurrency(Number(item.price)) }}</p>
        <button 
          @click="addToCart"
          class="bg-primary hover:bg-primary/90 text-white rounded-lg px-3 py-1 text-sm font-bold flex items-center gap-1"
        >
          <span class="material-symbols-outlined text-sm">add</span>
          Thêm
        </button>
      </div>
    </div>
  </div>
</template>
