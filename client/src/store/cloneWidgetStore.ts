import { create } from 'zustand';

/**
 * Global state for the Clone widget — lets the trigger button in the
 * top app Header (NotificationBell-area) toggle the widget open/closed
 * without prop drilling.
 */
interface CloneWidgetState {
  open: boolean;
  toggle: () => void;
  setOpen: (v: boolean) => void;
}

export const useCloneWidgetStore = create<CloneWidgetState>((set) => ({
  open: false,
  toggle: () => set(s => ({ open: !s.open })),
  setOpen: (v: boolean) => set({ open: v }),
}));
