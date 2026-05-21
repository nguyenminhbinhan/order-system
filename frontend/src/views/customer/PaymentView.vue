<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { socketService } from '@/services/socket';

import { API_BASE_URL } from '@/utils/constants';

const route = useRoute();
const paymentId = computed(() => route.params.paymentId as string);

const API_URL = API_BASE_URL;

// ==========================================
// STATE MACHINE
// ==========================================
type PaymentState = 'loading' | 'review' | 'processing' | 'success' | 'error' | 'already_paid';
const state = ref<PaymentState>('loading');
const errorMessage = ref('');

// Payment data from backend
const paymentData = ref<any>(null);

// ==========================================
// FETCH PAYMENT INFO (public, no auth)
// ==========================================
const fetchPaymentInfo = async () => {
  try {
    state.value = 'loading';
    const res = await fetch(`${API_URL}/payments/${paymentId.value}/info`);
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) {
        errorMessage.value = 'Liên kết thanh toán không hợp lệ hoặc đã hết hạn.';
        state.value = 'error';
        return;
      }
      errorMessage.value = data.message || 'Không thể tải thông tin thanh toán.';
      state.value = 'error';
      return;
    }

    const data = await res.json();
    paymentData.value = data;

    if (data.status === 'paid') {
      state.value = 'already_paid';
      // Save to localStorage for persistence
      savePaymentToLocal(data);
    } else if (data.status === 'failed') {
      errorMessage.value = 'Thanh toán này đã bị hủy.';
      state.value = 'error';
    } else {
      state.value = 'review';
    }
  } catch (err) {
    errorMessage.value = 'Không thể kết nối đến máy chủ.';
    state.value = 'error';
  }
};

// ==========================================
// CONFIRM PAYMENT (public, no auth)
// ==========================================
const isConfirming = ref(false);

