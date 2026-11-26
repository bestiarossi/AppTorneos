import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Flame, Loader2, Target, Trophy, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CreatePredictionPollModal({
  isOpen,
  tournament,
  currentUserId,
  matches = [],
  subtournaments = [],
  subEntries = [],
  subMatches = [],
  participantMap = new Map(),
  existingPolls = [],
  onClose,
  onCreated,
}) {
  const isCustom = tournament?.format === 'custom';

  const usedMatchIds = useMemo(
    () => new Set(existingPolls.map((p) => p.match_id).filter(Boolean)),
    [existingPolls]
  );
  const usedSubMatchIds = useMemo(
    () =>
      new Set(existingPolls.map((p) => p.subtournament_match_id).filter(Boolean)),
    [existingPolls]
  );
  const usedSubIds = useMemo(
    () => new Set(existingPolls.map((p) => p.subtournament_id).filter(Boolean)),
    [existingPolls]
  );

  const availableMatches = useMemo(
    () =>
      matches.filter(
        (m) =>
          !m.is_bye &&
          m.status !== 'completed' &&
          m.participant_a_id &&
          m.participant_b_id &&
          !usedMatchIds.has(m.id)
      ),
    [matches, usedMatchIds]
  );

  const availableRounds = useMemo(() => {
    const map = new Map();
    availableMatches.forEach((m) => {
      if (!map.has(m.round_number)) {
        map.set(m.round_number, {
          roundNumber: m.round_number,
          roundName: m.round_name,
          matches: [],
        });
      }
      map.get(m.round_number).matches.push(m);
    });
    return Array.from(map.values()).sort((a, b) => a.roundNumber - b.roundNumber);
  }, [availableMatches]);

  const activeSubMap = useMemo(
    () =>
      new Map(
        subtournaments
          .filter((s) => s.status !== 'completed')
          .map((s) => [s.id, s])
      ),
    [subtournaments]
  );

  const availableSubtournaments = useMemo(() => {
    const countBySub = new Map();
    subEntries.forEach((e) => {
      countBySub.set(
        e.subtournament_id,
        (countBySub.get(e.subtournament_id) || 0) + 1
      );
    });
    return subtournaments.filter(
      (s) =>
        s.status !== 'completed' &&
        (countBySub.get(s.id) || 0) >= 2 &&
        !usedSubIds.has(s.id)
    );
  }, [subtournaments, subEntries, usedSubIds]);

  const availableSubMatches = useMemo(() => {
    const entryMap = new Map(subEntries.map((e) => [e.id, e]));
    return subMatches
      .filter(
        (sm) =>
          !sm.is_bye &&
          sm.status !== 'completed' &&
          sm.entry_a_id &&
          sm.entry_b_id &&
          activeSubMap.has(sm.subtournament_id) &&
          !usedSubMatchIds.has(sm.id)
      )
      .map((sm) => ({
        ...sm,
        subName: activeSubMap.get(sm.subtournament_id)?.name || 'Subtorneo',
        nameA: entryMap.get(sm.entry_a_id)?.entry_name || 'Lado A',
        nameB: entryMap.get(sm.entry_b_id)?.entry_name || 'Lado B',
      }));
  }, [subMatches, subEntries, activeSubMap, usedSubMatchIds]);

  // 'classic' (marcador exacto 3/1) | 'survey' (encuesta con cuotas dinámicas)
  const [prodeKind, setProdeKind] = useState('classic');
  // Para 'classic': 'match' | 'subtournament_match'
  // Para 'survey': 'subtournament_winner' | 'match' | 'subtournament_match'
  const [pollType, setPollType] = useState('match');
  const [createBatchRound, setCreateBatchRound] = useState(false);
  const [selectedRoundNumber, setSelectedRoundNumber] = useState('');
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [allowDraw, setAllowDraw] = useState(true);

  // Puntaje Clásico
  const [pointsExact, setPointsExact] = useState('3');
  const [pointsOutcome, setPointsOutcome] = useState('1');

  // Puntaje Encuesta (dinámico por popularidad)
  const [surveyMinPts, setSurveyMinPts] = useState('1');
  const [surveyMaxPts, setSurveyMaxPts] = useState('5');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setCreateBatchRound(false);
    setPointsExact('3');
    setPointsOutcome('1');
    setSurveyMinPts('1');
    setSurveyMaxPts('5');
    setAllowDraw(tournament?.format !== 'knockout');

    if (isCustom) {
      if (availableSubtournaments.length > 0) {
        setProdeKind('survey');
        setPollType('subtournament_winner');
        setTargetId(availableSubtournaments[0].id);
      } else {
        setProdeKind('classic');
        setPollType('subtournament_match');
        setTargetId(availableSubMatches[0]?.id || '');
      }
    } else {
      setProdeKind('classic');
      setPollType('match');
      setTargetId(availableMatches[0]?.id || '');
      setSelectedRoundNumber(
        availableRounds[0] ? String(availableRounds[0].roundNumber) : ''
      );
    }
  }, [
    isOpen,
    isCustom,
    tournament?.format,
    availableMatches,
    availableRounds,
    availableSubMatches,
    availableSubtournaments,
  ]);

  // Autocompletar título sugerido
  useEffect(() => {
    if (!isOpen || createBatchRound || !targetId) {
      setTitle('');
      return;
    }

    if (pollType === 'match') {
      const m = availableMatches.find((item) => item.id === targetId);
      if (m) {
        const nA = participantMap.get(m.participant_a_id)?.name || 'A';
        const nB = participantMap.get(m.participant_b_id)?.name || 'B';
        setTitle(`${m.round_name}: ${nA} vs ${nB}`);
      }
    } else if (pollType === 'subtournament_match') {
      const sm = availableSubMatches.find((item) => item.id === targetId);
      if (sm) {
        setTitle(`${sm.subName} (${sm.round_name}): ${sm.nameA} vs ${sm.nameB}`);
      }
    } else if (pollType === 'subtournament_winner') {
      const s = availableSubtournaments.find((item) => item.id === targetId);
      if (s) {
        setTitle(`¿Quién gana "${s.name}"?`);
      }
    }
  }, [
    isOpen,
    createBatchRound,
    pollType,
    targetId,
    availableMatches,
    availableSubMatches,
    availableSubtournaments,
    participantMap,
  ]);

  function handleSelectProdeKind(nextKind) {
    setProdeKind(nextKind);
    setError('');
    setCreateBatchRound(false);

    if (nextKind === 'classic') {
      const nextType = isCustom ? 'subtournament_match' : 'match';
      setPollType(nextType);
      setTargetId(
        nextType === 'match'
          ? availableMatches[0]?.id || ''
          : availableSubMatches[0]?.id || ''
      );
    } else {
      if (isCustom) {
        if (availableSubtournaments.length > 0) {
          setPollType('subtournament_winner');
          setTargetId(availableSubtournaments[0].id);
        } else {
          setPollType('subtournament_match');
          setTargetId(availableSubMatches[0]?.id || '');
        }
      } else {
        setPollType('match');
        setTargetId(availableMatches[0]?.id || '');
      }
    }
  }

  function handleChangePollType(nextType) {
    setPollType(nextType);
    setError('');
    setCreateBatchRound(false);
    if (nextType === 'subtournament_winner') {
      setTargetId(availableSubtournaments[0]?.id || '');
    } else if (nextType === 'subtournament_match') {
      setTargetId(availableSubMatches[0]?.id || '');
    } else {
      setTargetId(availableMatches[0]?.id || '');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!tournament?.id || !currentUserId) return;

    const isClassic = prodeKind === 'classic';
    const predictionMode = isClassic
      ? 'exact_score'
      : pollType === 'subtournament_winner'
      ? 'champion'
      : 'winner';

    const pExact = Math.max(0, Number.parseInt(pointsExact || '3', 10) || 0);
    const pOutcome = Math.max(0, Number.parseInt(pointsOutcome || '1', 10) || 0);
    const minP = Math.max(1, Number.parseInt(surveyMinPts || '1', 10) || 1);
    const maxP = Math.max(minP, Number.parseInt(surveyMaxPts || '5', 10) || minP);

    setSaving(true);
    setError('');

    try {
      // Creación masiva de toda una fecha (solo para partidos estándar)
      if (!isCustom && pollType === 'match' && createBatchRound) {
        const roundGroup = availableRounds.find(
          (r) => String(r.roundNumber) === String(selectedRoundNumber)
        );
        if (!roundGroup || roundGroup.matches.length === 0) {
          throw new Error('No hay partidos pendientes disponibles en esa fecha.');
        }

        const payloads = roundGroup.matches.map((m) => {
          const nA = participantMap.get(m.participant_a_id)?.name || 'A';
          const nB = participantMap.get(m.participant_b_id)?.name || 'B';
          return {
            tournament_id: tournament.id,
            title: `${m.round_name}: ${nA} vs ${nB}`,
            poll_type: 'match',
            prediction_mode: predictionMode,
            match_id: m.id,
            subtournament_match_id: null,
            subtournament_id: null,
            allow_draw: Boolean(allowDraw),
            points_outcome: isClassic ? pOutcome : minP,
            points_exact: isClassic ? pExact : maxP,
            points_champion: maxP,
            status: 'open',
            created_by: currentUserId,
          };
        });

        const { data, error: batchError } = await supabase
          .from('prediction_polls')
          .insert(payloads)
          .select();

        if (batchError) throw batchError;
        if (onCreated) onCreated(data);
        onClose();
        return;
      }

      if (!targetId) {
        throw new Error('No hay ningún evento pendiente disponible.');
      }

      const cleanTitle = title.trim();
      if (!cleanTitle) {
        throw new Error('Ingresa un título para la encuesta.');
      }

      const payload = {
        tournament_id: tournament.id,
        title: cleanTitle,
        poll_type: pollType,
        prediction_mode: predictionMode,
        match_id: pollType === 'match' ? targetId : null,
        subtournament_match_id: pollType === 'subtournament_match' ? targetId : null,
        subtournament_id: pollType === 'subtournament_winner' ? targetId : null,
        allow_draw:
          pollType === 'subtournament_winner' ? false : Boolean(allowDraw),
        points_outcome: isClassic ? pOutcome : minP,
        points_exact: isClassic ? pExact : maxP,
        points_champion: maxP,
        status: 'open',
        created_by: currentUserId,
      };

      const { data, error: insertError } = await supabase
        .from('prediction_polls')
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;
      if (onCreated) onCreated(data);
      onClose();
    } catch (err) {
      setError(err?.message || 'No se pudo crear la predicción.');
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === 'undefined') return null;

  const hasTargets =
    !isCustom && pollType === 'match' && createBatchRound
      ? availableRounds.length > 0
      : pollType === 'match'
      ? availableMatches.length > 0
      : pollType === 'subtournament_match'
      ? availableSubMatches.length > 0
      : availableSubtournaments.length > 0;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="glass-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Nueva predicción / encuesta
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Elegí Prode Clásico o Encuesta con cuotas por popularidad
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Selector de los 2 tipos de Prode */}
              <div>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  Tipo de Prode
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleSelectProdeKind('classic')}
                    className={`flex min-h-[44px] flex-col items-start rounded-2xl border p-3 text-left transition ${
                      prodeKind === 'classic'
                        ? 'border-emerald-500 bg-emerald-50/70 dark:border-emerald-400 dark:bg-emerald-500/15'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white">
                      <Trophy className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Prode Clásico</span>
                    </span>
                    <span className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      Marcador exacto: +3 pts exacto, +1 pt ganador o empate
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectProdeKind('survey')}
                    className={`flex min-h-[44px] flex-col items-start rounded-2xl border p-3 text-left transition ${
                      prodeKind === 'survey'
                        ? 'border-violet-500 bg-violet-50/70 dark:border-violet-400 dark:bg-violet-500/15'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white">
                      <Flame className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                      <span>Tipo Encuesta</span>
                    </span>
                    <span className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      Elegís ganador/campeón: la más votada da menos puntos
                    </span>
                  </button>
                </div>
              </div>

              {/* Alcance cuando es modo Custom y Tipo Encuesta */}
              {isCustom && prodeKind === 'survey' && (
                <div>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    ¿Sobre qué se vota?
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleChangePollType('subtournament_winner')}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        pollType === 'subtournament_winner'
                          ? 'border-violet-500 bg-violet-50 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                      }`}
                    >
                      Campeón de subtorneo
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChangePollType('subtournament_match')}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        pollType === 'subtournament_match'
                          ? 'border-violet-500 bg-violet-50 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                      }`}
                    >
                      Cruce directo interno
                    </button>
                  </div>
                </div>
              )}

              {/* Opción de carga masiva por fecha en Liga / Eliminatoria */}
              {!isCustom && availableRounds.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateBatchRound(false)}
                    className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      !createBatchRound
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                        : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    Un partido puntual
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateBatchRound(true)}
                    className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      createBatchRound
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                        : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    Toda una fecha / ronda
                  </button>
                </div>
              )}

              {/* Selector de objetivo */}
              <div>
                <label
                  htmlFor="poll-target"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                >
                  {!isCustom && createBatchRound
                    ? 'Selecciona la fecha / ronda'
                    : pollType === 'subtournament_winner'
                    ? 'Subtorneo a predecir'
                    : 'Enfrentamiento pendiente'}
                </label>

                {!hasTargets ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                    {pollType === 'subtournament_winner'
                      ? 'No hay subtorneos activos con al menos 2 competidores sin encuesta.'
                      : 'No hay partidos pendientes con ambos rivales definidos y sin encuesta previa.'}
                  </div>
                ) : !isCustom && createBatchRound ? (
                  <select
                    id="poll-target"
                    value={selectedRoundNumber}
                    onChange={(e) => setSelectedRoundNumber(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {availableRounds.map((r) => (
                      <option key={r.roundNumber} value={r.roundNumber}>
                        {r.roundName} ({r.matches.length}{' '}
                        {r.matches.length === 1 ? 'partido' : 'partidos'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    id="poll-target"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {pollType === 'match' &&
                      availableMatches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.round_name}:{' '}
                          {participantMap.get(m.participant_a_id)?.name} vs{' '}
                          {participantMap.get(m.participant_b_id)?.name}
                        </option>
                      ))}

                    {pollType === 'subtournament_match' &&
                      availableSubMatches.map((sm) => (
                        <option key={sm.id} value={sm.id}>
                          {sm.subName} ({sm.round_name}): {sm.nameA} vs {sm.nameB}
                        </option>
                      ))}

                    {pollType === 'subtournament_winner' &&
                      availableSubtournaments.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {(!createBatchRound || isCustom) && (
                <div>
                  <label
                    htmlFor="poll-title"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                  >
                    Título visible
                  </label>
                  <input
                    id="poll-title"
                    type="text"
                    maxLength={100}
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Final: Juan vs Pedro"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base font-medium text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              {pollType !== 'subtournament_winner' && (
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={allowDraw}
                    onChange={(e) => setAllowDraw(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                  />
                  <span>Permitir predecir empate</span>
                </label>
              )}

              {/* Configuración de puntaje según el tipo */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  {prodeKind === 'classic'
                    ? 'Puntaje Prode Clásico'
                    : 'Rango de puntaje dinámico (según votos)'}
                </p>

                {prodeKind === 'classic' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="pts-exact"
                        className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                      >
                        Marcador exacto
                      </label>
                      <input
                        id="pts-exact"
                        type="number"
                        min={0}
                        max={100}
                        value={pointsExact}
                        onChange={(e) => setPointsExact(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-bold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pts-outcome"
                        className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                      >
                        Ganador o empate
                      </label>
                      <input
                        id="pts-outcome"
                        type="number"
                        min={0}
                        max={100}
                        value={pointsOutcome}
                        onChange={(e) => setPointsOutcome(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-bold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="pts-survey-min"
                          className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                        >
                          Mínimo (más votada)
                        </label>
                        <input
                          id="pts-survey-min"
                          type="number"
                          min={1}
                          max={50}
                          value={surveyMinPts}
                          onChange={(e) => setSurveyMinPts(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-bold text-slate-900 focus:border-violet-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="pts-survey-max"
                          className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                        >
                          Máximo (batacazo)
                        </label>
                        <input
                          id="pts-survey-max"
                          type="number"
                          min={1}
                          max={100}
                          value={surveyMaxPts}
                          onChange={(e) => setSurveyMaxPts(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-bold text-slate-900 focus:border-violet-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Si el 80% vota a un favorito, dará cerca del mínimo; si acertás uno que casi nadie eligió, te llevás cerca del máximo.
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  Cancelar
                </button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  disabled={saving || !hasTargets}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>
                    {saving
                      ? 'Creando...'
                      : !isCustom && createBatchRound
                      ? 'Abrir toda la fecha'
                      : 'Abrir encuesta'}
                  </span>
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