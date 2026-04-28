import { defineStore } from 'pinia';
import { ref } from 'vue';
import { authService } from '@/services/auth.service';
import { socketService } from '@/services/socket';

export const useUserStore = defineStore('user', () => {
  const user = ref<any>(null);
  const token = ref<string | null>(localStorage.getItem('token'));
  const isAuthenticated = ref<boolean>(!!token.value);

  async function login(credentials: any) {
    const data = await authService.login(credentials);
    token.value = data.access_token;
    localStorage.setItem('token', data.access_token);
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
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    // Disconnect socket on logout
    socketService.disconnect();
  }

  // Rehydrate session on page reload if token exists but user is null
  async function initSession() {
    if (isAuthenticated.value && !user.value) {
      // Try localStorage first (instant, no network)
      const cached = localStorage.getItem('user');
      if (cached) {
        try {
          user.value = JSON.parse(cached);
        } catch {}
      }
      
      // Then validate with server (background)
      await fetchProfile();
    }
  }

  return { user, token, isAuthenticated, login, fetchProfile, logout, initSession };
});
