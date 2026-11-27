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
            className="pointer-events-none fixed inset-x-0 top-16 z-[110] flex flex-col items-center gap-2 px-4 pt-3 sm:items-end sm:px-6"
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
                    className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-[#141923]/95 px-3.5 py-2.5 text-xs font-bold text-white shadow-2xl backdrop-blur-xl ${
                      isErr
                        ? 'border-rose-500/40'
                        : isInfo
                        ? 'border-[#2563EB]/45'
                        : 'border-[#CCFF00]/35'
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                        isErr
                          ? 'bg-rose-500/15 text-rose-400'
                          : isInfo
                          ? 'bg-[#2563EB]/20 text-blue-400'
                          : 'bg-[#CCFF00]/15 text-[#CCFF00]'
                      }`}
                    >
                      {isErr ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : isInfo ? (
                        <Info className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </div>

                    <span className="flex-1 leading-snug text-slate-100">
                      {t.message}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeToast(t.id)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
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