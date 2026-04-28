<template>
  <div v-if="data" class="thermal-receipt">
    <div class="center bold title">Nhà hàng Demo</div>
    <div class="center address">123 Nguyen Van Linh, Da Nang</div>
    <div class="center bold subtitle">HÓA ĐƠN THANH TOÁN</div>
    
    <div class="dashed-line"></div>

    <div class="info-row">
      <span>Bàn: <span class="bold">{{ data.tableNumber || data.tableId || '' }}</span></span>
      <span>Ngày: {{ new Date().toLocaleDateString('vi-VN') }}</span>
    </div>
    <div class="info-row">
      <span>Giờ vào: {{ formatTime(data.startedAt) }}</span>
      <span>Giờ ra: {{ formatTime(data.endedAt || new Date()) }}</span>
    </div>
    <div v-if="data.orderCount" class="info-row">
      <span>Số đơn: <span class="bold">{{ data.orderCount }}</span></span>
    </div>

    <div class="dashed-line"></div>

    <!-- Column Header -->
    <div class="flex-between bold" style="font-size: 11px; margin-bottom: 4px;">
      <span>Món</span>
      <span class="price-col">Thành tiền</span>
    </div>

    <div class="dashed-line" style="margin: 2px 0;"></div>

    <div class="items">
      <div v-for="(item, idx) in billItems" :key="idx" class="item">
        <div class="flex-between">
          <span>{{ item.name }} <span class="bold">x{{ item.quantity }}</span></span>
          <span class="price-col">{{ formatCurrency(Number(item.price) * item.quantity) }}</span>
        </div>
        <div v-if="item.note" class="note">+ {{ item.note }}</div>
      </div>
    </div>

    <div class="dashed-line"></div>

    <div class="summary">
      <div class="flex-between">
        <span>Tạm tính:</span>
        <span class="price-col">{{ formatCurrency(computedSubtotal) }}</span>
      </div>
      <div v-if="serviceFee > 0" class="flex-between">
        <span>Phí dịch vụ:</span>
        <span class="price-col">{{ formatCurrency(serviceFee) }}</span>
      </div>
      <div v-if="tax > 0" class="flex-between">
        <span>VAT ({{ taxRate }}%):</span>
        <span class="price-col">{{ formatCurrency(tax) }}</span>
      </div>
    </div>

    <div class="dashed-line"></div>

    <div class="flex-between total-row bold">
      <span>TỔNG:</span>
      <span class="price-col">{{ formatCurrency(grandTotal) }}</span>
    </div>

    <div class="dashed-line"></div>

    <div class="qr-container">
       <img :src="`https://img.vietqr.io/image/970415-113333666888-compact.png?amount=${Math.round(grandTotal)}&addInfo=Ban%20${data.tableNumber || data.tableId || ''}`" />
    </div>
    <div class="center note" style="margin-top: 5px;">Cảm ơn quý khách!</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  data: any;
  showServiceFee?: boolean;
  showTax?: boolean;
}>();

// Config: set to 0 to hide
const SERVICE_FEE = 20000; // VND, configurable
const TAX_RATE = 8; // %, configurable

// Flatten items: handle both new format (flat items[]) and legacy (orders[] with nested items)
const billItems = computed(() => {
  if (!props.data?.items) return [];

  // New format: items are already flat { name, price, quantity, note }
  if (props.data.items.length > 0 && props.data.items[0].name && props.data.items[0].price !== undefined) {
    return props.data.items;
  }

  // Legacy format: items are actually orders[] with nested items
  const flat: any[] = [];
  for (const order of props.data.items) {
    if (order.items && Array.isArray(order.items)) {
      for (const item of order.items) {
        flat.push({
          name: item.name || item.menuItem?.name || 'Item',
          price: Number(item.price || 0),
          quantity: item.quantity,
          note: item.note || '',
        });
      }
    }
  }
  return flat;
});

const computedSubtotal = computed(() => {
  return billItems.value.reduce((sum: number, item: any) => sum + Number(item.price) * item.quantity, 0);
});

const serviceFee = computed(() => {
  if (props.showServiceFee === false) return 0;
  return SERVICE_FEE;
});

const taxRate = TAX_RATE;

const tax = computed(() => {
  if (props.showTax === false) return 0;
  return computedSubtotal.value * (TAX_RATE / 100);
});

const grandTotal = computed(() => {
  return computedSubtotal.value + serviceFee.value + tax.value;
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
};

const formatTime = (dateStr: string | Date) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute:'2-digit' });
};
</script>
