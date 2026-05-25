import axios from 'axios';
import { API_BASE_URL } from '@/utils/constants';
import { toast } from 'vue3-toastify';
import { h } from 'vue';

// Create a configured Axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 2;

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token as string);
  });
  failedQueue = [];
}

let logoutCallback: (() => void) | null = null;

export function registerLogoutCallback(cb: () => void) {
  logoutCallback = cb;
}

function clearAuthAndRedirect() {
  let loggedOut = false;
  if (logoutCallback) {
    try {
      logoutCallback();
      loggedOut = true;
    } catch (e) {
      console.warn('[AUTH] Dynamic logout callback failed, falling back to manual cleanup:', e);
    }
  }

  if (!loggedOut) {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('tableId');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('orderId');
    
    // Only redirect if not already on login page
    if (!window.location.pathname.startsWith('/login')) {
      toast.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
      window.location.href = '/login';
    }
  }

  isRefreshing = false;
  refreshAttempts = 0;
  failedQueue = [];
}

// Request interceptor — attach the current token
apiClient.interceptors.request.use(
  async (config) => {
    let token = null;
    try {
      const { useUserStore } = await import('@/stores/user.store');
      const userStore = useUserStore();
      token = userStore.token;
    } catch (e) {
      token = localStorage.getItem('token');
    }

    if (!token) {
      token = localStorage.getItem('token');
    }

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    } else {
      // Allow unauthenticated requests to public routes
      const path = window.location.pathname;
      const isPublicRoute = 
        config.url?.startsWith('/auth/') || 
        config.url?.startsWith('/payments/') || 
        path.startsWith('/customer') || 
        path.startsWith('/payment') || 
        path === '/' || 
        path.startsWith('/tables') ||
        path.startsWith('/table/') ||
        path.startsWith('/table') ||
        path.startsWith('/menu');
      
      if (!isPublicRoute) {
        console.warn('[AUTH] No token for protected request:', config.url);
        return Promise.reject(new Error('Chưa đăng nhập. Vui lòng đăng nhập lại.'));
      }
    }

    // Attach customer table session token if present
    const sessionToken = localStorage.getItem('sessionToken');
    if (sessionToken) {
      config.headers['X-Session-Token'] = sessionToken;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor — handle 401 (expired token) and 403 (role mismatch) separately
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // === 401 UNAUTHORIZED: Token expired → try refresh ===
    if (
      error.response?.status === 401 && 
      !originalRequest._retry && 
      originalRequest.url !== '/auth/refresh' &&
      originalRequest.url !== '/auth/login'
    ) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        console.warn('[AUTH] No refresh token available');
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      // Prevent infinite refresh loops
      if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
        console.error('[AUTH] Max refresh attempts reached');
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request to be retried after refresh completes
        return new Promise(function(resolve, reject) {
          failedQueue.push({
            resolve: (token) => {
              originalRequest.headers['Authorization'] = 'Bearer ' + token;
              resolve(apiClient(originalRequest));
            },
            reject: (err) => reject(err)
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      refreshAttempts++;

      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken
        });

        const newToken = res.data.access_token;
        localStorage.setItem('token', newToken);
        if (res.data.refresh_token) {
          localStorage.setItem('refreshToken', res.data.refresh_token);
        }

        // Update user store in memory
        try {
          const { useUserStore } = await import('@/stores/user.store');
          const userStore = useUserStore();
          userStore.token = newToken;
          if (res.data.user) {
            userStore.user = res.data.user;
            localStorage.setItem('user', JSON.stringify(res.data.user));
          }
        } catch (e) {
          console.warn('[AUTH] Failed to update userStore during refresh:', e);
          if (res.data.user) {
            localStorage.setItem('user', JSON.stringify(res.data.user));
          }
        }

        // Update socket token and reconnect
        try {
          const { socketService } = await import('@/services/socket');
          socketService.setToken(newToken);
          socketService.reconnectWithNewToken();
        } catch (e) {
          console.warn('[SOCKET] Failed to update socketService during refresh:', e);
        }

        processQueue(null, newToken);
        isRefreshing = false;
        refreshAttempts = 0; // Reset on success

        originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err, null);
        isRefreshing = false;
        clearAuthAndRedirect();
        return Promise.reject(err);
      }
    }

    // === 403 FORBIDDEN: Role mismatch → do NOT retry, do NOT logout ===
    if (error.response?.status === 403) {
      const message = error.response?.data?.message || 'Bạn không có quyền truy cập';
      toast.error(message, { toastId: 'auth-403', autoClose: 5000 });
      return Promise.reject(error);
    }

    // === Extract error message ===
    let message = 'An unexpected error occurred';
    if (error.response?.data?.message) {
      if (Array.isArray(error.response.data.message)) {
        message = error.response.data.message[0];
      } else {
        message = error.response.data.message;
      }
    } else if (error.message) {
      message = error.message;
    }

    // 401 that couldn't be refreshed, or 404 — just show toast
    if (error.response?.status === 401 || error.response?.status === 404) {
      toast.error(message);
      return Promise.reject(error);
    }
    
    // For other errors (500, network, etc.) — show retry toast
    return new Promise((resolve, reject) => {
      let resolvedOrRejected = false;
      
      const toastId = toast.error(
        {
          setup() {
            return () => h('div', [
              h('p', message),
              h('button', {
                class: 'mt-3 bg-red-900/40 text-white border border-white/20 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-red-800 transition-colors',
                onClick: () => {
                  resolvedOrRejected = true;
                  toast.remove(toastId);
                  apiClient(originalRequest).then(resolve).catch(reject);
                }
              }, 'Thử lại')
            ]);
          }
        }, 
        {
          autoClose: 6000,
          closeOnClick: false,
          onClose: () => {
            if (!resolvedOrRejected) {
              reject(error);
            }
          }
        }
      );
    });
  }
);
