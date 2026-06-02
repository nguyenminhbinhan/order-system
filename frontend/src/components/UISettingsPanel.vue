<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
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

// Drag and drop settings button state
const posX = ref(0);
const posY = ref(0);
const isDragging = ref(false);

let startX = 0;
let startY = 0;
let initialPosX = 0;
let initialPosY = 0;
let hasDraggedSignificant = false;

// Helper to constrain position within screen boundary margins
const constrainPosition = (x: number, y: number) => {
  const buttonSize = 48;
  const margin = 10;
  const defaultRight = 20;
  const defaultBottom = 20;
  
  const defaultX = window.innerWidth - defaultRight - buttonSize;
  const defaultY = window.innerHeight - defaultBottom - buttonSize;
  
  const minX = margin;
  const maxX = window.innerWidth - buttonSize - margin;
  const minY = margin;
  const maxY = window.innerHeight - buttonSize - margin;
  
  const targetX = defaultX + x;
  const targetY = defaultY + y;
  
  const clampedX = Math.max(minX, Math.min(maxX, targetX));
  const clampedY = Math.max(minY, Math.min(maxY, targetY));
  
  return {
    x: clampedX - defaultX,
    y: clampedY - defaultY
  };
};

const startDrag = (event: MouseEvent | TouchEvent) => {
  if (event.type === 'mousedown' && (event as MouseEvent).button !== 0) {
    return;
  }
  
  isDragging.value = true;
  hasDraggedSignificant = false;
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
  
  startX = clientX;
  startY = clientY;
  initialPosX = posX.value;
  initialPosY = posY.value;
  
  if ('touches' in event) {
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
  } else {
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
  }
};

const onDrag = (event: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return;
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
  
  const deltaX = clientX - startX;
  const deltaY = clientY - startY;
  
  if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
    hasDraggedSignificant = true;
  }
  
  const constrained = constrainPosition(initialPosX + deltaX, initialPosY + deltaY);
  posX.value = constrained.x;
  posY.value = constrained.y;
  
  if ('touches' in event) {
    event.preventDefault();
  }
};

const endDrag = () => {
  if (!isDragging.value) return;
  isDragging.value = false;
  
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend', endDrag);
  
  localStorage.setItem('binh_an_ui_settings_pos', JSON.stringify({ x: posX.value, y: posY.value }));
};

const handleButtonClick = (event: Event) => {
  if (hasDraggedSignificant) {
    event.stopPropagation();
    event.preventDefault();
    return;
  }
  ui.toggleSettings();
};

const handleResize = () => {
  const constrained = constrainPosition(posX.value, posY.value);
  posX.value = constrained.x;
  posY.value = constrained.y;
};

// Panel clamping to keep it fully visible on screen
const panelPosX = computed(() => {
  const panelWidth = 288;
  const margin = 10;
  const defaultRight = 20;
  const defaultLeft = window.innerWidth - defaultRight - panelWidth;
  
  const minX = margin - defaultLeft;
  const maxX = window.innerWidth - panelWidth - margin - defaultLeft;
  
  return Math.max(minX, Math.min(maxX, posX.value));
});

const panelPosY = computed(() => {
  const panelHeight = 350; // height estimate
  const margin = 10;
  const defaultBottom = 80; // bottom-20
  const defaultTop = window.innerHeight - defaultBottom - panelHeight;
  
  const minY = margin - defaultTop;
  const maxY = window.innerHeight - panelHeight - margin - defaultTop;
  
  return Math.max(minY, Math.min(maxY, posY.value));
});

onMounted(() => {
  const savedPos = localStorage.getItem('binh_an_ui_settings_pos');
  if (savedPos) {
    try {
      const parsed = JSON.parse(savedPos);
      if (
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number' &&
        !isNaN(parsed.x) &&
        !isNaN(parsed.y)
      ) {
        const constrained = constrainPosition(parsed.x, parsed.y);
        posX.value = constrained.x;
        posY.value = constrained.y;
      } else {
        localStorage.removeItem('binh_an_ui_settings_pos');
        posX.value = 0;
        posY.value = 0;
      }
    } catch (e) {
      localStorage.removeItem('binh_an_ui_settings_pos');
      posX.value = 0;
      posY.value = 0;
    }
  }
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <!-- Floating Settings Button -->
  <button
    @mousedown="startDrag"
    @touchstart="startDrag"
    @click="handleButtonClick"
    class="fixed bottom-5 right-5 z-[9998] w-12 h-12 rounded-full bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 shadow-xl hover:shadow-2xl flex items-center justify-center select-none touch-none"
    :class="{ 'rotate-90': ui.showSettings }"
    :style="{
      transform: `translate(${posX}px, ${posY}px) rotate(${ui.showSettings ? 90 : 0}deg)`,
      transition: isDragging ? 'none' : 'transform 0.2s ease, box-shadow 0.2s ease'
    }"
    title="Cài đặt giao diện"
  >
    <span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' 1;">
      {{ ui.showSettings ? 'close' : 'tune' }}
    </span>
  </button>

  <!-- Settings Panel -->
  <Transition name="settings-fade">
    <div
      v-if="ui.showSettings"
      class="fixed bottom-20 right-5 z-[9997]"
      :style="{
        transform: `translate(${panelPosX}px, ${panelPosY}px)`,
        transition: isDragging ? 'none' : 'transform 0.2s ease'
      }"
    >
      <div
        class="w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in"
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
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
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
