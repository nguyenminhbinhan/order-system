import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useUserStore } from '@/stores/user.store';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue')
  },
  {
    path: '/customer',
    name: 'Customer',
    alias: '/menu',
    component: () => import('@/views/customer/CustomerView.vue'),
  },
  {
    path: '/customer/cart',
    name: 'CustomerCart',
    component: () => import('@/views/customer/CartView.vue'),
  },
  {
    path: '/customer/tracking/:id',
    name: 'OrderTracking',
    component: () => import('@/views/customer/OrderTrackingView.vue'),
  },
  {
    path: '/admin',
    redirect: '/admin/dashboard'
  },
  {
    path: '/admin/dashboard',
    name: 'AdminDashboard',
    component: () => import('@/views/admin/AdminDashboardView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'] }
  },
  {
    path: '/admin/menu',
    name: 'AdminMenu',
    component: () => import('@/views/admin/AdminView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'] }
  },
  {
    path: '/admin/users',
    name: 'AdminUsers',
    component: () => import('@/views/admin/AdminUsersView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'] }
  },
  {
    path: '/admin/tables',
    name: 'AdminTables',
    component: () => import('@/views/admin/AdminTablesView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'] }
  },
  {
    path: '/admin/bills',
    name: 'AdminBills',
    component: () => import('@/views/admin/AdminBillsView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'] }
  },
  {
    path: '/admin/audit',
    name: 'AdminAudit',
    component: () => import('@/views/admin/AdminAuditView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager'] }
  },
  {
    path: '/admin/qr',
    name: 'TableQR',
    component: () => import('@/views/admin/TableQRView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'manager', 'service'] }
  },
  {
    path: '/service',
    redirect: '/service/tables'
  },
  {
    path: '/service/tables',
    name: 'ServiceTables',
    component: () => import('@/views/service/ServiceTablesView.vue'),
    meta: { requiresAuth: true, roles: ['service', 'admin', 'manager'] }
  },
  {
    path: '/kitchen',
    name: 'Kitchen',
    component: () => import('@/views/kitchen/KitchenKanbanView.vue'),
    meta: { requiresAuth: true, roles: ['kitchen', 'admin', 'manager'] }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore();
  
  if (to.meta.requiresAuth) {
    if (!userStore.isAuthenticated) {
      return next({ name: 'Login' });
    }

    // Rehydrate user data on page reload (token exists but user object is null)
    if (!userStore.user) {
      await userStore.initSession();
    }
    
    if (userStore.user && to.meta.roles) {
      const allowedRoles = to.meta.roles as string[];
      if (!allowedRoles.includes(userStore.user.role)) {
        // Redirect to correct dashboard based on role
        const role = userStore.user.role;
        const target = role === 'admin' || role === 'manager' ? '/admin/dashboard' : 
                       role === 'service' ? '/service/tables' : 
                       role === 'kitchen' ? '/kitchen' : '/menu';
        return next(target);
      }
    }
  }
  
  next();
});

export default router;
