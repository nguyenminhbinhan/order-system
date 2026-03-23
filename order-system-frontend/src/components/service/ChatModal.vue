<script setup lang="ts">
import { ref, onMounted, nextTick, onUnmounted } from 'vue';
import { socketService } from '@/services/socket';
import { toast } from 'vue3-toastify';

const props = defineProps<{ tableId: number, tableName: string }>();
const emit = defineEmits(['close']);
const messages = ref<any[]>([]);
const newMessage = ref('');
const messagesContainer = ref<HTMLElement | null>(null);

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${hh}:${mm} - ${dd}/${MM}/${yyyy}`;
};

const fetchMessages = async () => {
  try {
    const res = await fetch(`http://localhost:3000/messages/${props.tableId}`);
    if (res.ok) {
      messages.value = await res.json();
      scrollToBottom();
    }
  } catch (error) {
    console.error('Failed to load chat history');
  }
};

onMounted(() => {
  fetchMessages();
  
  socketService.on('newMessage', (msg) => {
    if (msg.tableId === props.tableId) {
      messages.value.push(msg);
      scrollToBottom();
    }
  });
});

onUnmounted(() => {
  socketService.off('newMessage');
});

const sendMessage = async () => {
  if (!newMessage.value.trim()) return;
  const content = newMessage.value;
  newMessage.value = '';
  
  try {
    await fetch('http://localhost:3000/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: props.tableId, sender: 'service', content })
    });
  } catch(error) {
    toast.error('Failed to send message');
  }
};
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
    <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl flex flex-col h-[600px] overflow-hidden">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
        <div>
          <h3 class="text-lg font-bold">Chat Session</h3>
          <p class="text-sm text-slate-500">Table {{ tableName }}</p>
        </div>
        <button @click="emit('close')" class="flex size-8 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
          <span class="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      <!-- Messages -->
      <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900/50" ref="messagesContainer">
        <div v-if="messages.length === 0" class="text-center text-slate-500 text-sm mt-4">No messages for this table.</div>
        
        <div v-for="msg in messages" :key="msg.id" class="flex flex-col w-full mb-2">
          
          <!-- System Message -->
          <div v-if="msg.sender === 'system'" class="w-full justify-center text-center my-2 flex">
            <span class="bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[11px] px-3 py-1 rounded-full italic font-medium border border-slate-200 dark:border-slate-800">
              {{ msg.content }} • {{ formatTime(msg.createdAt) }}
            </span>
          </div>
          
          <!-- Normal Message -->
          <div v-else class="flex w-full" :class="msg.sender === 'service' ? 'justify-end' : 'justify-start'">
            <div class="flex flex-col" :class="msg.sender === 'service' ? 'items-end' : 'items-start'">
              <div class="max-w-xs rounded-2xl px-4 py-2 text-sm shadow-sm" 
                   :class="msg.sender === 'service' ? 'bg-primary text-white rounded-br-none' : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none'">
                {{ msg.content }}
              </div>
              <span class="text-[10px] text-slate-400 font-medium mt-1 mx-1">{{ formatTime(msg.createdAt) }}</span>
            </div>
          </div>
          
        </div>
      </div>

      <!-- Input -->
      <div class="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2">
        <input v-model="newMessage" @keyup.enter="sendMessage" type="text" placeholder="Type a reply..." class="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/50" />
        <button @click="sendMessage" :disabled="!newMessage.trim()" class="bg-primary text-white px-4 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center">
          <span class="material-symbols-outlined leading-none">send</span>
        </button>
      </div>
    </div>
  </div>
</template>
