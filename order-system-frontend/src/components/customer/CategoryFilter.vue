<script setup lang="ts">
defineProps<{
  categories: any[];
  activeCategoryId: string | null;
}>();

defineEmits<{
  (e: 'select', categoryId: string | null): void;
}>();
</script>

<template>
  <div class="pb-3 sticky top-[128px] bg-background-light dark:bg-background-dark z-10 w-full overflow-hidden">
    <div class="flex border-b border-slate-200 dark:border-slate-700 px-4 gap-6 overflow-x-auto no-scrollbar w-full whitespace-nowrap">
      
      <a 
        href="#"
        @click.prevent="$emit('select', null)"
        class="flex flex-col items-center justify-center pb-[13px] pt-2 shrink-0 transition-colors"
        :class="[
          activeCategoryId === null 
            ? 'border-b-[3px] border-primary text-primary' 
            : 'border-b-[3px] border-transparent text-slate-500 dark:text-slate-400 hover:text-primary'
        ]"
      >
        <p class="text-sm font-bold leading-normal tracking-[0.015em]">Tất cả</p>
      </a>

      <a 
        v-for="cat in categories" 
        :key="cat.id"
        href="#"
        @click.prevent="$emit('select', cat.id)"
        class="flex flex-col items-center justify-center pb-[13px] pt-2 shrink-0 transition-colors"
        :class="[
          activeCategoryId === cat.id 
            ? 'border-b-[3px] border-primary text-primary' 
            : 'border-b-[3px] border-transparent text-slate-500 dark:text-slate-400 hover:text-primary'
        ]"
      >
        <p class="text-sm font-bold leading-normal tracking-[0.015em]">{{ cat.displayName || cat.name }}</p>
      </a>

    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
