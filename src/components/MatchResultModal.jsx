import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

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
      setError(
        'La serie quedó 1-1. Selecciona quién avanza a la siguiente ronda.'
      );
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && match && (
        <motion.div
          key="match-result-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) onClose();
          }}
        >
          <motion.div
            key="match-result-dialog"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-200/90 bg-white shadow-2xl sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            {/* Header fijo */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3.5 sm:px-5 sm:py-4 dark:border-slate-800">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400">
                  <Swords className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {match.status === 'completed'
                      ? 'Editar resultado'
                      : 'Cargar resultado'}
                  </h2>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {match.round_name}
                    {isTwoLegKnockout
                      ? ` · ${
                          match.leg === 1 ? 'Partido de Ida' : 'Partido de Vuelta'
                        }`
                      : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition active:bg-slate-100 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:active:bg-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Formulario scrolleable */}
            <form
              id="match-result-form"
              onSubmit={handleSubmit}
              className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:space-y-5 sm:p-5"
            >
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
                  className={`relative min-h-[42px] rounded-xl py-2 text-xs font-bold transition-colors sm:text-sm ${
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
                  className={`relative min-h-[42px] rounded-xl py-2 text-xs font-bold transition-colors sm:text-sm ${
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
                    <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200">
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
                      <div className="min-w-0 text-center">
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
                          className="min-h-[54px] w-full rounded-xl border border-slate-200/90 bg-white py-2.5 text-center text-2xl font-black text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none dark:border-slate-700/80 dark:bg-slate-900 dark:text-white"
                        />
                      </div>

                      <span className="pt-6 text-lg font-extrabold text-slate-400">
                        -
                      </span>

                      <div className="min-w-0 text-center">
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
                          className="min-h-[54px] w-full rounded-xl border border-slate-200/90 bg-white py-2.5 text-center text-2xl font-black text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none dark:border-slate-700/80 dark:bg-slate-900 dark:text-white"
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
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedWinnerOnly(match.participant_a_id)
                        }
                        className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border px-3.5 py-3 text-sm font-bold transition active:scale-[0.98] ${
                          selectedWinnerOnly === match.participant_a_id
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 ring-2 ring-emerald-500/25 dark:border-emerald-400 dark:text-emerald-200'
                            : 'border-slate-200/90 bg-white/80 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <Trophy className="h-4 w-4 shrink-0" />
                        <span className="truncate">{playerA?.name}</span>
                      </button>

                      {!isKnockout && (
                        <button
                          type="button"
                          onClick={() => setSelectedWinnerOnly('draw')}
                          className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border px-3.5 py-3 text-sm font-bold transition active:scale-[0.98] ${
                            selectedWinnerOnly === 'draw'
                              ? 'border-amber-500 bg-amber-500/15 text-amber-800 ring-2 ring-amber-500/25 dark:border-amber-400 dark:text-amber-200'
                              : 'border-slate-200/90 bg-white/80 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-800/70'
                          }`}
                        >
                          <span>Empate</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedWinnerOnly(match.participant_b_id)
                        }
                        className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border px-3.5 py-3 text-sm font-bold transition active:scale-[0.98] ${
                          selectedWinnerOnly === match.participant_b_id
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 ring-2 ring-emerald-500/25 dark:border-emerald-400 dark:text-emerald-200'
                            : 'border-slate-200/90 bg-white/80 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <Trophy className="h-4 w-4 shrink-0" />
                        <span className="truncate">{playerB?.name}</span>
                      </button>
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
                        <button
                          type="button"
                          onClick={() =>
                            setTiebreakerWinnerId(match.participant_a_id)
                          }
                          className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition active:scale-[0.98] ${
                            tiebreakerWinnerId === match.participant_a_id
                              ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                              : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-100/70 dark:border-amber-500/30 dark:bg-slate-900/90 dark:text-amber-200 dark:hover:bg-amber-500/20'
                          }`}
                        >
                          {tiebreakerWinnerId === match.participant_a_id && (
                            <Check className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="truncate">{playerA?.name}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setTiebreakerWinnerId(match.participant_b_id)
                          }
                          className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition active:scale-[0.98] ${
                            tiebreakerWinnerId === match.participant_b_id
                              ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                              : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-100/70 dark:border-amber-500/30 dark:bg-slate-900/90 dark:text-amber-200 dark:hover:bg-amber-500/20'
                          }`}
                        >
                          {tiebreakerWinnerId === match.participant_b_id && (
                            <Check className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="truncate">{playerB?.name}</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>

            {/* Footer fijo siempre accesible */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t border-slate-200/80 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4 dark:border-slate-800 dark:bg-slate-900">
              {match.status === 'completed' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleResetMatch}
                  className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition active:bg-rose-100 hover:bg-rose-100 disabled:opacity-50 sm:w-auto dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Resetear a pendiente</span>
                </button>
              )}

              <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
                <button
                  type="button"
                  disabled={saving}
                  onClick={onClose}
                  className="min-h-[44px] flex-1 rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition active:bg-slate-100 hover:bg-slate-50 disabled:opacity-50 sm:flex-none dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="match-result-form"
                  disabled={saving}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition active:scale-[0.98] hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 sm:flex-none"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Guardar</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}