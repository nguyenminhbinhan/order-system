<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { tableService } from '@/services/table.service';
import { orderService } from '@/services/order.service';
import { socketService } from '@/services/socket';
import { apiClient } from '@/services/api';
import { toast } from 'vue3-toastify';
import ChatModal from '@/components/service/ChatModal.vue';
import PrintBill from '@/components/PrintBill.vue';
import html2pdf from 'html2pdf.js';
import { useUserStore } from '@/stores/user.store';
import NotificationBell from '@/components/NotificationBell.vue';
import { useRouter } from 'vue-router';

const userStore = useUserStore();
const router = useRouter();

const handleLogout = () => {
  userStore.logout();
};

const tables = ref<any[]>([]);
const activeOrders = ref<any[]>([]);
const loading = ref(true);

const selectedTable = ref<any>(null);
const selectedOrder = ref<any>(null);
const showModal = ref(false);
const showPaymentModal = ref(false);
const isProcessingPayment = ref(false);
const isConfirmingOrder = ref(false);
const isResettingTable = ref(false);
const showCheckoutWarning = ref(false);
const nonReadyItems = ref<any[]>([]);
const pendingWarningTable = ref<any>(null);
const itemNotes = ref<Record<string, string>>({});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' ₫';
};

const hasConfirmedItemsForTable = (table: any) => {
  if (!table?.tableOrders) return false;
  return table.tableOrders.some((o: any) => 
    o.items?.some((i: any) => i.status !== 'pending' && i.status !== 'cancelled')
  );
};

const chatTableId = ref<number | null>(null);
const chatTableName = ref('');
const notifications = ref<Record<number, { unreadCount: number, lastType: string, lastMessage: string }>>({});
const showNotifs = ref(false);

const notificationsList = computed(() => {
  const list: any[] = [];
  Object.keys(notifications.value).forEach(tableId => {
    const notif = notifications.value[Number(tableId)];
    if (notif.unreadCount > 0) {
      list.push({ tableId, message: notif.lastMessage, count: notif.unreadCount });
    }
  });
  return list;
});

const totalUnread = computed(() => notificationsList.value.reduce((acc, curr) => acc + curr.count, 0));

const openChat = (tableId: number, tableName: string) => {
  chatTableId.value = tableId;
  chatTableName.value = tableName;
  if (notifications.value[tableId]) {
    notifications.value[tableId].unreadCount = 0;
  }
};

const handleTableClickEvent = (tableId: number) => {
  if (notifications.value[tableId]) {
    notifications.value[tableId].unreadCount = 0;
  }
  openTableModal(tableId);
};

const fetchData = async () => {
  loading.value = true;
  try {
    const [tablesData, ordersData] = await Promise.all([
      tableService.getTables(),
      orderService.getOrders(true)
    ]);
    tables.value = JSON.parse(JSON.stringify(tablesData));
    activeOrders.value = JSON.parse(JSON.stringify(ordersData.filter((o: any) => ['pending_confirmation', 'confirmed', 'preparing', 'ready', 'delivered'].includes(o.status))));
    
    // Sync the selectedTable if a modal is currently open to reflect cancellations or status changes in real-time
    if (showModal.value && selectedTable.value) {
      const updated = displayTables.value.find(t => t.id === selectedTable.value.id);
      if (updated) {
        const tableOrders = activeOrders.value.filter(o => o.tableId === updated.id && o.sessionId === updated.activeSessionId);
        selectedTable.value = {
          ...selectedTable.value,
          ...updated,
          tableOrders,
          computedState: updated.computedState
        };
        // Populate notes for any new items that were fetched
        tableOrders.forEach((order: any) => {
          order.items?.forEach((item: any) => {
            if (itemNotes.value[item.id] === undefined) {
              itemNotes.value[item.id] = item.note || '';
            }
          });
        });
      }
    }
  } catch (error) {
    console.error('Failed to fetch dashboard data', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchData();

  socketService.connect();
  socketService.joinService(); // Waiters join the service room

  socketService.onNewOrderCreated(() => {
    fetchData();
  });

  socketService.onOrderUpdated(() => {
    fetchData();
  });

  socketService.on('tableNotification', (data) => {
    if (!notifications.value[data.tableId]) {
      notifications.value[data.tableId] = { unreadCount: 0, lastType: '', lastMessage: '' };
    }
    
    if (chatTableId.value !== data.tableId) {
      notifications.value[data.tableId].unreadCount++;
    }
    
    notifications.value[data.tableId].lastType = data.type;
    notifications.value[data.tableId].lastMessage = data.message;
    
    const tableContext = tables.value.find(t => t.id === data.tableId);
    const tableName = tableContext ? tableContext.name.replace('Table', '').trim() : data.tableId;
    toast.info(`Bàn ${tableName}: ${data.message}`, { autoClose: 3000, theme: 'colored' });
  });

  socketService.on('billPrinted', (data) => {
    fetchData();
    const tblName = tables.value.find(t => t.id === data.tableId)?.name?.replace('Table', '')?.trim() || data.tableId;
    toast.info(`Bàn ${tblName} đã in bill tạm tính!`);
  });

  socketService.on('paymentCompleted', (data) => {
    fetchData();
    const tblName = tables.value.find(t => t.id === data.tableId)?.name?.replace('Table', '')?.trim() || data.tableId;
    toast.success(`Bàn ${tblName} thanh toán thành công!`);
    
    if (selectedTable.value?.id === data.tableId) {
      showModal.value = false;
      showPaymentModal.value = false;
    }
  });

  socketService.on('tableUpdated', (tableId) => {
    fetchData();
  });

  // Customer activity notifications (Fix #3)
  socketService.onCustomerActivity((data: any) => {
    // Add to notification badges
    if (!notifications.value[data.tableId]) {
      notifications.value[data.tableId] = { unreadCount: 0, lastType: '', lastMessage: '' };
    }
    
    // Don't increment if chat is open for this table
    if (chatTableId.value !== data.tableId) {
      notifications.value[data.tableId].unreadCount++;
    }
    
    notifications.value[data.tableId].lastType = data.type;
    notifications.value[data.tableId].lastMessage = data.description;

    // Show toast for important activities
    const activityIcons: Record<string, string> = {
      SCAN_QR: '📱',
      ORDER_PLACED: '🍽️',
      PAYMENT_CONFIRMED: '💳',
      ITEM_CANCELLED: '❌',
      CART_UPDATE: '🛒',
    };
    const icon = activityIcons[data.type] || '📋';
    
    // Only show toasts for high-priority events (not cart browsing)
    if (['SCAN_QR', 'ORDER_PLACED', 'PAYMENT_CONFIRMED', 'ITEM_CANCELLED'].includes(data.type)) {
      toast.info(`${icon} ${data.description}`, { autoClose: 4000, theme: 'colored' });
    }
  });

});

onUnmounted(() => {
  socketService.offNewOrderCreated();
  socketService.offOrderUpdated();
  socketService.off('tableNotification');
  socketService.off('billPrinted');
  socketService.off('paymentCompleted');
  socketService.off('tableUpdated');
  socketService.offCustomerActivity();

  socketService.leaveService();
});

// Computed properties for Table Grid
const displayTables = computed(() => {
  return tables.value.map(table => {
    // Find ALL active orders for this table mapping generically 
    const tableOrders = activeOrders.value.filter(o => o.tableId === table.id && o.sessionId === table.activeSessionId);
    const activeOrder = tableOrders.length > 0 ? tableOrders[0] : null;

    let colorClass, badgeClass, statusText, icon;

    const hasWaitingConfirm = tableOrders.some(o => o.status === 'pending_confirmation');

    if (hasWaitingConfirm) {
      colorClass = 'bg-white dark:bg-slate-900 border-2 border-yellow-500/30 hover:border-yellow-500';
      badgeClass = 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
      statusText = 'Chờ xác nhận';
      icon = 'notifications_active';
    } else if (table.computedState === 'occupied' || table.computedState === 'paying') {
      if (table.computedState === 'paying') {
        colorClass = 'bg-purple-600 text-white shadow-lg shadow-purple-600/20';
        badgeClass = 'bg-white/20 text-white';
        statusText = 'Đang thanh toán';
        icon = 'payments';
      } else {
        colorClass = 'bg-red-500 text-white shadow-lg shadow-red-500/20';
        badgeClass = 'bg-white/20 text-white';
        statusText = 'Đang phục vụ';
        icon = 'restaurant';
      }
    } else if (table.computedState === 'serving') {
      colorClass = 'bg-blue-500 text-white shadow-lg shadow-blue-500/20';
      badgeClass = 'bg-white/20 text-white';
      statusText = 'Phục vụ xong';
      icon = 'done_all';
    } else {
      colorClass = 'bg-white dark:bg-slate-900 border-2 border-green-500/30 hover:border-green-500';
      badgeClass = 'bg-green-500/10 text-green-500';
      statusText = 'Trống';
      icon = 'check_circle';
    }

    const formatComputedState = (state: string) => {
      const map: Record<string, string> = {
        'available': 'Trống',
        'waiting_confirm': 'Chờ xác nhận',
        'occupied': 'Đang phục vụ',
        'serving': 'Phục vụ xong',
        'paying': 'Đang thanh toán'
      };
      return map[state] || state;
    };
    
    // Attach the mapped state explicit mapping
    table.formattedComputedState = formatComputedState(table.computedState);



    return {
      ...table,
      tableOrders,
      activeOrder,
      colorClass,
      badgeClass,
      statusText,
      icon,
      guestCount: 2 // Mock generic data
    };
  });
});

const stats = computed(() => {
  return {
    available: tables.value.filter(t => t.computedState === 'available').length,
    occupied: tables.value.filter(t => ['occupied'].includes(t.computedState)).length,
    serving: tables.value.filter(t => t.computedState === 'serving').length,
    waiting: tables.value.filter(t => t.computedState === 'waiting_confirm').length,
  };
});

const openTableModal = (tableId: number) => {
  const table = displayTables.value.find(t => t.id === tableId);
  if (table) {
    selectedTable.value = table;
    // Populate notes
    selectedTable.value.tableOrders?.forEach((order: any) => {
      order.items?.forEach((item: any) => {
        itemNotes.value[item.id] = item.note || '';
      });
    });
    showModal.value = true;
  }
};

const handleUpdateQuantity = async (orderId: string, item: any, delta: number) => {
  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    await handleServiceCancelItem(orderId, item.id, item.name || 'Món ăn');
    return;
  }
  
  try {
    const currentNote = itemNotes.value[item.id] || '';
    await orderService.updateItemProperties(orderId, item.id, newQty, currentNote);
    item.quantity = newQty;
    await fetchData();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Lỗi cập nhật số lượng');
  }
};

