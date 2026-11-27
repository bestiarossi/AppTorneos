import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Play,
  Shuffle,
  Users,
} from 'lucide-react';
import { resolveParticipantAvatar } from '../utils/avatarUpload';
import {
  generateGroupStageMatches,
  getGroupLabel,
  shuffleArray,
  validateGroupStageConfig,
} from '../utils/tournamentEngine';
import Avatar from './Avatar';

export default function GroupStageBuilder({
  tournament,
  participants = [],
  isAdmin = false,
  generating = false,
  onGenerateGroupStage,
}) {
  const cfg = tournament?.config || {};

  const [groupCount, setGroupCount] = useState(
    String(cfg.group_count ?? 2)
  );
  const [directPerGroup, setDirectPerGroup] = useState(
    String(cfg.direct_per_group ?? 2)
  );
  const [playoffPerGroup, setPlayoffPerGroup] = useState(
    String(cfg.playoff_per_group ?? 0)
  );
  const [bestThirdsCount, setBestThirdsCount] = useState(
    String(cfg.best_thirds_count ?? 0)
  );
  const [bestThirdsDest, setBestThirdsDest] = useState(
    cfg.best_thirds_destination === 'playoff' ? 'playoff' : 'direct'
  );
  const [groupHomeAndAway, setGroupHomeAndAway] = useState(
    Boolean(cfg.group_home_and_away)
  );
  const [koHomeAndAway, setKoHomeAndAway] = useState(
    Boolean(cfg.knockout_home_and_away)
  );
  const [thirdPlace, setThirdPlace] = useState(Boolean(cfg.third_place));

  // Mapa participantId -> groupLabel ('Grupo A', 'Grupo B', ...)
  const [playerGroupMap, setPlayerGroupMap] = useState({});
  const [submitError, setSubmitError] = useState('');

  const safeGroupCount = Math.max(
    1,
    Math.min(16, Number.parseInt(groupCount || '2', 10) || 2)
  );

  const groupLabels = useMemo(
    () => Array.from({ length: safeGroupCount }, (_, idx) => getGroupLabel(idx)),
    [safeGroupCount]
  );

  // Inicializar o reajustar asignaciones desde config o round-robin
  useEffect(() => {
    const saved = cfg.group_assignments;
    const initialMap = {};

    if (saved && typeof saved === 'object') {
      Object.entries(saved).forEach(([gLabel, ids]) => {
        if (!groupLabels.includes(gLabel) || !Array.isArray(ids)) return;
        ids.forEach((id) => {
          initialMap[id] = gLabel;
        });
      });
    }

    participants.forEach((p, idx) => {
      if (!initialMap[p.id] || !groupLabels.includes(initialMap[p.id])) {
        initialMap[p.id] = groupLabels[idx % groupLabels.length];
      }
    });

    setPlayerGroupMap(initialMap);
  }, [participants, groupLabels, cfg.group_assignments]);

  function handleRandomizeGroups() {
    if (participants.length === 0) return;
    setSubmitError('');
    const shuffled = shuffleArray(participants);
    const nextMap = {};
    shuffled.forEach((p, idx) => {
      nextMap[p.id] = groupLabels[idx % groupLabels.length];
    });
    setPlayerGroupMap(nextMap);
  }

  const groupsRosterMap = useMemo(() => {
    const map = new Map();
    groupLabels.forEach((lbl) => map.set(lbl, []));
    participants.forEach((p) => {
      const assigned = playerGroupMap[p.id] || groupLabels[0];
      if (!map.has(assigned)) map.set(assigned, []);
      map.get(assigned).push(p);
    });
    return map;
  }, [groupLabels, participants, playerGroupMap]);

  const draftConfig = useMemo(() => {
    const groupAssignmentsObj = {};
    groupsRosterMap.forEach((list, label) => {
      groupAssignmentsObj[label] = list.map((p) => p.id);
    });

    return {
      ...(tournament?.config || {}),
      group_count: safeGroupCount,
      direct_per_group: Math.max(0, Number.parseInt(directPerGroup || '0', 10) || 0),
      playoff_per_group: Math.max(0, Number.parseInt(playoffPerGroup || '0', 10) || 0),
      best_thirds_count: Math.max(0, Number.parseInt(bestThirdsCount || '0', 10) || 0),
      best_thirds_destination: bestThirdsDest,
      group_home_and_away: groupHomeAndAway,
      knockout_home_and_away: koHomeAndAway,
      third_place: thirdPlace,
      group_assignments: groupAssignmentsObj,
    };
  }, [
    tournament?.config,
    safeGroupCount,
    directPerGroup,
    playoffPerGroup,
    bestThirdsCount,
    bestThirdsDest,
    groupHomeAndAway,
    koHomeAndAway,
    thirdPlace,
    groupsRosterMap,
  ]);

  const validation = useMemo(
    () => validateGroupStageConfig(draftConfig, groupsRosterMap),
    [draftConfig, groupsRosterMap]
  );

  async function handleGenerate() {
    if (!isAdmin || !validation.isValid || !onGenerateGroupStage) return;
    setSubmitError('');
    try {
      const rows = generateGroupStageMatches(
        { ...tournament, config: draftConfig },
        participants,
        draftConfig.group_assignments
      );
      await onGenerateGroupStage(draftConfig, rows);
    } catch (err) {
      setSubmitError(err?.message || 'No se pudieron generar los grupos.');
    }
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900/40">
        <Users className="mx-auto mb-3 h-8 w-8 text-slate-400" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Grupos sin sortear
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
          El administrador todavía no armó los grupos ni generó el fixture de este torneo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Armador de Fase de Grupos
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configurá la cantidad de grupos, qué jugadores van a cada grupo y los cupos de clasificación.
          </p>
        </div>

        <button
          type="button"
          disabled={participants.length < 2}
          onClick={handleRandomizeGroups}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <Shuffle className="h-3.5 w-3.5 text-indigo-500" />
          <span>Sortear grupos al azar</span>
        </button>
      </div>

      {/* Reglas de grupos y clasificación */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900/60">
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
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-base font-extrabold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-base font-extrabold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-base font-extrabold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Mejores{' '}
              {Number(directPerGroup || 0) + Number(playoffPerGroup || 0) + 1}.º
            </label>
            <input
              type="number"
              min={0}
              max={16}
              value={bestThirdsCount}
              onChange={(e) => setBestThirdsCount(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-base font-extrabold text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {Number(bestThirdsCount || 0) > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
            <span className="font-bold text-slate-600 dark:text-slate-300">
              Destino mejores terceros:
            </span>
            <button
              type="button"
              onClick={() => setBestThirdsDest('direct')}
              className={`min-h-[36px] rounded-lg px-2.5 py-1 font-bold transition ${
                bestThirdsDest === 'direct'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'
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
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              Al Playoff
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={groupHomeAndAway}
              onChange={(e) => setGroupHomeAndAway(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600"
            />
            <span>Grupos ida y vuelta</span>
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={koHomeAndAway}
              onChange={(e) => setKoHomeAndAway(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600"
            />
            <span>Elim. ida y vuelta</span>
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
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

      {/* Asignación libre de participantes a grupos */}
      {participants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
          Agrega participantes en la lista lateral para asignarlos a los grupos.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Resumen por grupo */}
          <div className="flex flex-wrap gap-2">
            {groupLabels.map((label) => {
              const members = groupsRosterMap.get(label) || [];
              const ok = members.length >= validation.parsed.minPerGroup;
              return (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold tabular-nums ${
                    ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-300'
                  }`}
                >
                  <span>{label}:</span>
                  <span>
                    {members.length}{' '}
                    {members.length === 1 ? 'integrante' : 'integrantes'}
                  </span>
                </span>
              );
            })}
          </div>

          <div className="space-y-2">
            {participants.map((p) => {
              const currentGroup = playerGroupMap[p.id] || groupLabels[0];
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/85 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/65"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar
                      name={p.name}
                      url={resolveParticipantAvatar(p)}
                      size="sm"
                    />
                    <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {p.name}
                    </span>
                  </div>

                  {groupLabels.length <= 5 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {groupLabels.map((lbl) => {
                        const active = currentGroup === lbl;
                        return (
                          <button
                            key={lbl}
                            type="button"
                            onClick={() =>
                              setPlayerGroupMap((prev) => ({
                                ...prev,
                                [p.id]: lbl,
                              }))
                            }
                            className={`min-h-[40px] rounded-xl border px-3 py-1 text-xs font-bold transition ${
                              active
                                ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <select
                      value={currentGroup}
                      onChange={(e) =>
                        setPlayerGroupMap((prev) => ({
                          ...prev,
                          [p.id]: e.target.value,
                        }))
                      }
                      className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-bold text-slate-800 focus:border-emerald-500 focus:outline-none sm:text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {groupLabels.map((lbl) => (
                        <option key={lbl} value={lbl}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Validación en vivo */}
      <div
        className={`rounded-2xl border p-3.5 text-xs ${
          validation.isValid
            ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-200'
            : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200'
        }`}
      >
        {validation.isValid ? (
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 font-extrabold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>
                {validation.parsed.totalPlayoff > 0
                  ? `${validation.parsed.totalDirect} directos + ${validation.parsed.totalPlayoff} a Playoff → ${validation.parsed.mainBracketCount} en llave final (Potencia de 2 ✓)`
                  : `${validation.parsed.totalDirect} clasificados directos (Potencia de 2 ✓)`}
              </span>
            </p>
            <p className="text-[11px] opacity-90">
              Estructura final: {validation.bracketPreview}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {validation.errors.map((err, i) => (
              <p key={i} className="flex items-start gap-1.5 font-bold">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{err}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {submitError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="flex justify-end">
        <motion.button
          whileTap={{ scale: 0.96 }}
          type="button"
          disabled={!validation.isValid || generating}
          onClick={handleGenerate}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          <span>
            {generating ? 'Generando grupos...' : 'Generar Grupos y Llaves'}
          </span>
        </motion.button>
      </div>
    </div>
  );
}