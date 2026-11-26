import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  Loader2,
  RotateCcw,
  Swords,
  Trophy,
  X,
} from 'lucide-react';
import { getSingleMatchWinner } from '../utils/tournamentEngine';

export default function MatchResultModal({
  isOpen,
  match,
  siblingLeg,
  tournamentFormat,
  participantMap,
  onClose,
  onSave,
  onReset,
}) {
  const [mode, setMode] = useState('exact');
  const [scoreAInput, setScoreAInput] = useState('');
  const [scoreBInput, setScoreBInput] = useState('');
  const [selectedWinnerOnly, setSelectedWinnerOnly] = useState(null);
  const [tiebreakerWinnerId, setTiebreakerWinnerId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !match) return;

    setError('');
    setSaving(false);

    if (match.status === 'completed') {
      if (match.score_a !== null && match.score_b !== null) {
        setMode('exact');
        setScoreAInput(String(match.score_a));
        setScoreBInput(String(match.score_b));
        setSelectedWinnerOnly(null);
        setTiebreakerWinnerId(
          match.winner_id || siblingLeg?.winner_id || null
        );
      } else {
        setMode('winner_only');
        setScoreAInput('');
        setScoreBInput('');
        if (match.is_draw && tournamentFormat === 'league') {
          setSelectedWinnerOnly('draw');
          setTiebreakerWinnerId(null);
        } else if (
          match.is_draw &&
          tournamentFormat === 'knockout' &&
          siblingLeg
        ) {
          const sibWinner = getSingleMatchWinner(siblingLeg);
          const inferredLegWinner =
            sibWinner === match.participant_a_id
              ? match.participant_b_id
              : match.participant_a_id;
          setSelectedWinnerOnly(inferredLegWinner);
          setTiebreakerWinnerId(match.winner_id || null);
        } else {
          setSelectedWinnerOnly(match.winner_id || null);
          setTiebreakerWinnerId(siblingLeg?.winner_id || null);
        }
      }
    } else {
      setMode('exact');
      setScoreAInput('');
      setScoreBInput('');
      setSelectedWinnerOnly(null);
      setTiebreakerWinnerId(null);
    }
  }, [isOpen, match, siblingLeg, tournamentFormat]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, saving, onClose]);

  const playerA = match ? participantMap.get(match.participant_a_id) : null;
  const playerB = match ? participantMap.get(match.participant_b_id) : null;
  const isKnockout = tournamentFormat === 'knockout';
  const isTwoLegKnockout = isKnockout && Boolean(siblingLeg);

  const parsedA =
    scoreAInput.trim() === '' ? null : Number.parseInt(scoreAInput.trim(), 10);
  const parsedB =
    scoreBInput.trim() === '' ? null : Number.parseInt(scoreBInput.trim(), 10);
  const hasValidExactInputs =
    parsedA !== null &&
    parsedB !== null &&
    !Number.isNaN(parsedA) &&
    !Number.isNaN(parsedB) &&
    parsedA >= 0 &&
    parsedB >= 0;

  const siblingCompletedWithScores =
    Boolean(siblingLeg) &&
    siblingLeg.status === 'completed' &&
    siblingLeg.score_a !== null &&
    siblingLeg.score_b !== null;

  const siblingCompletedWinnerOnly =
    Boolean(siblingLeg) &&
    siblingLeg.status === 'completed' &&
    siblingLeg.score_a === null;

  function computeTwoLegAggregate(scoreForA, scoreForB) {
    if (!siblingCompletedWithScores || !match) return null;
    const totals = {
      [match.participant_a_id]: scoreForA,
      [match.participant_b_id]: scoreForB,
    };
    if (totals[siblingLeg.participant_a_id] !== undefined) {
      totals[siblingLeg.participant_a_id] += siblingLeg.score_a;
    }
    if (totals[siblingLeg.participant_b_id] !== undefined) {
      totals[siblingLeg.participant_b_id] += siblingLeg.score_b;
    }
    return {
      aggA: totals[match.participant_a_id],
      aggB: totals[match.participant_b_id],
    };
  }

  let aggregatePreview = null;
  let needsTiebreaker = false;

  if (match && isKnockout) {
    if (mode === 'exact' && hasValidExactInputs) {
      if (!isTwoLegKnockout) {
        needsTiebreaker = parsedA === parsedB;
      } else if (siblingCompletedWithScores) {
        aggregatePreview = computeTwoLegAggregate(parsedA, parsedB);
        needsTiebreaker = aggregatePreview.aggA === aggregatePreview.aggB;
      } else if (siblingCompletedWinnerOnly) {
        const sibWinner = getSingleMatchWinner(siblingLeg);
        const currentLegWinner =
          parsedA > parsedB
            ? match.participant_a_id
            : parsedB > parsedA
            ? match.participant_b_id
            : null;
        if (sibWinner && currentLegWinner && sibWinner !== currentLegWinner) {
          needsTiebreaker = true;
        }
      }
    } else if (
      mode === 'winner_only' &&
      selectedWinnerOnly &&
      isTwoLegKnockout
    ) {
      if (siblingLeg.status === 'completed') {
        const sibWinner = getSingleMatchWinner(siblingLeg);
        if (sibWinner && sibWinner !== selectedWinnerOnly) {
          needsTiebreaker = true;
        }
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!match) return;
    setError('');

    if (mode === 'exact') {
      if (!hasValidExactInputs) {
        setError(
          'Ingresa un marcador numérico válido (0 o mayor) para ambos jugadores.'
        );
        return;
      }

      if (needsTiebreaker && !tiebreakerWinnerId) {
        setError(
          'El marcador quedó igualado. Selecciona quién avanza por desempate.'
        );
        return;
      }

      let primaryUpdate = null;
      let siblingUpdate = null;

      if (!isKnockout) {
        const isDraw = parsedA === parsedB;
        primaryUpdate = {
          score_a: parsedA,
          score_b: parsedB,
          is_draw: isDraw,
          winner_id: isDraw
            ? null
            : parsedA > parsedB
            ? match.participant_a_id
            : match.participant_b_id,
          status: 'completed',
        };
      } else if (!isTwoLegKnockout) {
        const isDraw = parsedA === parsedB;
        primaryUpdate = {
          score_a: parsedA,
          score_b: parsedB,
          is_draw: isDraw,
          winner_id: isDraw
            ? tiebreakerWinnerId
            : parsedA > parsedB
            ? match.participant_a_id
            : match.participant_b_id,
          status: 'completed',
        };
      } else {
        const currentLegDraw = parsedA === parsedB;
        const naturalWinner = currentLegDraw
          ? null
          : parsedA > parsedB
          ? match.participant_a_id
          : match.participant_b_id;

        if (match.leg === 2) {
          primaryUpdate = {
            score_a: parsedA,
            score_b: parsedB,
            is_draw: currentLegDraw,
            winner_id: needsTiebreaker ? tiebreakerWinnerId : naturalWinner,
            status: 'completed',
          };
        } else {
          primaryUpdate = {
            score_a: parsedA,
            score_b: parsedB,
            is_draw: currentLegDraw,
            winner_id: naturalWinner,
            status: 'completed',
          };

          if (siblingLeg?.status === 'completed') {
            if (needsTiebreaker) {
              siblingUpdate = {
                id: siblingLeg.id,
                patch: {
                  winner_id: tiebreakerWinnerId,
                  ...(siblingLeg.score_a === null ? { is_draw: true } : {}),
                },
              };
            } else if (siblingCompletedWithScores) {
              const sibDraw = siblingLeg.score_a === siblingLeg.score_b;
              siblingUpdate = {
                id: siblingLeg.id,
                patch: {
                  winner_id: sibDraw
                    ? null
                    : siblingLeg.score_a > siblingLeg.score_b
                    ? siblingLeg.participant_a_id
                    : siblingLeg.participant_b_id,
                },
              };
            }
          }
        }
      }

      setSaving(true);
      try {
        await onSave({ primaryUpdate, siblingUpdate });
        onClose();
      } catch (err) {
        setError(err?.message || 'No se pudo guardar el resultado.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!selectedWinnerOnly) {
      setError('Selecciona un ganador o resultado.');
      return;
    }

    if (needsTiebreaker && !tiebreakerWinnerId) {
      setError('La serie quedó 1-1. Selecciona quién avanza a la siguiente ronda.');
      return;
    }

    let primaryUpdate = null;
    let siblingUpdate = null;

    if (!isKnockout) {
      const isDraw = selectedWinnerOnly === 'draw';
      primaryUpdate = {
        score_a: null,
        score_b: null,
        is_draw: isDraw,
        winner_id: isDraw ? null : selectedWinnerOnly,
        status: 'completed',
      };
    } else if (!isTwoLegKnockout) {
      primaryUpdate = {
        score_a: null,
        score_b: null,
        is_draw: false,
        winner_id: selectedWinnerOnly,
        status: 'completed',
      };
    } else if (match.leg === 2) {
      primaryUpdate = {
        score_a: null,
        score_b: null,
        is_draw: Boolean(needsTiebreaker),
        winner_id: needsTiebreaker ? tiebreakerWinnerId : selectedWinnerOnly,
        status: 'completed',
      };
    } else {
      primaryUpdate = {
        score_a: null,
        score_b: null,
        is_draw: false,
        winner_id: selectedWinnerOnly,
        status: 'completed',
      };

      if (siblingLeg?.status === 'completed' && needsTiebreaker) {
        siblingUpdate = {
          id: siblingLeg.id,
          patch: {
            winner_id: tiebreakerWinnerId,
            ...(siblingLeg.score_a === null ? { is_draw: true } : {}),
          },
        };
      }
    }

    setSaving(true);
    try {
      await onSave({ primaryUpdate, siblingUpdate });
      onClose();
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el resultado.');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetMatch() {
    if (!match) return;
    setError('');
    setSaving(true);
    try {
      await onReset(match);
      onClose();
    } catch (err) {
      setError(err?.message || 'No se pudo resetear el partido.');
    } finally {
      setSaving(false);
    }
  }

  const siblingPlayerA = siblingLeg
    ? participantMap.get(siblingLeg.participant_a_id)
    : null;
  const siblingPlayerB = siblingLeg
    ? participantMap.get(siblingLeg.participant_b_id)
    : null;

  return (
    <AnimatePresence>
      {isOpen && match && (
        <motion.div
          key="match-result-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) onClose();
          }}
        >
          <motion.div
            key="match-result-dialog"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95"
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400">
                  <Swords className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {match.status === 'completed'
                      ? 'Editar resultado'
                      : 'Cargar resultado'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {match.round_name}
                    {isTwoLegKnockout
                      ? ` · ${
                          match.leg === 1 ? 'Partido de Ida' : 'Partido de Vuelta'
                        }`
                      : ''}
                  </p>
                </div>
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.92 }}
                disabled={saving}
                onClick={onClose}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5">
              {isTwoLegKnockout && siblingLeg && (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                  <span className="font-bold text-slate-800 dark:text-white">
                    {siblingLeg.leg === 1 ? 'Ida:' : 'Vuelta:'}{' '}
                  </span>
                  {siblingLeg.status === 'completed' ? (
                    siblingLeg.score_a !== null && siblingLeg.score_b !== null ? (
                      <span>
                        {siblingPlayerA?.name || 'Jugador A'}{' '}
                        {siblingLeg.score_a} - {siblingLeg.score_b}{' '}
                        {siblingPlayerB?.name || 'Jugador B'}
                      </span>
                    ) : (
                      <span>
                        Ganador:{' '}
                        {participantMap.get(getSingleMatchWinner(siblingLeg))
                          ?.name || 'Definido'}
                      </span>
                    )
                  ) : (
                    <span className="text-slate-400">Aún pendiente</span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 rounded-2xl border border-slate-200/70 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-950/80">
                <button
                  type="button"
                  onClick={() => {
                    setMode('exact');
                    setError('');
                  }}
                  className={`relative rounded-xl py-2 text-xs font-bold transition-colors sm:text-sm ${
                    mode === 'exact'
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {mode === 'exact' && (
                    <motion.div
                      layoutId="match-result-mode-pill"
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 32,
                      }}
                      className="absolute inset-0 rounded-xl bg-white shadow-xs dark:bg-slate-800"
                    />
                  )}
                  <span className="relative z-10">Resultado exacto</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('winner_only');
                    setError('');
                  }}
                  className={`relative rounded-xl py-2 text-xs font-bold transition-colors sm:text-sm ${
                    mode === 'winner_only'
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {mode === 'winner_only' && (
                    <motion.div
                      layoutId="match-result-mode-pill"
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 32,
                      }}
                      className="absolute inset-0 rounded-xl bg-white shadow-xs dark:bg-slate-800"
                    />
                  )}
                  <span className="relative z-10">Solo ganador</span>
                </button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {mode === 'exact' ? (
                  <motion.div
                    key="mode-exact"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="text-center">
                        <label
                          htmlFor="score-a-input"
                          className="mb-2 block truncate text-sm font-bold text-slate-900 dark:text-white"
                          title={playerA?.name}
                        >
                          {playerA?.name || 'Jugador A'}
                        </label>
                        <input
                          id="score-a-input"
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={scoreAInput}
                          onChange={(e) => setScoreAInput(e.target.value)}
                          placeholder="0"
                          className="w-full rounded-xl border border-slate-200/90 bg-white py-3 text-center text-2xl font-black text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none dark:border-slate-700/80 dark:bg-slate-900 dark:text-white"
                        />
                      </div>

                      <span className="pt-6 text-lg font-extrabold text-slate-400">
                        -
                      </span>

                      <div className="text-center">
                        <label
                          htmlFor="score-b-input"
                          className="mb-2 block truncate text-sm font-bold text-slate-900 dark:text-white"
                          title={playerB?.name}
                        >
                          {playerB?.name || 'Jugador B'}
                        </label>
                        <input
                          id="score-b-input"
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={scoreBInput}
                          onChange={(e) => setScoreBInput(e.target.value)}
                          placeholder="0"
                          className="w-full rounded-xl border border-slate-200/90 bg-white py-3 text-center text-2xl font-black text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none dark:border-slate-700/80 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {hasValidExactInputs && !isKnockout && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl bg-slate-100/90 px-3.5 py-2 text-center text-xs font-bold text-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
                      >
                        {parsedA > parsedB
                          ? `Ganador: ${playerA?.name} (+3 pts)`
                          : parsedB > parsedA
                          ? `Ganador: ${playerB?.name} (+3 pts)`
                          : 'Empate (+1 pt para cada jugador)'}
                      </motion.div>
                    )}

                    {hasValidExactInputs && aggregatePreview && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2 text-center text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200"
                      >
                        Marcador global: {playerA?.name} {aggregatePreview.aggA}{' '}
                        - {aggregatePreview.aggB} {playerB?.name}
                      </motion.div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="mode-winner-only"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                    className="space-y-3"
                  >
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Elige el resultado directo sin cargar goles ni puntos
                      numéricos.
                    </p>

                    <div
                      className={`grid gap-2.5 ${
                        !isKnockout
                          ? 'grid-cols-1 sm:grid-cols-3'
                          : 'grid-cols-1 sm:grid-cols-2'
                      }`}
                    >
                      <motion.button
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() =>
                          setSelectedWinnerOnly(match.participant_a_id)
                        }
                        className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold transition-colors ${
                          selectedWinnerOnly === match.participant_a_id
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 ring-2 ring-emerald-500/25 dark:border-emerald-400 dark:text-emerald-200'
                            : 'border-slate-200/90 bg-white/80 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <Trophy className="h-4 w-4 shrink-0" />
                        <span className="truncate">{playerA?.name}</span>
                      </motion.button>

                      {!isKnockout && (
                        <motion.button
                          type="button"
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setSelectedWinnerOnly('draw')}
                          className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold transition-colors ${
                            selectedWinnerOnly === 'draw'
                              ? 'border-amber-500 bg-amber-500/15 text-amber-800 ring-2 ring-amber-500/25 dark:border-amber-400 dark:text-amber-200'
                              : 'border-slate-200/90 bg-white/80 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-800/70'
                          }`}
                        >
                          <span>Empate</span>
                        </motion.button>
                      )}

                      <motion.button
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() =>
                          setSelectedWinnerOnly(match.participant_b_id)
                        }
                        className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold transition-colors ${
                          selectedWinnerOnly === match.participant_b_id
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 ring-2 ring-emerald-500/25 dark:border-emerald-400 dark:text-emerald-200'
                            : 'border-slate-200/90 bg-white/80 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <Trophy className="h-4 w-4 shrink-0" />
                        <span className="truncate">{playerB?.name}</span>
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {needsTiebreaker && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -6 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 p-3.5 dark:border-amber-500/35 dark:bg-amber-500/12">
                      <p className="mb-2.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                        {isTwoLegKnockout
                          ? 'Serie empatada: elige quién avanza por desempate'
                          : 'Partido empatado: elige quién avanza por desempate'}
                      </p>
                      <div className="grid grid-cols-2 gap-2.5">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          onClick={() =>
                            setTiebreakerWinnerId(match.participant_a_id)
                          }
                          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                            tiebreakerWinnerId === match.participant_a_id
                              ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                              : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-100/70 dark:border-amber-500/30 dark:bg-slate-900/90 dark:text-amber-200 dark:hover:bg-amber-500/20'
                          }`}
                        >
                          {tiebreakerWinnerId === match.participant_a_id && (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          <span className="truncate">{playerA?.name}</span>
                        </motion.button>

                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          onClick={() =>
                            setTiebreakerWinnerId(match.participant_b_id)
                          }
                          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                            tiebreakerWinnerId === match.participant_b_id
                              ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                              : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-100/70 dark:border-amber-500/30 dark:bg-slate-900/90 dark:text-amber-200 dark:hover:bg-amber-500/20'
                          }`}
                        >
                          {tiebreakerWinnerId === match.participant_b_id && (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          <span className="truncate">{playerB?.name}</span>
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4 dark:border-slate-800">
                <div>
                  {match.status === 'completed' && (
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      disabled={saving}
                      onClick={handleResetMatch}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Resetear a pendiente</span>
                    </motion.button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    disabled={saving}
                    onClick={onClose}
                    className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Guardar resultado</span>
                  </motion.button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}