const handleSaveItemNote = async (orderId: string, item: any) => {
  const newNote = itemNotes.value[item.id] || '';
  if (newNote === (item.note || '')) return;
  
  try {
    await orderService.updateItemProperties(orderId, item.id, item.quantity, newNote);
    item.note = newNote;
    toast.success('Đã lưu ghi chú món');
    await fetchData();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Lỗi cập nhật ghi chú');
    itemNotes.value[item.id] = item.note || '';
  }
};

// ========== INDIVIDUAL ITEM ACTIONS ==========
const isUpdatingItemStatus = ref<string | null>(null);

const handleConfirmIndividualItem = async (orderId: string, itemId: string, itemName: string) => {
  if (isConfirmingOrder.value) return;
  isConfirmingOrder.value = true;
  try {
    await orderService.confirmItems(orderId, [itemId]);
    toast.success(`Đã xác nhận món: ${itemName}!`);
    await fetchData();
    // Rebind the modal payload organically
    if (selectedTable.value) {
      const updated = tables.value.find(t => t.id === selectedTable.value.id);
      if (updated) {
        const tableOrders = activeOrders.value.filter(o => o.tableId === updated.id && o.sessionId === updated.activeSessionId);
        selectedTable.value = {
          ...selectedTable.value,
          ...updated,
          tableOrders,
          computedState: updated.computedState
        };
      }
    }
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Lỗi xác nhận món');
  } finally {
    isConfirmingOrder.value = false;
  }
};

const handleMarkItemReady = async (orderId: string, itemId: string, itemName: string) => {
  if (isUpdatingItemStatus.value) return;
  isUpdatingItemStatus.value = itemId;
  try {
    await orderService.updateItemStatus(orderId, itemId, 'ready');
    toast.success(`✅ ${itemName} — Đã nấu xong!`);
    await fetchData();
    // Rebind the modal payload organically
    if (selectedTable.value) {
      const updated = tables.value.find(t => t.id === selectedTable.value.id);
      if (updated) {
        const tableOrders = activeOrders.value.filter(o => o.tableId === updated.id && o.sessionId === updated.activeSessionId);
        selectedTable.value = {
          ...selectedTable.value,
          ...updated,
          tableOrders,
          computedState: updated.computedState
        };
      }
    }
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Lỗi cập nhật trạng thái');
  } finally {
    isUpdatingItemStatus.value = null;
  }
};

// ========== SERVICE STATUS ACTIONS (served / completed) ==========
const updatingOrderId = ref<string | null>(null);

const handleServiceStatusUpdate = async (orderId: string, newStatus: string) => {
  if (updatingOrderId.value) return;
  updatingOrderId.value = orderId;
  try {
    await apiClient.put(`/orders/${orderId}`, { status: newStatus });
    await fetchData();
    // Rebind modal data
    if (selectedTable.value) {
      const updated = tables.value.find(t => t.id === selectedTable.value.id);
      if (updated) {
        const tableOrders = activeOrders.value.filter(o => o.tableId === updated.id && o.sessionId === updated.activeSessionId);
        selectedTable.value = {
          ...selectedTable.value,
          ...updated,
          tableOrders,
          computedState: updated.computedState
        };
      }
    }
    const labels: Record<string, string> = { ready: 'Xác nhận đã nấu!' };
    toast.success(labels[newStatus] || 'Cập nhật thành công');
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Lỗi cập nhật');
  } finally {
    updatingOrderId.value = null;
  }
};

const orderStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending_confirmation: 'Chờ xác nhận',
    confirmed: '🔥 Đã gửi bếp',
    ready: '✅ Đã nấu',
    cancelled: 'Đã huỷ',
  };
  return labels[status] || status;
};

const orderStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending_confirmation: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return colors[status] || 'bg-slate-100 text-slate-500';
};

// ========== STAFF ORDER MODAL ==========
import { useMenuStore } from '@/stores/menu.store';
const menuStore = useMenuStore();

const showStaffOrderModal = ref(false);
const staffOrderTableId = ref<number | null>(null);
const staffCart = ref<any[]>([]);
const staffSearchQuery = ref('');
const staffActiveCategoryId = ref<string | null>(null);
const isSubmittingStaffOrder = ref(false);

const staffCategories = computed(() => {
  const catsMap = new Map();
  menuStore.menuItems.forEach((item: any) => {
    if (item.category) {
      catsMap.set(item.category.id, item.category);
    }
  });
  return Array.from(catsMap.values()).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
});

const staffFilteredMenuItems = computed(() => {
  let items = menuStore.menuItems.filter((i: any) => !i.isDeleted && i.available !== false);
  if (staffActiveCategoryId.value) {
    items = items.filter((i: any) => i.categoryId === staffActiveCategoryId.value);
  }
  if (staffSearchQuery.value) {
    const q = staffSearchQuery.value.toLowerCase();
    items = items.filter((i: any) => i.name.toLowerCase().includes(q) || (i.description && i.description.toLowerCase().includes(q)));
  }
  return items;
});

const staffCartTotal = computed(() => {
  return staffCart.value.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
});

const staffCartCount = computed(() => {
  return staffCart.value.reduce((sum, i) => sum + i.quantity, 0);
});

const openStaffOrderModal = (tableId: number) => {
  staffOrderTableId.value = tableId;
  staffCart.value = [];
  staffSearchQuery.value = '';
  staffActiveCategoryId.value = null;
  showStaffOrderModal.value = true;
  menuStore.fetchMenuItems(true); // Force refresh
};

const addToStaffCart = (menuItem: any) => {
  const existing = staffCart.value.find(i => i.menuItemId === menuItem.id);
  if (existing) {
    existing.quantity++;
  } else {
    staffCart.value.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: Number(menuItem.price),
      quantity: 1,
      note: '',
      imageFilename: menuItem.imageFilename,
    });
  }
};

const removeFromStaffCart = (menuItemId: string) => {
  staffCart.value = staffCart.value.filter(i => i.menuItemId !== menuItemId);
};

const staffCartItemQty = (menuItemId: string, delta: number) => {
  const item = staffCart.value.find(i => i.menuItemId === menuItemId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromStaffCart(menuItemId);
  }
};

const getStaffImageUrl = (menuItem: any) => {
  const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  let imgFilename = menuItem.imageFilename;
  if (!imgFilename && menuItem.images && menuItem.images.length > 0) {
    imgFilename = menuItem.images[0].image;
  }
  if (imgFilename) {
    if (imgFilename.startsWith('http')) return imgFilename;
    const cleanName = imgFilename.replace('/uploads/images/', '').replace('/uploads/', '');
    return `${BASE_URL}/uploads/${cleanName}`;
  }
  return 'https://placehold.co/150x150?text=No+Image';
};

const submitStaffOrder = async () => {
  if (!staffOrderTableId.value || staffCart.value.length === 0 || isSubmittingStaffOrder.value) return;
  
  isSubmittingStaffOrder.value = true;
  try {
    const totalAmount = staffCartTotal.value;
    await apiClient.post('/orders', {
      tableId: staffOrderTableId.value,
      totalAmount,
      items: staffCart.value.map(i => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        note: i.note || undefined,
      }))
    });
    
    toast.success('Đã đặt món thành công!');
    showStaffOrderModal.value = false;
    staffCart.value = [];
    await fetchData();
    
    // Refresh the table modal if it's still open
    if (showModal.value && selectedTable.value?.id === staffOrderTableId.value) {
      const updated = tables.value.find(t => t.id === staffOrderTableId.value);
      if (updated) {
        const tableOrders = activeOrders.value.filter(o => o.tableId === updated.id);
        selectedTable.value = {
          ...selectedTable.value,
          ...updated,
          tableOrders,
          computedState: updated.computedState
        };
      }
    }
  } catch (error: any) {
    console.error(error);
    toast.error(error.response?.data?.message || 'Lỗi khi đặt món');
  } finally {
    isSubmittingStaffOrder.value = false;
  }
};

const showPreviewBill = ref(false);
const isPreviewing = ref(false);
const previewData = ref<any>(null);
const activePaymentId = ref<string | null>(null);
const isCreatingPayment = ref(false);

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
  if (!element || !previewData.value) return;
  
  const opt = {
    margin:       0,
    filename:     `bill-${previewData.value.sessionId}.pdf`,
    image:        { type: 'jpeg' as const, quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'mm', format: [80, 200] as [number, number], orientation: 'portrait' as const }
  };
  html2pdf().set(opt).from(element).save();
};


const handleViewPreview = async (table: any) => {
  const tableId = table?.id;
  if (!tableId) {
    toast.error('Invalid table');
    return;
  }

  if (userStore.user?.role === 'kitchen') {
    toast.error('Bạn không có quyền', { theme: 'colored' });
    return;
  }

  // Count ready items and gather non-ready items
  let readyCount = 0;
  const uncompleted: any[] = [];
  if (table.tableOrders) {
    table.tableOrders.forEach((order: any) => {
      if (order.items) {
        order.items.forEach((item: any) => {
          if (item.status !== 'cancelled') {
            if (item.status === 'ready') {
              readyCount += item.quantity;
            } else {
              uncompleted.push({
                name: item.name || item.menuItem?.name || 'Món ăn',
                status: item.status,
                quantity: item.quantity
              });
            }
          }
        });
      }
    });
  }

  if (readyCount === 0) {
    toast.warning('Chưa có món nào hoàn tất để thanh toán');
    return;
  }

  // If there are non-ready items, show the warning modal first!
  if (uncompleted.length > 0) {
    nonReadyItems.value = uncompleted;
    pendingWarningTable.value = table;
    showCheckoutWarning.value = true;
    return;
  }

  await proceedToPreviewBill(table);
};

const proceedToPreviewBill = async (table: any) => {
  const tableId = table.id;
  if (isPreviewing.value) return;
  try {
    isPreviewing.value = true;
    showPreviewBill.value = false;
    activePaymentId.value = null;  // Reset QR state for fresh preview
    
    const res = await apiClient.get(`/tables/${tableId}/preview-bill`);
    
    previewData.value = res.data;
    selectedTable.value = table;
    
    showPreviewBill.value = true;
    
    await fetchData();
  } catch (err: any) {
    console.error(err.response?.data);
    toast.error(err.response?.data?.message || 'Preview failed');
  } finally {
    isPreviewing.value = false;
  }
};

const handleConfirmCheckoutWarning = async () => {
  showCheckoutWarning.value = false;
  if (pendingWarningTable.value) {
    await proceedToPreviewBill(pendingWarningTable.value);
    pendingWarningTable.value = null;
  }
};

const handleCancelCheckoutWarning = () => {
  showCheckoutWarning.value = false;
  pendingWarningTable.value = null;
  nonReadyItems.value = [];
};


