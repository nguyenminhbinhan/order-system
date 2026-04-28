<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { socketService } from '@/services/socket';

const notifications = ref<any[]>([]);
const showDropdown = ref(false);
const unreadCount = computed(() => notifications.value.filter(n => !n.read).length);

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value;
  if (showDropdown.value) {
    notifications.value.forEach(n => n.read = true);
  }
};

const getIcon = (type: string) => {
  switch(type) {
    case 'call_waiter': return 'room_service';
    case 'request_payment': return 'payments';
    case 'new_order': return 'receipt_long';
    default: return 'notifications';
  }
};

const getColor = (type: string) => {
  switch(type) {
    case 'call_waiter': return 'text-amber-500 bg-amber-50 dark:bg-amber-500/10';
    case 'request_payment': return 'text-green-500 bg-green-50 dark:bg-green-500/10';
    case 'new_order': return 'text-blue-500 bg-blue-50 dark:bg-blue-500/10';
    default: return 'text-primary bg-primary/10';
  }
};

const timeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return date.toLocaleDateString('vi-VN');
};

const clickOutside = (e: MouseEvent) => {
  if (showDropdown.value) {
    const target = e.target as HTMLElement;
    if (!target.closest('.notification-container')) {
      showDropdown.value = false;
    }
  }
};

onMounted(() => {
  document.addEventListener('click', clickOutside);
  
  socketService.on('tableNotification', (payload: any) => {
    notifications.value.unshift({
      id: Date.now() + Math.random(),
      tableId: payload.tableId,
      message: payload.message,
      type: payload.type,
      time: new Date(),
      read: false
    });
    
    if (notifications.value.length > 50) {
      notifications.value.pop();
    }
  });
});

onUnmounted(() => {
  document.removeEventListener('click', clickOutside);
});
</script>

<template>
  <div class="relative notification-container">
    <button @click="toggleDropdown" class="relative p-2 text-slate-500 hover:text-primary transition-colors focus:outline-none rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center">
      <span class="material-symbols-outlined text-[24px]">notifications</span>
      <span v-if="unreadCount > 0" class="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-black h-[16px] min-w-[16px] px-1 flex items-center justify-center rounded-full leading-none shadow-md animate-bounce border-2 border-white dark:border-slate-900">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- Dropdown -->
    <transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div v-if="showDropdown" class="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-slate-100 dark:border-slate-800 overflow-hidden z-50">
        <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
          <h3 class="font-bold text-slate-800 dark:text-slate-100">Notifications</h3>
          <span v-if="notifications.length > 0" class="text-xs font-semibold text-primary px-2 py-1 bg-primary/10 rounded-full cursor-pointer hover:bg-primary/20 transition-colors" @click="notifications = []">Clear All</span>
        </div>
        
        <div class="max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div v-if="notifications.length === 0" class="p-8 text-center text-slate-500 flex flex-col items-center">
            <span class="material-symbols-outlined text-4xl mb-3 opacity-30">notifications_paused</span>
            <p class="text-sm font-semibold">No new notifications</p>
            <p class="text-xs opacity-70 mt-1">You're all caught up!</p>
          </div>
          
          <div v-else class="divide-y divide-slate-100 dark:divide-slate-800/50">
            <div v-for="notif in notifications" :key="notif.id" 
                class="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex gap-4 items-start relative group cursor-pointer"
                :class="{'bg-primary/5 dark:bg-primary/10': !notif.read}">
                
              <div class="size-10 rounded-full flex flex-shrink-0 items-center justify-center font-bold" :class="getColor(notif.type)">
                <span class="material-symbols-outlined text-[20px]">{{ getIcon(notif.type) }}</span>
              </div>
              
              <div class="flex-1 min-w-0">
                <p class="text-sm text-slate-800 dark:text-slate-200 leading-snug break-words">
                   <strong class="font-bold">Bàn {{ String(notif.tableId).replace('Table', '').trim() }}:</strong> {{ notif.message }}
                </p>
                <span class="text-[11px] text-slate-500 font-semibold mt-1 block">{{ timeAgo(notif.time) }}</span>
              </div>
              
              <div v-if="!notif.read" class="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
            </div>
          </div>
        </div>
        
        <div class="p-3 border-t border-slate-100 dark:border-slate-800 text-center bg-slate-50/50 dark:bg-slate-800/20">
          <button class="text-xs text-slate-500 font-bold hover:text-primary transition-colors">View All Activity</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 20px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
}
</style>
