<template>
  <div v-if="data" class="thermal-receipt" id="print-receipt">
    <!-- ===== HEADER ===== -->
    <div class="receipt-header">
      <div class="shop-name">QUÁN ĂN BÌNH AN</div>
      <div class="shop-info">70 Hoàng Dư Khương, Cẩm Lệ, Đà Nẵng</div>
      <div class="shop-info">SĐT: 0935124062</div>
      <div class="shop-info">Email: annguyen020403@gmail.com</div>
    </div>

    <div class="receipt-title">HÓA ĐƠN THANH TOÁN</div>

    <div class="dashed-divider"></div>

    <!-- ===== INFO ===== -->
    <div class="info-section">
      <div class="info-line">
        <span>Bàn:</span>
        <span class="info-value">{{ data.tableNumber || data.tableId || '—' }}</span>
      </div>
      <div class="info-line">
        <span>Ngày:</span>
        <span class="info-value">{{ new Date().toLocaleDateString('vi-VN') }}</span>
      </div>
      <div class="info-line">
        <span>Giờ vào:</span>
        <span class="info-value">{{ formatTime(data.startedAt) }}</span>
      </div>
      <div class="info-line">
        <span>Giờ ra:</span>
        <span class="info-value">{{ formatTime(data.endedAt || new Date()) }}</span>
      </div>
      <div v-if="data.orderCount" class="info-line">
        <span>Số đơn:</span>
        <span class="info-value">{{ data.orderCount }}</span>
      </div>
    </div>

    <div class="dashed-divider"></div>

    <!-- ===== COLUMN HEADER ===== -->
    <div class="col-header">
      <span class="col-name">Tên món</span>
      <span class="col-qty">SL</span>
      <span class="col-price">Giá</span>
      <span class="col-total">T.Tiền</span>
    </div>

    <div class="solid-divider"></div>

    <!-- ===== ITEMS ===== -->
    <div class="items-section">
      <div v-for="(item, idx) in billItems" :key="idx" class="item-row">
        <div class="item-main">
          <span class="col-name item-name">{{ item.name }}</span>
          <span class="col-qty">{{ item.quantity }}</span>
          <span class="col-price">{{ formatShort(Number(item.price)) }}</span>
          <span class="col-total">{{ formatShort(Number(item.price) * item.quantity) }}</span>
        </div>
        <div v-if="item.note" class="item-note">↳ {{ item.note }}</div>
      </div>
    </div>

    <div class="dashed-divider"></div>

    <!-- ===== TOTALS ===== -->
    <div class="totals-section">
      <div class="total-line">
        <span>Tạm tính:</span>
        <span class="total-value">{{ formatCurrency(computedSubtotal) }}</span>
      </div>
    </div>

    <div class="solid-divider"></div>

    <div class="grand-total-line">
      <span>TỔNG TIỀN:</span>
      <span class="grand-total-value">{{ formatCurrency(computedSubtotal) }}</span>
    </div>

    <div class="dashed-divider"></div>

    <!-- ===== QR CODE ===== -->
    <div v-if="computedSubtotal > 0 && paymentId" class="qr-section">
      <img 
        :src="`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentUrl)}`" 
        class="qr-img"
        alt="QR Thanh toán"
      />
      <div class="qr-label">Quét mã để thanh toán</div>
      <div class="qr-url">{{ paymentUrl }}</div>
    </div>
    <div v-else-if="computedSubtotal > 0 && !paymentId" class="qr-section">
      <div class="qr-placeholder">
        <span style="font-size: 32px;">📱</span>
        <div class="qr-label">Nhấn "Tạo QR" để lấy mã thanh toán</div>
      </div>
    </div>

    <div class="dashed-divider"></div>

    <!-- ===== FOOTER ===== -->
    <div class="receipt-footer">
      <div>Cảm ơn quý khách đã sử dụng dịch vụ!</div>
      <div>Hẹn gặp lại! ★</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  data: any;
  paymentId?: string;
}>();

const FRONTEND_URL = typeof window !== 'undefined' 
  ? `${window.location.protocol}//${window.location.host}` 
  : 'http://localhost:5173';

