import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validateGroupStageConfig } from '../utils/tournamentEngine';
import { TOURNAMENT_FORMAT_LIST } from '../utils/tournamentFormats';
import { TOURNAMENT_SPORT_LIST } from '../utils/tournamentThemes';
import { useToast } from './ToastProvider';

const MEETINGS_PRESETS = [
  { value: 1, label: '1 vuelta' },
  { value: 2, label: '2 (Ida/Vuelta)' },
  { value: 3, label: '3 vueltas' },
  { value: 4, label: '4 vueltas' },
];

export default function CreateTournamentModal({
  isOpen,
  onClose,
  userId,
  onCreated,
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [sport, setSport] = useState('football');
  const [format, setFormat] = useState('league');
  const [isTeamBased, setIsTeamBased] = useState(false);
  const [homeAndAway, setHomeAndAway] = useState(false);
  const [meetingsPerPair, setMeetingsPerPair] = useState('1');
  const [leagueTiebreaker, setLeagueTiebreaker] = useState(false);
  const [thirdPlace, setThirdPlace] = useState(false);
  const [rounds, setRounds] = useState('');
  const [initialLives, setInitialLives] = useState('1');
  const [notes, setNotes] = useState('');
  const [allowSelfJoin, setAllowSelfJoin] = useState(true);

  // Opciones específicas de 'group_stage'
  const [groupCount, setGroupCount] = useState('2');
  const [directPerGroup, setDirectPerGroup] = useState('2');
  const [playoffPerGroup, setPlayoffPerGroup] = useState('0');
  const [bestThirdsCount, setBestThirdsCount] = useState('0');
  const [bestThirdsDest, setBestThirdsDest] = useState('direct');
  const [groupHomeAndAway, setGroupHomeAndAway] = useState(false);
  const [koHomeAndAway, setKoHomeAndAway] = useState(false);

  const [participantInput, setParticipantInput] = useState('');
  const [participants, setParticipants] = useState([]);
  const [participantError, setParticipantError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const participantInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  function resetForm() {
    setName('');
    setSport('football');
    setFormat('league');
    setIsTeamBased(false);
    setHomeAndAway(false);
    setMeetingsPerPair('1');
    setLeagueTiebreaker(false);
    setThirdPlace(false);
    setRounds('');
    setInitialLives('1');
    setNotes('');
    setAllowSelfJoin(true);
    setGroupCount('2');
    setDirectPerGroup('2');
    setPlayoffPerGroup('0');
    setBestThirdsCount('0');
    setBestThirdsDest('direct');
    setGroupHomeAndAway(false);
    setKoHomeAndAway(false);
    setParticipantInput('');
    setParticipants([]);
    setParticipantError('');
    setError('');
  }

  function handleSafeClose() {
    if (submitting) return;
    resetForm();
    onClose();
  }

  function handleAddParticipant() {
    setParticipantError('');
    const trimmed = participantInput.trim();
    if (!trimmed) {
      setParticipantError('Escribe el nombre del participante antes de agregarlo.');
      return;
    }

    const exists = participants.some(
      (p) => p.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setParticipantError('Ese nombre ya fue agregado a la lista.');
      return;
    }

    setParticipants((prev) => [...prev, trimmed]);
    setParticipantInput('');
    participantInputRef.current?.focus();
  }

  function handleParticipantKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddParticipant();
    }
  }

  function handleRemoveParticipant(index) {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  const groupStageValidation = useMemo(() => {
    if (format !== 'group_stage') return null;
    return validateGroupStageConfig({
      group_count: groupCount,
      direct_per_group: directPerGroup,
      playoff_per_group: playoffPerGroup,
      best_thirds_count: bestThirdsCount,
      best_thirds_destination: bestThirdsDest,
    });
  }, [
    format,
    groupCount,
    directPerGroup,
    playoffPerGroup,
    bestThirdsCount,
    bestThirdsDest,
  ]);

  function buildConfig() {
    const parsedRounds = rounds.trim() ? Number.parseInt(rounds.trim(), 10) : null;
    const base = {
      sport,
      allow_self_join: allowSelfJoin,
      is_team_based: format === 'custom' ? false : isTeamBased,
    };

    if (format === 'league') {
      const parsedMeetings = Math.max(
        1,
        Math.min(10, Number.parseInt(meetingsPerPair || '1', 10) || 1)
      );
      return {
        ...base,
        meetings_per_pair: parsedMeetings,
        home_and_away: parsedMeetings >= 2,
        league_tiebreaker: leagueTiebreaker,
        ...(parsedRounds ? { rounds: parsedRounds } : {}),
      };
    }

    if (format === 'knockout') {
      return {
        ...base,
        home_and_away: homeAndAway,
        third_place: thirdPlace,
      };
    }

    if (format === 'group_stage') {
      const gc = Math.max(1, Number.parseInt(groupCount || '2', 10) || 2);
      const dp = Math.max(0, Number.parseInt(directPerGroup || '0', 10) || 0);
      const pp = Math.max(0, Number.parseInt(playoffPerGroup || '0', 10) || 0);
      const bt = Math.max(0, Number.parseInt(bestThirdsCount || '0', 10) || 0);
      return {
        ...base,
        group_count: gc,
        direct_per_group: dp,
        playoff_per_group: pp,
        best_thirds_count: bt,
        best_thirds_destination: bestThirdsDest,
        group_home_and_away: groupHomeAndAway,
        knockout_home_and_away: koHomeAndAway,
        league_tiebreaker: leagueTiebreaker,
        third_place: thirdPlace,
      };
    }

    if (format === 'last_standing') {
      const parsedLives = Number.parseInt(initialLives.trim() || '1', 10);
      return {
        ...base,
        initial_lives: Number.isNaN(parsedLives) || parsedLives < 1 ? 1 : parsedLives,
        ...(parsedRounds ? { rounds: parsedRounds } : {}),
      };
    }

    return {
      ...base,
      ...(parsedRounds ? { rounds: parsedRounds } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    if (!cleanName) {
      setError('El torneo necesita un nombre.');
      return;
    }

    if (format === 'group_stage' && groupStageValidation && !groupStageValidation.isValid) {
      setError(groupStageValidation.errors[0]);
      return;
    }

    if (rounds.trim()) {
      const parsedRounds = Number.parseInt(rounds.trim(), 10);
      if (Number.isNaN(parsedRounds) || parsedRounds < 1) {
        setError('La cantidad de jornadas debe ser un número mayor a 0.');
        return;
      }
    }

    if (format === 'last_standing') {
      const parsedLives = Number.parseInt(initialLives.trim(), 10);
      if (Number.isNaN(parsedLives) || parsedLives < 1) {
        setError('Las vidas iniciales deben ser al menos 1.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const config = buildConfig();

      const { data: createdTournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert({
          name: cleanName,
          format,
          config,
          created_by: userId,
        })
        .select()
        .single();

      if (tournamentError) {
        throw tournamentError;
      }

      if (participants.length > 0) {
        const participantRows = participants.map((participantName) => ({
          tournament_id: createdTournament.id,
          name: participantName,
        }));

        const { error: participantsError } = await supabase
          .from('tournament_participants')
          .insert(participantRows);

        if (participantsError) {
          throw participantsError;
        }
      }

      toast.success(`¡Torneo "${cleanName}" creado!`);
      resetForm();
      onCreated(createdTournament.id);
    } catch (err) {
      setError(err?.message || 'No se pudo crear el torneo. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="create-tournament-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/65 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleSafeClose();
          }}
        >
          <motion.div
            key="create-tournament-dialog"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="glass-card flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 sm:px-6 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Crear nuevo torneo
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Quedarás registrado como Creador (Owner)
                  </p>
                </div>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={handleSafeClose}
                disabled={submitting}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6"
            >
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label
                  htmlFor="tournament-name"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                >
                  Nombre del torneo *
                </label>
                <input
                  id="tournament-name"
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Copa Amigos 2026, Mundialito..."
                  className="w-full rounded-xl border border-slate-200/90 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-slate-700/80 dark:bg-slate-950/70 dark:text-slate-100"
                />
              </div>

              <div>
                <span className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Deporte / Temática</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {TOURNAMENT_SPORT_LIST.map((item) => {
                    const selected = sport === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSport(item.id)}
                        className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                          selected
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:text-emerald-200'
                            : 'border-slate-200/90 bg-white/75 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-base leading-none">{item.emoji}</span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  Formato *
                </span>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {TOURNAMENT_FORMAT_LIST.map((item) => {
                    const selected = format === item.value;
                    return (
                      <motion.button
                        key={item.value}
                        type="button"
                        whileTap={{ scale: 0.985 }}
                        onClick={() => setFormat(item.value)}
                        className={`min-h-[44px] rounded-2xl border p-3.5 text-left transition-colors ${
                          selected
                            ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/25 dark:border-emerald-400 dark:bg-emerald-500/15'
                            : 'border-slate-200/90 bg-white/70 hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-slate-700 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {item.label}
                          </span>
                          <span
                            className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                              selected
                                ? 'border-emerald-600 bg-emerald-500 dark:border-emerald-400'
                                : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
                            }`}
                          />
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {item.description}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {format !== 'custom' && (
                <div>
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Modalidad de participación
                  </span>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsTeamBased(false)}
                      className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition active:scale-[0.99] ${
                        !isTeamBased
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-200'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300'
                      }`}
                    >
                      <User className="h-4 w-4 shrink-0" />
                      <span>Individual</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsTeamBased(true)}
                      className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition active:scale-[0.99] ${
                        isTeamBased
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-200'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300'
                      }`}
                    >
                      <Users className="h-4 w-4 shrink-0" />
                      <span>Por Equipos</span>
                    </button>
                  </div>

                  <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-sky-200/80 bg-sky-50/70 p-3 text-xs leading-relaxed text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/12 dark:text-sky-200">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                    <span>
                      {isTeamBased
                        ? 'En modo Por Equipos, primero anotás a los jugadores individuales y luego dentro del torneo tendrás un apartado dedicado "Equipos" para definir cantidad, usar bombos y hacer sorteo manual, rápido o en vivo.'
                        : 'Si ya tienen los equipos armados o no les interesa anotar a cada jugador individualmente, pueden usar el modo Individual directamente (anotando cada equipo como un participante).'}
                    </span>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  Opciones del formato
                </h3>

                <AnimatePresence mode="wait">
                  {format === 'league' && (
                    <motion.div
                      key="opts-league"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16 }}
                      className="space-y-3"
                    >
                      <div>
                        <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">
                          Encuentros contra cada rival (vueltas)
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {MEETINGS_PRESETS.map((opt) => {
                            const active =
                              String(opt.value) === String(meetingsPerPair);
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() =>
                                  setMeetingsPerPair(String(opt.value))
                                }
                                className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                                  active
                                    ? 'border-emerald-500 bg-emerald-600 text-white'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={meetingsPerPair}
                            onChange={(e) => setMeetingsPerPair(e.target.value)}
                            aria-label="Cantidad personalizada de vueltas"
                            className="h-[38px] w-16 rounded-xl border border-slate-200 bg-white px-2 text-center font-mono text-sm font-black text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200/90 bg-white/90 px-3.5 py-2.5 transition hover:border-emerald-400/60 dark:border-slate-700/80 dark:bg-slate-900/80">
                          <input
                            type="checkbox"
                            checked={leagueTiebreaker}
                            onChange={(e) =>
                              setLeagueTiebreaker(e.target.checked)
                            }
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                              Desempate por penales (3 / 2 / 1)
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              Ganar 3 pts · Ganar desempate 2 · Perder desempate 1
                            </span>
                          </div>
                        </label>

                        <div>
                          <label
                            htmlFor="league-rounds"
                            className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                          >
                            Límite de fechas (opcional)
                          </label>
                          <input
                            id="league-rounds"
                            type="number"
                            min={1}
                            max={99}
                            value={rounds}
                            onChange={(e) => setRounds(e.target.value)}
                            placeholder="Automático"
                            className="w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {format === 'knockout' && (
                    <motion.div
                      key="opts-knockout"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16 }}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                    >
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white/90 px-3.5 py-2.5 transition hover:border-emerald-400/60 dark:border-slate-700/80 dark:bg-slate-900/80">
                        <input
                          type="checkbox"
                          checked={homeAndAway}
                          onChange={(e) => setHomeAndAway(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          Cruces a ida y vuelta
                        </span>
                      </label>

                      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white/90 px-3.5 py-2.5 transition hover:border-emerald-400/60 dark:border-slate-700/80 dark:bg-slate-900/80">
                        <input
                          type="checkbox"
                          checked={thirdPlace}
                          onChange={(e) => setThirdPlace(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          Partido por el 3.º puesto
                        </span>
                      </label>
                    </motion.div>
                  )}

                  {format === 'group_stage' && (
                    <motion.div
                      key="opts-group-stage"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16 }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            Cant. grupos
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={16}
                            value={groupCount}
                            onChange={(e) => setGroupCount(e.target.value)}
                            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-base font-extrabold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            Directos / grupo
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={directPerGroup}
                            onChange={(e) => setDirectPerGroup(e.target.value)}
                            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-base font-extrabold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            A Playoff / grupo
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={playoffPerGroup}
                            onChange={(e) => setPlayoffPerGroup(e.target.value)}
                            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-base font-extrabold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            Mejores{' '}
                            {Number(directPerGroup || 0) +
                              Number(playoffPerGroup || 0) +
                              1}
                            .º
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={16}
                            value={bestThirdsCount}
                            onChange={(e) => setBestThirdsCount(e.target.value)}
                            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-base font-extrabold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      {Number(bestThirdsCount || 0) > 0 && (
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                          <span className="font-bold text-slate-600 dark:text-slate-300">
                            ¿A dónde van los mejores terceros?
                          </span>
                          <button
                            type="button"
                            onClick={() => setBestThirdsDest('direct')}
                            className={`min-h-[36px] rounded-lg px-2.5 py-1 font-bold transition ${
                              bestThirdsDest === 'direct'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            Directo a llave final
                          </button>
                          <button
                            type="button"
                            onClick={() => setBestThirdsDest('playoff')}
                            className={`min-h-[36px] rounded-lg px-2.5 py-1 font-bold transition ${
                              bestThirdsDest === 'playoff'
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            Al Playoff
                          </button>
                        </div>
                      )}

                      {groupStageValidation && (
                        <div
                          className={`rounded-xl border p-3 text-xs ${
                            groupStageValidation.isValid
                              ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200'
                              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200'
                          }`}
                        >
                          {groupStageValidation.isValid ? (
                            <div className="space-y-1">
                              <p className="flex items-center gap-1.5 font-extrabold">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                <span>
                                  {groupStageValidation.parsed.totalPlayoff > 0
                                    ? `${groupStageValidation.parsed.totalDirect} dir. + ${groupStageValidation.parsed.totalPlayoff} Playoff → ${groupStageValidation.parsed.mainBracketCount} en llave final (Potencia de 2 ✓)`
                                    : `Total clasificados: ${groupStageValidation.parsed.totalDirect} (Potencia de 2 ✓)`}
                                </span>
                              </p>
                              <p className="text-[11px] opacity-90">
                                Fase final: {groupStageValidation.bracketPreview}
                              </p>
                            </div>
                          ) : (
                            <p className="flex items-start gap-1.5 font-bold">
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>{groupStageValidation.errors[0]}</span>
                            </p>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={groupHomeAndAway}
                            onChange={(e) => setGroupHomeAndAway(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                          />
                          <span>Grupos ida y vuelta</span>
                        </label>
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={koHomeAndAway}
                            onChange={(e) => setKoHomeAndAway(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                          />
                          <span>Elim. ida y vuelta</span>
                        </label>
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={leagueTiebreaker}
                            onChange={(e) => setLeagueTiebreaker(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                          />
                          <span>Desempate grupos (3/2/1)</span>
                        </label>
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={thirdPlace}
                            onChange={(e) => setThirdPlace(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                          />
                          <span>Con 3.º puesto</span>
                        </label>
                      </div>
                    </motion.div>
                  )}

                  {format === 'last_standing' && (
                    <motion.div
                      key="opts-last-standing"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16 }}
                      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                    >
                      <div>
                        <label
                          htmlFor="ls-lives"
                          className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                        >
                          Vidas iniciales
                        </label>
                        <input
                          id="ls-lives"
                          type="number"
                          min={1}
                          max={10}
                          value={initialLives}
                          onChange={(e) => setInitialLives(e.target.value)}
                          className="w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-base text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="ls-rounds"
                          className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                        >
                          Máximo de jornadas (opcional)
                        </label>
                        <input
                          id="ls-rounds"
                          type="number"
                          min={1}
                          max={99}
                          value={rounds}
                          onChange={(e) => setRounds(e.target.value)}
                          placeholder="Hasta quedar 1"
                          className="w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100"
                        />
                      </div>
                    </motion.div>
                  )}

                  {format === 'custom' && (
                    <motion.div
                      key="opts-custom"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16 }}
                      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                    >
                      <div>
                        <label
                          htmlFor="custom-rounds"
                          className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                        >
                          Cantidad de jornadas (opcional)
                        </label>
                        <input
                          id="custom-rounds"
                          type="number"
                          min={1}
                          max={99}
                          value={rounds}
                          onChange={(e) => setRounds(e.target.value)}
                          placeholder="Ej: 6"
                          className="w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="custom-notes"
                          className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                        >
                          Regla o detalle corto (opcional)
                        </label>
                        <input
                          id="custom-notes"
                          type="text"
                          maxLength={80}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Ej: Puntos extra por diferencia"
                          className="w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white/90 px-3.5 py-2 text-xs font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={allowSelfJoin}
                    onChange={(e) => setAllowSelfJoin(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Permitir que nuevos invitados se anoten solos desde el link</span>
                </label>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="participant-name-input"
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Participantes iniciales ({participants.length})</span>
                  </label>
                  <span className="text-xs text-slate-400">
                    También podrás agregar más luego
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    ref={participantInputRef}
                    id="participant-name-input"
                    type="text"
                    maxLength={50}
                    value={participantInput}
                    onChange={(e) => {
                      setParticipantInput(e.target.value);
                      if (participantError) setParticipantError('');
                    }}
                    onKeyDown={handleParticipantKeyDown}
                    placeholder="Nombre del jugador (ej: Santi, Mateo...)"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200/90 bg-white/90 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-slate-700/80 dark:bg-slate-950/70 dark:text-slate-100"
                  />
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={handleAddParticipant}
                    className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Agregar</span>
                  </motion.button>
                </div>

                {participantError && (
                  <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                    {participantError}
                  </p>
                )}

                {participants.length > 0 ? (
                  <ul className="mt-3 max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/50">
                    <AnimatePresence initial={false}>
                      {participants.map((pName, index) => (
                        <motion.li
                          layout
                          key={pName}
                          initial={{ opacity: 0, x: -10, scale: 0.97 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: 12, scale: 0.95 }}
                          transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 28,
                          }}
                          className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/90"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                              {index + 1}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {pName}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(index)}
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-400"
                            aria-label={`Quitar a ${pName}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                ) : (
                  <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400">
                    Escribe un nombre arriba y presiona <strong>Enter</strong> o haz
                    clic en <strong>Agregar</strong> para ir armando la lista de
                    jugadores.
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200/80 pt-4 sm:flex-row sm:justify-end dark:border-slate-800">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={handleSafeClose}
                  disabled={submitting}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancelar
                </motion.button>
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.96 }}
                  disabled={
                    submitting ||
                    (format === 'group_stage' &&
                      groupStageValidation &&
                      !groupStageValidation.isValid)
                  }
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{submitting ? 'Creando torneo...' : 'Crear Torneo'}</span>
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}