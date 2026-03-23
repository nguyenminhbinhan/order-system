<script setup lang="ts">
import { computed, ref } from 'vue';
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
  return 'https://placehold.co/300x300?text=No+Image'; // Default placeholder
});

const note = ref('');

const addToCart = () => {
  cartStore.addItem(props.item, 1, note.value);
  note.value = '';
};
</script>

<template>
  <div class="flex flex-col gap-3 pb-3 bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-primary/5 group">
    <div 
      class="w-full bg-center bg-no-repeat aspect-square bg-cover transition-transform duration-300 group-hover:scale-105" 
      :data-alt="item.name" 
      :style="{ backgroundImage: `url('${imageUrl}')` }"
    ></div>
    <div class="p-3">
      <p class="text-slate-900 dark:text-slate-100 text-base font-bold leading-tight line-clamp-1">{{ item.name }}</p>
      <p class="text-slate-500 dark:text-slate-400 text-xs mb-3 line-clamp-1">{{ item.description || 'No description available' }}</p>
      
      <input 
        v-model="note" 
        type="text" 
        placeholder="Ghi chú (ít đá, không cay...)" 
        class="w-full text-xs rounded-lg border-slate-200 focus:border-primary focus:ring-primary shadow-sm mb-3 px-3 py-2 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 placeholder:text-slate-400"
      />

      <div class="flex items-center justify-between">
        <p class="text-primary text-base font-bold leading-normal">{{ formatCurrency(item.price) }}</p>
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
