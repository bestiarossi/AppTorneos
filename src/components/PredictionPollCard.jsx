import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Crown,
  Loader2,
  Lock,
  LockOpen,
  Trash2,
  Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resolveParticipantAvatar } from '../utils/avatarUpload';
import { evaluateVote } from '../utils/predictionsEngine';
import Avatar from './Avatar';

export default function PredictionPollCard({
  poll,
  targetDetails,
  votes = [],
  participantMap = new Map(),
  myLinkedParticipant = null,
  currentUserId,
  isAdmin = false,
  onChanged,
}) {
  const myVote =
    votes.find((v) => v.user_id === currentUserId) || null;

  const [scoreAInput, setScoreAInput] = useState('');
  const [scoreBInput, setScoreBInput] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState('');

  const [savingVote, setSavingVote] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAllVotes, setShowAllVotes] = useState(false);
  const [error, setError] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (!myVote) {
      setScoreAInput('');
      setScoreBInput('');
      setSelectedOutcome('');
      setSelectedEntryId('');
      return;
    }

    setScoreAInput(
      myVote.predicted_score_a !== null && myVote.predicted_score_a !== undefined
        ? String(myVote.predicted_score_a)
        : ''
    );
    setScoreBInput(
      myVote.predicted_score_b !== null && myVote.predicted_score_b !== undefined
        ? String(myVote.predicted_score_b)
        : ''
    );
    setSelectedOutcome(myVote.predicted_outcome || '');
    setSelectedEntryId(myVote.predicted_entry_id || '');
  }, [myVote]);

  if (!targetDetails) return null;

  const isOpen = poll.status === 'open' && !targetDetails.isCompleted;
  const canVote = isOpen && Boolean(myLinkedParticipant);

  async function saveVotePayload(fields) {
    if (!canVote) return;
    setError('');
    setSavingVote(true);

    try {
      const { error: upsertError } = await supabase
        .from('prediction_votes')
        .upsert(
          {
            poll_id: poll.id,
            user_id: currentUserId,
            participant_id: myLinkedParticipant.id,
            ...fields,
          },
          { onConflict: 'poll_id,user_id' }
        );

      if (upsertError) throw upsertError;

      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 1800);
      if (onChanged) await onChanged();
    } catch (err) {
      setError(err?.message || 'No se pudo guardar tu predicción.');
    } finally {
      setSavingVote(false);
    }
  }

  async function handleSaveExactScore(e) {
    e.preventDefault();
    const sA = Number.parseInt(scoreAInput, 10);
    const sB = Number.parseInt(scoreBInput, 10);

    if (Number.isNaN(sA) || Number.isNaN(sB) || sA < 0 || sB < 0) {
      setError('Ingresa un marcador válido (números enteros mayores o iguales a 0).');
      return;
    }
    if (!poll.allow_draw && sA === sB) {
      setError('Esta encuesta no permite predecir empate.');
      return;
    }

    await saveVotePayload({
      predicted_score_a: sA,
      predicted_score_b: sB,
      predicted_outcome: sA > sB ? 'a' : sB > sA ? 'b' : 'draw',
      predicted_entry_id: null,
    });
  }

  async function handleSelectWinner(outcome) {
    setSelectedOutcome(outcome);
    await saveVotePayload({
      predicted_outcome: outcome,
      predicted_score_a: null,
      predicted_score_b: null,
      predicted_entry_id: null,
    });
  }

  async function handleSelectChampion(entryId) {
    setSelectedEntryId(entryId);
    await saveVotePayload({
      predicted_entry_id: entryId,
      predicted_outcome: null,
      predicted_score_a: null,
      predicted_score_b: null,
    });
  }

  async function handleTogglePollStatus() {
    if (!isAdmin) return;
    const nextStatus = poll.status === 'open' ? 'closed' : 'open';
    setError('');
    setTogglingStatus(true);

    try {
      const { error: updError } = await supabase
        .from('prediction_polls')
        .update({ status: nextStatus })
        .eq('id', poll.id);

      if (updError) throw updError;
      if (onChanged) await onChanged();
    } catch (err) {
      setError(err?.message || 'No se pudo cambiar el estado de la encuesta.');
    } finally {
      setTogglingStatus(false);
    }
  }

  async function handleDeletePoll() {
    if (!isAdmin) return;
    setDeleting(true);
    setError('');
    try {
      const { error: delError } = await supabase
        .from('prediction_polls')
        .delete()
        .eq('id', poll.id);
      if (delError) throw delError;
      if (onChanged) await onChanged();
    } catch (err) {
      setError(err?.message || 'No se pudo eliminar la encuesta.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const myEval = myVote ? evaluateVote(poll, myVote, targetDetails) : null;

  const scoringSummary =
    poll.prediction_mode === 'champion'
      ? `+${poll.points_champion} pts campeón`
      : poll.prediction_mode === 'exact_score'
      ? `+${poll.points_exact} pts exacto · +${poll.points_outcome} pts resultado`
      : `+${poll.points_outcome} pts resultado`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 shadow-2xs transition dark:bg-slate-900/65 ${
        isOpen
          ? 'border-emerald-200/90 bg-white/85 dark:border-emerald-500/35'
          : 'border-slate-200/80 bg-slate-50/75 dark:border-slate-800'
      }`}
    >
      {/* Cabecera */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {isOpen ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                <span>Abierta</span>
              </span>
            ) : targetDetails.isCompleted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300">
                <CheckCircle2 className="h-3 w-3" />
                <span>Finalizada</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                <Lock className="h-3 w-3" />
                <span>Cerrada</span>
              </span>
            )}

            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {scoringSummary}
            </span>

            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <Users className="h-3 w-3" />
              <span>{votes.length}</span>
            </span>
          </div>

          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
            {poll.title}
          </h3>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1">
            {!targetDetails.isCompleted && (
              <button
                type="button"
                disabled={togglingStatus}
                onClick={handleTogglePollStatus}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {togglingStatus ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isOpen ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <LockOpen className="h-3.5 w-3.5" />
                )}
                <span>{isOpen ? 'Cerrar' : 'Reabrir'}</span>
              </button>
            )}

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800"
                aria-label="Eliminar encuesta"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 p-1">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeletePoll}
                  className="min-h-[44px] rounded-lg bg-rose-600 px-2.5 text-xs font-bold text-white"
                >
                  {deleting ? '...' : 'Borrar'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="min-h-[44px] rounded-lg bg-white px-2 text-xs font-semibold text-slate-600"
                >
                  No
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resultado oficial si ya finalizó */}
      {targetDetails.isCompleted && (
        <div className="mb-3 rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-3.5 py-2.5 text-xs font-bold text-indigo-900 dark:border-indigo-500/35 dark:bg-indigo-500/15 dark:text-indigo-200">
          {targetDetails.kind === 'match' ? (
            <span>
              Resultado oficial:{' '}
              {targetDetails.hasScores
                ? `${targetDetails.sideA.name} ${targetDetails.scoreA} - ${targetDetails.scoreB} ${targetDetails.sideB.name}`
                : targetDetails.actualOutcome === 'draw'
                ? 'Empate'
                : `Ganó ${
                    targetDetails.actualOutcome === 'a'
                      ? targetDetails.sideA.name
                      : targetDetails.sideB.name
                  }`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-amber-500" />
              <span>
                Campeón oficial:{' '}
                {targetDetails.entries
                  .filter((e) => targetDetails.championEntryIds.includes(e.id))
                  .map((e) => e.name)
                  .join(', ') || 'Definido'}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Aviso si el usuario no está vinculado a un participante */}
      {isOpen && !myLinkedParticipant && (
        <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800 dark:border-sky-500/35 dark:bg-sky-500/15 dark:text-sky-200">
          Vincula tu cuenta a un participante del torneo en la lista lateral para emitir tu voto.
        </div>
      )}

      {/* Zona de votación para partido directo */}
      {targetDetails.kind === 'match' && (
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/45">
          <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex min-w-0 items-center justify-end gap-2">
              <span className="truncate text-right text-xs font-bold text-slate-900 sm:text-sm dark:text-white">
                {targetDetails.sideA.name}
              </span>
              <Avatar
                name={targetDetails.sideA.name}
                url={targetDetails.sideA.avatarUrl}
                size="sm"
              />
            </div>

            <span className="text-xs font-black text-slate-400">VS</span>

            <div className="flex min-w-0 items-center justify-start gap-2">
              <Avatar
                name={targetDetails.sideB.name}
                url={targetDetails.sideB.avatarUrl}
                size="sm"
              />
              <span className="truncate text-left text-xs font-bold text-slate-900 sm:text-sm dark:text-white">
                {targetDetails.sideB.name}
              </span>
            </div>
          </div>

          {poll.prediction_mode === 'exact_score' ? (
            <form onSubmit={handleSaveExactScore} className="space-y-2.5">
              <div className="flex items-center justify-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={99}
                  disabled={!canVote || savingVote}
                  value={scoreAInput}
                  onChange={(e) => setScoreAInput(e.target.value)}
                  placeholder="0"
                  aria-label={`Marcador de ${targetDetails.sideA.name}`}
                  className="h-11 w-20 rounded-xl border border-slate-300 bg-white text-center font-mono text-base font-extrabold text-slate-900 focus:border-emerald-500 focus:outline-none disabled:opacity-60 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <span className="font-bold text-slate-400">-</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  disabled={!canVote || savingVote}
                  value={scoreBInput}
                  onChange={(e) => setScoreBInput(e.target.value)}
                  placeholder="0"
                  aria-label={`Marcador de ${targetDetails.sideB.name}`}
                  className="h-11 w-20 rounded-xl border border-slate-300 bg-white text-center font-mono text-base font-extrabold text-slate-900 focus:border-emerald-500 focus:outline-none disabled:opacity-60 sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {canVote && (
                <button
                  type="submit"
                  disabled={savingVote}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {savingVote ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : savedNotice ? (
                    <Check className="h-4 w-4" />
                  ) : null}
                  <span>
                    {savingVote
                      ? 'Guardando...'
                      : savedNotice
                      ? '¡Predicción guardada!'
                      : myVote
                      ? 'Actualizar marcador'
                      : 'Guardar predicción'}
                  </span>
                </button>
              )}
            </form>
          ) : (
            <div
              className={`grid gap-2 ${
                poll.allow_draw ? 'grid-cols-3' : 'grid-cols-2'
              }`}
            >
              <button
                type="button"
                disabled={!canVote || savingVote}
                onClick={() => handleSelectWinner('a')}
                className={`min-h-[44px] truncate rounded-xl border px-2.5 py-2 text-xs font-bold transition disabled:opacity-70 ${
                  selectedOutcome === 'a'
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                Gana {targetDetails.sideA.name}
              </button>

              {poll.allow_draw && (
                <button
                  type="button"
                  disabled={!canVote || savingVote}
                  onClick={() => handleSelectWinner('draw')}
                  className={`min-h-[44px] rounded-xl border px-2.5 py-2 text-xs font-bold transition disabled:opacity-70 ${
                    selectedOutcome === 'draw'
                      ? 'border-amber-500 bg-amber-500 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  Empate
                </button>
              )}

              <button
                type="button"
                disabled={!canVote || savingVote}
                onClick={() => handleSelectWinner('b')}
                className={`min-h-[44px] truncate rounded-xl border px-2.5 py-2 text-xs font-bold transition disabled:opacity-70 ${
                  selectedOutcome === 'b'
                    ? 'border-emerald-500 bg-emerald-600 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                Gana {targetDetails.sideB.name}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Zona de votación para campeón de subtorneo */}
      {targetDetails.kind === 'subtournament' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {targetDetails.entries.map((entry) => {
            const isSelected = selectedEntryId === entry.id;
            const isRealChamp = targetDetails.championEntryIds.includes(entry.id);
            return (
              <button
                key={entry.id}
                type="button"
                disabled={!canVote || savingVote}
                onClick={() => handleSelectChampion(entry.id)}
                className={`flex min-h-[44px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition disabled:opacity-80 ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={entry.name} url={entry.avatarUrl} size="xs" />
                  <span className="truncate text-xs font-bold">{entry.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isRealChamp && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                  {isSelected && (
                    <span className="rounded-full bg-emerald-600 p-0.5 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Resultado de mi predicción */}
      {myEval?.resolved && (
        <div
          className={`mt-3 flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold ${
            myEval.fullHit
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
              : myEval.outcomeHit
              ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300'
              : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
          }`}
        >
          <span>
            {myEval.status === 'exact'
              ? '🎯 ¡Acierto pleno!'
              : myEval.status === 'outcome'
              ? '✅ Acertaste ganador/empate'
              : '❌ Sin acierto esta vez'}
          </span>
          <span>+{myEval.points} pts</span>
        </div>
      )}

      {error && (
        <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Desglose de votos de la comunidad */}
      {votes.length > 0 && (
        <div className="mt-3 border-t border-slate-200/80 pt-2.5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowAllVotes((prev) => !prev)}
            className="min-h-[44px] text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {showAllVotes
              ? 'Ocultar votos emitidos'
              : `Ver votos (${votes.length})`}
          </button>

          {showAllVotes && (
            <div className="mt-1.5 space-y-1.5">
              {votes.map((v) => {
                const voter = participantMap.get(v.participant_id);
                const evalV = evaluateVote(poll, v, targetDetails);
                let voteText = '';
                if (poll.prediction_mode === 'champion') {
                  voteText =
                    targetDetails.entries?.find((e) => e.id === v.predicted_entry_id)
                      ?.name || '—';
                } else if (poll.prediction_mode === 'exact_score') {
                  voteText = `${v.predicted_score_a} - ${v.predicted_score_b}`;
                } else {
                  voteText =
                    v.predicted_outcome === 'a'
                      ? targetDetails.sideA.name
                      : v.predicted_outcome === 'b'
                      ? targetDetails.sideB.name
                      : 'Empate';
                }

                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white/80 px-2.5 py-1.5 text-xs dark:bg-slate-800/70"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar
                        name={voter?.name || '?'}
                        url={resolveParticipantAvatar(voter)}
                        size="xs"
                      />
                      <span className="truncate font-semibold text-slate-800 dark:text-slate-200">
                        {voter?.name || 'Participante'}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                        {voteText}
                      </span>
                      {evalV.resolved && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                            evalV.points > 0
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                          }`}
                        >
                          +{evalV.points}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}