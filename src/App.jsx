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
const THEME_CYCLE = ['light', 'dark', 'classic'];

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'dark' || saved === 'light' || saved === 'classic') return saved;
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
  const isClassic = theme === 'classic';

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'classic');
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'classic') {
      root.classList.add('classic');
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        'content',
        theme === 'dark' ? '#0B0E14' : theme === 'classic' ? '#163228' : '#F4F6FA'
      );
    }
  }, [isDark, theme]);

  function toggleTheme() {
    setTheme((prev) => {
      const idx = THEME_CYCLE.indexOf(prev);
      return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    });
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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) return;
      if (nextSession?.user) {
        loadUserProfile(nextSession.user);
        if (event === 'SIGNED_IN') {
          setTimeout(() => {
            if (isMounted) setSession(nextSession);
          }, 680);
        } else {
          setSession(nextSession);
        }
      } else {
        setSession(null);
        setProfile(null);
        setSelectedTournamentId(null);
        setIsProfileModalOpen(false);
      }
    });
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
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 text-[var(--app-text)]">
        <div className="glass-card w-full max-w-lg rounded-2xl p-6">
          <div className="mb-3 flex items-center gap-2.5 text-amber-600 dark:text-amber-400 classic:text-[#C86849]">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-lg font-extrabold tracking-tight uppercase">
              Configuración de Supabase faltante
            </h1>
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 classic:text-[#2D4D40]">
            Crea un archivo{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-white/10 dark:text-[#CCFF00] classic:bg-[#EFE2CC] classic:text-[#163228]">
              .env
            </code>{' '}
            en la raíz del proyecto definiendo{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-white/10 dark:text-[#CCFF00] classic:bg-[#EFE2CC] classic:text-[#163228]">
              VITE_SUPABASE_URL
            </code>{' '}
            y{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-white/10 dark:text-[#CCFF00] classic:bg-[#EFE2CC] classic:text-[#163228]">
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
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 text-[var(--app-text)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card flex items-center gap-3.5 rounded-2xl px-6 py-4"
        >
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600 dark:text-[#CCFF00] classic:text-[#C86849]" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400 classic:text-[#4C6358]">
              Cargando sesión
            </span>
            <span className="text-sm font-extrabold tracking-tight uppercase">
              Preparando arena...
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="never">
      <ToastProvider>
        <div className="relative min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] antialiased transition-colors duration-300 selection:bg-emerald-500/20 selection:text-emerald-800 dark:selection:bg-[#CCFF00]/25 dark:selection:text-[#CCFF00] classic:selection:bg-[#C86849]/25 classic:selection:text-[#163228]">
          {/* Fondo ambiental adaptable a Claro / Oscuro / Clásico */}
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            <div className="arena-grid-overlay absolute inset-0" />

            {isClassic ? (
              <>
                {/* Modo Clásico: Aros geométricos animados de cancha + manchas suaves de póster deportivo */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
                  className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full border-[2px] border-dashed border-[#163228]/15"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 110, repeat: Infinity, ease: 'linear' }}
                  className="absolute -bottom-48 -left-40 h-[560px] w-[560px] rounded-full border-[2px] border-[#C86849]/18"
                />
                <motion.div
                  animate={{
                    x: [0, 26, -14, 0],
                    y: [0, -18, 12, 0],
                    scale: [1, 1.08, 0.96, 1],
                  }}
                  transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute top-[8%] left-[-6%] h-[360px] w-[460px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(200,104,73,0.22)_0%,rgba(200,104,73,0.04)_55%,transparent_75%)] blur-3xl"
                />
                <motion.div
                  animate={{
                    x: [0, -24, 16, 0],
                    y: [0, 22, -12, 0],
                    scale: [1, 0.95, 1.07, 1],
                  }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute right-[-8%] bottom-[5%] h-[420px] w-[480px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(22,50,40,0.18)_0%,rgba(22,50,40,0.03)_55%,transparent_75%)] blur-3xl"
                />
                <motion.div
                  animate={{
                    x: [0, 18, -18, 0],
                    y: [0, -14, 10, 0],
                  }}
                  transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute top-[42%] left-[32%] h-[320px] w-[460px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(217,164,65,0.2)_0%,rgba(217,164,65,0.03)_55%,transparent_75%)] blur-3xl"
                />
              </>
            ) : isDark ? (
              <>
                {/* Modo Oscuro: Sport-Tech Electric Lime + Electric Cobalt */}
                <motion.div
                  animate={{ opacity: 0.6, scale: 1.04 }}
                  transition={{ duration: 0.6 }}
                  className="absolute -top-44 left-1/2 h-[440px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(204,255,0,0.11)_0%,rgba(204,255,0,0.03)_45%,transparent_72%)] blur-3xl"
                />
                <motion.div
                  animate={{ opacity: 0.55 }}
                  transition={{ duration: 0.6 }}
                  className="absolute right-[-12%] bottom-[-18%] h-[420px] w-[580px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.16)_0%,rgba(37,99,235,0.04)_50%,transparent_75%)] blur-3xl"
                />
              </>
            ) : (
              <>
                {/* Modo Claro: Estadio luminoso limpio */}
                <motion.div
                  animate={{ opacity: 0.7, scale: 1 }}
                  transition={{ duration: 0.6 }}
                  className="absolute -top-36 left-1/2 h-[420px] w-[780px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.16)_0%,rgba(45,212,191,0.06)_48%,transparent_75%)] blur-3xl"
                />
                <motion.div
                  animate={{ opacity: 0.5 }}
                  transition={{ duration: 0.6 }}
                  className="absolute right-[-10%] bottom-[-15%] h-[380px] w-[520px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.12)_0%,rgba(99,102,241,0.05)_50%,transparent_75%)] blur-3xl"
                />
              </>
            )}
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
                  logoTriggerKey={selectedTournamentId || 'home'}
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