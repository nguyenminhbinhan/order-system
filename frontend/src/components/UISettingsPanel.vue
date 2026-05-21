<script setup lang="ts">
import { useUIStore } from '@/stores/ui.store';
import type { ThemeMode, ViewportMode } from '@/stores/ui.store';

const ui = useUIStore();

const themes: { mode: ThemeMode; icon: string; label: string }[] = [
  { mode: 'light', icon: 'light_mode', label: 'Sáng' },
  { mode: 'dark', icon: 'dark_mode', label: 'Tối' },
  { mode: 'system', icon: 'desktop_windows', label: 'Hệ thống' },
];

const viewports: { mode: ViewportMode; icon: string; label: string; desc: string }[] = [
  { mode: 'desktop', icon: 'desktop_windows', label: 'Desktop', desc: '100%' },
  { mode: 'tablet', icon: 'tablet_mac', label: 'Tablet', desc: '820px' },
  { mode: 'mobile', icon: 'smartphone', label: 'Mobile', desc: '430px' },
];
</script>

<template>
  <!-- Floating Settings Button -->
  <button
    @click="ui.toggleSettings()"
    class="fixed bottom-5 right-5 z-[9998] w-12 h-12 rounded-full bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 shadow-xl hover:shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
    :class="{ 'rotate-90': ui.showSettings }"
    style="transition: transform 0.2s ease, box-shadow 0.2s ease;"
    title="Cài đặt giao diện"
  >
    <span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' 1;">
      {{ ui.showSettings ? 'close' : 'tune' }}
    </span>
  </button>

  <!-- Settings Panel -->
  <Transition name="settings">
    <div
      v-if="ui.showSettings"
      class="fixed bottom-20 right-5 z-[9997] w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in"
    >
      <!-- Header -->
      <div class="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
        <h3 class="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px] text-primary">palette</span>
          Cài đặt giao diện
        </h3>
      </div>

      <!-- Theme Section -->
      <div class="px-5 py-4">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Chế độ màu</p>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="theme in themes"
            :key="theme.mode"
            @click="ui.setTheme(theme.mode)"
            :class="[
              'flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl text-[11px] font-bold transition-all',
              ui.themeMode === theme.mode
                ? 'bg-primary/10 text-primary ring-2 ring-primary/30'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            ]"
          >
            <span class="material-symbols-outlined text-[20px]" :style="ui.themeMode === theme.mode ? 'font-variation-settings: FILL 1;' : ''">
              {{ theme.icon }}
            </span>
            {{ theme.label }}
          </button>
        </div>
      </div>

      <!-- Viewport Section -->
      <div class="px-5 py-4 border-t border-slate-100 dark:border-slate-800">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Chế độ hiển thị</p>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="vp in viewports"
            :key="vp.mode"
            @click="ui.setViewport(vp.mode)"
            :class="[
              'flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-[11px] font-bold transition-all',
              ui.viewportMode === vp.mode
                ? 'bg-primary/10 text-primary ring-2 ring-primary/30'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            ]"
          >
            <span class="material-symbols-outlined text-[20px]" :style="ui.viewportMode === vp.mode ? 'font-variation-settings: FILL 1;' : ''">
              {{ vp.icon }}
            </span>
            {{ vp.label }}
            <span class="text-[9px] font-medium opacity-60">{{ vp.desc }}</span>
          </button>
        </div>
      </div>

      <!-- Current Info -->
      <div class="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
        <div class="flex items-center justify-between text-[10px] text-slate-400 font-medium">
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full" :class="ui.isDark ? 'bg-indigo-400' : 'bg-amber-400'"></span>
            {{ ui.isDark ? 'Dark' : 'Light' }} • {{ ui.viewportConfig.label }}
          </span>
          <span>Bình An POS</span>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Backdrop -->
  <Transition name="fade">
    <div 
      v-if="ui.showSettings" 
      @click="ui.showSettings = false"
      class="fixed inset-0 z-[9996] bg-black/10 backdrop-blur-[1px]"
    ></div>
  </Transition>
</template>

<style scoped>
.settings-enter-active,
.settings-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.settings-enter-from,
.settings-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
