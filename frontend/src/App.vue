<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const isOnline = ref(navigator.onLine);

const updateOnlineStatus = () => {
  isOnline.value = navigator.onLine;
};

onMounted(() => {
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
});

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus);
  window.removeEventListener('offline', updateOnlineStatus);
});
</script>

<template>
  <div v-if="!isOnline" class="fixed top-0 left-0 w-full bg-red-600 text-white text-center py-2 z-[9999] font-bold text-sm flex items-center justify-center gap-2 shadow-lg">
    <span class="material-symbols-outlined text-[18px]">wifi_off</span>
    Mất kết nối mạng
  </div>
  
  <div :class="{ 'mt-[36px]': !isOnline, 'pointer-events-none opacity-50': !isOnline }" class="min-h-screen transition-all select-none">
    <router-view />
  </div>
</template>

<style>
/* Global styles */
</style>
