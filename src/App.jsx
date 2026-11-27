import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import InviteModal from './components/InviteModal';
import Navbar from './components/Navbar';
import ProfileModal from './components/ProfileModal';
import { ToastProvider } from './components/ToastProvider';
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

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#0B0E14' : '#0B0E14');
    }
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
      <div className="relative flex min-h-screen items-center justify-center bg-[#0B0E14] px-4 text-white">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#CCFF00]/[0.07] blur-3xl" />
          <div className="absolute right-[-10%] bottom-[-15%] h-[360px] w-[480px] rounded-full bg-[#2563EB]/[0.12] blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#141923] p-6 shadow-2xl"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-wider text-amber-400 uppercase">
                Sistema / Entorno
              </p>
              <h1 className="text-lg font-extrabold tracking-tight text-white uppercase">
                Configuración de Supabase faltante
              </h1>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-300">
            Crea un archivo{' '}
            <code className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#CCFF00]">
              .env
            </code>{' '}
            en la raíz del proyecto definiendo{' '}
            <code className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#CCFF00]">
              VITE_SUPABASE_URL
            </code>{' '}
            y{' '}
            <code className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#CCFF00]">
              VITE_SUPABASE_ANON_KEY
            </code>
            , y luego reinicia el servidor de desarrollo.
          </p>
        </motion.div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[#0B0E14] px-4 text-white">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#CCFF00]/[0.08] blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative flex items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-[#141923]/95 px-6 py-4 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#CCFF00]/15">
            <Loader2 className="h-5 w-5 animate-spin text-[#CCFF00]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Cargando sesión
            </span>
            <span className="text-sm font-extrabold tracking-tight text-white uppercase">
              Preparando arena...
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <div className="relative min-h-screen bg-[#0B0E14] text-white antialiased selection:bg-[#CCFF00]/25 selection:text-[#CCFF00]">
          {/* Fondo ambiental Sport-Tech + iluminación de estadio */}
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="arena-grid-overlay absolute inset-0 opacity-30" />
            <motion.div
              animate={{
                opacity: isDark ? 0.55 : 0.45,
                scale: isDark ? 1.04 : 1,
              }}
              transition={{ duration: 0.7 }}
              className="absolute -top-44 left-1/2 h-[440px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(204,255,0,0.11)_0%,rgba(204,255,0,0.03)_45%,transparent_72%)] blur-3xl"
            />
            <motion.div
              animate={{
                opacity: isDark ? 0.5 : 0.4,
              }}
              transition={{ duration: 0.7 }}
              className="absolute right-[-12%] bottom-[-18%] h-[420px] w-[580px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.16)_0%,rgba(37,99,235,0.04)_50%,transparent_75%)] blur-3xl"
            />
          </div>

          <div className="relative z-10 flex min-h-screen flex-col">
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

                <main className="flex-1">
                  <AnimatePresence mode="wait">
                    {selectedTournamentId ? (
                      <motion.div
                        key={`tournament-${selectedTournamentId}`}
                        initial={{ opacity: 0, y: 12 }}
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
                        initial={{ opacity: 0, y: 12 }}
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
                </main>

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
        </div>
      </ToastProvider>
    </MotionConfig>
  );
}