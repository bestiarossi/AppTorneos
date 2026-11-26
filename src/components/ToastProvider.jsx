import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext({
  success: () => {},
  error: () => {},
  info: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (type, message) => {
      if (!message) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, type, message }]);
      setTimeout(() => {
        removeToast(id);
      }, 2800);
    },
    [removeToast]
  );

  const api = useMemo(
    () => ({
      success: (msg) => pushToast('success', msg),
      error: (msg) => pushToast('error', msg),
      info: (msg) => pushToast('info', msg),
    }),
    [pushToast]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {typeof document !== 'undefined' &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 top-16 z-[110] flex flex-col items-center gap-2 px-4 pt-2 sm:items-end sm:px-6"
          >
            <AnimatePresence initial={false}>
              {toasts.map((t) => {
                const isErr = t.type === 'error';
                const isInfo = t.type === 'info';
                return (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: -14, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                    className={`pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-xs font-bold shadow-xl backdrop-blur-xl ${
                      isErr
                        ? 'border-rose-300/80 bg-rose-50/95 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/90 dark:text-rose-200'
                        : isInfo
                        ? 'border-sky-300/80 bg-sky-50/95 text-sky-900 dark:border-sky-500/40 dark:bg-sky-950/90 dark:text-sky-200'
                        : 'border-emerald-300/80 bg-white/95 text-slate-900 dark:border-emerald-500/40 dark:bg-slate-900/95 dark:text-emerald-200'
                    }`}
                  >
                    {isErr ? (
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    ) : isInfo ? (
                      <Info className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    )}

                    <span className="flex-1 leading-snug">{t.message}</span>

                    <button
                      type="button"
                      onClick={() => removeToast(t.id)}
                      className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg opacity-60 transition hover:opacity-100"
                      aria-label="Cerrar notificación"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}