const handleFinalCheckout = async (table: any = null) => {
  let targetTableId = table?.id;
  
  if (!table) {
    // Fallback if triggered from preview modal where table isn't passed directly
    targetTableId = previewData.value?.tableId;
  }

  if (!targetTableId) {
    toast.error('Invalid table');
    return;
  }

  if (isProcessingPayment.value) return;
  isProcessingPayment.value = true;
  try {
    await apiClient.post(`/tables/${targetTableId}/checkout`);
    await fetchData();
    toast.success('Thanh toán thành công! Bàn đã được làm trống.');
    showPreviewBill.value = false;
    previewData.value = null;
    selectedTable.value = null;
    selectedOrder.value = null;
  } catch (error: any) {
    console.error(error);
    toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi thanh toán');
  } finally {
    isProcessingPayment.value = false;
  }
};

const handleForceReset = async (table: any) => {
  const tableId = table?.id;
  if (!tableId) {
    toast.error('Invalid table');
    return;
  }
  
  if (table?.computedState === 'available') {
    toast.error('Bàn chưa có dữ liệu để reset');
    return;
  }

  if (isResettingTable.value) return;
  if (!confirm('Bạn có chắc chắn muốn Force Reset bàn này? Hành động này sẽ hủy tất cả các đơn chưa hoàn thành và đóng phiên!')) return;
  
  isResettingTable.value = true;
  try {
    await apiClient.post(`/tables/${tableId}/reset`);
    await fetchData();
    toast.success('Đã reset bàn thành công!');
    showModal.value = false;
    previewData.value = null;
    selectedTable.value = null;
    selectedOrder.value = null;
  } catch (error: any) {
    console.error(error);
    toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi reset');
  } finally {
    isResettingTable.value = false;
  }
};

// ========== QR PAYMENT CREATION ==========
const handleCreateQRPayment = async () => {
  if (isCreatingPayment.value || !previewData.value?.tableId) return;
  isCreatingPayment.value = true;
  try {
    const res = await apiClient.post(`/tables/${previewData.value.tableId}/create-payment`);
    activePaymentId.value = res.data.paymentId;
    toast.success('Đã tạo QR thanh toán! Khách có thể quét mã.');
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Lỗi tạo thanh toán');
  } finally {
    isCreatingPayment.value = false;
  }
};

// ========== ORDER ITEM CANCELLATION (Fix #4 — Service/Waiter) ==========
const cancellingServiceItemId = ref<string | null>(null);

const handleServiceCancelItem = async (orderId: string, itemId: string, itemName: string) => {
  if (cancellingServiceItemId.value) return;
  
  const confirmed = confirm(`Hủy món "${itemName}"? Hành động này không thể hoàn tác.`);
  if (!confirmed) return;

  cancellingServiceItemId.value = itemId;
  try {
    await orderService.cancelOrderItem(orderId, itemId, 'service');
    toast.success(`Đã hủy: ${itemName}`);
    await fetchData();
    // Refresh the modal if it's open
    if (selectedTable.value) {
      await openTableModal(selectedTable.value.id);
    }
  } catch (error: any) {
    const msg = error?.response?.data?.message || 'Không thể hủy món.';
    toast.error(msg);
  } finally {
    cancellingServiceItemId.value = null;
  }
};

// ========== TABLE LOCK/UNLOCK (Feature #3) ==========
const isTogglingLock = ref(false);

const handleToggleLock = async (tableId: number, currentLocked: boolean) => {
  if (isTogglingLock.value) return;
  isTogglingLock.value = true;
  try {
    const endpoint = currentLocked ? 'unlock' : 'lock';
    await apiClient.post(`/tables/${tableId}/${endpoint}`);
    toast.success(currentLocked ? 'Đã mở khóa bàn' : 'Đã khóa bàn');
    await fetchData();
    // Refresh modal
    if (selectedTable.value?.id === tableId) {
      const updated = tables.value.find(t => t.id === tableId);
      if (updated) {
        selectedTable.value = { ...selectedTable.value, ...updated, isLocked: !currentLocked };
      }
    }
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Lỗi khóa/mở khóa bàn');
  } finally {
    isTogglingLock.value = false;
  }
};

// ========== PER-ITEM STATUS UPDATE (Feature #2) ==========
const updatingItemId = ref<string | null>(null);

const handleUpdateItemStatus = async (orderId: string, itemId: string, newStatus: string) => {
  if (updatingItemId.value) return;
  updatingItemId.value = itemId;
  try {
    await orderService.updateItemStatus(orderId, itemId, newStatus);
    toast.success('Cập nhật trạng thái món thành công');
    await fetchData();
    if (selectedTable.value) {
      const updated = tables.value.find(t => t.id === selectedTable.value.id);
      if (updated) {
        const tableOrders = activeOrders.value.filter(o => o.tableId === updated.id && o.sessionId === updated.activeSessionId);
        selectedTable.value = {
          ...selectedTable.value,
          ...updated,
          tableOrders,
          computedState: updated.computedState
        };
      }
    }
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Lỗi cập nhật trạng thái');
  } finally {
    updatingItemId.value = null;
  }
};

// Batch and select-all functions removed in favor of direct individual confirmation.

const itemStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã gửi bếp',
    ready: 'Đã nấu',
    cancelled: 'Đã hủy',
  };
  return labels[status] || status;
};

const itemStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 line-through',
  };
  return colors[status] || 'bg-slate-100 text-slate-500';
};

</script>

