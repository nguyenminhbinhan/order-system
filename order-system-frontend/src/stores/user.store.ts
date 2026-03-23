import { defineStore } from 'pinia';
import { ref } from 'vue';
import { authService } from '@/services/auth.service';

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
    isAuthenticated.value = true;
    await fetchProfile();
  }

  async function fetchProfile() {
    try {
      const data = await authService.getProfile();
      user.value = data;
    } catch (error) {
      console.error('Failed to fetch profile', error);
      logout();
    }
  }

  function logout() {
    user.value = null;
    token.value = null;
    isAuthenticated.value = false;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  return { user, token, isAuthenticated, login, fetchProfile, logout };
});
