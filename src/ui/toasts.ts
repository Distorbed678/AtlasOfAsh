import { create } from 'zustand';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

interface ToastStore {
  toasts: Toast[];
  dismiss(id: number): void;
}

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

let nextId = 1;

export function toast(text: string, kind: Toast['kind'] = 'info', ms = 4000): void {
  const id = nextId++;
  useToasts.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
  setTimeout(() => useToasts.getState().dismiss(id), ms);
}
