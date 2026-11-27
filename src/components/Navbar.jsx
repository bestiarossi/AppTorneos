import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Download,
  LogOut,
  Moon,
  Palette,
  Share,
  Smartphone,
  Sun,
  Trophy,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  getSoundSettings,
  initGlobalUiSounds,
  playUiClickSound,
  subscribeSoundSettings,
  updateSoundSettings,
} from '../utils/soundEffects';
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

  const [soundSettings, setSoundSettings] = useState(getSoundSettings);
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);
  const soundMenuRef = useRef(null);

  const isDark = theme === 'dark';
  const isClassic = theme === 'classic';

  useEffect(() => {
    initGlobalUiSounds();
    return subscribeSoundSettings(setSoundSettings);
  }, []);

  useEffect(() => {
    if (!soundMenuOpen) return;
    function handleOutside(e) {
      if (soundMenuRef.current && !soundMenuRef.current.contains(e.target)) {
        setSoundMenuOpen(false);
      }
    }
    window.addEventListener('pointerdown', handleOutside);
    return () => window.removeEventListener('pointerdown', handleOutside);
  }, [soundMenuOpen]);

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

  const themeMeta = isDark
    ? { label: 'Oscuro', next: 'Cambiar a modo Clásico' }
    : isClassic
    ? { label: 'Clásico', next: 'Cambiar a modo Claro' }
    : { label: 'Claro', next: 'Cambiar a modo Oscuro' };

  const isMuted = soundSettings.muted || soundSettings.volume <= 0;
  const SoundIcon = isMuted
    ? VolumeX
    : soundSettings.volume < 0.45
    ? Volume1
    : Volume2;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/85 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-colors duration-300 dark:border-white/[0.08] dark:bg-[#141923]/90 classic:border-b-2 classic:border-[#143026] classic:bg-[#1E4638] classic:backdrop-blur-none">
        {isClassic && (
          <div className="classic-heritage-stripe h-1.5 w-full" />
        )}

        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <motion.button
            type="button"
            onClick={onGoHome}
            whileTap={{ scale: 0.97 }}
            className="group flex min-h-[44px] items-center gap-3 text-left"
          >
            <motion.div
              whileHover={
                isClassic
                  ? { rotate: [-6, 6, -3, 0], scale: 1.08 }
                  : { scale: 1.05 }
              }
              transition={{ duration: 0.35 }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-600/25 dark:bg-[#CCFF00] dark:bg-none dark:text-[#0B0E14] dark:shadow-[0_0_20px_-4px_rgba(204,255,0,0.45)] classic:border-2 classic:border-[#FBF5E8] classic:bg-[#D46F4D] classic:bg-none classic:text-[#FBF5E8] classic:shadow-[2px_2px_0_#D9A441]"
            >
              <Trophy className="h-5 w-5 stroke-[2.3]" />
            </motion.div>
            <div className="leading-tight">
              <span className="block text-base font-extrabold tracking-tight text-slate-900 uppercase transition-colors group-hover:text-emerald-600 dark:text-white dark:group-hover:text-[#CCFF00] classic:text-[#EE8561] classic:group-hover:text-[#F4A261]">
                AppTorneos
              </span>
              <span className="hidden text-[10px] font-bold tracking-wider text-slate-500 uppercase sm:block dark:text-slate-400 classic:text-[#E6C782]">
                {isClassic ? 'Club Social & Deportivo' : 'Torneos entre amigos'}
              </span>
            </div>
          </motion.button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Control de Sonido / Volumen / Mute */}
            <div ref={soundMenuRef} className="relative">
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => setSoundMenuOpen((prev) => !prev)}
                aria-label="Configurar efectos de sonido"
                title="Efectos de sonido"
                className={`inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border px-2.5 py-2 text-xs font-bold transition ${
                  isMuted
                    ? 'border-slate-200/90 bg-slate-100/80 text-slate-400 dark:border-white/[0.08] dark:bg-white/5 dark:text-slate-500 classic:border-2 classic:border-[#FBF5E8]/30 classic:bg-[#285947] classic:text-[#B9CFC5]'
                    : 'border-slate-200/90 bg-slate-100/80 text-emerald-600 hover:bg-white dark:border-white/[0.08] dark:bg-white/5 dark:text-[#CCFF00] dark:hover:bg-white/10 classic:border-2 classic:border-[#D9A441] classic:bg-[#285947] classic:text-[#E6C782]'
                }`}
              >
                <SoundIcon className="h-4 w-4" />
              </motion.button>

              <AnimatePresence>
                {soundMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="glass-card absolute right-0 mt-2 w-56 rounded-2xl p-3.5 shadow-2xl"
                  >
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold tracking-wider text-slate-700 uppercase dark:text-slate-200 classic:text-[#1E4638]">
                        Sonidos UI
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextMuted = !soundSettings.muted;
                          updateSoundSettings({ muted: nextMuted });
                          if (!nextMuted) playUiClickSound(640);
                        }}
                        className={`rounded-lg px-2 py-1 text-[10px] font-extrabold uppercase transition ${
                          isMuted
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                            : 'bg-emerald-500/15 text-emerald-700 dark:bg-[#CCFF00]/20 dark:text-[#CCFF00] classic:bg-[#1E4638] classic:text-[#FBF5E8]'
                        }`}
                      >
                        {isMuted ? 'Silenciado' : 'Activo'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateSoundSettings({ muted: !soundSettings.muted })
                        }
                        className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                        aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
                      >
                        <SoundIcon className="h-4 w-4" />
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={
                          soundSettings.muted
                            ? 0
                            : Math.round(soundSettings.volume * 100)
                        }
                        onChange={(e) => {
                          const val = Number(e.target.value) / 100;
                          updateSoundSettings({
                            volume: val,
                            muted: val <= 0,
                          });
                        }}
                        onPointerUp={() => playUiClickSound(600)}
                        className="h-1.5 flex-1 cursor-pointer accent-emerald-600 dark:accent-[#CCFF00] classic:accent-[#D46F4D]"
                      />
                      <span className="w-8 text-right font-mono text-[11px] font-bold text-slate-600 tabular-nums dark:text-slate-300 classic:text-[#1E4638]">
                        {soundSettings.muted
                          ? '0%'
                          : `${Math.round(soundSettings.volume * 100)}%`}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {onToggleTheme && (
              <motion.button
                type="button"
                onClick={onToggleTheme}
                whileTap={{ scale: 0.94 }}
                aria-label={themeMeta.next}
                title={themeMeta.next}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-100/80 px-2.5 py-2 text-[11px] font-extrabold tracking-wider text-slate-700 uppercase transition hover:border-emerald-500/40 hover:bg-white dark:border-white/[0.08] dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#CCFF00]/40 dark:hover:bg-white/10 classic:border-2 classic:border-[#D9A441] classic:bg-[#285947] classic:text-[#FBF5E8] classic:shadow-[2px_2px_0_#143026] classic:hover:bg-[#316B56]"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isDark ? (
                    <motion.span
                      key="theme-dark"
                      initial={{ rotate: -60, opacity: 0, scale: 0.7 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: 60, opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.16 }}
                      className="inline-flex items-center gap-1.5 text-[#CCFF00]"
                    >
                      <Moon className="h-3.5 w-3.5" />
                      <span className="hidden text-slate-200 md:inline">
                        Oscuro
                      </span>
                    </motion.span>
                  ) : isClassic ? (
                    <motion.span
                      key="theme-classic"
                      initial={{ rotate: -60, opacity: 0, scale: 0.7 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: 60, opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.16 }}
                      className="inline-flex items-center gap-1.5 text-[#E6C782]"
                    >
                      <Palette className="h-3.5 w-3.5" />
                      <span className="hidden text-[#FBF5E8] md:inline">
                        Clásico
                      </span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="theme-light"
                      initial={{ rotate: 60, opacity: 0, scale: 0.7 }}
                      animate={{ rotate: 0, opacity: 1, scale: 1 }}
                      exit={{ rotate: -60, opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.16 }}
                      className="inline-flex items-center gap-1.5 text-amber-500"
                    >
                      <Sun className="h-3.5 w-3.5" />
                      <span className="hidden text-slate-700 md:inline">
                        Claro
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
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-extrabold tracking-wider text-emerald-700 uppercase transition hover:bg-emerald-100 dark:border-[#CCFF00]/30 dark:bg-[#CCFF00]/10 dark:text-[#CCFF00] dark:hover:bg-[#CCFF00]/20 classic:border-2 classic:border-[#FBF5E8]/80 classic:bg-[#D46F4D] classic:text-[#FBF5E8] classic:shadow-[2px_2px_0_#143026] classic:hover:bg-[#E07C5A]"
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
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/90 px-2.5 py-1.5 text-xs font-bold text-slate-800 transition hover:border-emerald-400/60 hover:bg-white dark:border-white/[0.08] dark:bg-white/5 dark:text-white dark:hover:border-[#CCFF00]/40 dark:hover:bg-white/10 classic:border-2 classic:border-[#FBF5E8]/35 classic:bg-[#285947] classic:text-[#FBF5E8] classic:shadow-[2px_2px_0_#143026] classic:hover:border-[#D9A441]"
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
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/5 dark:text-slate-300 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/15 dark:hover:text-rose-300 classic:border-2 classic:border-[#FBF5E8]/30 classic:bg-[#285947] classic:text-[#FBF5E8] classic:hover:border-[#D46F4D] classic:hover:bg-[#D46F4D] classic:hover:text-[#FBF5E8]"
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
                className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/65 p-4 backdrop-blur-md sm:items-center"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowIosGuide(false);
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  className="glass-card w-full max-w-sm rounded-2xl p-5 shadow-2xl"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-[#CCFF00]/15 dark:text-[#CCFF00] classic:border classic:border-[#1E4638] classic:bg-[#D46F4D] classic:text-[#FBF5E8]">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400 classic:text-[#4C6B5E]">
                          Acceso directo PWA
                        </p>
                        <h3 className="text-sm font-extrabold tracking-tight text-slate-900 uppercase dark:text-white classic:text-[#1E4638]">
                          Instalar en iPhone / iPad
                        </h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowIosGuide(false)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white classic:text-[#1E4638] classic:hover:bg-[#EFE2CC]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <ol className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300 classic:text-[#315E4E]">
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-mono text-[11px] font-extrabold text-white tabular-nums dark:bg-[#CCFF00] dark:text-[#0B0E14] classic:bg-[#1E4638] classic:text-[#FBF5E8]">
                        1
                      </span>
                      <span>
                        En la barra de Safari, toca el botón{' '}
                        <strong className="inline-flex items-center gap-1 font-bold text-slate-900 dark:text-white classic:text-[#1E4638]">
                          <Share className="h-3.5 w-3.5 text-sky-500 dark:text-[#2563EB] classic:text-[#D46F4D]" />
                          Compartir
                        </strong>
                        .
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-mono text-[11px] font-extrabold text-white tabular-nums dark:bg-[#CCFF00] dark:text-[#0B0E14] classic:bg-[#1E4638] classic:text-[#FBF5E8]">
                        2
                      </span>
                      <span>
                        Desliza hacia abajo y selecciona{' '}
                        <strong className="font-bold text-slate-900 dark:text-white classic:text-[#1E4638]">
                          &quot;Agregar a inicio&quot;
                        </strong>
                        .
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-mono text-[11px] font-extrabold text-white tabular-nums dark:bg-[#CCFF00] dark:text-[#0B0E14] classic:bg-[#1E4638] classic:text-[#FBF5E8]">
                        3
                      </span>
                      <span>
                        Toca{' '}
                        <strong className="font-bold text-slate-900 dark:text-white classic:text-[#1E4638]">
                          Agregar
                        </strong>{' '}
                        y se abrirá como app nativa sin barra de navegador.
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