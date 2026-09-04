import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

type ToastTone = 'success' | 'error' | 'warning' | 'info';
type Toast = { id: number; tone: ToastTone; message: string };
type ToastContextValue = {
  showToast: (tone: ToastTone, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClass: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
};

const toneIcon: Record<ToastTone, string> = {
  success: 'OK',
  error: '!',
  warning: '!',
  info: 'i',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.round(Math.random() * 1000);
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(
    () => ({
      showToast,
      success: (message: string) => showToast('success', message),
      error: (message: string) => showToast('error', message),
      warning: (message: string) => showToast('warning', message),
      info: (message: string) => showToast('info', message),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-5">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl shadow-slate-950/10 ${toneClass[toast.tone]}`}
            role="status"
          >
            <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/80 text-xs font-black">
              {toneIcon[toast.tone]}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
