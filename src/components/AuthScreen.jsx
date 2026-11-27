import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Moon,
  Palette,
  Sparkles,
  Sun,
  Trophy,
  User,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getFormatMeta } from '../utils/tournamentFormats';

function translateAuthError(message = '') {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) {
    return 'Email o contraseña incorrectos.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Debes confirmar tu correo electrónico antes de iniciar sesión.';
  }
  if (normalized.includes('user already registered')) {
    return 'Ya existe una cuenta registrada con ese email.';
  }
  if (normalized.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (normalized.includes('unable to validate email address')) {
    return 'El formato del correo electrónico no es válido.';
  }
  if (normalized.includes('rate limit')) {
    return 'Demasiados intentos seguidos. Espera un momento e intenta de nuevo.';
  }
  return message || 'Ocurrió un error al autenticar. Intenta nuevamente.';
}

export default function AuthScreen({ theme = 'light', onToggleTheme, inviteCode = null }) {
  const [mode, setMode] = useState('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [inviteInfo, setInviteInfo] = useState(null);

  const isRegister = mode === 'register';
  const isDark = theme === 'dark';
  const isClassic = theme === 'classic';

  useEffect(() => {
    if (!inviteCode || !supabase) {
      setInviteInfo(null);
      return;
    }

    let active = true;
    supabase
      .rpc('get_invite_public_info', { p_invite_code: inviteCode })
      .then(({ data, error: rpcError }) => {
        if (!active || rpcError) return;
        if (data?.found) {
          setInviteInfo(data);
        }
      });

    return () => {
      active = false;
    };
  }, [inviteCode]);

  function handleSwitchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setSuccessMessage('');
    setConfirmPassword('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Ingresa tu correo electrónico.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        const cleanName = displayName.trim();
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: cleanName
            ? { data: { display_name: cleanName } }
            : undefined,
        });

        if (signUpError) {
          throw signUpError;
        }

        if (
          data?.user &&
          Array.isArray(data.user.identities) &&
          data.user.identities.length === 0
        ) {
          setError('Ya existe una cuenta registrada con ese correo electrónico.');
          return;
        }

        if (data?.user && !data?.session) {
          setSuccessMessage(
            '¡Cuenta creada! Revisa tu bandeja de entrada para confirmar tu correo antes de iniciar sesión.'
          );
          setMode('login');
          setPassword('');
          setConfirmPassword('');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInError) {
          throw signInError;
        }
      }
    } catch (err) {
      setError(translateAuthError(err?.message));
    } finally {
      setLoading(false);
    }
  }

  const inviteFormatMeta = inviteInfo ? getFormatMeta(inviteInfo.format) : null;

  const themeAriaLabel = isDark
    ? 'Cambiar a modo Clásico'
    : isClassic
    ? 'Cambiar a modo Claro'
    : 'Cambiar a modo Oscuro';

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      {onToggleTheme && (
        <motion.button
          type="button"
          onClick={onToggleTheme}
          whileTap={{ scale: 0.94 }}
          aria-label={themeAriaLabel}
          title={themeAriaLabel}
          className="fixed top-4 right-4 z-20 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/85 px-3 py-2 text-[11px] font-extrabold tracking-wider text-slate-700 uppercase shadow-sm backdrop-blur-xl transition hover:border-emerald-500/40 dark:border-white/[0.08] dark:bg-[#141923]/90 dark:text-slate-200 dark:hover:border-[#CCFF00]/40 classic:border-2 classic:border-[#1E4638] classic:bg-[#FBF5E8] classic:text-[#1E4638] classic:shadow-[3px_3px_0_#1E4638]"
        >
          <AnimatePresence mode="wait" initial={false}>
            {isDark ? (
              <motion.span
                key="auth-dark"
                initial={{ rotate: -60, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 60, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.16 }}
                className="inline-flex items-center gap-1.5 text-[#CCFF00]"
              >
                <Moon className="h-3.5 w-3.5" />
                <span className="text-slate-200">Oscuro</span>
              </motion.span>
            ) : isClassic ? (
              <motion.span
                key="auth-classic"
                initial={{ rotate: -60, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 60, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.16 }}
                className="inline-flex items-center gap-1.5 text-[#D46F4D]"
              >
                <Palette className="h-3.5 w-3.5" />
                <span className="text-[#1E4638]">Clásico</span>
              </motion.span>
            ) : (
              <motion.span
                key="auth-light"
                initial={{ rotate: 60, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -60, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.16 }}
                className="inline-flex items-center gap-1.5 text-amber-500"
              >
                <Sun className="h-3.5 w-3.5" />
                <span className="text-slate-700">Claro</span>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="w-full max-w-md"
      >
        <div className="mb-7 text-center">
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-emerald-500/25 blur-xl dark:bg-[#CCFF00]/20 classic:hidden" />
            <motion.div
              whileHover={isClassic ? { rotate: [-6, 6, 0], scale: 1.06 } : { scale: 1.04 }}
              className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/25 dark:bg-[#CCFF00] dark:bg-none dark:text-[#0B0E14] dark:shadow-[0_0_28px_-4px_rgba(204,255,0,0.45)] classic:border-2 classic:border-[#1E4638] classic:bg-[#D46F4D] classic:bg-none classic:text-[#FBF5E8] classic:shadow-[4px_4px_0_#1E4638]"
            >
              <Trophy className="h-7 w-7 stroke-[2.3]" />
            </motion.div>
          </div>
          <p className="mb-1 text-[11px] font-bold tracking-wider text-emerald-600 uppercase dark:text-[#CCFF00] classic:text-[#D46F4D]">
            {isClassic ? 'Club Social & Deportivo' : 'Sport-Tech Arena'}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 uppercase sm:text-3xl dark:text-white classic:text-[#1E4638]">
            AppTorneos
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 classic:text-[#315E4E]">
            Organiza ligas, eliminatorias y torneos con tus amigos en un solo lugar.
          </p>
        </div>

        {inviteCode && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-2xl border border-emerald-300/80 bg-emerald-50/90 p-4 text-sm shadow-xs dark:border-[#CCFF00]/30 dark:bg-[#CCFF00]/10 classic:border-2 classic:border-[#1E4638] classic:bg-[#F6E2B3] classic:shadow-[3px_3px_0_#1E4638]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:bg-[#CCFF00]/20 dark:text-[#CCFF00] classic:bg-[#1E4638] classic:text-[#FBF5E8]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold tracking-tight text-emerald-950 dark:text-white classic:text-[#1E4638]">
                  {inviteInfo
                    ? `Te invitaron a "${inviteInfo.name}"`
                    : `Tenés una invitación al torneo #${inviteCode}`}
                </p>
                <p className="mt-0.5 text-xs text-emerald-800 dark:text-slate-300 classic:text-[#315E4E]">
                  Inicia sesión o crea tu cuenta y te llevamos directo al torneo.
                </p>
                {inviteFormatMeta && (
                  <span
                    className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${inviteFormatMeta.badgeClass}`}
                  >
                    {inviteFormatMeta.label}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}

        <div className="glass-card overflow-hidden rounded-2xl p-6 sm:p-7">
          {isClassic && (
            <div className="classic-heritage-stripe -mx-6 -mt-6 mb-6 h-1.5 sm:-mx-7 sm:-mt-7" />
          )}

          <div className="mb-6 grid grid-cols-2 rounded-xl border border-slate-200/80 bg-slate-100/85 p-1 dark:border-white/[0.08] dark:bg-[#0B0E14] classic:border-2 classic:border-[#1E4638] classic:bg-[#EFE2CC]">
            <button
              type="button"
              onClick={() => handleSwitchMode('login')}
              className={`relative min-h-[42px] rounded-lg py-2 text-xs font-extrabold tracking-wider uppercase transition-colors ${
                !isRegister
                  ? 'text-slate-900 dark:text-[#0B0E14] classic:text-[#FBF5E8]'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white classic:text-[#4C6B5E] classic:hover:text-[#1E4638]'
              }`}
            >
              {!isRegister && (
                <motion.div
                  layoutId="auth-mode-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-lg bg-white shadow-xs dark:bg-[#CCFF00] classic:bg-[#1E4638]"
                />
              )}
              <span className="relative z-10">Iniciar sesión</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchMode('register')}
              className={`relative min-h-[42px] rounded-lg py-2 text-xs font-extrabold tracking-wider uppercase transition-colors ${
                isRegister
                  ? 'text-slate-900 dark:text-[#0B0E14] classic:text-[#FBF5E8]'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white classic:text-[#4C6B5E] classic:hover:text-[#1E4638]'
              }`}
            >
              {isRegister && (
                <motion.div
                  layoutId="auth-mode-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-lg bg-white shadow-xs dark:bg-[#CCFF00] classic:bg-[#1E4638]"
                />
              )}
              <span className="relative z-10">Crear cuenta</span>
            </button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.18 }}
                className="mb-4 overflow-hidden"
              >
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200 classic:border-2 classic:border-[#D46F4D] classic:bg-[#D46F4D]/15 classic:text-[#9E3F22]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.18 }}
                className="mb-4 overflow-hidden"
              >
                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-[#CCFF00]/35 dark:bg-[#CCFF00]/10 dark:text-[#CCFF00] classic:border-2 classic:border-[#1E4638] classic:bg-[#1E4638]/10 classic:text-[#1E4638]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence initial={false}>
              {isRegister && (
                <motion.div
                  key="display-name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <label
                    htmlFor="auth-display-name"
                    className="mb-1.5 block text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400 classic:text-[#315E4E]"
                  >
                    Tu nombre o apodo (opcional)
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 classic:text-[#4C6B5E]" />
                    <input
                      id="auth-display-name"
                      type="text"
                      maxLength={50}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ej: Santi"
                      className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 py-2.5 pr-3.5 pl-10 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-white/[0.08] dark:bg-[#0B0E14] dark:text-white dark:focus:border-[#CCFF00] dark:focus:ring-[#CCFF00]/20 classic:border-2 classic:border-[#1E4638]/40 classic:bg-[#FFFBF4] classic:text-[#1E4638] classic:focus:border-[#1E4638]"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label
                htmlFor="auth-email"
                className="mb-1.5 block text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400 classic:text-[#315E4E]"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 classic:text-[#4C6B5E]" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 py-2.5 pr-3.5 pl-10 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-white/[0.08] dark:bg-[#0B0E14] dark:text-white dark:focus:border-[#CCFF00] dark:focus:ring-[#CCFF00]/20 classic:border-2 classic:border-[#1E4638]/40 classic:bg-[#FFFBF4] classic:text-[#1E4638] classic:focus:border-[#1E4638]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="mb-1.5 block text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400 classic:text-[#315E4E]"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 classic:text-[#4C6B5E]" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 py-2.5 pr-12 pl-10 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-white/[0.08] dark:bg-[#0B0E14] dark:text-white dark:focus:border-[#CCFF00] dark:focus:ring-[#CCFF00]/20 classic:border-2 classic:border-[#1E4638]/40 classic:bg-[#FFFBF4] classic:text-[#1E4638] classic:focus:border-[#1E4638]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute top-1/2 right-1 inline-flex min-h-[42px] min-w-[42px] -translate-y-1/2 items-center justify-center text-slate-400 transition hover:text-slate-700 dark:hover:text-white classic:text-[#4C6B5E] classic:hover:text-[#1E4638]"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {isRegister && (
                <motion.div
                  key="confirm-password-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <label
                    htmlFor="auth-confirm-password"
                    className="mb-1.5 block text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400 classic:text-[#315E4E]"
                  >
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 classic:text-[#4C6B5E]" />
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite tu contraseña"
                      className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 py-2.5 pr-3.5 pl-10 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-white/[0.08] dark:bg-[#0B0E14] dark:text-white dark:focus:border-[#CCFF00] dark:focus:ring-[#CCFF00]/20 classic:border-2 classic:border-[#1E4638]/40 classic:bg-[#FFFBF4] classic:text-[#1E4638] classic:focus:border-[#1E4638]"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              whileTap={{ scale: 0.97 }}
              disabled={loading}
              className="mt-2 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-extrabold tracking-wide text-white uppercase shadow-md shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#CCFF00] dark:bg-none dark:text-[#0B0E14] dark:shadow-[0_0_24px_-6px_rgba(204,255,0,0.45)] dark:hover:bg-[#d9ff33] classic:border-2 classic:border-[#1E4638] classic:bg-[#D46F4D] classic:bg-none classic:text-[#FBF5E8] classic:shadow-[3px_3px_0_#1E4638] classic:hover:bg-[#df7b59]"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {loading
                  ? isRegister
                    ? 'Creando cuenta...'
                    : 'Ingresando...'
                  : isRegister
                  ? 'Registrarme'
                  : 'Iniciar sesión'}
              </span>
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}