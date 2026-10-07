import { create } from "zustand";

/**
 * Eine kurze Bestätigung unten („Gespeichert: Müller"), die von selbst verschwindet.
 * Kein Browser-Dialog — der hält den Serienmodus auf und sieht aus wie ein Fehler.
 */
interface ToastState {
  text: string | null;
  href: string | null;
  show: (text: string, href?: string) => void;
  hide: () => void;
}

let timer: number | undefined;

export const useToast = create<ToastState>((set) => ({
  text: null,
  href: null,
  show: (text, href) => {
    if (timer !== undefined) window.clearTimeout(timer);
    set({ text, href: href ?? null });
    timer = window.setTimeout(() => set({ text: null, href: null }), 2800);
  },
  hide: () => {
    if (timer !== undefined) window.clearTimeout(timer);
    set({ text: null, href: null });
  },
}));

export const toast = (text: string, href?: string): void => useToast.getState().show(text, href);
