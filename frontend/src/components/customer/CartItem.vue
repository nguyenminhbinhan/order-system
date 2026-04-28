<script setup lang="ts">
import { computed } from 'vue';
import { useCartStore } from '@/stores/cart.store';

const props = defineProps<{
  item: any;
}>();

const cartStore = useCartStore();

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
    if (imgFilename.startsWith('http')) return imgFilename;
    const cleanName = imgFilename.replace('/uploads/images/', '').replace('/uploads/', '');
    return `${BASE_URL}/uploads/${cleanName}`;
  }
  return 'https://placehold.co/150x150?text=No+Image';
});

const increaseQuantity = () => {
  cartStore.addItem(props.item, 1, props.item.note || '');
};

const decreaseQuantity = () => {
  if (props.item.quantity > 1) {
    cartStore.addItem(props.item, -1, props.item.note || '');
  } else {
    cartStore.removeItem(props.item.cartItemId);
  }
};

const removeItem = () => {
  cartStore.removeItem(props.item.cartItemId);
};

const handleImageError = (e: Event) => {
  (e.target as HTMLImageElement).src = 'https://placehold.co/150x150?text=No+Image';
};
</script>

<template>
  <div class="flex items-center gap-4 px-4 py-4 border-b border-slate-50 dark:border-slate-800/50">
    <div class="relative rounded-xl size-20 shadow-sm overflow-hidden shrink-0 self-start mt-1">
      <img 
        :src="imageUrl" 
        :alt="item.name"
        @error="handleImageError"
        class="absolute inset-0 w-full h-full object-cover" 
      />
    </div>
    
    <div class="flex flex-col flex-1 gap-2 py-1">
      <div class="flex justify-between items-start">
         <div class="flex-1 pr-2">
           <p class="text-slate-900 dark:text-slate-100 text-base font-bold leading-snug">{{ item.name }}</p>
           <p class="text-slate-500 dark:text-slate-400 text-sm font-medium mt-0.5">{{ formatCurrency(Number(item.price)) }}</p>
         </div>
         <button @click="removeItem" class="text-slate-300 hover:text-red-500 p-1 -mr-1 -mt-1 transition-colors cursor-pointer shrink-0">
           <span class="material-symbols-outlined text-[20px]">delete</span>
         </button>
      </div>
      
      <div class="flex gap-3 mt-1 items-end">
        <div class="flex-1">
          <input 
            v-model="item.note" 
            type="text" 
            placeholder="Thêm ghi chú..." 
            class="w-full text-xs rounded-lg border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary shadow-sm px-3 py-2 dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-100 placeholder:text-slate-400 transition-all font-medium"
          />
        </div>
        
        <div class="flex items-center gap-3 p-1 rounded-xl shrink-0">
          <button @click="decreaseQuantity" class="flex size-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 shadow-sm hover:bg-slate-200 transition-colors text-slate-600 dark:text-slate-300 font-bold hover:shadow-md">
            <span class="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <span class="text-sm font-bold w-4 text-center">{{ item.quantity }}</span>
          <button @click="increaseQuantity" class="flex size-8 items-center justify-center rounded-lg bg-primary text-white shadow-sm hover:bg-primary/90 transition-colors font-bold hover:shadow-md">
            <span class="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
