import { defineStore } from 'pinia';
import { ref } from 'vue';
import { authService } from '@/services/auth.service';
import { socketService } from '@/services/socket';
import { useOrderStore } from './order.store';
import { useCartStore } from './cart.store';
import { useMenuStore } from './menu.store';
import { useUIStore } from './ui.store';
import router from '@/router';
import { registerLogoutCallback } from '@/services/api';

export const useUserStore = defineStore('user', () => {
  const user = ref<any>(null);
  const token = ref<string | null>(localStorage.getItem('token'));
  const isAuthenticated = ref<boolean>(!!token.value);

  // Helper to get role from token
  function getRoleFromToken(t: string | null): string | null {
    if (!t) return null;
    try {
      const base64Url = t.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const parsed = JSON.parse(jsonPayload);
      return parsed.role || null;
    } catch (e) {
      return null;
    }
  }

  // Sync token to socketService on initial startup
  if (token.value) {
    socketService.setToken(token.value);
  }

  // Pre-load user from localStorage if role matches token
  const cachedUserStr = localStorage.getItem('user');
  if (cachedUserStr && token.value) {
    try {
      const parsed = JSON.parse(cachedUserStr);
      const tokenRole = getRoleFromToken(token.value);
      if (tokenRole && parsed.role === tokenRole) {
        user.value = parsed;
      } else if (tokenRole) {
        parsed.role = tokenRole;
        user.value = parsed;
      }
    } catch {}
  }

  async function login(credentials: any) {
    const data = await authService.login(credentials);
    token.value = data.access_token;
    localStorage.setItem('token', data.access_token);
    socketService.setToken(data.access_token); // Update socket service
    if (data.refresh_token) {
      localStorage.setItem('refreshToken', data.refresh_token);
    }
    
    // Hydrate user immediately from login response (no extra API call needed)
    if (data.user) {
      user.value = data.user;
      localStorage.setItem('user', JSON.stringify(data.user));
    } else {
      // Fallback: fetch profile if login doesn't return user
      await fetchProfile();
    }
    
    isAuthenticated.value = true;
    
    // Reconnect socket with new token
    socketService.reconnectWithNewToken();
  }

  async function fetchProfile() {
    try {
      const data = await authService.getProfile();
      user.value = data;
      localStorage.setItem('user', JSON.stringify(data));
    } catch (error: any) {
      console.error('Failed to fetch profile', error);
      // Only logout if the token is definitively invalid (401 from server)
      // AND there's no refresh token to try.
      // The Axios interceptor handles the refresh flow automatically.
      if (error?.response?.status === 401) {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          logout();
        }
        // If refresh token exists, interceptor handles it. Don't logout.
      }
    }
  }

  function logout() {
    user.value = null;
    token.value = null;
    isAuthenticated.value = false;
    socketService.setToken(null);

    // Clear other stores
    try {
      const orderStore = useOrderStore();
      orderStore.reset();
    } catch (e) {
      console.warn('Failed to reset order store:', e);
    }

    try {
      const cartStore = useCartStore();
      cartStore.reset();
    } catch (e) {
      console.warn('Failed to reset cart store:', e);
    }

    try {
      const menuStore = useMenuStore();
      menuStore.reset();
    } catch (e) {
      console.warn('Failed to reset menu store:', e);
    }

    try {
      const uiStore = useUIStore();
      uiStore.reset();
    } catch (e) {
      console.warn('Failed to reset ui store:', e);
    }

    // Clear all localStorage keys completely on logout
    localStorage.clear();

    // Disconnect socket on logout
    socketService.removeAllAppListeners();
    socketService.disconnect();

    // Redirect immediately to login
    router.replace('/login');
  }

  // Register logout callback for API client to use when refreshing fails
  registerLogoutCallback(logout);

  // Rehydrate session on page reload if token exists but user is null
  async function initSession() {
    if (isAuthenticated.value && !user.value) {
      // Try localStorage first (instant, no network)
      const cached = localStorage.getItem('user');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const tokenRole = getRoleFromToken(token.value);
          if (tokenRole && parsed.role === tokenRole) {
            user.value = parsed;
          } else if (tokenRole) {
            parsed.role = tokenRole;
            user.value = parsed;
          }
        } catch {}
      }
      
      // Then validate with server (background)
      await fetchProfile();
    }
    
    // Ensure socket is connected after session rehydration
    // This is critical for surviving page refreshes — without it,
    // realtime events won't work until a view-level connect() happens
    if (isAuthenticated.value && token.value) {
      socketService.setToken(token.value);
      socketService.connect();
    }
  }

  return { user, token, isAuthenticated, login, fetchProfile, logout, initSession };
});
