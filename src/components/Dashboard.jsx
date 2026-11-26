import { useCallback, useEffect, useState } from 'react';
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
import CreateTournamentModal from './CreateTournamentModal';

export default function Dashboard({
  user,
  refreshTrigger = 0,
  onSelectTournament,
}) {
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

      setJoinFeedback({
        type: 'success',
        tournamentId: data?.tournament_id,
        message: data?.already_member
          ? `Ya formabas parte de "${data?.name}".`
          : `¡Te uniste al torneo "${data?.name}"!`,
      });
    } catch (err) {
      setJoinFeedback({
        type: 'error',
        message:
          err?.message || 'No fue posible unirte con ese código de invitación.',
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Mis Torneos
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Administra tus competencias o únete con un código de invitación.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          <span>Crear Torneo</span>
        </button>
      </div>

      <section className="glass-card mb-8 rounded-2xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <KeyRound className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Unirse con código de invitación</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              ¿Un amigo ya creó el torneo? Pídele el código o link e ingrésalo aquí.
            </p>
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
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-base font-semibold tracking-wider text-slate-900 uppercase placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 placeholder:normal-case focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={joining}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {joining && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{joining ? 'Uniéndose...' : 'Unirse'}</span>
            </button>
          </form>
        </div>

        {joinFeedback && (
          <div
            className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
              joinFeedback.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
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
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                <span>Abrir torneo</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </section>

      {fetchError && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            type="button"
            onClick={fetchTournaments}
            className="min-h-[44px] rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-xs hover:bg-rose-100"
          >
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((skeleton) => (
            <div
              key={skeleton}
              className="glass-card h-48 animate-pulse rounded-2xl p-5"
            >
              <div className="mb-3 flex justify-between">
                <div className="h-5 w-20 rounded-full bg-slate-200" />
                <div className="h-5 w-24 rounded-full bg-slate-200" />
              </div>
              <div className="mb-2 h-6 w-3/4 rounded-lg bg-slate-200" />
              <div className="h-4 w-1/2 rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      ) : memberships.length === 0 ? (
        <div className="glass-card rounded-2xl border-dashed px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
            <Trophy className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Todavía no participas en ningún torneo
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Crea un nuevo torneo para invitar a tus amigos o ingresa arriba un código de
            invitación si ya armaron uno.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            <span>Crear mi primer torneo</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {memberships.map((membership) => {
            const { tournament, role } = membership;
            const formatMeta = getFormatMeta(tournament.format);
            const roleMeta = getRoleMeta(role);
            const configItems = getConfigSummaryItems(
              tournament.format,
              tournament.config
            );
            const participantCount =
              tournament.tournament_participants?.[0]?.count ?? 0;

            return (
              <button
                key={tournament.id}
                type="button"
                onClick={() => onSelectTournament(tournament.id)}
                className="glass-card group flex min-h-[44px] flex-col justify-between rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
              >
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${roleMeta.badgeClass}`}
                    >
                      {renderRoleIcon(role)}
                      <span>{roleMeta.label}</span>
                    </span>

                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${formatMeta.badgeClass}`}
                    >
                      {formatMeta.label}
                    </span>
                  </div>

                  <h3 className="line-clamp-2 text-lg font-bold text-slate-900 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
                    {tournament.name}
                  </h3>

                  {configItems.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {configItems.slice(0, 2).map((item, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      {participantCount}{' '}
                      {participantCount === 1 ? 'jugador' : 'jugadores'}
                    </span>
                    <span className="hidden font-mono text-slate-400 sm:inline">
                      #{tournament.invite_code}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    <span>Entrar</span>
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>

                {tournament.created_at && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    Creado el {formatShortDate(tournament.created_at)}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      <CreateTournamentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        userId={user.id}
        onCreated={handleTournamentCreated}
      />
    </main>
  );
}