<script setup lang="ts">
import { computed } from 'vue';
import { useCartStore } from '@/stores/cart.store';
import { API_BASE_URL } from '@/utils/constants';

const props = defineProps<{
  item: any;
}>();

const cartStore = useCartStore();

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
};

const imageUrl = computed(() => {
  const BASE_URL = API_BASE_URL;
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
    // Confirm before removing last item — prevents accidental fat-finger removal on mobile
    const confirmed = confirm(`Xóa "${props.item.name}" khỏi giỏ hàng?`);
    if (confirmed) {
      cartStore.removeItem(props.item.cartItemId);
    }
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
  <div class="flex items-start gap-3 sm:gap-4 px-3 sm:px-4 py-3.5 sm:py-4 border-b border-slate-50 dark:border-slate-800/50">
    <!-- Image — larger on mobile for tap-to-preview feel -->
    <div class="relative rounded-xl w-[72px] h-[72px] sm:w-20 sm:h-20 shadow-sm overflow-hidden shrink-0">
      <img 
        :src="imageUrl" 
        :alt="item.name"
        @error="handleImageError"
        class="absolute inset-0 w-full h-full object-cover" 
        loading="lazy"
      />
    </div>
    
    <div class="flex flex-col flex-1 gap-1.5 sm:gap-2 min-w-0">
      <!-- Name + delete row -->
      <div class="flex justify-between items-start gap-2">
         <div class="flex-1 min-w-0">
           <p class="text-slate-900 dark:text-slate-100 text-[15px] sm:text-base font-bold leading-snug truncate">{{ item.name }}</p>
           <p class="text-slate-500 dark:text-slate-400 text-sm font-medium mt-0.5">{{ formatCurrency(Number(item.price)) }}</p>
         </div>
         <!-- Delete button — 44px touch target -->
         <button @click="removeItem" class="text-slate-300 hover:text-red-500 p-2 -mr-2 -mt-1 transition-colors cursor-pointer shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center">
           <span class="material-symbols-outlined text-[20px]">delete</span>
         </button>
      </div>
      
      <!-- Note + quantity row -->
      <div class="flex gap-2 sm:gap-3 items-end">
        <div class="flex-1 min-w-0">
          <input 
            v-model="item.note" 
            type="text" 
            placeholder="Thêm ghi chú..." 
            class="w-full text-xs rounded-lg border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary shadow-sm px-3 py-2.5 sm:py-2 dark:bg-slate-900/50 dark:border-slate-700 dark:text-slate-100 placeholder:text-slate-400 transition-all font-medium min-h-[40px] sm:min-h-[36px]"
          />
        </div>
        
        <!-- Quantity controls — larger buttons on mobile -->
        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
          <button @click="decreaseQuantity" class="flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 shadow-sm hover:bg-slate-200 transition-colors text-slate-600 dark:text-slate-300 font-bold hover:shadow-md w-10 h-10 sm:w-8 sm:h-8 active:scale-90">
            <span class="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <span class="text-sm font-black w-5 text-center tabular-nums">{{ item.quantity }}</span>
          <button @click="increaseQuantity" class="flex items-center justify-center rounded-xl bg-primary text-white shadow-sm hover:bg-primary/90 transition-colors font-bold hover:shadow-md w-10 h-10 sm:w-8 sm:h-8 active:scale-90">
            <span class="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
