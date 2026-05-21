import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

const CART_STORAGE_KEY = 'binh_an_cart';

/**
 * Cart store with localStorage persistence.
 * Cart data is scoped by tableId to prevent cross-table contamination.
 * On page reload, cart is restored from localStorage.
 */
export const useCartStore = defineStore('cart', () => {
  const items = ref<any[]>([]);

  const totalItems = computed(() => items.value.reduce((acc, item) => acc + item.quantity, 0));
  const totalPrice = computed(() => items.value.reduce((acc, item) => acc + (Number(item.price) * item.quantity), 0));

  // ===== PERSISTENCE =====

  /**
   * Load cart from localStorage scoped to current tableId.
   * Called on component mount when tableId is known.
   */
  function loadFromStorage(tableId: number | null) {
    if (!tableId) return;
    try {
      const stored = localStorage.getItem(`${CART_STORAGE_KEY}_${tableId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          items.value = parsed;
        }
      }
    } catch (e) {
      console.warn('[Cart] Failed to load from localStorage', e);
    }
  }

  /**
   * Save cart to localStorage scoped to current tableId.
   */
  function saveToStorage(tableId: number | null) {
    if (!tableId) return;
    try {
      localStorage.setItem(`${CART_STORAGE_KEY}_${tableId}`, JSON.stringify(items.value));
    } catch (e) {
      console.warn('[Cart] Failed to save to localStorage', e);
    }
  }

  /**
   * Clear cart data from localStorage for a specific table.
   */
  function clearStorage(tableId: number | null) {
    if (!tableId) {
      // Clear all cart keys
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(CART_STORAGE_KEY)) {
          localStorage.removeItem(key);
        }
      });
    } else {
      localStorage.removeItem(`${CART_STORAGE_KEY}_${tableId}`);
    }
  }

  // ===== CART MUTATIONS =====

  function addItem(product: any, quantity: number = 1, note: string = '') {
    const formattedNote = note.trim();
    const cartItemId = `${product.id}-${formattedNote}`;
    
    // Find exact match of product + note
    const existing = items.value.find(i => i.cartItemId === cartItemId);
    
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.value.push({ ...product, quantity, note: formattedNote, cartItemId });
    }
  }

  function removeItem(cartItemId: string) {
    items.value = items.value.filter(i => i.cartItemId !== cartItemId);
  }

  function updateQuantity(cartItemId: string, quantity: number) {
    const item = items.value.find(i => i.cartItemId === cartItemId);
    if (item) {
      if (quantity <= 0) {
        removeItem(cartItemId);
      } else {
        item.quantity = quantity;
      }
    }
  }

  function clearCart() {
    items.value = [];
  }

  function reset() {
    clearCart();
    clearStorage(null);
  }

  return { 
    items, totalItems, totalPrice, 
    addItem, removeItem, updateQuantity, clearCart,
    loadFromStorage, saveToStorage, clearStorage,
    reset
  };
});
