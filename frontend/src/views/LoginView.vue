<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user.store';

const router = useRouter();
const userStore = useUserStore();

const email = ref('');
const password = ref('');
const isLoading = ref(false);
const errorMsg = ref('');

const handleLogin = async () => {
  if (!email.value || !password.value) {
    errorMsg.value = 'Please enter both email and password';
    return;
  }
  
  isLoading.value = true;
  errorMsg.value = '';
  
  try {
    // Attempt actual API login via store
    await userStore.login({ email: email.value, password: password.value });
    
    // Map role to correct dashboard
    const role = userStore.user?.role || 'admin';
    const targetRoute = role === 'admin' || role === 'manager' ? '/admin/dashboard' :
                        role === 'service' ? '/service/tables' :
                        role === 'kitchen' ? '/kitchen' : '/menu';
    router.push(targetRoute);
  } catch (err: any) {
    if (err.response && err.response.data && err.response.data.message) {
       errorMsg.value = err.response.data.message;
    } else {
       errorMsg.value = 'Invalid credentials or server error. Please try again.';
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="flex-1 flex flex-col lg:flex-row h-screen font-display text-slate-900 dark:text-slate-100 bg-background-light dark:bg-background-dark">
    <!-- Brand Section / Decorative -->
    <div class="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary/10">
      <div class="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5"></div>
      <div class="m-auto max-w-lg p-12 relative z-10">
        <div class="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mb-8 shadow-xl shadow-primary/20">
          <span class="material-symbols-outlined text-white text-4xl">restaurant_menu</span>
        </div>
        <h1 class="text-5xl font-bold leading-tight mb-6">Streamline your restaurant operations.</h1>
        <p class="text-xl text-slate-600 dark:text-slate-400">Join over 5,000+ restaurants worldwide managing their kitchen, staff, and inventory with ease.</p>
        <div class="mt-12">
          <div class="flex items-center gap-4 mb-8">
            <div class="w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm">
              <span class="material-symbols-outlined text-primary">analytics</span>
            </div>
            <div>
              <p class="font-bold text-lg">Real-time Analytics</p>
              <p class="text-slate-500">Track performance metrics at a glance.</p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm">
              <span class="material-symbols-outlined text-primary">groups</span>
            </div>
            <div>
              <p class="font-bold text-lg">Staff Management</p>
              <p class="text-slate-500">Effortless scheduling and payroll.</p>
            </div>
          </div>
        </div>
      </div>
      <div class="absolute bottom-0 right-0 p-8">
        <div class="w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
      </div>
    </div>
    
    <!-- Login Section -->
    <div class="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-white dark:bg-background-dark relative">
      <div class="w-full max-w-[420px]">
        <!-- Mobile Logo -->
        <div class="lg:hidden flex justify-center mb-10">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span class="material-symbols-outlined text-white">restaurant</span>
            </div>
            <span class="text-xl font-bold tracking-tight">RestoFlow</span>
          </div>
        </div>
        
        <div class="text-center lg:text-left mb-8">
          <h2 class="text-3xl font-bold mb-2">Welcome back</h2>
          <p class="text-slate-500 dark:text-slate-400">Enter your credentials to access your dashboard</p>
        </div>
        
        <!-- Error Message Banner -->
        <div v-if="errorMsg" class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400">
          <span class="material-symbols-outlined">error</span>
          <p class="text-sm font-medium mt-0.5">{{ errorMsg }}</p>
        </div>
        
        <form @submit.prevent="handleLogin" class="space-y-6">
          <div class="space-y-2">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Email Address</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
              <input 
                v-model="email"
                type="email" 
                class="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-400" 
                placeholder="name@restaurant.com" 
                required
              />
            </div>
          </div>
          
          <div class="space-y-2">
            <div class="flex justify-between items-center px-1">
              <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
              <a class="text-xs font-semibold text-primary hover:underline cursor-pointer">Forgot password?</a>
            </div>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
              <input 
                v-model="password"
                type="password"
                class="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-400" 
                placeholder="••••••••" 
                required
              />
            </div>
          </div>
          
          <div class="flex items-center gap-2 px-1">
            <input id="remember" type="checkbox" class="w-4 h-4 text-primary bg-slate-50 border-slate-200 rounded focus:ring-primary"/>
            <label for="remember" class="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">Stay signed in for 30 days</label>
          </div>
          
          <button 
            type="submit" 
            :disabled="isLoading"
            class="w-full py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed" 
          >
            <span v-if="isLoading" class="material-symbols-outlined animate-spin align-middle">autorenew</span>
            <span>{{ isLoading ? 'Signing in...' : 'Sign in' }}</span>
            <span v-if="!isLoading" class="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        </form>
        
        <div class="relative my-8">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-slate-200 dark:border-slate-800"></div>
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-white dark:bg-background-dark px-4 text-slate-400">Or continue with</span>
          </div>
        </div>
        
        <div class="grid grid-cols-1 gap-4">
          <button class="flex items-center justify-center gap-3 py-3.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all font-semibold text-slate-700 dark:text-slate-300">
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuD1BVpScErtXupdnYeTNOF8lvPpop26L71nYTxEk7kpuswRV0tZz5mfGErxfsC5fcfifeFGCFE54zHhAbf1rAoXcAuYbV3795NydIi7Fjm_ukrCUesd_laOfiLJr2-vCco-elkGOFTqVL1WGN9xhMRc7_ckSzBWNKKVsbXXQSx2PQD6lHSV7DTQrjd8WxGBIqTTxzmze_0jnPJzatLJNAp6-_QmLf2o1WsoAevL_eQTpfrBzSncLTUL3myGr7A_cyRvnjWGnEETVkJB" alt="Google logo" class="w-5 h-5"/>
            <span>Sign in with Google</span>
          </button>
        </div>
        
        <p class="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Don't have an account? 
          <a class="text-primary font-bold hover:underline cursor-pointer">Get started for free</a>
        </p>
      </div>
      
      <footer class="absolute bottom-6 left-0 right-0 text-center text-xs text-slate-400">
        © 2024 RestoFlow SaaS Solutions. All rights reserved.
      </footer>
    </div>
  </div>
</template>
