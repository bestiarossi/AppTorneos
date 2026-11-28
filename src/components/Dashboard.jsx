import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Crown,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  formatShortDate,
  getConfigSummaryItems,
  getFormatMeta,
  getRoleMeta,
} from '../utils/tournamentFormats';
import { getTournamentTheme } from '../utils/tournamentThemes';
import CreateTournamentModal from './CreateTournamentModal';
import { DashboardSkeleton } from './Skeletons';
import { useToast } from './ToastProvider';

export default function Dashboard({
  user,
  refreshTrigger = 0,
  onSelectTournament,
}) {
  const toast = useToast();
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    setFetchError('');

    try {
      const { data, error } = await supabase
        .from('tournament_members')
        .select(
          `
          id,
          role,
          created_at,
          tournament:tournaments (
            id,
            name,
            format,
            config,
            invite_code,
            created_by,
            created_at,
            tournament_participants (count)
          )
        `
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const validMemberships = (data || []).filter((item) => Boolean(item.tournament));
      setMemberships(validMemberships);
    } catch (err) {
      setFetchError(err?.message || 'No se pudieron cargar tus torneos.');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments, refreshTrigger]);

  async function handleJoinByCode(e) {
    e.preventDefault();
    setJoinFeedback(null);

    const normalizedCode = inviteCode.trim().toUpperCase();
    if (!normalizedCode) {
      setJoinFeedback({
        type: 'error',
        message: 'Ingresa un código de invitación para unirte.',
      });
      return;
    }

    setJoining(true);

    try {
      const { data, error } = await supabase.rpc('join_tournament_by_code', {
        p_invite_code: normalizedCode,
      });

      if (error) {
        throw error;
      }

      setInviteCode('');
      await fetchTournaments();

      const msg = data?.already_member
        ? `Ya formabas parte de "${data?.name}".`
        : `¡Te uniste al torneo "${data?.name}"!`;

      toast.success(msg);
      setJoinFeedback({
        type: 'success',
        tournamentId: data?.tournament_id,
        message: msg,
      });
    } catch (err) {
      const errMsg =
        err?.message || 'No fue posible unirte con ese código de invitación.';
      toast.error(errMsg);
      setJoinFeedback({
        type: 'error',
        message: errMsg,
      });
    } finally {
      setJoining(false);
    }
  }

  async function handleTournamentCreated(newTournamentId) {
    setIsCreateModalOpen(false);
    await fetchTournaments();
    if (newTournamentId) {
      onSelectTournament(newTournamentId);
    }
  }

  function renderRoleIcon(role) {
    if (role === 'owner') return <Crown className="h-3 w-3" />;
    if (role === 'admin') return <ShieldCheck className="h-3 w-3" />;
    return <User className="h-3 w-3" />;
  }

  const count = memberships.length;
  const gridColsClass =
    count === 1
      ? 'grid-cols-1'
      : count === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header atlético */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-bold tracking-wider text-emerald-600 uppercase dark:text-[#CCFF00] classic:text-[#D46F4D]">
            Hub de Competencias
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 uppercase sm:text-3xl dark:text-white classic:text-[#1E4638]">
            Mis Torneos
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 classic:text-[#4C6B5E]">
            Administra tus competencias o únete con un código de invitación.
          </p>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-extrabold tracking-wider text-white uppercase shadow-md shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 dark:bg-[#CCFF00] dark:bg-none dark:text-[#0B0E14] dark:shadow-[0_0_24px_-6px_rgba(204,255,0,0.45)] dark:hover:bg-[#d9ff33] classic:border-2 classic:border-[#1E4638] classic:bg-[#D46F4D] classic:bg-none classic:text-[#FBF5E8] classic:shadow-[3px_3px_0_#1E4638] classic:hover:bg-[#df7b59]"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Crear Torneo</span>
        </motion.button>
      </div>

      {fetchError && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            type="button"
            onClick={fetchTournaments}
            className="min-h-[40px] rounded-xl bg-white px-3.5 py-1.5 text-xs font-extrabold tracking-wider text-rose-700 uppercase shadow-xs hover:bg-rose-100 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Lista de Torneos primero */}
      {loading ? (
        <DashboardSkeleton />
      ) : memberships.length === 0 ? (
        <div className="glass-card rounded-2xl border-dashed px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-[#CCFF00] classic:border-2 classic:border-[#1E4638] classic:bg-[#EFE2CC] classic:text-[#1E4638]">
            <Trophy className="h-7 w-7" />
          </div>
          <h3 className="text-base font-extrabold tracking-tight text-slate-900 uppercase dark:text-white classic:text-[#1E4638]">
            Todavía no participas en ningún torneo
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400 classic:text-[#4C6B5E]">
            Crea un nuevo torneo para invitar a tus amigos o ingresa abajo un código de
            invitación si ya armaron uno.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold tracking-wider text-white uppercase shadow-sm transition hover:bg-emerald-700 dark:bg-[#CCFF00] dark:text-[#0B0E14] dark:hover:bg-[#d9ff33] classic:border-2 classic:border-[#1E4638] classic:bg-[#D46F4D] classic:text-[#FBF5E8] classic:shadow-[3px_3px_0_#1E4638]"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Crear mi primer torneo</span>
          </motion.button>
        </div>
      ) : (
        <div className={`grid gap-4 ${gridColsClass}`}>
          {memberships.map((membership, idx) => {
            const { tournament, role } = membership;
            const formatMeta = getFormatMeta(tournament.format);
            const roleMeta = getRoleMeta(role);
            const sportTheme = getTournamentTheme(tournament.config);
            const configItems = getConfigSummaryItems(
              tournament.format,
              tournament.config
            );
            const participantCount =
              tournament.tournament_participants?.[0]?.count ?? 0;

            const isSingle = count === 1;
            const isDouble = count === 2;

            return (
              <motion.button
                key={tournament.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(idx * 0.04, 0.28) }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => onSelectTournament(tournament.id)}
                className={`glass-card group relative flex flex-col justify-between overflow-hidden rounded-2xl text-left transition hover:shadow-xl dark:hover:border-white/20 ${
                  isSingle
                    ? 'min-h-[220px] p-6 sm:p-8'
                    : isDouble
                    ? 'min-h-[195px] p-6'
                    : 'min-h-[175px] p-5'
                } ${sportTheme.accentBorder}`}
              >
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${sportTheme.cardRibbon}`}
                />

                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute -right-2 bottom-10 opacity-[0.08] transition-transform duration-300 select-none group-hover:scale-110 group-hover:-rotate-6 dark:opacity-[0.07] classic:opacity-[0.14] ${
                    isSingle ? 'text-8xl sm:text-9xl' : 'text-7xl'
                  }`}
                >
                  {sportTheme.emoji}
                </span>

                <div className="relative z-10">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ${roleMeta.badgeClass}`}
                    >
                      {renderRoleIcon(role)}
                      <span>{roleMeta.label}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${sportTheme.badgeClass}`}
                      >
                        <span>{sportTheme.emoji}</span>
                        <span className="hidden sm:inline">{sportTheme.label}</span>
                      </span>

                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${formatMeta.badgeClass}`}
                      >
                        {formatMeta.label}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <h3
                      className={`line-clamp-2 leading-[1.1] font-black tracking-tight text-slate-900 uppercase transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-[#CCFF00] classic:text-[#1E4638] classic:group-hover:text-[#D46F4D] ${
                        isSingle
                          ? 'text-2xl sm:text-3xl'
                          : isDouble
                          ? 'text-xl sm:text-2xl'
                          : 'text-xl sm:text-[22px]'
                      }`}
                    >
                      {tournament.name}
                    </h3>
                    <div
                      className={`mt-2.5 h-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 dark:bg-[#CCFF00] dark:bg-none dark:shadow-[0_0_12px_rgba(204,255,0,0.6)] classic:bg-[#D46F4D] classic:bg-none ${
                        isSingle
                          ? 'w-14 group-hover:w-24'
                          : 'w-10 group-hover:w-16'
                      }`}
                    />
                  </div>

                  {configItems.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {configItems.slice(0, isSingle ? 4 : 2).map((item, cIdx) => (
                        <span
                          key={cIdx}
                          className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300 classic:border classic:border-[#1E4638]/20 classic:bg-[#EFE2CC] classic:text-[#1E4638]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative z-10 mt-6 flex items-center justify-between border-t border-slate-100 pt-3.5 text-xs text-slate-500 dark:border-white/[0.06] dark:text-slate-400 classic:border-[#1E4638]/15 classic:text-[#4C6B5E]">
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-200 classic:text-[#1E4638]">
                      <Users className="h-3.5 w-3.5 text-slate-400 classic:text-[#D46F4D]" />
                      {participantCount}{' '}
                      <span className="font-sans font-semibold text-slate-500 dark:text-slate-400">
                        {participantCount === 1 ? 'jugador' : 'jugadores'}
                      </span>
                    </span>
                    <span className="hidden rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-500 sm:inline dark:bg-white/[0.05] dark:text-slate-400 classic:bg-[#EFE2CC] classic:text-[#1E4638]">
                      #{tournament.invite_code}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-extrabold tracking-wider text-emerald-600 uppercase dark:text-[#CCFF00] classic:text-[#D46F4D]">
                    <span>Entrar al torneo</span>
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>

                {tournament.created_at && (
                  <p className="relative z-10 mt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500 classic:text-[#607D71]">
                    Creado el {formatShortDate(tournament.created_at)}
                  </p>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Tarjeta de unión por código debajo de los torneos */}
      <section className="glass-card mt-8 rounded-2xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:bg-[#CCFF00]/12 dark:text-[#CCFF00] classic:border-2 classic:border-[#1E4638] classic:bg-[#D9A441]/30 classic:text-[#1E4638]">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase classic:text-[#4C6B5E]">
                Acceso rápido
              </p>
              <h2 className="text-sm font-extrabold tracking-tight text-slate-900 uppercase dark:text-white classic:text-[#1E4638]">
                Unirse con código de invitación
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 classic:text-[#4C6B5E]">
                ¿Un amigo ya creó el torneo? Pídele el código o link e ingrésalo aquí.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleJoinByCode}
            className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:min-w-[380px]"
          >
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value.toUpperCase());
                if (joinFeedback) setJoinFeedback(null);
              }}
              placeholder="Ej: A7K9M2"
              maxLength={16}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-base font-bold tracking-widest text-slate-900 uppercase placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 placeholder:normal-case focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-white/[0.08] dark:bg-[#0B0E14] dark:text-white dark:focus:border-[#CCFF00] dark:focus:ring-[#CCFF00]/20 classic:border-2 classic:border-[#1E4638]/40 classic:bg-[#FFFBF4] classic:text-[#1E4638] classic:focus:border-[#1E4638]"
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={joining}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-extrabold tracking-wider text-white uppercase transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#2563EB] dark:hover:bg-blue-500 classic:border-2 classic:border-[#1E4638] classic:bg-[#1E4638] classic:text-[#FBF5E8] classic:shadow-[2px_2px_0_#D9A441] classic:hover:bg-[#285947]"
            >
              {joining && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{joining ? 'Uniéndose...' : 'Unirse'}</span>
            </motion.button>
          </form>
        </div>

        {joinFeedback && (
          <div
            className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-xs font-semibold ${
              joinFeedback.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200 classic:border-2 classic:border-[#D46F4D] classic:bg-[#D46F4D]/15 classic:text-[#9E3F22]'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-[#CCFF00]/35 dark:bg-[#CCFF00]/10 dark:text-[#CCFF00] classic:border-2 classic:border-[#1E4638] classic:bg-[#1E4638]/10 classic:text-[#1E4638]'
            }`}
          >
            <div className="flex items-center gap-2">
              {joinFeedback.type === 'error' ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              )}
              <span>{joinFeedback.message}</span>
            </div>

            {joinFeedback.tournamentId && (
              <button
                type="button"
                onClick={() => onSelectTournament(joinFeedback.tournamentId)}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-extrabold tracking-wider text-white uppercase transition hover:bg-emerald-700 dark:bg-[#CCFF00] dark:text-[#0B0E14] dark:hover:bg-[#d9ff33] classic:bg-[#1E4638] classic:text-[#FBF5E8]"
              >
                <span>Abrir torneo</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </section>

      <CreateTournamentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        userId={user.id}
        onCreated={handleTournamentCreated}
      />
    </main>
  );
}