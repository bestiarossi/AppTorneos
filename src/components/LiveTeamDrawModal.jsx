import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  FastForward,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { resolveParticipantAvatar } from '../utils/avatarUpload';
import { triggerChampionConfetti } from '../utils/confetti';
import { getPotBadgeColor } from '../utils/potBalancer';
import Avatar from './Avatar';

const TEAM_ACCENT_COLORS = [
  'border-emerald-400/70 bg-emerald-500/10 text-emerald-700 dark:border-[#CCFF00]/50 dark:bg-[#CCFF00]/10 dark:text-[#CCFF00] classic:border-[#1E4638] classic:bg-[#1E4638]/10 classic:text-[#1E4638]',
  'border-sky-400/70 bg-sky-500/10 text-sky-700 dark:border-[#2563EB]/60 dark:bg-[#2563EB]/15 dark:text-blue-300 classic:border-[#D46F4D] classic:bg-[#D46F4D]/15 classic:text-[#A94B2D]',
  'border-amber-400/70 bg-amber-500/10 text-amber-800 dark:border-amber-400/50 dark:bg-amber-400/12 dark:text-amber-300 classic:border-[#B68322] classic:bg-[#D9A441]/25 classic:text-[#7D5310]',
  'border-violet-400/70 bg-violet-500/10 text-violet-700 dark:border-violet-400/50 dark:bg-violet-500/15 dark:text-violet-300 classic:border-[#6B4E71] classic:bg-[#6B4E71]/15 classic:text-[#4F3554]',
  'border-rose-400/70 bg-rose-500/10 text-rose-700 dark:border-rose-400/50 dark:bg-rose-500/15 dark:text-rose-300 classic:border-[#B84A4A] classic:bg-[#B84A4A]/15 classic:text-[#8E3333]',
  'border-cyan-400/70 bg-cyan-500/10 text-cyan-800 dark:border-cyan-400/50 dark:bg-cyan-500/15 dark:text-cyan-300 classic:border-[#2D6A4F] classic:bg-[#2D6A4F]/15 classic:text-[#1E4638]',
];

