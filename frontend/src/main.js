import './assets/main.css'
import 'vue3-toastify/dist/index.css';

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Vue3Toastify from 'vue3-toastify';
import App from './App.vue'
import router from './router'

// Override console.error for global error catching
const originalError = console.error;
console.error = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]);
  if (msg && !msg.includes('ResizeObserver') && !msg.includes('Vue warn')) {
    import('vue3-toastify').then(({ toast }) => {
      toast.error(msg.substring(0, 100));
    });
  }
  originalError(...args);
};

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Vue3Toastify, {
  autoClose: 3000,
});

app.mount('#app')
