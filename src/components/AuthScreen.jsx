import { useState } from 'react';
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
  Sun,
  Trophy,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

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

export default function AuthScreen({ theme = 'light', onToggleTheme }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isRegister = mode === 'register';
  const isDark = theme === 'dark';

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
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
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

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      {onToggleTheme && (
        <motion.button
          type="button"
          onClick={onToggleTheme}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.94 }}
          aria-label={
            isDark ? 'Cambiar a Clean Glass Light' : 'Cambiar a Arena Dark'
          }
          className="glass-card fixed top-4 right-4 z-20 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-emerald-500/40 dark:text-slate-200"
        >
          <AnimatePresence mode="wait" initial={false}>
            {isDark ? (
              <motion.span
                key="auth-sun"
                initial={{ rotate: -70, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 70, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.16 }}
                className="inline-flex items-center gap-1.5 text-amber-300"
              >
                <Sun className="h-3.5 w-3.5" />
                <span>Clean Glass</span>
              </motion.span>
            ) : (
              <motion.span
                key="auth-moon"
                initial={{ rotate: 70, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -70, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.16 }}
                className="inline-flex items-center gap-1.5 text-indigo-600"
              >
                <Moon className="h-3.5 w-3.5" />
                <span className="text-slate-700">Arena Dark</span>
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
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-emerald-500/30 blur-xl" />
            <motion.div
              whileHover={{ rotate: -6, scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/25"
            >
              <Trophy className="h-7 w-7" />
            </motion.div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            AppTorneos
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Organiza ligas, eliminatorias y torneos con tus amigos en un solo lugar.
          </p>
        </div>

        <div className="glass-card rounded-3xl p-6 sm:p-8">
          <div className="mb-6 grid grid-cols-2 rounded-2xl border border-slate-200/70 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900/90">
            <button
              type="button"
              onClick={() => handleSwitchMode('login')}
              className={`relative rounded-xl py-2 text-sm font-bold transition-colors ${
                !isRegister
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {!isRegister && (
                <motion.div
                  layoutId="auth-mode-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-white shadow-xs dark:bg-slate-800"
                />
              )}
              <span className="relative z-10">Iniciar sesión</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchMode('register')}
              className={`relative rounded-xl py-2 text-sm font-bold transition-colors ${
                isRegister
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {isRegister && (
                <motion.div
                  layoutId="auth-mode-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-white shadow-xs dark:bg-slate-800"
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
                <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
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
                <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="auth-email"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full rounded-xl border border-slate-200/90 bg-white/90 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-slate-200/90 bg-white/90 py-2.5 pr-10 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
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
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                  >
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite tu contraseña"
                      className="w-full rounded-xl border border-slate-200/90 bg-white/90 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.97 }}
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
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