export default function LiveTeamDrawModal({
  isOpen,
  onClose,
  teams = [],
  participants = [],
  targetAssignments = {},
  potMap = null,
  potSetName = '',
  onRequestReroll,
  onConfirmDraw,
}) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rouletteName, setRouletteName] = useState('');
  const [lastRevealed, setLastRevealed] = useState(null);
  const [autoPlay, setAutoPlay] = useState(false);

  const spinIntervalRef = useRef(null);
  const spinTimeoutRef = useRef(null);
  const autoTimerRef = useRef(null);

  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants]
  );

  const teamMap = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  // Ordena el bolillero por Bombo (1, 2, 3...) o al orden asignado
  const drawQueue = useMemo(() => {
    const items = participants
      .filter((p) => Boolean(targetAssignments[p.id]))
      .map((p) => ({
        participantId: p.id,
        teamId: targetAssignments[p.id],
        potNumber: potMap?.get(p.id) ?? 999,
      }));

    if (potMap && potMap.size > 0) {
      items.sort((a, b) => a.potNumber - b.potNumber);
    }

    return items;
  }, [participants, targetAssignments, potMap]);

  const totalToDraw = drawQueue.length;
  const isFinished = totalToDraw > 0 && revealedCount >= totalToDraw;

  const clearTimers = useCallback(() => {
    if (spinIntervalRef.current) {
      clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
    if (spinTimeoutRef.current) {
      clearTimeout(spinTimeoutRef.current);
      spinTimeoutRef.current = null;
    }
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  // Reset al abrir o re-sortear
  useEffect(() => {
    clearTimers();
    if (!isOpen) return;
    setRevealedCount(0);
    setIsSpinning(false);
    setRouletteName('');
    setLastRevealed(null);
    setAutoPlay(false);
  }, [isOpen, targetAssignments, clearTimers]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      clearTimers();
    };
  }, [isOpen, clearTimers]);

  const drawNextPlayer = useCallback(() => {
    if (isSpinning || revealedCount >= totalToDraw) return;

    const nextItem = drawQueue[revealedCount];
    if (!nextItem) return;

    const remainingPool = drawQueue
      .slice(revealedCount)
      .map((item) => participantMap.get(item.participantId)?.name || 'Jugador');

    setIsSpinning(true);

    let tick = 0;
    spinIntervalRef.current = setInterval(() => {
      const candidate =
        remainingPool[tick % Math.max(remainingPool.length, 1)] || '...';
      setRouletteName(candidate);
      tick += 1;
    }, 65);

    const spinDuration = remainingPool.length <= 1 ? 450 : 950;

    spinTimeoutRef.current = setTimeout(() => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }

      const nextCount = revealedCount + 1;
      setRevealedCount(nextCount);
      setLastRevealed(nextItem);
      setRouletteName('');
      setIsSpinning(false);

      if (nextCount >= totalToDraw) {
        setAutoPlay(false);
        triggerChampionConfetti();
      }
    }, spinDuration);
  }, [isSpinning, revealedCount, totalToDraw, drawQueue, participantMap]);

  // Modo automático
  useEffect(() => {
    if (!isOpen || !autoPlay || isSpinning || isFinished) return;

    autoTimerRef.current = setTimeout(() => {
      drawNextPlayer();
    }, 650);

    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [isOpen, autoPlay, isSpinning, isFinished, revealedCount, drawNextPlayer]);

  function handleSkipToEnd() {
    clearTimers();
    setIsSpinning(false);
    setAutoPlay(false);
    setRouletteName('');
    setRevealedCount(totalToDraw);
    setLastRevealed(drawQueue[totalToDraw - 1] || null);
    triggerChampionConfetti();
  }

  function handleConfirm() {
    clearTimers();
    onConfirmDraw?.(targetAssignments);
    onClose?.();
  }

  const revealedByTeam = useMemo(() => {
    const map = new Map(teams.map((t) => [t.id, []]));
    drawQueue.slice(0, revealedCount).forEach((item) => {
      const list = map.get(item.teamId);
      if (list) list.push(item);
    });
    return map;
  }, [teams, drawQueue, revealedCount]);

  const currentNextItem = drawQueue[revealedCount] || null;
  const activePotLabel =
    currentNextItem && currentNextItem.potNumber < 999
      ? `Bombo ${currentNextItem.potNumber}`
      : lastRevealed && lastRevealed.potNumber < 999
      ? `Bombo ${lastRevealed.potNumber}`
      : null;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[120] flex items-end justify-center bg-[#0B0E14]/85 p-0 backdrop-blur-md sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="glass-card flex h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:rounded-3xl"
          >
            {/* Header Broadcast */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/[0.08] classic:border-b-2 classic:border-[#1E4638] classic:bg-[#1E4638]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-[#CCFF00] dark:text-[#0B0E14] classic:border-2 classic:border-[#FBF5E8] classic:bg-[#D46F4D] classic:text-[#FBF5E8]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-rose-600 uppercase dark:bg-[#CCFF00]/20 dark:text-[#CCFF00] classic:bg-[#D9A441] classic:text-[#1E4638]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                      EN VIVO
                    </span>
                    {potSetName && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 classic:bg-[#FBF5E8]/20 classic:text-[#FBF5E8]">
                        <Layers className="h-3 w-3" />
                        {potSetName}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-0.5 text-base font-black tracking-tight text-slate-900 uppercase sm:text-lg dark:text-white classic:text-[#FBF5E8]">
                    Sorteo Oficial de Equipos
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  clearTimers();
                  onClose();
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white classic:text-[#FBF5E8] classic:hover:bg-[#285947]"
                aria-label="Cerrar sorteo"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
              {/* Escenario del Bolillero */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-900 px-5 py-6 text-center text-white shadow-inner dark:border-white/[0.08] dark:bg-[#0B0E14] classic:border-2 classic:border-[#1E4638] classic:bg-[#1E4638]">
                <div className="pointer-events-none absolute -top-20 left-1/2 h-44 w-72 -translate-x-1/2 rounded-full bg-[#CCFF00]/15 blur-3xl classic:bg-[#D9A441]/25" />

                <div className="relative z-10 flex flex-col items-center">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-0.5 font-mono text-[11px] font-bold text-slate-200 tabular-nums">
                      {revealedCount} / {totalToDraw} sorteados
                    </span>
                    {activePotLabel && !isFinished && (
                      <span className="rounded-full border border-amber-400/40 bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-300 uppercase">
                        {activePotLabel}
                      </span>
                    )}
                  </div>

                  <div className="flex min-h-[112px] w-full max-w-md flex-col items-center justify-center">
                    <AnimatePresence mode="wait">
                      {isSpinning ? (
                        <motion.div
                          key="spinning"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 1.08 }}
                          className="flex flex-col items-center"
                        >
                          <span className="text-[10px] font-bold tracking-widest text-[#CCFF00] uppercase classic:text-[#D9A441]">
                            Girando bolillero...
                          </span>
                          <motion.p
                            animate={{ y: [0, -3, 0] }}
                            transition={{ repeat: Infinity, duration: 0.16 }}
                            className="mt-2 text-2xl font-black tracking-tight text-white uppercase sm:text-3xl"
                          >
                            {rouletteName || '...'}
                          </motion.p>
                        </motion.div>
                      ) : isFinished ? (
                        <motion.div
                          key="finished"
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                          className="flex flex-col items-center"
                        >
                          <span className="rounded-full bg-[#CCFF00] px-3 py-1 text-[11px] font-black tracking-wider text-[#0B0E14] uppercase classic:bg-[#D9A441] classic:text-[#1E4638]">
                            ¡Sorteo Completado!
                          </span>
                          <p className="mt-2.5 text-xl font-black tracking-tight text-white uppercase sm:text-2xl">
                            Todos los equipos están listos
                          </p>
                          <p className="mt-1 text-xs text-slate-300">
                            Confirmá abajo para guardar esta formación o sorteá de nuevo.
                          </p>
                        </motion.div>
                      ) : lastRevealed ? (
                        <motion.div
                          key={`revealed-${lastRevealed.participantId}`}
                          initial={{ opacity: 0, scale: 0.72, y: 14 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                          className="flex flex-col items-center"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={
                                participantMap.get(lastRevealed.participantId)
                                  ?.name || ''
                              }
                              url={resolveParticipantAvatar(
                                participantMap.get(lastRevealed.participantId)
                              )}
                              size="lg"
                              highlight
                            />
                            <div className="text-left">
                              <p className="text-xl font-black tracking-tight text-white uppercase sm:text-2xl">
                                {
                                  participantMap.get(lastRevealed.participantId)
                                    ?.name
                                }
                              </p>
                              <p className="mt-0.5 text-xs font-extrabold tracking-wider text-[#CCFF00] uppercase classic:text-[#D9A441]">
                                → Va para{' '}
                                {teamMap.get(lastRevealed.teamId)?.name ||
                                  'Equipo'}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="ready"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center"
                        >
                          <p className="text-lg font-extrabold tracking-tight text-white uppercase sm:text-xl">
                            ¿Listos para el sorteo?
                          </p>
                          <p className="mt-1 text-xs text-slate-300">
                            Tocá <strong>Sacar bolilla</strong> o activá el modo{' '}
                            <strong>Automático</strong> para ir revelando uno por uno.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Controles del Bolillero */}
                  {!isFinished && (
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        disabled={isSpinning}
                        onClick={drawNextPlayer}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#CCFF00] px-5 py-2.5 text-xs font-black tracking-wider text-[#0B0E14] uppercase shadow-lg shadow-[#CCFF00]/20 transition hover:bg-[#d9ff33] disabled:opacity-50 classic:border-2 classic:border-[#FBF5E8] classic:bg-[#D46F4D] classic:text-[#FBF5E8] classic:shadow-none"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>
                          {revealedCount === 0
                            ? 'Sacar primera bolilla'
                            : 'Sacar siguiente'}
                        </span>
                      </motion.button>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setAutoPlay((prev) => !prev)}
                        className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-extrabold tracking-wider uppercase transition ${
                          autoPlay
                            ? 'border-amber-400/60 bg-amber-400/20 text-amber-200'
                            : 'border-white/15 bg-white/10 text-white hover:bg-white/15'
                        }`}
                      >
                        {autoPlay ? (
                          <>
                            <Pause className="h-3.5 w-3.5" />
                            <span>Pausar</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5" />
                            <span>Automático</span>
                          </>
                        )}
                      </motion.button>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={handleSkipToEnd}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
                      >
                        <FastForward className="h-3.5 w-3.5" />
                        <span>Revelar todo</span>
                      </motion.button>
                    </div>
                  )}
                </div>
              </div>

              {/* Grilla de Equipos llenándose en vivo */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map((team, idx) => {
                  const members = revealedByTeam.get(team.id) || [];
                  const accentClass =
                    TEAM_ACCENT_COLORS[idx % TEAM_ACCENT_COLORS.length];
                  const isJustUpdated =
                    lastRevealed?.teamId === team.id && !isSpinning;

                  return (
                    <motion.div
                      key={team.id}
                      layout
                      animate={
                        isJustUpdated ? { scale: [1, 1.03, 1] } : { scale: 1 }
                      }
                      transition={{ duration: 0.3 }}
                      className={`rounded-2xl border p-3.5 transition ${
                        isJustUpdated
                          ? 'border-emerald-400 bg-emerald-50/50 shadow-md dark:border-[#CCFF00]/60 dark:bg-[#CCFF00]/[0.06] classic:border-2 classic:border-[#D46F4D] classic:bg-[#FBF5E8]'
                          : 'border-slate-200/90 bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.03] classic:border-2 classic:border-[#1E4638] classic:bg-[#FBF5E8]'
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-extrabold tracking-tight uppercase ${accentClass}`}
                        >
                          <Users className="h-3.5 w-3.5" />
                          <span className="truncate">{team.name}</span>
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-500 tabular-nums dark:text-slate-400">
                          {members.length}
                        </span>
                      </div>

                      {members.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 py-4 text-center text-[11px] font-medium text-slate-400 dark:border-white/10">
                          Esperando bolillas...
                        </div>
                      ) : (
                        <ul className="space-y-1.5">
                          <AnimatePresence initial={false}>
                            {members.map((item) => {
                              const player = participantMap.get(
                                item.participantId
                              );
                              return (
                                <motion.li
                                  key={item.participantId}
                                  initial={{ opacity: 0, x: -12, scale: 0.9 }}
                                  animate={{ opacity: 1, x: 0, scale: 1 }}
                                  transition={{
                                    type: 'spring',
                                    stiffness: 420,
                                    damping: 26,
                                  }}
                                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-slate-50/90 px-2.5 py-1.5 dark:border-white/[0.06] dark:bg-[#141923] classic:border-[#1E4638]/20 classic:bg-[#EFE2CC]"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Avatar
                                      name={player?.name || ''}
                                      url={resolveParticipantAvatar(player)}
                                      size="xs"
                                    />
                                    <span className="truncate text-xs font-bold text-slate-900 dark:text-white classic:text-[#1E4638]">
                                      {player?.name || 'Jugador'}
                                    </span>
                                  </div>
                                  {item.potNumber < 999 && (
                                    <span
                                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold ${getPotBadgeColor(
                                        item.potNumber
                                      )}`}
                                    >
                                      B{item.potNumber}
                                    </span>
                                  )}
                                </motion.li>
                              );
                            })}
                          </AnimatePresence>
                        </ul>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Footer de confirmación */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t border-slate-200/80 bg-white/95 px-5 py-3.5 pb-[max(0.85rem,env(safe-area-inset-bottom))] dark:border-white/[0.08] dark:bg-[#141923] classic:border-t-2 classic:border-[#1E4638] classic:bg-[#EFE2CC]">
              {onRequestReroll ? (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  disabled={isSpinning}
                  onClick={onRequestReroll}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.1] dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 classic:border-2 classic:border-[#1E4638] classic:bg-[#FBF5E8] classic:text-[#1E4638]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Sortear de nuevo</span>
                </motion.button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearTimers();
                    onClose();
                  }}
                  className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/[0.1] dark:bg-white/5 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  disabled={!isFinished}
                  onClick={handleConfirm}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-extrabold tracking-wider text-white uppercase shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#CCFF00] dark:text-[#0B0E14] dark:hover:bg-[#d9ff33] classic:border-2 classic:border-[#1E4638] classic:bg-[#D46F4D] classic:text-[#FBF5E8] classic:shadow-[2px_2px_0_#1E4638]"
                >
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  <span>Confirmar equipos</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}