/**
 * Theme store — dark mode toggle
 * Persists to localStorage, applies 'dark' class to <html>
 */
import { create } from 'zustand';

interface ThemeState {
  dark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

// ⚠️ DARK MODE TEMPORARILY DISABLED (stand by) — user request 2026-05.
// We don't yet ship a fully theme-aware UI: some pages have hard-coded
// dark surfaces (Studio, marketing landings) and others don't tint cleanly,
// so the global "dark" class produced inconsistent reads.
//
// To re-enable: revert this file to git HEAD before this commit and
// re-show the Sun/Moon toggle in Header.tsx.
export const useThemeStore = create<ThemeState>((set) => {
  // Force light mode regardless of localStorage / system preference.
  // We still clean up any stale `dark` class that previous sessions added.
  document.documentElement.classList.remove('dark');
  try { localStorage.removeItem('corpmind-theme'); } catch { /* ignore */ }

  return {
    dark: false,
    toggle: () => {
      // No-op while dark mode is parked. Keeps button handlers safe even
      // if some legacy code still calls toggle().
      document.documentElement.classList.remove('dark');
      set({ dark: false });
    },
    setDark: () => {
      document.documentElement.classList.remove('dark');
      set({ dark: false });
    },
  };
});
