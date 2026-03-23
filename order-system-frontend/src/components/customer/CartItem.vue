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
  if (props.item.images && props.item.images.length > 0) {
    const imgFilename = props.item.images[0].image;
    if (imgFilename.startsWith('http')) return imgFilename;
    return `http://localhost:3000/uploads/images/${imgFilename}`;
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
</script>

<template>
  <div class="flex items-center gap-4 px-4 min-h-[88px] py-4 border-b border-slate-50 dark:border-slate-800/50">
    <div 
      class="bg-center bg-no-repeat aspect-square bg-cover rounded-xl size-20 shadow-sm" 
      :data-alt="item.name" 
      :style="{ backgroundImage: `url('${imageUrl}')` }"
    ></div>
    
    <div class="flex flex-col justify-center flex-1">
      <p class="text-slate-900 dark:text-slate-100 text-base font-bold leading-normal line-clamp-1">{{ item.name }}</p>
      <p v-if="item.note" class="text-slate-500 italic text-xs leading-tight mb-1">Ghi chú: {{ item.note }}</p>
      <p class="text-slate-500 dark:text-slate-400 text-sm font-medium leading-normal mb-2">{{ formatCurrency(item.price) }}</p>
      
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3 text-slate-900 dark:text-slate-100">
          <button @click="decreaseQuantity" class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <span class="material-symbols-outlined text-sm">remove</span>
          </button>
          <span class="text-sm font-bold w-4 text-center">{{ item.quantity }}</span>
          <button @click="increaseQuantity" class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <span class="material-symbols-outlined text-sm">add</span>
          </button>
        </div>
        <button @click="removeItem" class="text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
          <span class="material-symbols-outlined text-sm">delete</span>
        </button>
      </div>
    </div>
  </div>
</template>
