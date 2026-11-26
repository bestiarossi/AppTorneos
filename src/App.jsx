import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import InviteModal from './components/InviteModal';
import Navbar from './components/Navbar';
import ProfileModal from './components/ProfileModal';
import TournamentView from './components/TournamentView';

const THEME_STORAGE_KEY = 'torneoclub-theme';
const INVITE_STORAGE_KEY = 'torneoclub-pending-invite';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function extractInviteCodeFromUrl() {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const queryInvite = params.get('invite');
  if (queryInvite && queryInvite.trim()) {
    return queryInvite.trim().toUpperCase();
  }

  const pathMatch = window.location.pathname.match(/^\/invite\/([A-Za-z0-9_-]+)\/?$/i);
  if (pathMatch?.[1]) {
    return pathMatch[1].trim().toUpperCase();
  }

  return null;
}

function getInitialInviteCode() {
  if (typeof window === 'undefined') return null;
  const fromUrl = extractInviteCodeFromUrl();
  if (fromUrl) {
    window.sessionStorage.setItem(INVITE_STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  const saved = window.sessionStorage.getItem(INVITE_STORAGE_KEY);
  return saved ? saved.trim().toUpperCase() : null;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState(null);
  const [theme, setTheme] = useState(getInitialTheme);

  const [pendingInviteCode, setPendingInviteCode] = useState(getInitialInviteCode);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);

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

  const loadUserProfile = useCallback(async (user) => {
    if (!supabase || !user?.id) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
      return;
    }

    // Fallback seguro si el perfil recién se creó o faltaba
    const fallbackName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'Jugador';

    const { data: created } = await supabase
      .from('profiles')
      .upsert(
        { id: user.id, display_name: fallbackName },
        { onConflict: 'id' }
      )
      .select()
      .maybeSingle();

    setProfile(created || { id: user.id, display_name: fallbackName, avatar_url: null });
  }, []);

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
        const nextSession = data?.session ?? null;
        setSession(nextSession);
        if (nextSession?.user) {
          loadUserProfile(nextSession.user);
        }
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
      if (nextSession?.user) {
        loadUserProfile(nextSession.user);
      } else {
        setProfile(null);
        setSelectedTournamentId(null);
        setIsProfileModalOpen(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  const clearPendingInvite = useCallback(() => {
    setPendingInviteCode(null);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(INVITE_STORAGE_KEY);
      const hasUrlInvite = Boolean(extractInviteCodeFromUrl());
      if (hasUrlInvite) {
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  function handleInviteJoined(tournamentId) {
    clearPendingInvite();
    setDashboardRefreshKey((prev) => prev + 1);
    if (tournamentId) {
      setSelectedTournamentId(tournamentId);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      setSelectedTournamentId(null);
      setProfile(null);
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
            Crea un archivo{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">
              .env
            </code>{' '}
            en la raíz del proyecto definiendo{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">
              VITE_SUPABASE_URL
            </code>{' '}
            y{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">
              VITE_SUPABASE_ANON_KEY
            </code>
            , y luego reinicia el servidor de desarrollo.
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
          <AuthScreen
            theme={theme}
            onToggleTheme={toggleTheme}
            inviteCode={pendingInviteCode}
          />
        ) : (
          <>
            <Navbar
              user={session.user}
              profile={profile}
              onOpenProfile={() => setIsProfileModalOpen(true)}
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
                    profile={profile}
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
                    refreshTrigger={dashboardRefreshKey}
                    onSelectTournament={(id) => setSelectedTournamentId(id)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <ProfileModal
              isOpen={isProfileModalOpen}
              user={session.user}
              profile={profile}
              onClose={() => setIsProfileModalOpen(false)}
              onSaved={(updatedProfile) => setProfile(updatedProfile)}
            />

            <InviteModal
              isOpen={Boolean(pendingInviteCode)}
              inviteCode={pendingInviteCode}
              user={session.user}
              profile={profile}
              onClose={clearPendingInvite}
              onJoined={handleInviteJoined}
            />
          </>
        )}
      </div>
    </MotionConfig>
  );
}