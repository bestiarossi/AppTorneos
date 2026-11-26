import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Crown,
  Loader2,
  Plus,
  Target,
  Trophy,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resolveParticipantAvatar } from '../utils/avatarUpload';
import {
  buildProdeWhatsAppText,
  computeProdeLeaderboard,
  formatProdePoints,
  getPollTargetDetails,
} from '../utils/predictionsEngine';
import Avatar from './Avatar';
import CreatePredictionPollModal from './CreatePredictionPollModal';
import PredictionPollCard from './PredictionPollCard';
import WhatsAppShareButton from './WhatsAppShareButton';

export default function PredictionsTab({
  tournament,
  participants = [],
  participantMap = new Map(),
  matches = [],
  subtournaments = [],
  subEntries = [],
  subEntryMembers = [],
  subMatches = [],
  isAdmin = false,
  currentUserId,
  myLinkedParticipant = null,
  externalPolls = null,
  externalVotes = null,
  externalLoading = false,
  onRefreshExternal = null,
}) {
  const hasExternalState = Array.isArray(externalPolls);

  const [localPolls, setLocalPolls] = useState([]);
  const [localVotes, setLocalVotes] = useState([]);
  const [localLoading, setLocalLoading] = useState(!hasExternalState);
  const [error, setError] = useState('');

  const [subView, setSubView] = useState('polls');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const loadLocalPredictions = useCallback(async () => {
    if (hasExternalState) {
      if (onRefreshExternal) await onRefreshExternal();
      return;
    }

    if (!supabase || !tournament?.id) return;
    setError('');

    try {
      const { data: pollRows, error: pollsErr } = await supabase
        .from('prediction_polls')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('created_at', { ascending: false });

      if (pollsErr) throw pollsErr;

      const list = pollRows || [];
      setLocalPolls(list);

      if (list.length > 0) {
        const pollIds = list.map((p) => p.id);
        const { data: voteRows, error: votesErr } = await supabase
          .from('prediction_votes')
          .select('*')
          .in('poll_id', pollIds);

        if (votesErr) throw votesErr;
        setLocalVotes(voteRows || []);
      } else {
        setLocalVotes([]);
      }
    } catch (err) {
      setError(err?.message || 'No se pudieron cargar las encuestas del Prode.');
    } finally {
      setLocalLoading(false);
    }
  }, [hasExternalState, onRefreshExternal, tournament?.id]);

  useEffect(() => {
    if (hasExternalState) return;
    setLocalLoading(true);
    loadLocalPredictions();
  }, [hasExternalState, loadLocalPredictions, matches, subMatches, subtournaments]);

  useEffect(() => {
    if (hasExternalState || !supabase || !tournament?.id) return;

    const channel = supabase
      .channel(`prode-${tournament.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prediction_polls',
          filter: `tournament_id=eq.${tournament.id}`,
        },
        () => {
          loadLocalPredictions();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prediction_votes',
        },
        () => {
          loadLocalPredictions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasExternalState, tournament?.id, loadLocalPredictions]);

  const polls = hasExternalState ? externalPolls : localPolls;
  const votes = hasExternalState ? externalVotes || [] : localVotes;
  const loading = hasExternalState ? externalLoading : localLoading;

  const votesByPollId = useMemo(() => {
    const map = new Map();
    votes.forEach((v) => {
      if (!map.has(v.poll_id)) map.set(v.poll_id, []);
      map.get(v.poll_id).push(v);
    });
    return map;
  }, [votes]);

  const pollItems = useMemo(() => {
    return polls
      .map((poll) => ({
        poll,
        targetDetails: getPollTargetDetails(poll, {
          matches,
          subMatches,
          subtournaments,
          subEntries,
          participantMap,
          subEntryMembers,
        }),
        pollVotes: votesByPollId.get(poll.id) || [],
      }))
      .filter((item) => Boolean(item.targetDetails));
  }, [
    polls,
    matches,
    subMatches,
    subtournaments,
    subEntries,
    participantMap,
    subEntryMembers,
    votesByPollId,
  ]);

  const openPolls = useMemo(
    () =>
      pollItems.filter(
        (item) =>
          item.poll.status === 'open' && !item.targetDetails.isCompleted
      ),
    [pollItems]
  );

  const closedPolls = useMemo(
    () =>
      pollItems.filter(
        (item) =>
          item.poll.status !== 'open' || item.targetDetails.isCompleted
      ),
    [pollItems]
  );

  const leaderboard = useMemo(
    () =>
      computeProdeLeaderboard({
        participants,
        polls,
        votes,
        matches,
        subMatches,
        subtournaments,
        subEntries,
        participantMap,
        subEntryMembers,
      }),
    [
      participants,
      polls,
      votes,
      matches,
      subMatches,
      subtournaments,
      subEntries,
      participantMap,
      subEntryMembers,
    ]
  );

  const supportsPolls = tournament?.format !== 'last_standing';
  const prodeLeader =
    leaderboard.length > 0 && leaderboard[0].points > 0 ? leaderboard[0] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14 text-sm font-semibold text-slate-500 dark:text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-500" />
        <span>Cargando Prode...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white">
            <Target className="h-4 w-4 text-emerald-500" />
            <span>Prode &amp; Encuestas de Predicción</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Clásico (marcador exacto 3/1) y Encuestas dinámicas según votos (tabla aparte).
          </p>
        </div>

        {isAdmin && supportsPolls && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-emerald-600/20"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva predicción</span>
          </motion.button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-950/70">
          <button
            type="button"
            onClick={() => setSubView('polls')}
            className={`relative min-h-[44px] rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              subView === 'polls'
                ? 'text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {subView === 'polls' && (
              <motion.div
                layoutId="prode-subview-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 shadow-xs"
              />
            )}
            <span className="relative z-10">
              Predicciones ({pollItems.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubView('standings')}
            className={`relative min-h-[44px] rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              subView === 'standings'
                ? 'text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {subView === 'standings' && (
              <motion.div
                layoutId="prode-subview-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 shadow-xs"
              />
            )}
            <span className="relative z-10">Tabla del Prode</span>
          </button>
        </div>

        {prodeLeader && (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/80 px-3 py-1.5 text-xs font-bold text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-200">
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            <span>
              Líder Prode: {prodeLeader.participant.name} (
              {formatProdePoints(prodeLeader.points)} pts)
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!supportsPolls ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
          Las encuestas de predicción están disponibles para torneos con cruces directos (Liga, Eliminatoria) o Modo Personalizado con subtorneos y cruces.
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {subView === 'polls' ? (
            <motion.div
              key="prode-polls"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="space-y-5"
            >
              {pollItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900/40">
                  <Target className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Todavía no hay predicciones ni encuestas
                  </h3>
                  <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
                    {isAdmin
                      ? 'Crea un Prode Clásico (marcador exacto 3/1) sobre partidos o una Encuesta dinámica sobre subtorneos para empezar a competir.'
                      : 'Los administradores todavía no publicaron predicciones.'}
                  </p>
                </div>
              ) : (
                <>
                  {openPolls.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Votación abierta ({openPolls.length})
                      </h3>
                      <div className="space-y-3">
                        {openPolls.map(({ poll, targetDetails, pollVotes }) => (
                          <PredictionPollCard
                            key={poll.id}
                            poll={poll}
                            targetDetails={targetDetails}
                            votes={pollVotes}
                            participantMap={participantMap}
                            myLinkedParticipant={myLinkedParticipant}
                            currentUserId={currentUserId}
                            isAdmin={isAdmin}
                            onChanged={loadLocalPredictions}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {closedPolls.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Cerradas y finalizadas ({closedPolls.length})
                      </h3>
                      <div className="space-y-3">
                        {closedPolls.map(({ poll, targetDetails, pollVotes }) => (
                          <PredictionPollCard
                            key={poll.id}
                            poll={poll}
                            targetDetails={targetDetails}
                            votes={pollVotes}
                            participantMap={participantMap}
                            myLinkedParticipant={myLinkedParticipant}
                            currentUserId={currentUserId}
                            isAdmin={isAdmin}
                            onChanged={loadLocalPredictions}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="prode-standings"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ordenado por puntos de predicción, aciertos plenos y efectividad.
                </p>
                {leaderboard.length > 0 && (
                  <WhatsAppShareButton
                    compact
                    label="Compartir Prode"
                    getText={() => buildProdeWhatsAppText(tournament, leaderboard)}
                  />
                )}
              </div>

              {leaderboard.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                  Aún no hay participantes vinculados que hayan participado en el Prode.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-2xs backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200/80 bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400">
                          <th className="w-12 px-3 py-3 text-center">Pos</th>
                          <th className="px-3 py-3">Participante</th>
                          <th className="px-2.5 py-3 text-center" title="Encuestas resueltas votadas">
                            Res.
                          </th>
                          <th className="px-2.5 py-3 text-center" title="Aciertos plenos (exacto / encuesta)">
                            Plenos
                          </th>
                          <th className="hidden px-2.5 py-3 text-center sm:table-cell" title="Total aciertos">
                            Aciertos
                          </th>
                          <th className="px-2.5 py-3 text-center" title="Efectividad">
                            % Efect.
                          </th>
                          <th className="px-4 py-3 text-right">Pts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-slate-800/80">
                        {leaderboard.map((row) => {
                          const isMine = row.participant.user_id === currentUserId;
                          const hasPts = row.points > 0;
                          let badgeClass =
                            'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
                          if (hasPts && row.rank === 1) {
                            badgeClass = 'podium-gold text-amber-800 dark:text-amber-200';
                          } else if (hasPts && row.rank === 2) {
                            badgeClass = 'podium-silver text-slate-800 dark:text-slate-200';
                          } else if (hasPts && row.rank === 3) {
                            badgeClass = 'podium-bronze text-orange-800 dark:text-orange-200';
                          }

                          return (
                            <tr
                              key={row.participant.id}
                              className={
                                isMine
                                  ? 'bg-emerald-50/60 dark:bg-emerald-500/12'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                              }
                            >
                              <td className="px-3 py-2.5 text-center">
                                <span
                                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-extrabold ${badgeClass}`}
                                >
                                  {row.rank}
                                </span>
                              </td>

                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <Avatar
                                    name={row.participant.name}
                                    url={resolveParticipantAvatar(row.participant)}
                                    size="sm"
                                    highlight={isMine}
                                  />
                                  <span className="font-bold text-slate-900 dark:text-slate-100">
                                    {row.participant.name}
                                  </span>
                                  {isMine && (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                      Tú
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-2.5 py-2.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                                {row.resolvedVotes}
                              </td>

                              <td className="px-2.5 py-2.5 text-center text-xs font-extrabold text-amber-700 dark:text-amber-300">
                                {row.fullHits}
                              </td>

                              <td className="hidden px-2.5 py-2.5 text-center text-xs font-semibold text-slate-600 sm:table-cell dark:text-slate-300">
                                {row.totalHits}
                              </td>

                              <td className="px-2.5 py-2.5 text-center text-xs font-bold text-slate-700 dark:text-slate-200">
                                {row.resolvedVotes > 0
                                  ? `${row.effectivenessPct}%`
                                  : '—'}
                              </td>

                              <td className="px-4 py-2.5 text-right">
                                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-sm font-black text-emerald-700 dark:text-emerald-300">
                                  <Trophy className="h-3.5 w-3.5" />
                                  {formatProdePoints(row.points)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <CreatePredictionPollModal
        isOpen={isCreateOpen}
        tournament={tournament}
        currentUserId={currentUserId}
        matches={matches}
        subtournaments={subtournaments}
        subEntries={subEntries}
        subMatches={subMatches}
        participantMap={participantMap}
        existingPolls={polls}
        onClose={() => setIsCreateOpen(false)}
        onCreated={loadLocalPredictions}
      />
    </div>
  );
}