const handleConfirmPayment = async () => {
  if (isConfirming.value) return;
  isConfirming.value = true;
  state.value = 'processing';

  try {
    const res = await fetch(`${API_URL}/payments/${paymentId.value}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      errorMessage.value = data.message || 'Thanh toán thất bại. Vui lòng thử lại.';
      state.value = 'review';
      isConfirming.value = false;
      return;
    }

    const data = await res.json();
    
    if (data.alreadyPaid) {
      state.value = 'already_paid';
    } else {
      state.value = 'success';
    }

    // Save to local storage for persistence
    savePaymentToLocal(paymentData.value);
  } catch (err) {
    errorMessage.value = 'Lỗi kết nối. Vui lòng thử lại.';
    state.value = 'review';
    isConfirming.value = false;
  }
};

// ==========================================
// LOCAL STORAGE PERSISTENCE
// ==========================================
const savePaymentToLocal = (data: any) => {
  if (!data) return;
  try {
    const record = {
      paymentId: data.paymentId,
      tableNumber: data.tableNumber,
      amount: data.amount,
      items: data.items,
      paidAt: data.paidAt || new Date().toISOString(),
      restaurant: data.restaurant,
    };
    const existing = JSON.parse(localStorage.getItem('binh_an_order_history') || '[]');
    // Don't add duplicates
    if (!existing.some((r: any) => r.paymentId === data.paymentId)) {
      existing.unshift(record);
      if (existing.length > 20) existing.length = 20;
      localStorage.setItem('binh_an_order_history', JSON.stringify(existing));
    }
  } catch {}
};

// ==========================================
// FORMATTING
// ==========================================
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
};

const formatTime = (dateStr: string | Date) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateStr: string | Date) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN');
};

// ==========================================
// LIFECYCLE
// ==========================================
onMounted(() => {
  fetchPaymentInfo();

  // Listen for payment completion from socket (e.g. if waiter pays via cash simultaneously)
  socketService.connect();
  socketService.on('paymentCompleted', (payload: any) => {
    if (paymentData.value && Number(payload.tableId) === Number(paymentData.value.tableId)) {
      state.value = 'success';
      savePaymentToLocal(paymentData.value);
    }
  });
});

onUnmounted(() => {
  socketService.off('paymentCompleted');
});
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-3 sm:p-4">
    <div class="w-full max-w-md">

      <!-- ==================== LOADING ==================== -->
      <div v-if="state === 'loading'" class="text-center py-20">
        <div class="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-slate-500 font-medium">Đang tải thông tin thanh toán...</p>
      </div>

      <!-- ==================== ERROR ==================== -->
      <div v-else-if="state === 'error'" class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-xl p-6 sm:p-8 text-center">
        <div class="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <span class="material-symbols-outlined text-4xl text-red-500" style="font-variation-settings: 'FILL' 1;">error</span>
        </div>
        <h2 class="text-xl font-black text-slate-900 dark:text-white mb-3">Không thể thanh toán</h2>
        <p class="text-slate-500 text-sm mb-6">{{ errorMessage }}</p>
        <button @click="fetchPaymentInfo" class="px-6 py-3.5 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors min-h-[48px] active:scale-[0.97]">
          Thử lại
        </button>
      </div>

      <!-- ==================== REVIEW (main payment page) ==================== -->
      <div v-else-if="state === 'review' && paymentData" class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden">
        
        <!-- Restaurant Header -->
        <div class="bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 sm:px-6 py-4 sm:py-5 text-white text-center">
          <div class="flex items-center justify-center gap-2 mb-1">
            <span class="material-symbols-outlined text-[24px]" style="font-variation-settings: 'FILL' 1;">restaurant</span>
            <h1 class="text-lg font-black tracking-tight">{{ paymentData.restaurant?.name || 'Quán ăn Bình An' }}</h1>
          </div>
          <p class="text-emerald-100 text-xs">{{ paymentData.restaurant?.address }}</p>
          <p class="text-emerald-100 text-xs">SĐT: {{ paymentData.restaurant?.phone }}</p>
        </div>

        <!-- Table Info -->
        <div class="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <span class="material-symbols-outlined text-emerald-600 text-[20px]">table_restaurant</span>
            </div>
            <div>
              <p class="text-xs text-slate-500">Bàn số</p>
              <p class="text-lg font-black text-slate-900 dark:text-white">{{ paymentData.tableNumber }}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-xs text-slate-500">{{ formatDate(paymentData.startedAt) }}</p>
            <p class="text-xs text-slate-400">{{ formatTime(paymentData.startedAt) }}</p>
          </div>
        </div>

        <!-- Order Items -->
        <div class="px-4 sm:px-6 py-3 sm:py-4">
          <h3 class="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-[14px]">receipt_long</span>
            Chi tiết đơn hàng ({{ paymentData.orderCount }} đơn)
          </h3>
          <div class="space-y-2">
            <div v-for="(item, idx) in paymentData.items" :key="idx" class="flex justify-between items-start py-1.5">
              <div class="flex-1 pr-3">
                <p class="text-sm font-medium text-slate-800 dark:text-slate-200">
                  <span class="text-slate-400 mr-1">{{ item.quantity }}×</span>
                  {{ item.name }}
                </p>
                <p v-if="item.note" class="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  📝 {{ item.note }}
                </p>
              </div>
              <span class="text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                {{ formatCurrency(item.price * item.quantity) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Total -->
        <div class="mx-4 sm:mx-6 py-3 sm:py-4 border-t-2 border-dashed border-slate-200 dark:border-slate-700">
          <div class="flex justify-between items-center">
            <span class="text-lg font-black text-slate-900 dark:text-white">TỔNG TIỀN</span>
            <span class="text-2xl font-black text-emerald-600">{{ formatCurrency(paymentData.amount) }}</span>
          </div>
          <p class="text-[10px] text-slate-400 mt-1">Đã bao gồm tất cả chi phí • Không thuế</p>
        </div>

        <!-- Confirm Button -->
        <div class="p-4 sm:p-6 pt-2">
          <button 
            @click="handleConfirmPayment"
            :disabled="isConfirming"
            class="w-full py-4 sm:py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] min-h-[56px]"
          >
            <span v-if="isConfirming" class="material-symbols-outlined animate-spin text-[20px]">autorenew</span>
            <span v-else class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
            {{ isConfirming ? 'Đang xử lý...' : 'XÁC NHẬN THANH TOÁN' }}
          </button>
          <p class="text-center text-[10px] text-slate-400 mt-3">Nhấn để xác nhận thanh toán đơn hàng</p>
        </div>
      </div>

      <!-- ==================== PROCESSING ==================== -->
      <div v-else-if="state === 'processing'" class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-xl p-8 sm:p-12 text-center">
        <div class="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
        <h2 class="text-xl font-black text-slate-900 dark:text-white mb-2">Đang xử lý thanh toán</h2>
        <p class="text-slate-500 text-sm">Vui lòng không tắt trang...</p>
      </div>

      <!-- ==================== SUCCESS / ALREADY PAID ==================== -->
      <div v-else-if="state === 'success' || state === 'already_paid'" class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden">
        
        <!-- Success Header -->
        <div class="bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 sm:px-6 py-6 sm:py-8 text-center text-white">
          <div class="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <span class="material-symbols-outlined text-5xl" style="font-variation-settings: 'FILL' 1;">check_circle</span>
          </div>
          <h1 class="text-2xl font-black tracking-tight mb-1">Thanh toán thành công!</h1>
          <p class="text-emerald-100 text-sm">Cảm ơn quý khách đã ghé quán Bình An</p>
        </div>

        <!-- Restaurant Info -->
        <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800">
          <div class="space-y-2">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-emerald-500 text-[18px]">restaurant</span>
              <span class="text-sm font-bold text-slate-800 dark:text-slate-200">{{ paymentData?.restaurant?.name }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-slate-400 text-[18px]">location_on</span>
              <span class="text-sm text-slate-600 dark:text-slate-400">{{ paymentData?.restaurant?.address }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-blue-500 text-[18px]">call</span>
              <span class="text-sm text-slate-600 dark:text-slate-400">{{ paymentData?.restaurant?.phone }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-red-500 text-[18px]">mail</span>
              <span class="text-sm text-slate-600 dark:text-slate-400">{{ paymentData?.restaurant?.email }}</span>
            </div>
          </div>
        </div>

        <!-- Payment Summary -->
        <div class="px-4 sm:px-6 py-3 sm:py-4">
          <div class="flex justify-between items-center mb-4">
            <span class="text-xs font-black text-slate-400 uppercase tracking-wider">Bàn {{ paymentData?.tableNumber }}</span>
            <span class="text-xs text-slate-400">{{ formatDate(new Date()) }} • {{ formatTime(new Date()) }}</span>
          </div>

          <!-- Items -->
          <div class="space-y-1.5 mb-4">
            <div v-for="(item, idx) in paymentData?.items" :key="idx" class="flex justify-between items-start py-1">
              <p class="text-sm text-slate-700 dark:text-slate-300 flex-1 pr-3">
                <span class="text-slate-400 mr-1">{{ item.quantity }}×</span>
                {{ item.name }}
              </p>
              <span class="text-sm font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                {{ formatCurrency(item.price * item.quantity) }}
              </span>
            </div>
          </div>

          <!-- Total -->
          <div class="pt-3 border-t-2 border-dashed border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <span class="text-lg font-black text-slate-900 dark:text-white">Đã thanh toán</span>
            <span class="text-xl font-black text-emerald-600">{{ formatCurrency(paymentData?.amount || 0) }}</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-4 sm:px-6 py-5 sm:py-6 text-center bg-slate-50 dark:bg-slate-900/50">
          <p class="text-xs text-slate-400">Hẹn gặp lại quý khách lần sau! 🎉</p>
          <p class="text-[10px] text-slate-300 mt-1">Đơn hàng đã được lưu trên thiết bị</p>
        </div>
      </div>

    </div>
  </div>
</template>
