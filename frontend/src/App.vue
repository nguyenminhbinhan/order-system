<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import UISettingsPanel from '@/components/UISettingsPanel.vue';
import { useUIStore } from '@/stores/ui.store';

const ui = useUIStore();

const isOnline = ref(navigator.onLine);

const updateOnlineStatus = () => {
  isOnline.value = navigator.onLine;
};

onMounted(() => {
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  // Ensure theme is applied on mount
  ui.applyTheme();
});

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus);
  window.removeEventListener('offline', updateOnlineStatus);
});

// Viewport simulation container style
const viewportStyle = computed(() => {
  if (ui.viewportMode === 'desktop') {
    return {};
  }
  return {
    maxWidth: ui.viewportConfig.maxWidth,
    margin: '0 auto',
    boxShadow: '0 0 0 1px rgba(100,116,139,0.1), 0 25px 50px -12px rgba(0,0,0,0.15)',
    borderRadius: ui.viewportMode === 'mobile' ? '24px' : '16px',
    overflow: 'hidden',
  };
});

const isSimulating = computed(() => ui.viewportMode !== 'desktop');
</script>

<template>
  <!-- Offline Banner -->
  <div v-if="!isOnline" class="fixed top-0 left-0 w-full bg-red-600 text-white text-center py-2 z-[9999] font-bold text-sm flex items-center justify-center gap-2 shadow-lg">
    <span class="material-symbols-outlined text-[18px]">wifi_off</span>
    Mất kết nối mạng
  </div>
  
  <!-- Viewport Simulation Shell -->
  <div 
    v-if="isSimulating" 
    class="min-h-screen bg-slate-200 dark:bg-slate-950 flex flex-col items-center py-4 transition-colors duration-300"
  >
    <!-- Device Frame Label -->
    <div class="mb-3 flex items-center gap-2 text-[11px] font-bold text-slate-400 dark:text-slate-500">
      <span class="material-symbols-outlined text-[16px]">{{ ui.viewportConfig.icon }}</span>
      {{ ui.viewportConfig.label }} Preview • {{ ui.viewportConfig.maxWidth }}
    </div>
    
    <!-- Simulated Device Container -->
    <div 
      class="w-full flex-1 bg-background-light dark:bg-background-dark transition-all duration-300"
      :style="viewportStyle"
      :class="{ 'mt-[36px]': !isOnline }"
    >
      <router-view />
    </div>
  </div>

  <!-- Normal (Desktop) Layout -->
  <div 
    v-else
    :class="{ 'mt-[36px]': !isOnline, 'pointer-events-none opacity-50': !isOnline }" 
    class="min-h-screen transition-colors duration-300 select-none"
  >
    <router-view />
  </div>

  <!-- Global UI Settings Panel (always visible) -->
  <UISettingsPanel />
</template>

<style>
/* Theme transition — smooth background/color changes */
html {
  transition: color 0.3s ease, background-color 0.3s ease;
}

html.dark {
  color-scheme: dark;
}
</style>
