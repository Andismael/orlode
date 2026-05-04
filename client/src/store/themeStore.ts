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

export const useThemeStore = create<ThemeState>((set) => {
  // Init from localStorage or system preference
  const stored = localStorage.getItem('corpmind-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = stored ? stored === 'dark' : prefersDark;

  // Apply immediately
  if (initial) document.documentElement.classList.add('dark');

  return {
    dark: initial,
    toggle: () => set((state) => {
      const next = !state.dark;
      localStorage.setItem('corpmind-theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
      return { dark: next };
    }),
    setDark: (dark: boolean) => {
      localStorage.setItem('corpmind-theme', dark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', dark);
      set({ dark });
    },
  };
});
