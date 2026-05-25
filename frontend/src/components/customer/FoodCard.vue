<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCartStore } from '@/stores/cart.store';
import { resolveImageUrl } from '@/utils/imageUrl';

const props = defineProps<{
  item: any;
}>();

const cartStore = useCartStore();
const imageLoaded = ref(false);

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
};

const imageUrl = computed(() => resolveImageUrl(props.item));

const cartQty = computed(() => {
  const found = cartStore.items.find(i => i.id === props.item.id && !i.note);
  return found ? found.quantity : 0;
});

const addToCart = () => {
  cartStore.addItem({ ...props.item, price: Number(props.item.price) }, 1);
};

const increment = () => {
  const existing = cartStore.items.find(i => i.id === props.item.id && !i.note);
  if (existing) {
    cartStore.updateQuantity(existing.cartItemId, existing.quantity + 1);
  } else {
    addToCart();
  }
};

const decrement = () => {
  const existing = cartStore.items.find(i => i.id === props.item.id && !i.note);
  if (existing) {
    if (existing.quantity === 1) {
      const confirmed = confirm(`Bạn có chắc chắn muốn bỏ "${props.item.name}" khỏi giỏ hàng?`);
      if (confirmed) {
        cartStore.removeItem(existing.cartItemId);
      }
    } else {
      cartStore.updateQuantity(existing.cartItemId, existing.quantity - 1);
    }
  }
};

const handleImageError = (e: Event) => {
  imageLoaded.value = true;
  const target = e.target as HTMLImageElement;
  target.onerror = null;
  target.src = 'https://placehold.co/300x300?text=No+Image';
};
</script>

<template>
  <div 
    class="flex flex-col bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700/50 group hover:shadow-md transition-all duration-200 relative cursor-pointer"
    :class="cartQty === 0 ? 'active:scale-[0.97]' : ''"
    @click="cartQty === 0 ? addToCart() : null"
  >
    <!-- Image — 4:3 ratio for better mobile food display -->
    <div class="w-full aspect-[4/3] relative overflow-hidden bg-slate-100 dark:bg-slate-700">
      <div v-if="!imageLoaded" class="absolute inset-0 skeleton"></div>
      <img 
        :src="imageUrl" 
        :alt="item.name"
        @load="imageLoaded = true"
        @error="handleImageError"
        class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 group-active:scale-100"
        :class="{ 'opacity-0': !imageLoaded }"
        loading="lazy"
      />
      <!-- Cart quantity badge -->
      <div 
        v-if="cartQty > 0" 
        class="absolute top-2.5 right-2.5 bg-primary text-white text-xs font-black min-w-[26px] h-[26px] rounded-full flex items-center justify-center shadow-lg shadow-primary/30 animate-scale-in px-1.5"
      >
        {{ cartQty }}
      </div>
    </div>

    <!-- Info — responsive padding and typography -->
    <div class="p-3 sm:p-3.5 flex-1 flex flex-col justify-between min-h-[80px]">
      <div>
        <p class="text-slate-900 dark:text-slate-100 text-[13px] sm:text-sm font-bold leading-snug line-clamp-2 mb-0.5">{{ item.name }}</p>
        <p v-if="item.description" class="text-slate-400 text-[11px] leading-snug line-clamp-1 mb-1.5">{{ item.description }}</p>
      </div>

      <div class="flex items-center justify-between mt-auto pt-1.5">
        <p class="text-primary text-sm sm:text-[15px] font-black">{{ formatCurrency(Number(item.price)) }}</p>
        
        <!-- Quantity control steppers -->
        <div v-if="cartQty > 0" class="flex items-center bg-slate-100 dark:bg-slate-700/70 rounded-xl p-0.5 gap-1.5" @click.stop>
          <button 
            class="w-8 h-8 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center bg-white dark:bg-slate-650 text-slate-700 dark:text-slate-200 active:scale-90 shadow-sm transition-all hover:bg-slate-50"
            @click.stop="decrement"
            aria-label="Giảm số lượng"
          >
            <span class="material-symbols-outlined text-[18px] sm:text-[16px]">remove</span>
          </button>
          <span class="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 min-w-[20px] text-center">
            {{ cartQty }}
          </span>
          <button 
            class="w-8 h-8 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center bg-primary text-white active:scale-90 shadow-sm transition-all hover:bg-primary/95"
            @click.stop="increment"
            aria-label="Tăng số lượng"
          >
            <span class="material-symbols-outlined text-[18px] sm:text-[16px]">add</span>
          </button>
        </div>
        
        <button 
          v-else
          @click.stop="addToCart"
          class="bg-primary/10 hover:bg-primary text-primary hover:text-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-0.5 shadow-sm"
        >
          <span class="material-symbols-outlined text-[14px]">add</span>
          Thêm món
        </button>
      </div>
    </div>
  </div>
</template>