<template>
  <div class="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 antialiased font-display max-w-[1600px] mx-auto">
    
    <!-- Header -->
    <header class="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
      <div class="flex items-center px-3 sm:px-4 py-3 sm:py-4 justify-between max-w-7xl mx-auto w-full">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="bg-primary/10 p-1.5 sm:p-2 rounded-lg text-primary">
            <span class="material-symbols-outlined text-[20px] sm:text-[24px]">grid_view</span>
          </div>
          <div>
            <h2 class="text-base sm:text-xl font-bold leading-tight tracking-tight">Quản lý bàn</h2>
            <p class="text-[10px] text-slate-500 font-medium sm:hidden">{{ tables.length }} bàn</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 sm:gap-2">
          <NotificationBell />
          <button @click="fetchData" class="flex size-10 items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors active:scale-95">
            <span class="material-symbols-outlined" :class="{ 'animate-spin': loading }">refresh</span>
          </button>
          <button @click="handleLogout" class="flex size-10 items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-95" title="Đăng xuất">
            <span class="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </div>
      
      <!-- Tab Navigation — scrollable on mobile -->
      <div class="px-3 sm:px-4 max-w-7xl mx-auto w-full">
        <div class="flex gap-3 sm:gap-6 overflow-x-auto no-scrollbar">
          <a class="flex flex-col items-center justify-center border-b-2 border-primary text-primary pb-2.5 sm:pb-3 pt-1.5 sm:pt-2 whitespace-nowrap" href="#">
            <p class="text-xs sm:text-sm font-bold">Tất cả ({{ tables.length }})</p>
          </a>
          <a class="flex flex-col items-center justify-center border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 pb-2.5 sm:pb-3 pt-1.5 sm:pt-2 whitespace-nowrap" href="#">
            <p class="text-xs sm:text-sm font-bold">Trống ({{ stats.available }})</p>
          </a>
          <a class="flex flex-col items-center justify-center border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 pb-2.5 sm:pb-3 pt-1.5 sm:pt-2 whitespace-nowrap" href="#">
            <p class="text-xs sm:text-sm font-bold">Chờ xác nhận ({{ stats.waiting }})</p>
          </a>
          <a class="flex flex-col items-center justify-center border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 pb-2.5 sm:pb-3 pt-1.5 sm:pt-2 whitespace-nowrap" href="#">
            <p class="text-xs sm:text-sm font-bold">Đang phục vụ ({{ stats.occupied }})</p>
          </a>
          <a class="flex flex-col items-center justify-center border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 pb-2.5 sm:pb-3 pt-1.5 sm:pt-2 whitespace-nowrap" href="#">
            <p class="text-xs sm:text-sm font-bold">Phục vụ xong ({{ stats.serving }})</p>
          </a>
        </div>
      </div>
    </header>

    <main class="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-24 md:pb-8">
      <div v-if="loading && tables.length === 0" class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 md:gap-4">
        <div v-for="i in 10" :key="i" class="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 sm:p-4 aspect-[4/3] sm:aspect-square flex flex-col justify-between animate-pulse border border-slate-200 dark:border-slate-700">
          <div class="flex justify-between items-start">
            <div class="h-6 sm:h-8 w-12 sm:w-16 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
            <div class="h-4 sm:h-5 w-14 sm:w-20 bg-slate-200 dark:bg-slate-700 rounded shadow-sm"></div>
          </div>
          <div class="space-y-2 sm:space-y-3">
             <div class="flex items-center gap-2"><div class="h-3 sm:h-4 w-3 sm:w-4 bg-slate-200 dark:bg-slate-700 rounded-full"></div><div class="h-3 sm:h-4 w-16 sm:w-20 bg-slate-200 dark:bg-slate-700 rounded"></div></div>
             <div class="h-8 sm:h-10 w-full bg-slate-200 dark:bg-slate-700 rounded-lg mt-2 sm:mt-4 shadow-sm"></div>
          </div>
        </div>
      </div>
      
      <div v-else class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 md:gap-4">
        
        <div 
          v-for="table in displayTables" 
          :key="table.id"
          @click="handleTableClickEvent(table.id)"
          :class="['group relative flex flex-col rounded-xl p-3 sm:p-4 aspect-[4/3] sm:aspect-square justify-between cursor-pointer transition-all active:scale-[0.97]', table.colorClass]"
        >
          <div class="flex justify-between items-start z-10">
            <span class="text-2xl sm:text-3xl font-black tracking-tighter">{{ table.name.replace('Table', '').trim() || table.id }}</span>
            <div class="flex flex-col items-end gap-1">
              <div :class="['px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest', table.badgeClass]">
                {{ table.statusText }}
              </div>
              <div v-if="notifications[table.id] && notifications[table.id].unreadCount > 0" class="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm">
                 <span class="material-symbols-outlined text-[12px]">notifications_active</span>
                 <span>{{ notifications[table.id].unreadCount }}</span>
              </div>
              <div v-if="table.billPrinted" class="flex items-center gap-1 bg-slate-800 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm mt-1">
                 <span class="material-symbols-outlined text-[12px]">receipt_long</span>
                 <span>Đã in Bill</span>
              </div>
              <div v-if="table.isLocked" class="flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm mt-1 animate-pulse">
                 <span class="material-symbols-outlined text-[12px]">lock</span>
                 <span>Khóa</span>
              </div>
            </div>
          </div>
          
          <div class="z-10">
            <div class="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1" :class="{ 'text-slate-500 dark:text-slate-400': !table.colorClass.includes('text-white') }">
              <span class="material-symbols-outlined text-xs sm:text-sm">groups</span>
              <span class="text-xs sm:text-sm font-bold">{{ table.guestCount }} khách</span>
            </div>
            <div class="flex items-center gap-1 sm:gap-1.5" :class="{ 'text-slate-400 dark:text-slate-500': !table.colorClass.includes('text-white') }">
              <span class="material-symbols-outlined text-xs sm:text-sm">{{ table.icon }}</span>
              <span class="text-xs sm:text-sm font-medium truncate">{{ table.activeOrder ? `#${table.activeOrder.id.substring(0,6)}` : 'Sẵn sàng' }}</span>
            </div>
            
            <button @click.stop="openChat(table.id, table.name)" class="mt-2 sm:mt-3 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all w-full justify-center relative shadow-sm border min-h-[36px] active:scale-95" :class="table.colorClass.includes('text-white') ? 'bg-white/20 hover:bg-white/30 border-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 border-slate-200 text-slate-700 dark:text-slate-300'">
               <span class="material-symbols-outlined text-sm">chat</span>
               Open Chat
               <span v-if="notifications[table.id] && notifications[table.id].unreadCount > 0" class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
                 <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                 <span class="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-[9px] font-bold items-center justify-center">{{ notifications[table.id].unreadCount }}</span>
               </span>
            </button>
          </div>
          
          <div class="sm:hidden mt-2 pt-2 border-t border-slate-200/20 dark:border-slate-700/50 flex gap-1.5">
            <button v-if="['occupied', 'serving'].includes(table.computedState)" @click.stop="router.push('/customer?tableId=' + table.id)" class="flex-1 py-2.5 bg-slate-800 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm min-h-[36px] active:scale-95">Gọi món</button>
            <button v-if="userStore.user && userStore.user.role !== 'kitchen' && hasConfirmedItemsForTable(table)" @click.stop="handleViewPreview(table)" :disabled="isPreviewing || !table?.id || table.computedState === 'available'" class="flex-1 py-2.5 bg-white/20 hover:bg-white/30 text-slate-800 dark:text-white rounded-lg text-[11px] font-bold transition-all border border-slate-300 dark:border-slate-600 disabled:opacity-50 min-h-[36px] active:scale-95">
              {{ isPreviewing && previewData?.tableId === table.id ? '...' : 'In bill' }}
            </button>
            <button @click.stop="openTableModal(table.id)" class="flex-1 py-3 bg-purple-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm">Thanh toán</button>
          </div>

          <div v-if="table.colorClass.includes('text-white')" class="absolute -right-4 -bottom-4 opacity-10 pointer-events-none hidden md:block">
            <span class="material-symbols-outlined text-9xl">restaurant</span>
          </div>
        </div>

      </div>
    </main>

    <!-- Sticky Bottom Bar (Mobile) -->
    <div class="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-2 md:hidden flex justify-around items-center z-40 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <button @click="showNotifs = !showNotifs" class="relative p-2 flex flex-col items-center w-full text-slate-500 focus:text-primary transition-colors">
        <span class="material-symbols-outlined text-[28px]">notifications</span>
        <span class="text-[10px] font-bold mt-0.5">Alerts</span>
        <span v-if="totalUnread > 0" class="absolute top-2 right-[25%] bg-red-500 text-white text-[10px] font-black h-[18px] min-w-[18px] px-1 flex items-center justify-center rounded-full leading-none shadow-md border-2 border-white dark:border-slate-900 animate-bounce">{{ totalUnread }}</span>
      </button>
      <button class="relative p-2 flex flex-col items-center w-full text-slate-500 hover:text-primary transition-colors">
        <span class="material-symbols-outlined text-[28px]">chat</span>
        <span class="text-[10px] font-bold mt-0.5">Chat</span>
      </button>
    </div>

    <!-- Notification Dropdown -->
    <div v-if="showNotifs" class="fixed bottom-[80px] left-4 right-4 bg-white dark:bg-slate-800 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-slate-200 dark:border-slate-700 z-50 overflow-hidden md:hidden animate-in slide-in-from-bottom-4 duration-300">
      <div class="p-5 border-b border-slate-100 dark:border-slate-700 font-bold flex justify-between items-center text-lg bg-slate-50 dark:bg-slate-900">
        Notification Center
        <button @click="showNotifs = false" class="bg-slate-200 dark:bg-slate-700 rounded-full h-8 w-8 flex justify-center items-center text-slate-600 dark:text-slate-300"><span class="material-symbols-outlined text-sm">close</span></button>
      </div>
      <div class="max-h-[50vh] overflow-y-auto w-full custom-scrollbar">
         <div v-if="notificationsList.length === 0" class="p-12 text-center text-slate-500 text-sm flex flex-col items-center">
            <span class="material-symbols-outlined text-4xl mb-2 opacity-50">all_inbox</span>
            Không có dữ liệu
         </div>
         <div v-else v-for="notif in notificationsList" @click="openTableModal(notif.tableId)" class="p-4 border-b border-slate-50 dark:border-slate-800/50 flex items-start gap-4 active:bg-slate-50 dark:active:bg-slate-700 transition-colors">
            <div class="bg-primary/10 text-primary rounded-full size-10 flex items-center justify-center font-black flex-none">#{{ notif.tableId }}</div>
            <div class="flex flex-col">
              <span class="text-sm font-bold text-slate-800 dark:text-slate-200">{{ notif.message }}</span>
              <span class="text-xs text-slate-500 mt-0.5">{{ notif.count }} recent alerts</span>
            </div>
         </div>
      </div>
    </div>

    <!-- Modal for Waiter Actions -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4">
      <div class="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]">
        <!-- Modal Header -->
        <div class="flex justify-between items-center p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 class="text-xl sm:text-2xl font-bold">{{ selectedTable?.name }}</h3>
            <p class="text-sm text-slate-500">{{ selectedTable?.statusText }}</p>
          </div>
          <div class="flex gap-2">
            <button @click="handleToggleLock(selectedTable.id, selectedTable.isLocked)" :disabled="isTogglingLock || !selectedTable?.id" :class="['px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border min-h-[36px] active:scale-95 flex items-center gap-1', selectedTable?.isLocked ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800' : 'bg-amber-100 text-amber-600 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 border-amber-200 dark:border-amber-800']">
              <span v-if="isTogglingLock" class="material-symbols-outlined animate-spin text-[12px]">autorenew</span>
              <span class="material-symbols-outlined text-[14px]">{{ selectedTable?.isLocked ? 'lock_open' : 'lock' }}</span>
              {{ selectedTable?.isLocked ? 'Mở khóa' : 'Khóa bàn' }}
            </button>
            <button @click="handleForceReset(selectedTable)" :disabled="isResettingTable || !selectedTable?.id" class="px-3 py-1.5 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg text-xs font-bold transition-colors border border-red-200 dark:border-red-800 disabled:opacity-50 min-h-[36px] active:scale-95">
              <span v-if="isResettingTable" class="material-symbols-outlined animate-spin text-[12px] align-middle mr-1">autorenew</span>
              Force Reset
            </button>
            <button @click="showModal = false" class="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        
        <!-- Modal Body (Orders) -->
        <div class="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/10">
          <div v-if="!selectedTable?.tableOrders || selectedTable.tableOrders.length === 0" class="text-center text-slate-500 p-8">
            <span class="material-symbols-outlined text-4xl mb-2">event_seat</span>
            <p class="font-bold text-lg">Không có dữ liệu</p>
          </div>
          <div v-else class="space-y-4">
            <div v-for="order in selectedTable.tableOrders" :key="order.id" class="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
              <div class="flex justify-between items-center mb-3 border-b border-slate-100 dark:border-slate-700/50 pb-2">
                <h4 class="font-bold text-slate-700 dark:text-slate-300">Order #{{ order.id.substring(0,6) }}</h4>
                <span :class="['text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider', orderStatusColor(order.status)]">{{ orderStatusLabel(order.status) }}</span>
              </div>
              
              <!-- Items list with individual actions -->
              <div class="space-y-3 mt-3">
                <div v-for="item in order.items" :key="item.id" class="p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                  <div class="flex justify-between items-start">
                    <div>
                      <p :class="['font-bold text-sm', item.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200']">
                        <span v-if="item.status === 'cancelled'">{{ item.quantity }}x </span>{{ item.name || item.menuItem?.name || 'Món ăn' }}
                      </p>
                      <span :class="['text-[9px] px-1.5 py-0.5 rounded font-bold uppercase inline-block mt-1', itemStatusColor(item.status)]">
                        {{ itemStatusLabel(item.status) }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <span :class="['text-sm font-bold', item.status === 'cancelled' ? 'text-slate-300 line-through' : 'text-slate-650 dark:text-slate-400']">
                        {{ formatCurrency(Number(item.price) * item.quantity) }}
                      </span>
                    </div>
                  </div>

                  <!-- POS controls for quantity & notes (shown for all active items) -->
                  <div v-if="item.status !== 'cancelled'" class="mt-3 space-y-2">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">Số lượng:</span>
                        <div class="flex items-center gap-1.5">
                          <button 
                            @click.stop="handleUpdateQuantity(order.id, item, -1)"
                            :disabled="item.status !== 'pending'"
                            :class="['size-6 rounded flex items-center justify-center text-xs font-bold transition-all border active:scale-95 text-slate-700 dark:text-slate-300', item.status !== 'pending' ? 'opacity-50 cursor-not-allowed bg-slate-150 dark:bg-slate-800 border-slate-250 dark:border-slate-700' : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 border-slate-300 dark:border-slate-600']"
                          >
                            −
                          </button>
                          <span class="text-xs font-black w-6 text-center text-slate-800 dark:text-slate-100">{{ item.quantity }}</span>
                          <button 
                            @click.stop="handleUpdateQuantity(order.id, item, 1)"
                            :disabled="item.status !== 'pending'"
                            :class="['size-6 rounded flex items-center justify-center text-xs font-bold transition-all border active:scale-95', item.status !== 'pending' ? 'opacity-50 cursor-not-allowed bg-slate-150 dark:bg-slate-800 border-slate-250 dark:border-slate-700 text-slate-700 dark:text-slate-300' : 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20']"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <!-- Individual Item Actions inside card -->
                      <div v-if="order.status !== 'cancelled' && ['pending', 'confirmed'].includes(item.status)" class="flex items-center gap-1.5">
                        <!-- Confirm individual pending item -->
                        <button
                          v-if="item.status === 'pending'"
                          @click.stop="handleConfirmIndividualItem(order.id, item.id, item.name || 'Món ăn')"
                          :disabled="isConfirmingOrder"
                          class="px-2.5 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded font-bold text-xs transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50 active:scale-95"
                        >
                          <span v-if="isConfirmingOrder" class="material-symbols-outlined animate-spin text-[12px]">autorenew</span>
                          <span v-else class="material-symbols-outlined text-[14px]">check</span>
                          Xác nhận
                        </button>
                        
                        <!-- Cancel individual pending item -->
                        <button
                          v-if="item.status === 'pending'"
                          @click.stop="handleServiceCancelItem(order.id, item.id, item.name || 'Món ăn')"
                          :disabled="cancellingServiceItemId === item.id"
                          class="px-2.5 py-1 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded text-xs font-bold transition-colors border border-red-200 dark:border-red-800 disabled:opacity-50 flex items-center gap-1 active:scale-95"
                        >
                          <span v-if="cancellingServiceItemId === item.id" class="material-symbols-outlined animate-spin text-[12px]">refresh</span>
                          <span v-else class="material-symbols-outlined text-[14px]">close</span>
                          Hủy món
                        </button>
                        
                        <!-- Mark confirmed item as ready (cooked) -->
                        <button
                          v-if="item.status === 'confirmed'"
                          @click.stop="handleMarkItemReady(order.id, item.id, item.name || 'Món ăn')"
                          :disabled="isUpdatingItemStatus === item.id"
                          class="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold text-xs transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50 active:scale-95"
                        >
                          <span v-if="isUpdatingItemStatus === item.id" class="material-symbols-outlined animate-spin text-[12px]">autorenew</span>
                          <span v-else class="material-symbols-outlined text-[14px]">restaurant</span>
                          Đã nấu
                        </button>
                      </div>
                    </div>

                    <!-- Ghi chú input -->
                    <div class="flex items-center gap-1.5 w-full">
                      <span class="material-symbols-outlined text-slate-400 text-xs shrink-0">edit_note</span>
                      <input 
                        v-model="itemNotes[item.id]" 
                        :disabled="item.status !== 'pending'"
                        @blur="handleSaveItemNote(order.id, item)"
                        @keydown.enter="handleSaveItemNote(order.id, item)"
                        placeholder="Ghi chú cho bếp..." 
                        :class="['flex-1 text-[11px] border rounded px-2 py-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/50', item.status !== 'pending' ? 'opacity-60 cursor-not-allowed border-slate-100 dark:border-slate-800' : 'border-slate-200 dark:border-slate-700']" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex justify-between items-center text-sm font-black pt-3 border-t border-slate-100 dark:border-slate-700/50 mt-3">
                <span class="text-slate-500">Tổng Order</span>
                <span class="text-slate-800 dark:text-slate-200">{{ formatCurrency(order.totalAmount) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Actions -->
        <div v-if="selectedTable" class="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 gap-2 shrink-0">
          
          <div v-if="['waiting_confirm', 'occupied', 'serving', 'paying'].includes(selectedTable.computedState)" class="flex flex-col gap-2">
            <button 
              @click="openStaffOrderModal(selectedTable.id)"
              class="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors min-h-[52px] active:scale-[0.98]"
            >
              <span class="material-symbols-outlined text-sm">restaurant_menu</span>
              Thêm món (Order more)
            </button>
            <div class="flex gap-2" v-if="userStore.user && userStore.user.role !== 'kitchen' && hasConfirmedItemsForTable(selectedTable)">
              <button 
                @click="handleViewPreview(selectedTable)"
                :disabled="isPreviewing || !selectedTable?.id"
                class="flex-1 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 min-h-[52px] active:scale-[0.98]"
              >
                <span v-if="isPreviewing" class="material-symbols-outlined animate-spin text-sm">refresh</span>
                <span v-else class="material-symbols-outlined text-sm">receipt_long</span> 
                {{ isPreviewing ? 'Đang tải...' : 'Xem tạm tính / Checkout' }}
              </button>
            </div>
          </div>

          <div v-else-if="selectedTable.computedState === 'available'" class="flex flex-col gap-2">
            <button 
              @click="openStaffOrderModal(selectedTable.id)"
              class="w-full py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors min-h-[52px] active:scale-[0.98]"
            >
              <span class="material-symbols-outlined text-sm">add_circle</span>
              Đặt món cho bàn này
            </button>
          </div>

        </div>
      </div>
    </div>

    <!-- Live Waiter Chat Interface -->
    <ChatModal v-if="chatTableId" :tableId="chatTableId" :tableName="chatTableName" @close="chatTableId = null" />

    <!-- Bill Preview Modal -->
    <div v-if="showPreviewBill" class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
      <div class="bg-white dark:bg-slate-900 w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        <div class="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <h3 class="font-bold text-lg">Hóa đơn tạm tính</h3>
          <button @click="showPreviewBill = false" class="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg flex items-center justify-center">
            <span class="material-symbols-outlined pb-[2px]">close</span>
          </button>
        </div>
        <div class="p-4 bg-slate-50 dark:bg-slate-900/50 overflow-y-auto w-full custom-scrollbar flex flex-col items-center flex-1">
            <div id="print-area" class="w-full max-w-[80mm] bg-white text-black p-4 rounded-lg shadow-sm">
                <PrintBill :data="previewData" :paymentId="activePaymentId || undefined" />
            </div>
        </div>
        <div class="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2 bg-white dark:bg-slate-900">
            <div class="flex gap-2">
              <button @click="executePrint(false)" class="flex-1 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-sm">
                  <span class="material-symbols-outlined text-[18px]">print</span> In Bill
              </button>
              <button 
                v-if="!activePaymentId"
                @click="handleCreateQRPayment"
                :disabled="isCreatingPayment"
                class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm"
              >
                  <span v-if="isCreatingPayment" class="material-symbols-outlined animate-spin text-[18px]">autorenew</span>
                  <span v-else class="material-symbols-outlined text-[18px]">qr_code_2</span> 
                  {{ isCreatingPayment ? 'Đang tạo...' : 'Tạo QR' }}
              </button>
              <div v-else class="flex-1 py-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl font-bold flex items-center justify-center gap-2 text-sm">
                  <span class="material-symbols-outlined text-[18px]">check_circle</span> QR đã tạo
              </div>
            </div>
            <button 
              v-if="['occupied', 'serving', 'paying'].includes(selectedTable?.computedState)"
              @click="handleFinalCheckout(selectedTable)"
              :disabled="isProcessingPayment || !selectedTable?.id"
              class="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm"
            >
                <span v-if="isProcessingPayment" class="material-symbols-outlined animate-spin text-[18px]">refresh</span>
                <span v-else class="material-symbols-outlined text-[18px]">payments</span> 
                {{ isProcessingPayment ? 'Đang xử lý...' : 'Thu tiền mặt (Cash)' }}
            </button>
        </div>
      </div>
    </div>

    <!-- ========== STAFF ORDER MODAL ========== -->
    <div v-if="showStaffOrderModal" class="fixed inset-0 z-[70] flex items-stretch bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-white dark:bg-slate-900 w-full flex flex-col overflow-hidden">
        
        <!-- Staff Modal Header -->
        <div class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div class="flex items-center gap-3">
            <button @click="showStaffOrderModal = false" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <span class="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h3 class="text-lg font-bold">Đặt món — Bàn {{ staffOrderTableId }}</h3>
              <p class="text-xs text-slate-500">Chọn món và gửi bếp</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="staffCartCount > 0" class="bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">{{ staffCartCount }} món</span>
            <button @click="showStaffOrderModal = false" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <!-- Staff Modal Body -->
        <div class="flex flex-1 overflow-hidden">
          
          <!-- Menu Grid (Left/Main) -->
          <div class="flex-1 flex flex-col overflow-hidden">
            
            <!-- Search + Categories -->
            <div class="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3 shrink-0">
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                <input v-model="staffSearchQuery" placeholder="Tìm món..." class="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50" />
              </div>
              <div class="flex gap-2 overflow-x-auto no-scrollbar">
                <button @click="staffActiveCategoryId = null" :class="['px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap', !staffActiveCategoryId ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200']">
                  Tất cả
                </button>
                <button v-for="cat in staffCategories" :key="cat.id" @click="staffActiveCategoryId = cat.id" :class="['px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap', staffActiveCategoryId === cat.id ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200']">
                  {{ cat.name }}
                </button>
              </div>
            </div>

            <!-- Menu Items Grid -->
            <div class="flex-1 overflow-y-auto p-4">
              <div v-if="menuStore.loading" class="flex items-center justify-center p-12">
                <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div v-else-if="staffFilteredMenuItems.length === 0" class="text-center text-slate-500 p-12">
                <span class="material-symbols-outlined text-4xl mb-2">search_off</span>
                <p class="font-bold">Không tìm thấy món</p>
              </div>
              <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <div 
                  v-for="menuItem in staffFilteredMenuItems" 
                  :key="menuItem.id" 
                  @click="addToStaffCart(menuItem)"
                  class="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group relative"
                >
                  <div class="aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img :src="getStaffImageUrl(menuItem)" :alt="menuItem.name" class="w-full h-full object-cover group-hover:scale-105 transition-transform" @error="(e: any) => e.target.src = 'https://placehold.co/150x150?text=No+Image'" />
                  </div>
                  <div class="p-2.5">
                    <p class="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{{ menuItem.name }}</p>
                    <p class="text-xs text-primary font-bold mt-0.5">{{ formatCurrency(Number(menuItem.price)) }}</p>
                  </div>
                  <!-- Quick quantity badge -->
                  <div v-if="staffCart.find(i => i.menuItemId === menuItem.id)" class="absolute top-1.5 right-1.5 bg-primary text-white text-[10px] font-black size-6 rounded-full flex items-center justify-center shadow-lg">
                    {{ staffCart.find(i => i.menuItemId === menuItem.id)?.quantity }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Staff Cart Sidebar (Right) -->
          <div class="w-80 border-l border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-900/50 shrink-0 hidden md:flex">
            <div class="p-4 border-b border-slate-100 dark:border-slate-800">
              <h4 class="font-bold text-sm flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-[18px]">shopping_cart</span>
                Giỏ hàng ({{ staffCartCount }})
              </h4>
            </div>
            
            <div class="flex-1 overflow-y-auto p-3 space-y-2">
              <div v-if="staffCart.length === 0" class="text-center text-slate-400 p-8">
                <span class="material-symbols-outlined text-3xl mb-2">add_shopping_cart</span>
                <p class="text-xs font-bold">Chọn món từ menu</p>
              </div>
              <div v-for="item in staffCart" :key="item.menuItemId" class="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                <div class="flex justify-between items-start mb-2">
                  <p class="text-xs font-bold text-slate-800 dark:text-slate-200 flex-1 pr-2">{{ item.name }}</p>
                  <button @click="removeFromStaffCart(item.menuItemId)" class="text-slate-300 hover:text-red-500 transition-colors">
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <button @click="staffCartItemQty(item.menuItemId, -1)" class="size-6 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 flex items-center justify-center text-xs font-bold transition-colors">−</button>
                    <span class="text-xs font-bold w-5 text-center">{{ item.quantity }}</span>
                    <button @click="staffCartItemQty(item.menuItemId, 1)" class="size-6 rounded bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center text-xs font-bold transition-colors">+</button>
                  </div>
                  <span class="text-xs font-bold text-primary">{{ formatCurrency(item.price * item.quantity) }}</span>
                </div>
                <input v-model="item.note" placeholder="Ghi chú..." class="w-full mt-2 text-[11px] border border-slate-100 dark:border-slate-700 rounded px-2 py-1 bg-slate-50 dark:bg-slate-900 focus:ring-1 focus:ring-primary/50" />
              </div>
            </div>

            <!-- Cart Footer -->
            <div class="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div class="flex justify-between items-center">
                <span class="text-sm font-bold text-slate-500">Tổng</span>
                <span class="text-lg font-black text-primary">{{ formatCurrency(staffCartTotal) }}</span>
              </div>
              <button 
                @click="submitStaffOrder"
                :disabled="staffCart.length === 0 || isSubmittingStaffOrder"
                class="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="isSubmittingStaffOrder" class="material-symbols-outlined animate-spin text-[18px]">autorenew</span>
                <span v-else class="material-symbols-outlined text-[18px]">send</span>
                {{ isSubmittingStaffOrder ? 'Đang gửi...' : 'Gửi đơn cho bếp' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Mobile Cart Footer (shown only on mobile when no sidebar) -->
        <div v-if="staffCart.length > 0" class="md:hidden p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <button 
            @click="submitStaffOrder"
            :disabled="staffCart.length === 0 || isSubmittingStaffOrder"
            class="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <span v-if="isSubmittingStaffOrder" class="material-symbols-outlined animate-spin text-[18px]">autorenew</span>
            <span v-else class="material-symbols-outlined text-[18px]">send</span>
            {{ isSubmittingStaffOrder ? 'Đang gửi...' : `Gửi đơn • ${formatCurrency(staffCartTotal)}` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Checkout Warning Modal -->
    <div v-if="showCheckoutWarning" class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-red-100 dark:border-red-900/30">
        <div class="p-5 flex flex-col items-center text-center">
          <div class="size-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-4 shrink-0">
            <span class="material-symbols-outlined text-2xl">warning</span>
          </div>
          <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-2">Cảnh báo: Món chưa hoàn thành</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Bàn này có các món chưa hoàn tất nấu hoặc chưa được xác nhận:
          </p>
          
          <div class="w-full bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 max-h-48 overflow-y-auto text-left mb-5 border border-slate-100 dark:border-slate-800 space-y-2">
            <div v-for="item in nonReadyItems" :key="item.name" class="flex justify-between items-center text-xs">
              <span class="font-semibold text-slate-800 dark:text-slate-200">{{ item.name }} (x{{ item.quantity }})</span>
              <span :class="['px-2 py-0.5 rounded font-bold uppercase text-[9px]', itemStatusColor(item.status)]">
                {{ itemStatusLabel(item.status) }}
              </span>
            </div>
          </div>
          
          <p class="text-xs text-slate-400 dark:text-slate-500 mb-6">
            Bạn có chắc chắn muốn tiếp tục thanh toán và bỏ qua các món này không?
          </p>

          <div class="flex gap-3 w-full">
            <button 
              @click="handleCancelCheckoutWarning" 
              class="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Hủy
            </button>
            <button 
              @click="handleConfirmCheckoutWarning" 
              class="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all text-sm shadow-sm"
            >
              Tiếp tục thanh toán
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
