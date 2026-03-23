<script setup lang="ts">
import { ref, onMounted, nextTick, onUnmounted } from 'vue';
import { socketService } from '@/services/socket';
import { toast } from 'vue3-toastify';

const props = defineProps<{ tableId: number }>();
const messages = ref<any[]>([]);
const newMessage = ref('');
const isSending = ref(false);
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
  
  // Directly bind onto native websocket listener instead of going thru OrderStore
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
  if (!newMessage.value.trim() || isSending.value) return;
  const content = newMessage.value;
  newMessage.value = ''; // Optimistic clear
  isSending.value = true;
  
  try {
    await fetch('http://localhost:3000/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: props.tableId, sender: 'customer', content })
    });
  } catch(error) {
    toast.error('Failed to send message');
    newMessage.value = content;
  } finally {
    isSending.value = false;
    scrollToBottom();
  }
};
</script>

<template>
  <div class="flex flex-col h-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg mt-4 mb-4">
    <div class="bg-primary p-3 text-white font-bold flex justify-between items-center z-10">
      <div class="flex items-center gap-2">
         <span class="material-symbols-outlined text-sm">support_agent</span>
         <span class="text-sm">Talk to Server</span>
      </div>
    </div>
    
    <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900/50" ref="messagesContainer">
      <div v-if="messages.length === 0" class="text-center text-slate-500 text-sm mt-4">Have questions? Send a message to your waiter.</div>
      <div v-for="msg in messages" :key="msg.id" class="flex flex-col w-full mb-2">
        
        <!-- System Message -->
        <div v-if="msg.sender === 'system'" class="w-full justify-center text-center my-2 flex">
          <span class="bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[11px] px-3 py-1 rounded-full italic font-medium border border-slate-200 dark:border-slate-800">
            {{ msg.content }} • {{ formatTime(msg.createdAt) }}
          </span>
        </div>
        
        <!-- Normal Message -->
        <div v-else class="flex w-full" :class="msg.sender === 'customer' ? 'justify-end' : 'justify-start'">
          <div class="flex flex-col" :class="msg.sender === 'customer' ? 'items-end' : 'items-start'">
            <div class="max-w-xs rounded-2xl px-4 py-2 text-sm shadow-sm" 
                 :class="msg.sender === 'customer' ? 'bg-primary text-white rounded-br-none' : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none'">
              {{ msg.content }}
            </div>
            <span class="text-[10px] text-slate-400 font-medium mt-1 mx-1">{{ formatTime(msg.createdAt) }}</span>
          </div>
        </div>
        
        
      </div>
      
      <div v-if="isSending" class="flex w-full justify-end mb-2">
         <span class="text-[10px] text-slate-400 font-medium italic">Sending...</span>
      </div>
    </div>
    
    <div class="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2">
      <input v-model="newMessage" @keyup.enter="sendMessage" type="text" placeholder="Type..." class="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/50" />
      <button @click="sendMessage" :disabled="!newMessage.trim()" class="bg-primary text-white p-2 w-10 h-10 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center shrink-0">
        <span class="material-symbols-outlined text-sm leading-none">send</span>
      </button>
    </div>
  </div>
</template>