const paymentUrl = computed(() => {
  if (!props.paymentId) return '';
  return `${FRONTEND_URL}/payment/${props.paymentId}`;
});

// Flatten items: handle both flat items[] and nested orders[].items[]
const billItems = computed(() => {
  if (!props.data?.items) return [];

  // Flat format: items are { name, price, quantity, note }
  if (props.data.items.length > 0 && props.data.items[0].name && props.data.items[0].price !== undefined) {
    return props.data.items;
  }

  // Nested format: items are orders[] with nested items
  const flat: any[] = [];
  for (const order of props.data.items) {
    if (order.items && Array.isArray(order.items)) {
      for (const item of order.items) {
        flat.push({
          name: item.name || item.menuItem?.name || 'Món',
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

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
};

const formatShort = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0);
};

const formatTime = (dateStr: string | Date) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};
</script>

<style scoped>
.thermal-receipt {
  font-family: 'Courier New', 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #111;
  background: #fff;
  width: 300px;
  margin: 0 auto;
  padding: 16px 12px;
  box-sizing: border-box;
}

/* ===== HEADER ===== */
.receipt-header {
  text-align: center;
  margin-bottom: 6px;
}

.shop-name {
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.shop-info {
  font-size: 10px;
  color: #555;
  line-height: 1.4;
}

.receipt-title {
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
  margin: 8px 0;
}

/* ===== DIVIDERS ===== */
.dashed-divider {
  border-top: 1px dashed #999;
  margin: 8px 0;
}

.solid-divider {
  border-top: 1px solid #333;
  margin: 4px 0;
}

/* ===== INFO ===== */
.info-section {
  margin: 4px 0;
}

.info-line {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  line-height: 1.7;
}

.info-value {
  font-weight: 700;
}

/* ===== COLUMN HEADERS ===== */
.col-header {
  display: flex;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #333;
}

.col-name { flex: 1; text-align: left; min-width: 0; }
.col-qty { width: 28px; text-align: center; flex-shrink: 0; }
.col-price { width: 60px; text-align: right; flex-shrink: 0; }
.col-total { width: 68px; text-align: right; flex-shrink: 0; }

/* ===== ITEMS ===== */
.items-section {
  margin: 4px 0;
}

.item-row {
  margin-bottom: 3px;
}

.item-main {
  display: flex;
  font-size: 12px;
  line-height: 1.6;
}

.item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-note {
  font-size: 10px;
  color: #888;
  padding-left: 8px;
  font-style: italic;
}

/* ===== TOTALS ===== */
.totals-section {
  margin: 4px 0;
}

.total-line {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  line-height: 1.8;
}

.total-value {
  font-weight: 700;
}

.grand-total-line {
  display: flex;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 900;
  line-height: 2;
}

.grand-total-value {
  font-weight: 900;
}

/* ===== QR ===== */
.qr-section {
  text-align: center;
  padding: 8px 0;
}

.qr-img {
  width: 180px;
  height: auto;
  margin: 0 auto;
  display: block;
}

.qr-label {
  font-size: 9px;
  color: #888;
  margin-top: 4px;
}

.qr-url {
  font-size: 7px;
  color: #aaa;
  margin-top: 2px;
  word-break: break-all;
  line-height: 1.3;
}

.qr-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 0;
  color: #999;
}

/* ===== FOOTER ===== */
.receipt-footer {
  text-align: center;
  font-size: 11px;
  color: #555;
  line-height: 1.6;
  padding: 4px 0 8px;
}

/* ===== PRINT STYLES ===== */
@media print {
  @page {
    margin: 0;
    size: 80mm auto;
  }

  body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }

  .no-print,
  .no-print * {
    display: none !important;
  }

  .thermal-receipt {
    width: 100% !important;
    max-width: 80mm;
    margin: 0 !important;
    padding: 8px !important;
    box-shadow: none !important;
    border: none !important;
    font-size: 11px !important;
  }

  .shop-name { font-size: 15px !important; }
  .receipt-title { font-size: 12px !important; }
  .grand-total-line { font-size: 14px !important; }
  .item-main { font-size: 11px !important; }
  .qr-img { width: 140px !important; }
}
</style>
