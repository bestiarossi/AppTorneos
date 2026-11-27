import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
import Avatar from './Avatar';

export default function Navbar({
  user,
  profile,
  onOpenProfile,
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

  const displayName =
    profile?.display_name || user?.email?.split('@')[0] || 'Mi perfil';

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#141923]/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <motion.button
            type="button"
            onClick={onGoHome}
            whileTap={{ scale: 0.97 }}
            className="group flex min-h-[44px] items-center gap-3 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CCFF00] text-[#0B0E14] shadow-[0_0_20px_-4px_rgba(204,255,0,0.45)] transition-transform duration-200 group-hover:scale-105">
              <Trophy className="h-5 w-5 stroke-[2.4]" />
            </div>
            <div className="leading-tight">
              <span className="block text-base font-extrabold tracking-tight text-white uppercase transition-colors group-hover:text-[#CCFF00]">
                AppTorneos
              </span>
              <span className="hidden text-[10px] font-bold tracking-wider text-slate-400 uppercase sm:block">
                Torneos entre amigos
              </span>
            </div>
          </motion.button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {onToggleTheme && (
              <motion.button
                type="button"
                onClick={onToggleTheme}
                whileTap={{ scale: 0.95 }}
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
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/5 px-2.5 py-2 text-[11px] font-bold tracking-wider text-slate-300 uppercase transition hover:border-white/15 hover:bg-white/10 hover:text-white"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isDark ? (
                    <motion.span
                      key="theme-sun"
                      initial={{ rotate: -70, opacity: 0, scale: 0.7 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: 70, opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.16 }}
                      className="inline-flex items-center gap-1.5 text-[#CCFF00]"
                    >
                      <Sun className="h-3.5 w-3.5" />
                      <span className="hidden text-slate-200 md:inline">
                        Clean Glass
                      </span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="theme-moon"
                      initial={{ rotate: 70, opacity: 0, scale: 0.7 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: -70, opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.16 }}
                      className="inline-flex items-center gap-1.5 text-[#2563EB]"
                    >
                      <Moon className="h-3.5 w-3.5" />
                      <span className="hidden text-slate-200 md:inline">
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
                whileTap={{ scale: 0.96 }}
                onClick={handleInstallClick}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#CCFF00]/30 bg-[#CCFF00]/10 px-3 py-2 text-[11px] font-extrabold tracking-wider text-[#CCFF00] uppercase transition hover:bg-[#CCFF00]/20"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Instalar App</span>
                <span className="sm:hidden">App</span>
              </motion.button>
            )}

            {onOpenProfile && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={onOpenProfile}
                aria-label="Editar mi perfil y avatar"
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/[0.08] bg-white/5 px-2.5 py-1.5 text-xs font-bold text-white transition hover:border-[#CCFF00]/40 hover:bg-white/10"
              >
                <Avatar
                  name={displayName}
                  url={profile?.avatar_url}
                  size="sm"
                />
                <span className="hidden max-w-[140px] truncate sm:inline">
                  {displayName}
                </span>
              </motion.button>
            )}

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={onSignOut}
              disabled={signingOut}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-rose-500/30 hover:bg-rose-500/15 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
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

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showIosGuide && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0B0E14]/80 p-4 backdrop-blur-md sm:items-center"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowIosGuide(false);
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#141923] p-5 shadow-2xl"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#CCFF00]/25 bg-[#CCFF00]/15 text-[#CCFF00]">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                          Acceso directo PWA
                        </p>
                        <h3 className="text-sm font-extrabold tracking-tight text-white uppercase">
                          Instalar en iPhone / iPad
                        </h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowIosGuide(false)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <ol className="space-y-3 text-xs leading-relaxed text-slate-300">
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#CCFF00] font-mono text-[11px] font-extrabold text-[#0B0E14] tabular-nums">
                        1
                      </span>
                      <span>
                        En la barra de Safari, toca el botón{' '}
                        <strong className="inline-flex items-center gap-1 font-bold text-white">
                          <Share className="h-3.5 w-3.5 text-[#2563EB]" />
                          Compartir
                        </strong>
                        .
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#CCFF00] font-mono text-[11px] font-extrabold text-[#0B0E14] tabular-nums">
                        2
                      </span>
                      <span>
                        Desliza hacia abajo y selecciona{' '}
                        <strong className="font-bold text-white">
                          &quot;Agregar a inicio&quot;
                        </strong>
                        .
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#CCFF00] font-mono text-[11px] font-extrabold text-[#0B0E14] tabular-nums">
                        3
                      </span>
                      <span>
                        Toca <strong className="font-bold text-white">Agregar</strong> y
                        se abrirá como app nativa sin barra de navegador.
                      </span>
                    </li>
                  </ol>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}