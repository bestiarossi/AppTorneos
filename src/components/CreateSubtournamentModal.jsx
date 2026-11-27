import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Info,
  Loader2,
  Square,
  Tag,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  SUBTOURNAMENT_CATEGORY_PRESETS,
  SUBTOURNAMENT_FORMAT_LIST,
  buildDefaultPointsScale,
  generateSubtournamentMatches,
} from '../utils/customTournamentEngine';
import { validateGroupStageConfig } from '../utils/tournamentEngine';

const MEETINGS_PRESETS = [
  { value: 1, label: '1 vuelta' },
  { value: 2, label: '2 (Ida/Vuelta)' },
  { value: 3, label: '3 vueltas' },
  { value: 4, label: '4 vueltas' },
];

export default function CreateSubtournamentModal({
  isOpen,
  matchday,
  tournamentId,
  participants,
  potSets = [],
  potAssignments = [],
  existingCategories = [],
  disableEscape = false,
  onOpenPotManager,
  onClose,
  onCreated,
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [format, setFormat] = useState('league');
  const [homeAndAway, setHomeAndAway] = useState(false);
  const [meetingsPerPair, setMeetingsPerPair] = useState('1');
  const [leagueTiebreaker, setLeagueTiebreaker] = useState(false);
  const [thirdPlace, setThirdPlace] = useState(false);

  // Opciones específicas cuando format === 'group_stage'
  const [groupCount, setGroupCount] = useState('2');
  const [directPerGroup, setDirectPerGroup] = useState('2');
  const [playoffPerGroup, setPlayoffPerGroup] = useState('0');
  const [bestThirdsCount, setBestThirdsCount] = useState('0');
  const [bestThirdsDest, setBestThirdsDest] = useState('direct');
  const [groupHomeAndAway, setGroupHomeAndAway] = useState(false);
  const [koHomeAndAway, setKoHomeAndAway] = useState(false);

  const [selectedParticipantIds, setSelectedParticipantIds] = useState([]);
  const [isTeamBased, setIsTeamBased] = useState(false);
  const [pointsScale, setPointsScale] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const suggestedCategories = useMemo(() => {
    const set = new Set([...existingCategories, ...SUBTOURNAMENT_CATEGORY_PRESETS]);
    return Array.from(set).filter(Boolean);
  }, [existingCategories]);

  useEffect(() => {
    if (!isOpen) return;

    const allIds = participants.map((p) => p.id);
    setName('');
    setCategory('');
    setFormat('league');
    setHomeAndAway(false);
    setMeetingsPerPair('1');
    setLeagueTiebreaker(false);
    setThirdPlace(false);
    setGroupCount('2');
    setDirectPerGroup('2');
    setPlayoffPerGroup('0');
    setBestThirdsCount('0');
    setBestThirdsDest('direct');
    setGroupHomeAndAway(false);
    setKoHomeAndAway(false);
    setSelectedParticipantIds(allIds);
    setIsTeamBased(false);
    setPointsScale(buildDefaultPointsScale(allIds.length));
    setError('');
    setSubmitting(false);
  }, [isOpen, participants]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || disableEscape) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, disableEscape, submitting, onClose]);

  const competitorCount = isTeamBased
    ? Math.max(2, Math.floor(selectedParticipantIds.length / 2))
    : selectedParticipantIds.length;

  useEffect(() => {
    if (!isOpen) return;
    setPointsScale((prev) => buildDefaultPointsScale(competitorCount, prev));
  }, [competitorCount, isOpen]);

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

  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants]
  );

  const selectedSet = useMemo(
    () => new Set(selectedParticipantIds),
    [selectedParticipantIds]
  );

  function toggleParticipant(participantId) {
    setSelectedParticipantIds((prev) => {
      if (prev.includes(participantId)) {
        return prev.filter((id) => id !== participantId);
      }
      return [...prev, participantId];
    });
  }

  function selectAllParticipants() {
    setSelectedParticipantIds(participants.map((p) => p.id));
  }

  function clearAllParticipants() {
    setSelectedParticipantIds([]);
  }

  function handlePointInputChange(index, value) {
    setPointsScale((prev) =>
      prev.map((item, idx) => (idx === index ? value : item))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Ingresa un nombre para el subtorneo.');
      return;
    }

    if (selectedParticipantIds.length < 2) {
      setError('Selecciona al menos 2 participantes para crear el subtorneo.');
      return;
    }

    if (format === 'group_stage' && groupStageValidation && !groupStageValidation.isValid) {
      setError(groupStageValidation.errors[0]);
      return;
    }

    const parsedScale = [];
    for (let i = 0; i < competitorCount; i += 1) {
      const rawVal = pointsScale[i];
      const numVal = Number(String(rawVal ?? 0).trim() || 0);
      if (Number.isNaN(numVal) || numVal < 0) {
        setError(
          `El puntaje del ${i + 1}.º puesto debe ser un número válido (>= 0).`
        );
        return;
      }
      parsedScale.push(numVal);
    }

    const cleanCategory = category.trim() || null;

    let config = {
      is_team_based: isTeamBased,
      ...(isTeamBased ? { selected_participant_ids: selectedParticipantIds } : {}),
      ...(cleanCategory ? { category: cleanCategory } : {}),
    };

    if (format === 'league') {
      const parsedMeetings = Math.max(
        1,
        Math.min(10, Number.parseInt(meetingsPerPair || '1', 10) || 1)
      );
      config.meetings_per_pair = parsedMeetings;
      config.home_and_away = parsedMeetings >= 2;
      config.league_tiebreaker = leagueTiebreaker;
    } else if (format === 'knockout') {
      config.home_and_away = homeAndAway;
      config.third_place = thirdPlace && (isTeamBased || competitorCount >= 4);
    } else if (format === 'group_stage') {
      const gc = Math.max(1, Number.parseInt(groupCount || '2', 10) || 2);
      const dp = Math.max(0, Number.parseInt(directPerGroup || '2', 10) || 0);
      const pp = Math.max(0, Number.parseInt(playoffPerGroup || '0', 10) || 0);
      const bt = Math.max(0, Number.parseInt(bestThirdsCount || '0', 10) || 0);

      config = {
        ...config,
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

    setSubmitting(true);
    let createdSubId = null;

    try {
      const { data: createdSub, error: subError } = await supabase
        .from('subtournaments')
        .insert({
          tournament_id: tournamentId,
          matchday_id: matchday.id,
          name: cleanName,
          category: cleanCategory,
          format,
          config,
          points_scale: parsedScale,
          status: 'active',
        })
        .select()
        .single();

      if (subError) throw subError;
      createdSubId = createdSub.id;

      if (!isTeamBased) {
        const entryPayloads = selectedParticipantIds.map((pId) => ({
          subtournament_id: createdSub.id,
          entry_name: participantMap.get(pId)?.name || 'Jugador',
          participant_id: pId,
        }));

        const { data: createdEntries, error: entriesError } = await supabase
          .from('subtournament_entries')
          .insert(entryPayloads)
          .select();

        if (entriesError) throw entriesError;

        const memberPayloads = [];
        createdEntries.forEach((entry) => {
          if (entry.participant_id) {
            memberPayloads.push({
              entry_id: entry.id,
              participant_id: entry.participant_id,
            });
          }
        });

        if (memberPayloads.length > 0) {
          const { error: membersError } = await supabase
            .from('subtournament_entry_members')
            .insert(memberPayloads);

          if (membersError) throw membersError;
        }

        if (
          format === 'league' ||
          format === 'knockout' ||
          format === 'group_stage'
        ) {
          const matchPayloads = generateSubtournamentMatches(
            createdSub,
            createdEntries
          );
          if (matchPayloads.length > 0) {
            const { error: matchesError } = await supabase
              .from('subtournament_matches')
              .insert(matchPayloads);

            if (matchesError) throw matchesError;
          }
        }
      }

      onCreated(createdSub.id);
      onClose();
    } catch (err) {
      if (createdSubId) {
        await supabase.from('subtournaments').delete().eq('id', createdSubId);
      }
      setError(err?.message || 'No se pudo crear el subtorneo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && matchday && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className="flex h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-slate-200/90 bg-white shadow-2xl sm:h-auto sm:max-h-[88dvh] sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3.5 sm:px-6 sm:py-4 dark:border-slate-800">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-extrabold text-slate-900 sm:text-lg dark:text-white">
                    Crear Subtorneo — {matchday.name}
                  </h2>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    Define nombre, categoría, formato, participantes y modalidad.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-slate-400 transition active:bg-slate-100 hover:bg-slate-100 hover:text-slate-600 dark:active:bg-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              id="create-subtournament-form"
              onSubmit={handleSubmit}
              className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:space-y-6 sm:px-6 sm:py-5"
            >
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-700 sm:text-sm dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. Nombre, Categoría y Formato */}
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="subtournament-name"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                  >
                    Nombre del subtorneo *
                  </label>
                  <input
                    id="subtournament-name"
                    type="text"
                    required
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Fútbol 5, FIFA 1v1, Truco por parejas..."
                    className="min-h-[46px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/45">
                  <label
                    htmlFor="subtournament-category"
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                  >
                    <Tag className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Categoría (para estadísticas agrupadas)</span>
                  </label>
                  <input
                    id="subtournament-category"
                    type="text"
                    maxLength={40}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ej: FIFA, Truco, Pádel... (opcional)"
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {suggestedCategories.map((cat) => {
                      const active =
                        category.trim().toLowerCase() === cat.toLowerCase();
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(active ? '' : cat)}
                          className={`min-h-[36px] rounded-xl border px-2.5 py-1 text-xs font-bold transition ${
                            active
                              ? 'border-indigo-500 bg-indigo-600 text-white shadow-2xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Formato del subtorneo *
                  </span>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {SUBTOURNAMENT_FORMAT_LIST.map((item) => {
                      const selected = format === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setFormat(item.value)}
                          className={`min-h-[56px] rounded-xl border p-3.5 text-left transition active:scale-[0.99] ${
                            selected
                              ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20 dark:border-emerald-500/60 dark:bg-emerald-500/15'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {item.label}
                            </span>
                            <span
                              className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                                selected
                                  ? 'border-emerald-600 bg-emerald-600 dark:border-emerald-400 dark:bg-emerald-400'
                                  : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
                              }`}
                            />
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            {item.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {format === 'league' && (
                    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/45">
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

                      <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
                        <input
                          type="checkbox"
                          checked={leagueTiebreaker}
                          onChange={(e) =>
                            setLeagueTiebreaker(e.target.checked)
                          }
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600"
                        />
                        <div>
                          <span className="block font-bold text-slate-800 dark:text-slate-100">
                            Desempate por penales (3 / 2 / 1 pts)
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Ganar 3 pts · Ganar desempate 2 · Perder desempate 1
                          </span>
                        </div>
                      </label>
                    </div>
                  )}

                  {format === 'knockout' && (
                    <div className="mt-3 grid grid-cols-1 gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-950/45">
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={homeAndAway}
                          onChange={(e) => setHomeAndAway(e.target.checked)}
                          className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600"
                        />
                        <span>Cruces a ida y vuelta</span>
                      </label>

                      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={thirdPlace}
                          onChange={(e) => setThirdPlace(e.target.checked)}
                          className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600"
                        />
                        <span>Partido por el 3.º puesto (4+ comp.)</span>
                      </label>
                    </div>
                  )}

                  {format === 'group_stage' && (
                    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/45">
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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
                            Destino mejores terceros:
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
                            onChange={(e) =>
                              setGroupHomeAndAway(e.target.checked)
                            }
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                          />
                          <span>Grupos ida y vuelta</span>
                        </label>
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={koHomeAndAway}
                            onChange={(e) =>
                              setKoHomeAndAway(e.target.checked)
                            }
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                          />
                          <span>Elim. ida y vuelta</span>
                        </label>
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={leagueTiebreaker}
                            onChange={(e) =>
                              setLeagueTiebreaker(e.target.checked)
                            }
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
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Participantes */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4 dark:border-slate-800 dark:bg-slate-950/45">
                <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                    <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      Participantes ({selectedParticipantIds.length} de{' '}
                      {participants.length})
                    </span>
                  </span>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                    <button
                      type="button"
                      onClick={selectAllParticipants}
                      className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 active:bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={clearAllParticipants}
                      className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 active:bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>

                {participants.length < 2 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
                    Agrega al menos 2 participantes al torneo general antes de
                    crear un subtorneo.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {participants.map((p) => {
                      const isChecked = selectedSet.has(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleParticipant(p.id)}
                          className={`flex min-h-[44px] items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-xs font-bold transition active:scale-[0.98] ${
                            isChecked
                              ? 'border-emerald-400 bg-white text-emerald-900 shadow-2xs dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-200'
                              : 'border-slate-200 bg-white/60 text-slate-500 hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400'
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                          )}
                          <span className="truncate">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Modalidad Individual vs Por Equipos */}
              <div>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  Modalidad de competencia
                </span>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsTeamBased(false)}
                    className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition active:scale-[0.99] ${
                      !isTeamBased
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-200'
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
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-200'
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
                      ? 'Al crear el subtorneo se abrirá el apartado "Equipos" donde podrás elegir cuántos equipos armar, usar bombos si querés y realizar el sorteo manual, rápido o en vivo.'
                      : 'Si ya tienen los equipos armados o no les interesa anotar a cada jugador individualmente, pueden usar el modo Individual directamente.'}
                  </span>
                </div>
              </div>

              {/* 4. Escala de puntos por puesto */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 dark:border-slate-800 dark:bg-slate-950/45">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                    Puntos al torneo general
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {isTeamBased
                      ? 'Se ajustará según la cant. de equipos'
                      : `${competitorCount} ${
                          competitorCount === 1 ? 'competidor' : 'competidores'
                        }`}
                  </span>
                </div>

                {competitorCount < 2 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Selecciona al menos 2 competidores para configurar los puntos
                    por puesto.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
                      {pointsScale.map((pts, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900"
                        >
                          <label className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            {index + 1}.º puesto
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min={0}
                            value={pts}
                            onChange={(e) =>
                              handlePointInputChange(index, e.target.value)
                            }
                            className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-base font-extrabold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-950/70 dark:text-white"
                          />
                        </div>
                      ))}
                    </div>
                    {isTeamBased && (
                      <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                        En modalidad por equipos, cada integrante del equipo
                        recibirá los puntos asignados al puesto obtenido.
                      </p>
                    )}
                  </>
                )}
              </div>
            </form>

            <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-slate-200/80 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-3 sm:px-6 sm:py-4 dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition active:bg-slate-100 hover:bg-slate-50 disabled:opacity-50 sm:flex-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="create-subtournament-form"
                disabled={
                  submitting ||
                  participants.length < 2 ||
                  (format === 'group_stage' &&
                    groupStageValidation &&
                    !groupStageValidation.isValid)
                }
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition active:scale-[0.99] hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{submitting ? 'Creando...' : 'Crear Subtorneo'}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}