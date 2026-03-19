import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';
import { onToast, type Toast } from '../lib/toast';

const ICONS = {
  success: <CheckCircle size={16} className="text-emerald-500 shrink-0" />,
  error:   <XCircle size={16} className="text-red-500 shrink-0" />,
  warning: <AlertTriangle size={16} className="text-amber-500 shrink-0" />,
};

const BG = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error:   'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return onToast(toast => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, toast.duration);
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-2 px-4 py-3 rounded-lg border shadow-lg text-sm animate-[slideIn_0.2s_ease-out] ${BG[t.type]}`}
        >
          {ICONS[t.type]}
          <span className="flex-1 break-words">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
