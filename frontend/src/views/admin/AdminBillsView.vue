<template>
  <div class="h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
    <div class="flex-none bg-white dark:bg-slate-800 p-6 shadow-sm z-10 border-b border-slate-200 dark:border-slate-700">
      <div class="flex flex-col md:flex-row md:items-center justify-between max-w-7xl mx-auto gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <span class="material-symbols-outlined text-primary text-3xl">receipt_long</span>
            Lịch sử Hóa đơn
          </h1>
          <p class="text-slate-500 dark:text-slate-400 mt-1">Quản lý và in lại hóa đơn đã thanh toán</p>
        </div>
        
        <div class="flex items-center gap-3">
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input v-model="searchQuery" type="text" placeholder="Tìm theo Bàn..." class="pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 w-full md:w-48" />
          </div>
          <input v-model="dateFilter" type="date" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-800 dark:text-slate-200" />
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-6">
      <div class="max-w-7xl mx-auto">
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div v-if="loading" class="p-8 text-center text-slate-500">Đang tải dữ liệu...</div>
          <div v-else-if="bills.length === 0" class="p-8 text-center text-slate-500">Chưa có hóa đơn nào.</div>
          <table v-else class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <th class="p-4 font-semibold text-slate-600 dark:text-slate-300">Mã Session</th>
                <th class="p-4 font-semibold text-slate-600 dark:text-slate-300">Bàn</th>
                <th class="p-4 font-semibold text-slate-600 dark:text-slate-300">Giờ vào</th>
                <th class="p-4 font-semibold text-slate-600 dark:text-slate-300">Giờ ra (Paid At)</th>
                <th class="p-4 font-semibold text-slate-600 dark:text-slate-300">Tổng tiền</th>
                <th class="p-4 font-semibold text-slate-600 dark:text-slate-300 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="bill in filteredBills" :key="bill.sessionId" class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td class="p-4 text-slate-800 dark:text-slate-200">#{{ bill.sessionId }}</td>
                <td class="p-4 text-slate-800 dark:text-slate-200 font-medium">{{ bill.tableNumber }}</td>
                <td class="p-4 text-slate-600 dark:text-slate-400">{{ formatTime(bill.startedAt) }}</td>
                <td class="p-4 text-slate-600 dark:text-slate-400">{{ formatTime(bill.endedAt) }}</td>
                <td class="p-4 font-bold text-primary">{{ formatCurrency(bill.total) }}</td>
                <td class="p-4 text-right">
                  <button @click="openBillModal(bill)" class="px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary text-sm font-bold flex items-center gap-1 transition-colors hover:bg-primary/10 rounded-lg ml-auto">
                    <span class="material-symbols-outlined text-[16px]">visibility</span> Xem lại bill
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Bill Modal -->
    <div v-if="selectedBill" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
        <div class="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <h3 class="font-bold text-slate-800 dark:text-white">Chi tiết Hóa đơn #{{ selectedBill.sessionId }}</h3>
          <button @click="selectedBill = null" class="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            <span class="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
        
        <div class="p-6 flex-1 overflow-y-auto w-full flex flex-col items-center custom-scrollbar" style="max-height: 60vh;">
           <!-- Actual receipt container matching print dimensions closely for preview -->
           <div class="bg-white p-4 shadow-sm border border-slate-200 w-full" style="max-width: 80mm;">
             <PrintBill :data="selectedBill" />
           </div>
        </div>

        <div class="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-2">
           <div class="flex gap-2">
             <button @click="executePrint(false)" class="flex-1 py-3 px-4 bg-slate-800 text-white rounded-xl font-bold transition-colors flex justify-center items-center gap-2">
                <span class="material-symbols-outlined text-sm">print</span>
                In lại
             </button>
             <button @click="exportPDF" class="flex-1 py-3 px-4 bg-orange-600 text-white rounded-xl font-bold transition-colors flex justify-center items-center gap-2">
                <span class="material-symbols-outlined text-sm">picture_as_pdf</span>
                PDF
             </button>
           </div>
           <button @click="selectedBill = null" class="w-full py-3 px-4 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors">Đóng</button>
        </div>
      </div>
    </div>

    <!-- Hidden Print Area -->
    <div id="print-area" style="display: none;">
      <PrintBill v-if="selectedBill" :data="selectedBill" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { apiClient } from '@/services/api';
import { toast } from 'vue3-toastify';
import PrintBill from '@/components/PrintBill.vue';
import html2pdf from 'html2pdf.js';

const bills = ref<any[]>([]);
const loading = ref(true);
const selectedBill = ref<any>(null);

const searchQuery = ref('');
const dateFilter = ref('');

const filteredBills = computed(() => {
  return bills.value.filter(b => {
    const matchTable = b.tableNumber?.toString().includes(searchQuery.value);
    const matchDate = dateFilter.value ? new Date(b.endedAt).toLocaleDateString('en-CA') === dateFilter.value : true;
    return matchTable && matchDate;
  });
});

const fetchBills = async () => {
  try {
    const res = await apiClient.get('/admin/bills');
    bills.value = res.data;
  } catch (err) {
    toast.error('Lỗi khi tải lịch sử hóa đơn');
  } finally {
    loading.value = false;
  }
};

onMounted(fetchBills);

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
};

const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('vi-VN', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute:'2-digit' 
  });
};

const openBillModal = (bill: any) => {
  selectedBill.value = bill;
};

const executePrint = (silent = false) => {
  const printContents = document.getElementById('print-area')?.innerHTML;
  if (!printContents) return;
  
  const win = window.open('', '', 'width=400,height=600');
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>Print Bill</title>
        <style>
          body { 
            font-family: 'Courier New', Courier, monospace; 
            padding: 0; margin: 0; color: #000; font-size: 12px; line-height: 1.4;
          }
          .thermal-receipt {
            width: 80mm; margin: 0 auto; padding: 5mm; box-sizing: border-box;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .title { font-size: 16px; margin-bottom: 2px; }
          .subtitle { font-size: 14px; margin: 8px 0; }
          .address { font-size: 10px; margin-bottom: 5px; }
          .dashed-line { border-top: 1px dashed #000; margin: 6px 0; }
          .flex-between { display: flex; justify-content: space-between; align-items: flex-start; }
          .info-row { display: flex; justify-content: space-between; font-size: 12px; }
          .items .item { margin-bottom: 4px; }
          .price-col { white-space: nowrap; padding-left: 10px; text-align: right; min-width: 65px; }
          .note { font-style: italic; font-size: 11px; }
          .total-row { font-size: 16px; margin: 4px 0; }
          .qr-container { display: flex; justify-content: center; margin: 10px 0 5px 0; }
          canvas, img { max-width: 140px; max-height: 140px; }
          @media print {
            @page { margin: 0; size: 80mm auto; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>${printContents}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  if (!silent) {
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  } else {
    setTimeout(() => win.close(), 100);
  }
};

const exportPDF = () => {
  const element = document.getElementById('print-area');
  if (!element || !selectedBill.value) return;
  
  const opt = {
    margin:       0,
    filename:     `bill-${selectedBill.value.sessionId}.pdf`,
    image:        { type: 'jpeg' as const, quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'mm', format: [80, 200] as [number, number], orientation: 'portrait' as const }
  };
  html2pdf().set(opt).from(element).save();
};
</script>
