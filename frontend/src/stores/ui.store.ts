import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

const STORAGE_KEY_THEME = 'binh_an_theme';
const STORAGE_KEY_VIEWPORT = 'binh_an_viewport';

/**
 * Centralized UI preference store.
 * 
 * ARCHITECTURE:
 * - Theme and viewport modes are purely UI-level preferences
 * - They persist via localStorage
 * - They do NOT affect business logic, sockets, stores, or sessions
 * - Theme toggles the `dark` class on <html> for Tailwind dark mode
 * - Viewport mode adds CSS classes for responsive simulation
 */
export const useUIStore = defineStore('ui', () => {
  // ==========================================
  // THEME
  // ==========================================
  const themeMode = ref<ThemeMode>(
    (localStorage.getItem(STORAGE_KEY_THEME) as ThemeMode) || 'system'
  );

  const systemPrefersDark = ref(
    typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-color-scheme: dark)').matches 
      : false
  );

  // Resolved theme (what actually applies)
  const isDark = computed(() => {
    if (themeMode.value === 'dark') return true;
    if (themeMode.value === 'light') return false;
    return systemPrefersDark.value; // system mode
  });

  function setTheme(mode: ThemeMode) {
    themeMode.value = mode;
    localStorage.setItem(STORAGE_KEY_THEME, mode);
    applyTheme();
  }

  function toggleTheme() {
    if (isDark.value) {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  }

  function applyTheme() {
    const html = document.documentElement;
    // Add transition class for smooth theme switch
    html.classList.add('theme-transitioning');
    if (isDark.value) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    // Remove transition class after animation completes
    setTimeout(() => html.classList.remove('theme-transitioning'), 350);
  }

  // Listen for system theme changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      systemPrefersDark.value = e.matches;
      if (themeMode.value === 'system') {
        applyTheme();
      }
    });
  }

  // Apply theme on store creation
  applyTheme();

  // Watch for theme changes
  watch(isDark, () => applyTheme());

  // ==========================================
  // VIEWPORT SIMULATION
  // ==========================================
  const viewportMode = ref<ViewportMode>(
    (localStorage.getItem(STORAGE_KEY_VIEWPORT) as ViewportMode) || 'desktop'
  );

  function setViewport(mode: ViewportMode) {
    viewportMode.value = mode;
    localStorage.setItem(STORAGE_KEY_VIEWPORT, mode);
  }

  // Viewport simulation dimensions for CSS containment
  const viewportConfig = computed(() => {
    switch (viewportMode.value) {
      case 'mobile': return { maxWidth: '430px', label: 'Mobile', icon: 'smartphone' };
      case 'tablet': return { maxWidth: '820px', label: 'Tablet', icon: 'tablet_mac' };
      default: return { maxWidth: '100%', label: 'Desktop', icon: 'desktop_windows' };
    }
  });

  // ==========================================
  // SETTINGS PANEL
  // ==========================================
  const showSettings = ref(false);

  function toggleSettings() {
    showSettings.value = !showSettings.value;
  }

  function reset() {
    showSettings.value = false;
    themeMode.value = 'system';
    viewportMode.value = 'desktop';
    applyTheme();
  }

  return {
    // Theme
    themeMode,
    isDark,
    setTheme,
    toggleTheme,
    applyTheme,
    // Viewport
    viewportMode,
    viewportConfig,
    setViewport,
    // Settings
    showSettings,
    toggleSettings,
    reset,
  };
});
