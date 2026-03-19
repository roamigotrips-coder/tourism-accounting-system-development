/**
 * Global toast notification system (event-bus pattern).
 * Works from both React components and plain TS modules (contexts, utils).
 */

export type ToastType = 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

type Listener = (toast: Toast) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function onToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function showToast(message: string, type: ToastType = 'success', duration = 4000) {
  const toast: Toast = { id: String(nextId++), message, type, duration };
  listeners.forEach(fn => fn(toast));
}

/** Drop-in replacement for `.catch(() => {})` that reports errors via toast. */
export function catchAndReport(operation: string) {
  return (err: any) => {
    console.error(`[Supabase] ${operation}:`, err);
    const msg = err?.message || 'Unknown error';
    showToast(`${operation} failed: ${msg}`, 'error');
  };
}
