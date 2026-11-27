import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  Clock,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Swords,
  Timer,
  Trophy,
  X,
} from 'lucide-react';
import { resolveParticipantAvatar } from '../utils/avatarUpload';
import {
  playScoreSound,
  playWhistleSound,
} from '../utils/soundEffects';
import { getSingleMatchWinner } from '../utils/tournamentEngine';
import Avatar from './Avatar';

const COUNTDOWN_PRESETS = [5, 10, 15, 20];

function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function MatchResultModal({
  isOpen,
  match,
  siblingLeg,
  tournamentFormat,
  participantMap,
  leagueTiebreakerEnabled = false,
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

  // Estado del Marcador en Vivo + Cronómetro
  const [clockType, setClockType] = useState('stopwatch'); // 'stopwatch' | 'countdown'
  const [countdownMinutes, setCountdownMinutes] = useState(10);
  const [customMinutesInput, setCustomMinutesInput] = useState('10');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [clockRunning, setClockRunning] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const clockIntervalRef = useRef(null);

  useEffect(() => {
    function handleFsChange() {
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  async function toggleNativeFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!isOpen || !match) return;

    setError('');
    setSaving(false);
    setClockRunning(false);
    setElapsedSeconds(0);
    setLiveEvents([]);

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
          setTiebreakerWinnerId(match.winner_id || null);
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

  // Motor del cronómetro / cuenta regresiva
  useEffect(() => {
    if (!isOpen || !clockRunning) {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
      return;
    }

    clockIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        const limitSecs = Math.max(1, Number(countdownMinutes) || 1) * 60;
        if (clockType === 'countdown' && next >= limitSecs) {
          setClockRunning(false);
          playWhistleSound();
          return limitSecs;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
        clockIntervalRef.current = null;
      }
    };
  }, [isOpen, clockRunning, clockType, countdownMinutes]);

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

  const isNumericMode = mode === 'exact' || mode === 'live';

  const parsedA =
    scoreAInput.trim() === ''
      ? mode === 'live'
        ? 0
        : null
      : Number.parseInt(scoreAInput.trim(), 10);
  const parsedB =
    scoreBInput.trim() === ''
      ? mode === 'live'
        ? 0
        : null
      : Number.parseInt(scoreBInput.trim(), 10);
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
    if (isNumericMode && hasValidExactInputs) {
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
  } else if (match && !isKnockout && leagueTiebreakerEnabled) {
    if (isNumericMode && hasValidExactInputs && parsedA === parsedB) {
      needsTiebreaker = true;
    } else if (mode === 'winner_only' && selectedWinnerOnly === 'draw') {
      needsTiebreaker = true;
    }
  }

  function handleLiveScoreDelta(side, delta) {
    const currentVal =
      side === 'a'
        ? Math.max(0, Number.parseInt(scoreAInput || '0', 10) || 0)
        : Math.max(0, Number.parseInt(scoreBInput || '0', 10) || 0);
    const nextVal = Math.max(0, currentVal + delta);

    if (side === 'a') {
      setScoreAInput(String(nextVal));
      if (scoreBInput === '') setScoreBInput('0');
    } else {
      setScoreBInput(String(nextVal));
      if (scoreAInput === '') setScoreAInput('0');
    }

    if (delta > 0) {
      playScoreSound();
      const stamp = formatClock(elapsedSeconds);
      const who = side === 'a' ? playerA?.name || 'Local' : playerB?.name || 'Visitante';
      setLiveEvents((prev) => [
        { id: `${Date.now()}-${Math.random()}`, side, who, time: stamp },
        ...prev.slice(0, 14),
      ]);
    } else if (delta < 0 && currentVal > 0) {
      setLiveEvents((prev) => {
        const idx = prev.findIndex((ev) => ev.side === side);
        if (idx === -1) return prev;
        return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
    }
  }

  function handleSwitchToLive() {
    setMode('live');
    setError('');
    if (scoreAInput === '') setScoreAInput('0');
    if (scoreBInput === '') setScoreBInput('0');
  }

  function handleResetClock() {
    setClockRunning(false);
    setElapsedSeconds(0);
  }

  function handleCustomMinutesChange(rawVal) {
    setCustomMinutesInput(rawVal);
    const parsed = Number.parseFloat(rawVal);
    if (!Number.isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(240, Math.max(1, parsed));
      setCountdownMinutes(clamped);
      setElapsedSeconds(0);
      setClockRunning(false);
    }
  }

  const totalCountdownSecs = Math.max(1, Number(countdownMinutes) || 1) * 60;
  const displayedClockSeconds =
    clockType === 'countdown'
      ? Math.max(0, totalCountdownSecs - elapsedSeconds)
      : elapsedSeconds;
  const isTimeUp =
    clockType === 'countdown' && elapsedSeconds >= totalCountdownSecs;

  function handleSafeClose() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!match) return;
    setError('');

    if (isNumericMode) {
      if (!hasValidExactInputs) {
        setError(
          'Ingresa un marcador numérico válido (0 o mayor) para ambos jugadores.'
        );
        return;
      }

      if (needsTiebreaker && !tiebreakerWinnerId) {
        setError(
          'El marcador quedó igualado. Selecciona quién ganó en el desempate.'
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
            ? leagueTiebreakerEnabled
              ? tiebreakerWinnerId
              : null
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
      setClockRunning(false);
      try {
        await onSave({ primaryUpdate, siblingUpdate });
        handleSafeClose();
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
        !isKnockout && leagueTiebreakerEnabled
          ? 'Selecciona quién ganó el desempate.'
          : 'La serie quedó 1-1. Selecciona quién avanza a la siguiente ronda.'
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
        winner_id: isDraw
          ? leagueTiebreakerEnabled
            ? tiebreakerWinnerId
            : null
          : selectedWinnerOnly,
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
      handleSafeClose();
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
      handleSafeClose();
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

  const isLiveFullscreen = mode === 'live';

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
          className={`fixed inset-0 z-[100] flex justify-center bg-slate-950/75 backdrop-blur-sm ${
            isLiveFullscreen
              ? 'items-stretch p-0'
              : 'items-end p-0 sm:items-center sm:p-4'
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving && !isLiveFullscreen) {
              handleSafeClose();
            }
          }}
        >
          <motion.div
            key="match-result-dialog"
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className={`flex flex-col overflow-hidden bg-white shadow-2xl dark:bg-[#141923] classic:bg-[#FBF5E8] ${
              isLiveFullscreen
                ? 'h-[100dvh] w-[100dvw] max-w-none rounded-none border-0'
                : 'max-h-[92dvh] w-full max-w-lg rounded-t-3xl border border-slate-200/90 sm:rounded-2xl dark:border-white/[0.08] classic:border-2 classic:border-[#1E4638]'
            }`}
          >
            {/* Header fijo */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 dark:border-white/[0.08] classic:border-b-2 classic:border-[#1E4638] classic:bg-[#1E4638]">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 sm:h-10 sm:w-10 dark:bg-[#CCFF00]/15 dark:bg-none dark:text-[#CCFF00] classic:border-2 classic:border-[#FBF5E8] classic:bg-[#D46F4D] classic:bg-none classic:text-[#FBF5E8]">
                  {mode === 'live' ? (
                    <Radio className="h-5 w-5 animate-pulse" />
                  ) : (
                    <Swords className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-extrabold tracking-tight text-slate-900 uppercase sm:text-base dark:text-white classic:text-[#FBF5E8]">
                    {mode === 'live'
                      ? 'Tablero en Vivo'
                      : match.status === 'completed'
                      ? 'Editar resultado'
                      : 'Cargar resultado'}
                  </h2>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400 classic:text-[#E6C782]">
                    {match.round_name}
                    {isTwoLegKnockout
                      ? ` · ${
                          match.leg === 1 ? 'Partido de Ida' : 'Partido de Vuelta'
                        }`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {isLiveFullscreen && (
                  <button
                    type="button"
                    onClick={toggleNativeFullscreen}
                    title="Pantalla completa"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-100/70 text-slate-600 transition hover:bg-slate-200/70 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 classic:border-[#FBF5E8]/30 classic:bg-[#285947] classic:text-[#FBF5E8]"
                  >
                    {isNativeFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSafeClose}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition active:bg-slate-100 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white classic:text-[#FBF5E8] classic:hover:bg-[#285947]"
                  aria-label="Cerrar modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Formulario scrolleable */}
            <form
              id="match-result-form"
              onSubmit={handleSubmit}
              className={`mx-auto flex w-full flex-1 flex-col overflow-y-auto overscroll-contain ${
                isLiveFullscreen
                  ? 'max-w-7xl justify-between gap-3 p-3 sm:p-6'
                  : 'space-y-4 p-4 sm:space-y-5 sm:p-5'
              }`}
            >
              {/* Barra superior de modos y contexto */}
              <div className="mx-auto w-full max-w-lg space-y-3">
                {isTwoLegKnockout && siblingLeg && (
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2 text-center text-xs text-slate-600 dark:border-white/[0.08] dark:bg-[#0B0E14] dark:text-slate-300">
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

                <div className="grid grid-cols-3 rounded-xl border border-slate-200/70 bg-slate-100/85 p-1 dark:border-white/[0.08] dark:bg-[#0B0E14] classic:border-2 classic:border-[#1E4638] classic:bg-[#EFE2CC]">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('exact');
                      setError('');
                    }}
                    className={`relative min-h-[38px] rounded-lg px-2 py-1.5 text-[11px] font-extrabold tracking-wide uppercase transition-colors sm:text-xs ${
                      mode === 'exact'
                        ? 'text-slate-900 dark:text-[#0B0E14] classic:text-[#FBF5E8]'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {mode === 'exact' && (
                      <motion.div
                        layoutId="match-result-mode-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-lg bg-white shadow-xs dark:bg-[#CCFF00] classic:bg-[#1E4638]"
                      />
                    )}
                    <span className="relative z-10">Exacto</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSwitchToLive}
                    className={`relative inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-extrabold tracking-wide uppercase transition-colors sm:text-xs ${
                      mode === 'live'
                        ? 'text-slate-900 dark:text-[#0B0E14] classic:text-[#FBF5E8]'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {mode === 'live' && (
                      <motion.div
                        layoutId="match-result-mode-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-lg bg-white shadow-xs dark:bg-[#CCFF00] classic:bg-[#D46F4D]"
                      />
                    )}
                    <Timer className="relative z-10 h-3.5 w-3.5" />
                    <span className="relative z-10">En Vivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('winner_only');
                      setClockRunning(false);
                      setError('');
                    }}
                    className={`relative min-h-[38px] rounded-lg px-2 py-1.5 text-[11px] font-extrabold tracking-wide uppercase transition-colors sm:text-xs ${
                      mode === 'winner_only'
                        ? 'text-slate-900 dark:text-[#0B0E14] classic:text-[#FBF5E8]'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {mode === 'winner_only' && (
                      <motion.div
                        layoutId="match-result-mode-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-lg bg-white shadow-xs dark:bg-[#CCFF00] classic:bg-[#1E4638]"
                      />
                    )}
                    <span className="relative z-10">Ganador</span>
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
                      <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence mode="wait">
                {mode === 'live' ? (
                  <motion.div
                    key="mode-live"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                    className="flex flex-1 flex-col justify-center gap-3"
                  >
                    {/* En PC (lg:) y en Celular Horizontal (landscape:) arma 3 columnas: Local | Reloj Central | Visitante */}
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-stretch lg:gap-5 max-lg:landscape:grid-cols-12 max-lg:landscape:items-stretch max-lg:landscape:gap-2.5">
                      {/* Reloj Central (primero en vertical, al medio en horizontal y PC) */}
                      <div
                        className={`flex flex-col justify-between rounded-2xl border p-3.5 text-center transition sm:p-5 lg:order-2 lg:col-span-4 max-lg:landscape:order-2 max-lg:landscape:col-span-4 max-lg:landscape:p-2.5 ${
                          isTimeUp
                            ? 'border-rose-400 bg-rose-950 text-white'
                            : 'border-slate-800 bg-slate-900 text-white dark:border-white/[0.08] dark:bg-[#0B0E14] classic:border-2 classic:border-[#1E4638] classic:bg-[#1E4638]'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-[10px] font-extrabold uppercase">
                            <button
                              type="button"
                              onClick={() => {
                                setClockType('stopwatch');
                                handleResetClock();
                              }}
                              className={`rounded-md px-2.5 py-1 transition ${
                                clockType === 'stopwatch'
                                  ? 'bg-[#CCFF00] text-[#0B0E14] classic:bg-[#D9A441] classic:text-[#1E4638]'
                                  : 'text-slate-300 hover:text-white'
                              }`}
                            >
                              Libre
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setClockType('countdown');
                                handleResetClock();
                              }}
                              className={`rounded-md px-2.5 py-1 transition ${
                                clockType === 'countdown'
                                  ? 'bg-[#CCFF00] text-[#0B0E14] classic:bg-[#D9A441] classic:text-[#1E4638]'
                                  : 'text-slate-300 hover:text-white'
                              }`}
                            >
                              Temporizador
                            </button>
                          </div>

                          {/* Selector de minutos: Presets + Input libre */}
                          {clockType === 'countdown' && (
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              {COUNTDOWN_PRESETS.map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => {
                                    setCountdownMinutes(m);
                                    setCustomMinutesInput(String(m));
                                    setElapsedSeconds(0);
                                    setClockRunning(false);
                                  }}
                                  className={`rounded-md px-2 py-1 font-mono text-[10px] font-bold transition ${
                                    Number(countdownMinutes) === m
                                      ? 'bg-white/20 text-[#CCFF00] classic:text-[#D9A441]'
                                      : 'text-slate-400 hover:bg-white/10 hover:text-white'
                                  }`}
                                >
                                  {m}&apos;
                                </button>
                              ))}

                              <div className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5">
                                <input
                                  type="number"
                                  min={1}
                                  max={240}
                                  value={customMinutesInput}
                                  onChange={(e) =>
                                    handleCustomMinutesChange(e.target.value)
                                  }
                                  aria-label="Minutos personalizados"
                                  className="w-10 bg-transparent text-center font-mono text-xs font-black text-white focus:outline-none"
                                />
                                <span className="text-[10px] font-bold text-slate-300">
                                  min
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="my-2 flex flex-col items-center justify-center">
                          <span
                            className={`font-mono text-5xl font-black tracking-tight tabular-nums sm:text-6xl max-lg:landscape:text-4xl ${
                              isTimeUp
                                ? 'animate-pulse text-rose-300'
                                : clockRunning
                                ? 'text-[#CCFF00] classic:text-[#D9A441]'
                                : 'text-white'
                            }`}
                          >
                            {formatClock(displayedClockSeconds)}
                          </span>
                          {isTimeUp && (
                            <span className="mt-1 rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-black tracking-wider uppercase">
                              ¡Tiempo cumplido!
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-center gap-2">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              if (isTimeUp) {
                                setElapsedSeconds(0);
                                setClockRunning(true);
                              } else {
                                setClockRunning((prev) => !prev);
                              }
                            }}
                            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-black tracking-wider uppercase transition ${
                              clockRunning
                                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                                : 'bg-[#CCFF00] text-[#0B0E14] hover:bg-[#d9ff33] classic:bg-[#D46F4D] classic:text-[#FBF5E8]'
                            }`}
                          >
                            {clockRunning ? (
                              <>
                                <Pause className="h-3.5 w-3.5" />
                                <span>Pausar</span>
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5" />
                                <span>
                                  {elapsedSeconds > 0 ? 'Seguir' : 'Iniciar'}
                                </span>
                              </>
                            )}
                          </motion.button>

                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            onClick={handleResetClock}
                            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/15"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>00:00</span>
                          </motion.button>
                        </div>
                      </div>

                      {/* Tarjeta Jugador A (Izquierda en horizontal / PC) */}
                      <div className="flex flex-col items-center justify-between rounded-2xl border border-slate-200/90 bg-slate-50/85 p-4 lg:order-1 lg:col-span-4 max-lg:landscape:order-1 max-lg:landscape:col-span-4 max-lg:landscape:p-3 dark:border-white/[0.08] dark:bg-[#0B0E14] classic:border-2 classic:border-[#1E4638] classic:bg-[#EFE2CC]">
                        <div className="flex flex-col items-center">
                          <Avatar
                            name={playerA?.name || 'Local'}
                            url={resolveParticipantAvatar(playerA)}
                            size="md"
                          />
                          <span
                            className="mt-2 max-w-[180px] truncate text-sm font-black text-slate-900 uppercase sm:text-base dark:text-white classic:text-[#1E4638]"
                            title={playerA?.name}
                          >
                            {playerA?.name || 'Local'}
                          </span>
                        </div>

                        <motion.span
                          key={`a-${parsedA ?? 0}`}
                          initial={{ scale: 1.22 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.16 }}
                          className="my-2 font-mono text-6xl font-black text-slate-900 tabular-nums sm:text-7xl max-lg:landscape:my-1 max-lg:landscape:text-5xl dark:text-[#CCFF00] classic:text-[#1E4638]"
                        >
                          {parsedA ?? 0}
                        </motion.span>

                        <div className="flex w-full items-center gap-2">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.92 }}
                            disabled={(parsedA ?? 0) <= 0}
                            onClick={() => handleLiveScoreDelta('a', -1)}
                            className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                            aria-label={`Restar 1 a ${playerA?.name}`}
                          >
                            <Minus className="h-5 w-5" />
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.92 }}
                            onClick={() => handleLiveScoreDelta('a', 1)}
                            className="flex min-h-[48px] flex-[1.8] items-center justify-center gap-1 rounded-xl bg-emerald-600 text-base font-black text-white shadow-md hover:bg-emerald-700 dark:bg-[#CCFF00] dark:text-[#0B0E14] classic:border-2 classic:border-[#1E4638] classic:bg-[#D46F4D] classic:text-[#FBF5E8]"
                            aria-label={`Sumar 1 a ${playerA?.name}`}
                          >
                            <Plus className="h-5 w-5 stroke-[2.8]" />
                            <span>1</span>
                          </motion.button>
                        </div>
                      </div>

                      {/* Tarjeta Jugador B (Derecha en horizontal / PC) */}
                      <div className="flex flex-col items-center justify-between rounded-2xl border border-slate-200/90 bg-slate-50/85 p-4 lg:order-3 lg:col-span-4 max-lg:landscape:order-3 max-lg:landscape:col-span-4 max-lg:landscape:p-3 dark:border-white/[0.08] dark:bg-[#0B0E14] classic:border-2 classic:border-[#1E4638] classic:bg-[#EFE2CC]">
                        <div className="flex flex-col items-center">
                          <Avatar
                            name={playerB?.name || 'Visitante'}
                            url={resolveParticipantAvatar(playerB)}
                            size="md"
                          />
                          <span
                            className="mt-2 max-w-[180px] truncate text-sm font-black text-slate-900 uppercase sm:text-base dark:text-white classic:text-[#1E4638]"
                            title={playerB?.name}
                          >
                            {playerB?.name || 'Visitante'}
                          </span>
                        </div>

                        <motion.span
                          key={`b-${parsedB ?? 0}`}
                          initial={{ scale: 1.22 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.16 }}
                          className="my-2 font-mono text-6xl font-black text-slate-900 tabular-nums sm:text-7xl max-lg:landscape:my-1 max-lg:landscape:text-5xl dark:text-[#CCFF00] classic:text-[#1E4638]"
                        >
                          {parsedB ?? 0}
                        </motion.span>

                        <div className="flex w-full items-center gap-2">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.92 }}
                            disabled={(parsedB ?? 0) <= 0}
                            onClick={() => handleLiveScoreDelta('b', -1)}
                            className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                            aria-label={`Restar 1 a ${playerB?.name}`}
                          >
                            <Minus className="h-5 w-5" />
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.92 }}
                            onClick={() => handleLiveScoreDelta('b', 1)}
                            className="flex min-h-[48px] flex-[1.8] items-center justify-center gap-1 rounded-xl bg-emerald-600 text-base font-black text-white shadow-md hover:bg-emerald-700 dark:bg-[#CCFF00] dark:text-[#0B0E14] classic:border-2 classic:border-[#1E4638] classic:bg-[#D46F4D] classic:text-[#FBF5E8]"
                            aria-label={`Sumar 1 a ${playerB?.name}`}
                          >
                            <Plus className="h-5 w-5 stroke-[2.8]" />
                            <span>1</span>
                          </motion.button>
                        </div>
                      </div>
                    </div>

                    {/* Timeline de anotaciones en vivo */}
                    {liveEvents.length > 0 && (
                      <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 pr-1 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                            <Clock className="h-3 w-3" />
                            <span>Goles/Puntos:</span>
                          </span>
                          {liveEvents.slice(0, 10).map((ev) => (
                            <span
                              key={ev.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 dark:border-white/10 dark:bg-[#141923] dark:text-slate-200"
                            >
                              <span className="text-emerald-600 dark:text-[#CCFF00]">
                                {ev.time}
                              </span>
                              <span className="font-sans">{ev.who}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasValidExactInputs && aggregatePreview && (
                      <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2 text-center text-xs font-bold text-slate-700 dark:border-white/[0.08] dark:bg-[#0B0E14] dark:text-slate-200">
                        Marcador global: {playerA?.name} {aggregatePreview.aggA}{' '}
                        - {aggregatePreview.aggB} {playerB?.name}
                      </div>
                    )}
                  </motion.div>
                ) : mode === 'exact' ? (
                  <motion.div
                    key="mode-exact"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/75 p-4 dark:border-white/[0.08] dark:bg-[#0B0E14] classic:border-2 classic:border-[#1E4638] classic:bg-[#EFE2CC]">
                      <div className="min-w-0 text-center">
                        <label
                          htmlFor="score-a-input"
                          className="mb-2 block truncate text-sm font-bold text-slate-900 dark:text-white classic:text-[#1E4638]"
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
                          className="min-h-[54px] w-full rounded-xl border border-slate-200/90 bg-white py-2.5 text-center font-mono text-2xl font-black text-slate-900 tabular-nums focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none dark:border-white/10 dark:bg-[#141923] dark:text-white dark:focus:border-[#CCFF00]"
                        />
                      </div>

                      <span className="pt-6 text-lg font-extrabold text-slate-400">
                        -
                      </span>

                      <div className="min-w-0 text-center">
                        <label
                          htmlFor="score-b-input"
                          className="mb-2 block truncate text-sm font-bold text-slate-900 dark:text-white classic:text-[#1E4638]"
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
                          className="min-h-[54px] w-full rounded-xl border border-slate-200/90 bg-white py-2.5 text-center font-mono text-2xl font-black text-slate-900 tabular-nums focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none dark:border-white/10 dark:bg-[#141923] dark:text-white dark:focus:border-[#CCFF00]"
                        />
                      </div>
                    </div>

                    {hasValidExactInputs && !isKnockout && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl bg-slate-100/90 px-3.5 py-2 text-center text-xs font-bold text-slate-700 dark:bg-white/[0.06] dark:text-slate-200"
                      >
                        {parsedA > parsedB
                          ? `Ganador: ${playerA?.name} (+3 pts)`
                          : parsedB > parsedA
                          ? `Ganador: ${playerB?.name} (+3 pts)`
                          : leagueTiebreakerEnabled
                          ? 'Empate — definí ganador por desempate (+2 pts / +1 pt)'
                          : 'Empate (+1 pt para cada jugador)'}
                      </motion.div>
                    )}

                    {hasValidExactInputs && aggregatePreview && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2 text-center text-xs font-bold text-slate-700 dark:border-white/[0.08] dark:bg-[#0B0E14] dark:text-slate-200"
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
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 ring-2 ring-emerald-500/25 dark:border-[#CCFF00] dark:bg-[#CCFF00]/15 dark:text-[#CCFF00]'
                            : 'border-slate-200/90 bg-white/80 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200'
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
                              : 'border-slate-200/90 bg-white/80 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200'
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
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 ring-2 ring-emerald-500/25 dark:border-[#CCFF00] dark:bg-[#CCFF00]/15 dark:text-[#CCFF00]'
                            : 'border-slate-200/90 bg-white/80 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200'
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
                    className="mx-auto w-full max-w-lg overflow-hidden"
                  >
                    <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 p-3.5 dark:border-amber-500/35 dark:bg-amber-500/12">
                      <p className="mb-2.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                        {!isKnockout && leagueTiebreakerEnabled
                          ? 'Desempate (penales): +2 pts al ganador, +1 pt al perdedor'
                          : isTwoLegKnockout
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
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t border-slate-200/80 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 dark:border-white/[0.08] dark:bg-[#141923] classic:border-t-2 classic:border-[#1E4638] classic:bg-[#EFE2CC]">
              {match.status === 'completed' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleResetMatch}
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition active:bg-rose-100 hover:bg-rose-100 disabled:opacity-50 sm:w-auto dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Resetear a pendiente</span>
                </button>
              )}

              <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSafeClose}
                  className="min-h-[42px] flex-1 rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:flex-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="match-result-form"
                  disabled={saving}
                  className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-xs font-extrabold tracking-wider text-white uppercase shadow-md transition active:scale-[0.98] hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 sm:flex-none dark:bg-[#CCFF00] dark:bg-none dark:text-[#0B0E14] dark:hover:bg-[#d9ff33] classic:border-2 classic:border-[#1E4638] classic:bg-[#D46F4D] classic:bg-none classic:text-[#FBF5E8] classic:shadow-[2px_2px_0_#1E4638]"
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