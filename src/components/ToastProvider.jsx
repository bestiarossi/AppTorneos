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
                    className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-white/95 px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-xl backdrop-blur-xl dark:bg-[#141923]/95 dark:text-white classic:bg-[#FFFBF4]/95 classic:text-[#1F2A24] classic:shadow-[0_3px_0_rgba(27,67,50,0.14)] ${
                      isErr
                        ? 'border-rose-300/90 dark:border-rose-500/40 classic:border-[#C86D51]'
                        : isInfo
                        ? 'border-sky-300/90 dark:border-[#2563EB]/45 classic:border-[#D4A03E]'
                        : 'border-emerald-300/90 dark:border-[#CCFF00]/35 classic:border-[#1B4332]/40'
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                        isErr
                          ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 classic:bg-[#C86D51]/15 classic:text-[#A44E35]'
                          : isInfo
                          ? 'bg-sky-100 text-sky-600 dark:bg-[#2563EB]/20 dark:text-blue-400 classic:bg-[#D4A03E]/20 classic:text-[#8F651A]'
                          : 'bg-emerald-100 text-emerald-600 dark:bg-[#CCFF00]/15 dark:text-[#CCFF00] classic:bg-[#1B4332]/15 classic:text-[#1B4332]'
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

                    <span className="flex-1 leading-snug">{t.message}</span>

                    <button
                      type="button"
                      onClick={() => removeToast(t.id)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
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