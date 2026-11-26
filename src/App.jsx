import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { AlertTriangle, Loader2, Moon, Sparkles, Sun } from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import Navbar from './components/Navbar';
import TournamentView from './components/TournamentView';

const THEME_STORAGE_KEY = 'torneoclub-theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState(null);
  const [theme, setTheme] = useState(getInitialTheme);

  const isDark = theme === 'dark';

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [isDark, theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data?.session ?? null);
        setAuthLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession ?? null);
      if (!nextSession) {
        setSelectedTournamentId(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    if (!supabase) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      setSelectedTournamentId(null);
    } finally {
      setSigningOut(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-card w-full max-w-lg rounded-2xl p-6">
          <div className="mb-3 flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-lg font-bold">Configuración de Supabase faltante</h1>
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Crea un archivo <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">.env</code>{' '}
            en la raíz del proyecto definiendo{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">VITE_SUPABASE_URL</code>{' '}
            y{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">VITE_SUPABASE_ANON_KEY</code>,
            y luego reinicia el servidor de desarrollo.
          </p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card flex items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-semibold text-slate-600 dark:text-slate-200"
        >
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
          <span>Preparando arena...</span>
        </motion.div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen selection:bg-emerald-500/25 selection:text-emerald-700 dark:selection:text-emerald-200">
        {/* Fondo ambiental dinámico según el modo */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <motion.div
            animate={{
              opacity: isDark ? 0.35 : 0.65,
              scale: isDark ? 1.05 : 1,
            }}
            transition={{ duration: 0.7 }}
            className="absolute -top-36 left-1/2 h-[420px] w-[780px] -translate-x-1/2 rounded-full bg-radial from-emerald-400/25 via-teal-300/10 to-transparent blur-3xl dark:from-emerald-500/25 dark:via-cyan-500/10"
          />
          <motion.div
            animate={{
              opacity: isDark ? 0.28 : 0.45,
            }}
            transition={{ duration: 0.7 }}
            className="absolute right-[-10%] bottom-[-15%] h-[380px] w-[520px] rounded-full bg-radial from-sky-400/20 via-indigo-400/10 to-transparent blur-3xl dark:from-indigo-500/25 dark:via-violet-500/10"
          />
        </div>

        {!session?.user ? (
          <AuthScreen theme={theme} onToggleTheme={toggleTheme} />
        ) : (
          <>
            <Navbar
              user={session.user}
              onSignOut={handleSignOut}
              signingOut={signingOut}
              onGoHome={() => setSelectedTournamentId(null)}
              theme={theme}
              onToggleTheme={toggleTheme}
            />

            <AnimatePresence mode="wait">
              {selectedTournamentId ? (
                <motion.div
                  key={`tournament-${selectedTournamentId}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <TournamentView
                    tournamentId={selectedTournamentId}
                    user={session.user}
                    onBack={() => setSelectedTournamentId(null)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <Dashboard
                    user={session.user}
                    onSelectTournament={(id) => setSelectedTournamentId(id)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

      </div>
    </MotionConfig>
  );
}