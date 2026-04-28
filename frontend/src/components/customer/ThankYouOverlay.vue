<template>
  <Transition name="thankyou">
    <div v-if="visible" class="fixed inset-0 z-[999] flex items-center justify-center bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900">
      <!-- Animated particles background -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div v-for="i in 12" :key="i" class="particle" :style="particleStyle(i)"></div>
      </div>

      <div class="relative z-10 flex flex-col items-center text-center px-6 max-w-md mx-auto">
        <!-- Success icon with pulse -->
        <div class="relative mb-8">
          <div v-if="!isTerminal" class="absolute inset-0 bg-white/20 rounded-full animate-ping" style="animation-duration: 2s;"></div>
          <div class="relative size-28 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30">
            <span class="material-symbols-outlined text-6xl text-white" style="font-variation-settings: 'FILL' 1;">
              {{ isTerminal ? 'sentiment_satisfied' : 'check_circle' }}
            </span>
          </div>
        </div>

        <!-- Main text -->
        <h1 class="text-3xl font-black text-white mb-3 tracking-tight">
          Cảm ơn quý khách!
        </h1>
        <p class="text-lg text-emerald-200 font-medium mb-2">
          Thanh toán đã hoàn tất
        </p>
        <p class="text-emerald-300/80 text-sm mb-10">
          Hẹn gặp lại quý khách lần sau 🎉
        </p>

        <!-- Countdown circle (only during countdown phase) -->
        <template v-if="!isTerminal">
          <div class="relative mb-8">
            <svg class="size-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" stroke="rgba(255,255,255,0.15)" stroke-width="4" fill="none" />
              <circle 
                cx="40" cy="40" r="36" 
                stroke="white" 
                stroke-width="4" 
                fill="none"
                stroke-linecap="round"
                :stroke-dasharray="circumference"
                :stroke-dashoffset="dashOffset"
                style="transition: stroke-dashoffset 1s linear;"
              />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-2xl font-black text-white">
              {{ countdown }}
            </span>
          </div>

          <p class="text-emerald-200/60 text-xs mb-6">
            Phiên sẽ kết thúc sau {{ countdown }} giây...
          </p>
        </template>

        <!-- Terminal state: session fully ended -->
        <template v-else>
          <div class="mb-8 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
            <p class="text-emerald-100 text-sm font-medium mb-1">Phiên đã kết thúc</p>
            <p class="text-emerald-300/70 text-xs">Quét mã QR trên bàn để bắt đầu phiên mới</p>
          </div>
        </template>

        <!-- Action button -->
        <button 
          @click="handleRestart"
          class="px-8 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-xl font-bold text-sm border border-white/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-[18px]">qr_code_scanner</span>
          {{ isTerminal ? 'Quét lại để gọi món' : 'Đặt món lại' }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
  duration?: number;
}>();

const emit = defineEmits<{
  (e: 'complete'): void;
  (e: 'restart'): void;
}>();

const TOTAL_SECONDS = props.duration || 8;
const countdown = ref(TOTAL_SECONDS);
const isTerminal = ref(false);
const circumference = 2 * Math.PI * 36; // r=36

const dashOffset = computed(() => {
  const progress = countdown.value / TOTAL_SECONDS;
  return circumference * (1 - progress);
});

let timer: ReturnType<typeof setInterval> | null = null;

const startCountdown = () => {
  countdown.value = TOTAL_SECONDS;
  isTerminal.value = false;
  timer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      if (timer) clearInterval(timer);
      // Enter terminal state instead of redirecting
      isTerminal.value = true;
      emit('complete'); // Parent uses this to clear session state, NOT to redirect
    }
  }, 1000);
};

const handleRestart = () => {
  if (timer) clearInterval(timer);
  emit('restart');
};

const particleStyle = (i: number) => ({
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  width: `${4 + Math.random() * 8}px`,
  height: `${4 + Math.random() * 8}px`,
  animationDelay: `${Math.random() * 3}s`,
  animationDuration: `${3 + Math.random() * 4}s`,
});

onMounted(() => {
  if (props.visible) startCountdown();
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

watch(() => props.visible, (val) => {
  if (val) {
    startCountdown();
  } else {
    if (timer) clearInterval(timer);
    isTerminal.value = false;
  }
});
</script>

<style scoped>
.thankyou-enter-active {
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.thankyou-leave-active {
  transition: all 0.3s ease-in;
}
.thankyou-enter-from {
  opacity: 0;
  transform: scale(1.05);
}
.thankyou-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.particle {
  position: absolute;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  animation: float infinite ease-in-out;
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
  50% { transform: translateY(-30px) scale(1.2); opacity: 0.6; }
}
</style>
