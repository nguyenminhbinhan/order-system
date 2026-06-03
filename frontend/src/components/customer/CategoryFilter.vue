<script setup lang="ts">
defineProps<{
  categories: any[];
  activeCategoryId: string | null;
}>();

defineEmits<{
  (e: 'select', id: string | null): void;
}>();
</script>

<template>
  <div class="flex px-3 sm:px-4 gap-2 overflow-x-auto no-scrollbar py-2">
    
    <button 
      @click="$emit('select', null)"
      :class="[
        'px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 min-h-[40px] sm:min-h-[36px]',
        activeCategoryId === null 
          ? 'bg-primary text-white shadow-sm shadow-primary/20' 
          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-primary/30 hover:text-primary active:scale-95'
      ]"
    >
      Tất cả
    </button>

    <button 
      v-for="cat in categories" 
      :key="cat.id"
      @click="$emit('select', cat.id)"
      :class="[
        'px-4 py-2.5 sm:py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 min-h-[40px] sm:min-h-[36px]',
        activeCategoryId === cat.id 
          ? 'bg-primary text-white shadow-sm shadow-primary/20' 
          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-primary/30 hover:text-primary active:scale-95'
      ]"
    >
      {{ cat.displayName || cat.name }}
    </button>

  </div>
</template>
