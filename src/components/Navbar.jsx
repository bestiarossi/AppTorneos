import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Download,
  LogOut,
  Moon,
  Share,
  Smartphone,
  Sun,
  Trophy,
  X,
} from 'lucide-react';

export default function Navbar({
  user,
  onSignOut,
  signingOut,
  onGoHome,
  theme = 'light',
  onToggleTheme,
}) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIosSafari, setIsIosSafari] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  const isDark = theme === 'dark';

  useEffect(() => {
    const checkStandalone = () => {
      const displayStandalone =
        window.matchMedia?.('(display-mode: standalone)')?.matches ||
        window.navigator.standalone === true;
      setIsStandalone(Boolean(displayStandalone));
    };

    checkStandalone();

    const ua = window.navigator.userAgent || '';
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    setIsIosSafari(isIos && isSafari);

    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } finally {
        setDeferredPrompt(null);
      }
      return;
    }

    if (isIosSafari) {
      setShowIosGuide(true);
    }
  }

  const canShowInstallButton =
    !isStandalone && (Boolean(deferredPrompt) || isIosSafari);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-md transition-colors duration-300 dark:border-slate-800/80 dark:bg-slate-950/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <motion.button
            type="button"
            onClick={onGoHome}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="group flex items-center gap-2.5 text-left"
          >
            <motion.div
              whileHover={{ rotate: -6 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-600/25"
            >
              <Trophy className="h-5 w-5" />
            </motion.div>
            <div>
              <span className="block text-base font-extrabold tracking-tight text-slate-900 transition-colors group-hover:text-emerald-600 dark:text-white dark:group-hover:text-emerald-400">
                AppTorneos
              </span>
              <span className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">
                Torneos entre amigos
              </span>
            </div>
          </motion.button>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {onToggleTheme && (
              <motion.button
                type="button"
                onClick={onToggleTheme}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.94 }}
                aria-label={
                  isDark
                    ? 'Cambiar a modo Clean Glass'
                    : 'Cambiar a modo Arena Dark'
                }
                title={
                  isDark
                    ? 'Cambiar a Clean Glass Light'
                    : 'Cambiar a Arena Dark'
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-100/80 px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:border-emerald-500/40 hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:border-amber-400/40 dark:hover:bg-slate-800"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isDark ? (
                    <motion.span
                      key="theme-sun"
                      initial={{ rotate: -70, opacity: 0, scale: 0.7 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: 70, opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.16 }}
                      className="inline-flex items-center gap-1.5 text-amber-300"
                    >
                      <Sun className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Clean Glass</span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="theme-moon"
                      initial={{ rotate: 70, opacity: 0, scale: 0.7 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: -70, opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.16 }}
                      className="inline-flex items-center gap-1.5 text-indigo-600"
                    >
                      <Moon className="h-3.5 w-3.5" />
                      <span className="hidden md:inline text-slate-700">
                        Arena Dark
                      </span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )}

            {canShowInstallButton && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleInstallClick}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Instalar App</span>
                <span className="sm:hidden">App</span>
              </motion.button>
            )}

            {user?.email && (
              <div className="hidden items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs font-medium text-slate-600 lg:flex dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="max-w-[180px] truncate">{user.email}</span>
              </div>
            )}

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">
                {signingOut ? 'Saliendo...' : 'Cerrar sesión'}
              </span>
              <span className="sm:hidden">Salir</span>
            </motion.button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showIosGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-60 flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowIosGuide(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="glass-card w-full max-w-sm rounded-3xl p-5 shadow-2xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Instalar en iPhone / iPad
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIosGuide(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ol className="space-y-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    1
                  </span>
                  <span>
                    En la barra de Safari, toca el botón{' '}
                    <strong className="inline-flex items-center gap-1 text-slate-900 dark:text-white">
                      <Share className="h-3.5 w-3.5 text-sky-500" />
                      Compartir
                    </strong>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    2
                  </span>
                  <span>
                    Desliza hacia abajo y selecciona{' '}
                    <strong className="text-slate-900 dark:text-white">
                      &quot;Agregar a inicio&quot;
                    </strong>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    3
                  </span>
                  <span>
                    Toca <strong className="text-slate-900 dark:text-white">Agregar</strong> y se
                    abrirá como app nativa sin barra de navegador.
                  </span>
                </li>
              </ol>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}