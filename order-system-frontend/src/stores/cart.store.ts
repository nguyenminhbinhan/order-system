import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useCartStore = defineStore('cart', () => {
  const items = ref<any[]>([]);

  const totalItems = computed(() => items.value.reduce((acc, item) => acc + item.quantity, 0));
  const totalPrice = computed(() => items.value.reduce((acc, item) => acc + (item.price * item.quantity), 0));

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

  function clearCart() {
    items.value = [];
  }

  return { items, totalItems, totalPrice, addItem, removeItem, clearCart };
});
