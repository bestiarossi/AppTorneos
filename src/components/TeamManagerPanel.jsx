import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  Dices,
  Layers,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Shuffle,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import { resolveParticipantAvatar } from '../utils/avatarUpload';
import {
  assignTeamsBalancedWithPots,
  getPotBadgeColor,
} from '../utils/potBalancer';
import { shuffleArray } from '../utils/tournamentEngine';
import Avatar from './Avatar';
import LiveTeamDrawModal from './LiveTeamDrawModal';

export default function TeamManagerPanel({
  scopeName = '',
  participants = [],
  potSets = [],
  potAssignments = [],
  savedTeams = [],
  isAdmin = false,
  saving = false,
  hasMatchesGenerated = false,
  generatingMatches = false,
  onBroadcastLiveDraw,
  onOpenPotManager,
  onSaveTeams,
  onGenerateMatches,
}) {
  const [isEditing, setIsEditing] = useState(savedTeams.length === 0);
  const [teams, setTeams] = useState([
    { id: 'team-1', name: 'Equipo 1' },
    { id: 'team-2', name: 'Equipo 2' },
  ]);
  const [assignments, setAssignments] = useState({});
  const [selectedPotSetId, setSelectedPotSetId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [liveDrawOpen, setLiveDrawOpen] = useState(false);
  const [liveDrawTargets, setLiveDrawTargets] = useState({});

  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants]
  );

  const participantIds = useMemo(
    () => participants.map((p) => p.id),
    [participants]
  );

  useEffect(() => {
    if (savedTeams.length > 0) {
      const nextTeams = savedTeams.map((t, idx) => ({
        id: t.id || `team-${idx + 1}`,
        name: t.name || `Equipo ${idx + 1}`,
      }));
      const nextAssign = {};
      savedTeams.forEach((t, idx) => {
        const teamId = t.id || `team-${idx + 1}`;
        (t.memberIds || []).forEach((pId) => {
          nextAssign[pId] = teamId;
        });
      });
      setTeams(nextTeams);
      setAssignments(nextAssign);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  }, [savedTeams]);

  const activePotSet = useMemo(
    () => potSets.find((ps) => ps.id === selectedPotSetId) || null,
    [potSets, selectedPotSetId]
  );

  const activePotMap = useMemo(() => {
    const map = new Map();
    if (!selectedPotSetId) return map;
    potAssignments
      .filter((a) => a.pot_set_id === selectedPotSetId)
      .forEach((a) => {
        map.set(a.participant_id, a.pot_number);
      });
    return map;
  }, [potAssignments, selectedPotSetId]);

  function handleTeamCountChange(nextCountRaw) {
    const parsed = Number.parseInt(nextCountRaw, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.max(2, Math.min(20, parsed));
    setNotice('');
    setError('');

    setTeams((prev) => {
      const nextTeams = [];
      for (let i = 0; i < clamped; i += 1) {
        nextTeams.push(
          prev[i] || { id: `team-${i + 1}`, name: `Equipo ${i + 1}` }
        );
      }
      const validIds = new Set(nextTeams.map((t) => t.id));
      setAssignments((prevAssign) => {
        const cleaned = {};
        Object.entries(prevAssign).forEach(([pId, tId]) => {
          if (validIds.has(tId)) cleaned[pId] = tId;
        });
        return cleaned;
      });
      return nextTeams;
    });
  }

  function computeDrawAssignments() {
    if (participantIds.length < teams.length) {
      setError(
        `Necesitas al menos ${teams.length} jugadores para armar ${teams.length} equipos.`
      );
      return null;
    }

    if (activePotSet) {
      return assignTeamsBalancedWithPots(
        participantIds,
        teams,
        activePotMap,
        activePotSet.pot_count
      );
    }

    const shuffled = shuffleArray(participantIds);
    const nextAssignments = {};
    shuffled.forEach((pId, idx) => {
      nextAssignments[pId] = teams[idx % teams.length].id;
    });
    return nextAssignments;
  }

  function handleQuickDraw() {
    setError('');
    setNotice('');
    const next = computeDrawAssignments();
    if (!next) return;
    setAssignments(next);
    setNotice(
      activePotSet
        ? `Sorteo rápido equilibrado con "${activePotSet.name}".`
        : 'Sorteo rápido al azar realizado.'
    );
  }

  function handleOpenLiveDraw() {
    setError('');
    setNotice('');
    const next = computeDrawAssignments();
    if (!next) return;
    setLiveDrawTargets(next);
    setLiveDrawOpen(true);
  }

  function handleRerollLiveDraw() {
    const next = computeDrawAssignments();
    if (next) setLiveDrawTargets(next);
  }

  async function handleConfirmSave() {
    setError('');
    setNotice('');

    if (teams.length < 2) {
      setError('Debe haber al menos 2 equipos.');
      return;
    }

    const emptyName = teams.find((t) => !t.name.trim());
    if (emptyName) {
      setError('Todos los equipos deben tener un nombre.');
      return;
    }

    const unassigned = participantIds.filter((pId) => !assignments[pId]);
    if (unassigned.length > 0) {
      setError(
        `Faltan ${unassigned.length} ${
          unassigned.length === 1 ? 'jugador' : 'jugadores'
        } por asignar a un equipo.`
      );
      return;
    }

    const payload = teams.map((t) => ({
      id: t.id,
      name: t.name.trim(),
      memberIds: participantIds.filter((pId) => assignments[pId] === t.id),
    }));

    const emptyTeam = payload.find((t) => t.memberIds.length === 0);
    if (emptyTeam) {
      setError(`El equipo "${emptyTeam.name}" no tiene jugadores asignados.`);
      return;
    }

    await onSaveTeams?.(payload);
    setIsEditing(false);
  }

  if (!isAdmin || (!isEditing && savedTeams.length > 0)) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold tracking-tight text-slate-900 uppercase dark:text-white classic:text-[#1E4638]">
              Equipos Registrados ({savedTeams.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 classic:text-[#4C6B5E]">
              Formaciones oficiales confirmadas para esta competencia.
            </p>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsEditing(true)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/[0.1] dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 classic:border-2 classic:border-[#1E4638] classic:bg-[#EFE2CC] classic:text-[#1E4638]"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Editar / Re-sortear</span>
              </motion.button>

              {onGenerateMatches && !hasMatchesGenerated && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  disabled={generatingMatches}
                  onClick={onGenerateMatches}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold tracking-wider text-white uppercase shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-[#CCFF00] dark:text-[#0B0E14] classic:border-2 classic:border-[#1E4638] classic:bg-[#D46F4D] classic:text-[#FBF5E8]"
                >
                  {generatingMatches ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Swords className="h-3.5 w-3.5" />
                  )}
                  <span>Generar cruces</span>
                </motion.button>
              )}
            </div>
          )}
        </div>

        {savedTeams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <Users className="mx-auto mb-2.5 h-8 w-8 text-slate-400" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Todavía no se sortearon los equipos
            </h4>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              El administrador armará o sorteará los equipos desde esta sección.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {savedTeams.map((team, idx) => (
              <motion.div
                key={team.id || idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="rounded-2xl border border-slate-200/90 bg-white/85 p-4 dark:border-white/[0.08] dark:bg-white/[0.03] classic:border-2 classic:border-[#1E4638] classic:bg-[#FBF5E8]"
              >
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-white/[0.06] classic:border-[#1E4638]/15">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 font-mono text-xs font-extrabold text-emerald-700 dark:bg-[#CCFF00]/15 dark:text-[#CCFF00] classic:bg-[#1E4638] classic:text-[#FBF5E8]">
                      {idx + 1}
                    </span>
                    <h4 className="text-sm font-black tracking-tight text-slate-900 uppercase dark:text-white classic:text-[#1E4638]">
                      {team.name}
                    </h4>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600 tabular-nums dark:bg-white/[0.06] dark:text-slate-300">
                    {(team.memberIds || []).length} jug.
                  </span>
                </div>

                <ul className="space-y-1.5">
                  {(team.memberIds || []).map((pId) => {
                    const player = participantMap.get(pId);
                    return (
                      <li
                        key={pId}
                        className="flex items-center gap-2.5 rounded-xl bg-slate-50/80 px-2.5 py-1.5 dark:bg-[#141923] classic:bg-[#EFE2CC]"
                      >
                        <Avatar
                          name={player?.name || 'Jugador'}
                          url={resolveParticipantAvatar(player)}
                          size="xs"
                        />
                        <span className="truncate text-xs font-bold text-slate-800 dark:text-slate-100 classic:text-[#1E4638]">
                          {player?.name || 'Jugador'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-slate-900 uppercase dark:text-white classic:text-[#1E4638]">
            Armar y Sortear Equipos
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 classic:text-[#4C6B5E]">
            Elegí la cantidad de equipos, usá bombos si querés y sortealos en vivo o al instante.
          </p>
        </div>

        {savedTeams.length > 0 && (
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
          >
            Cancelar edición
          </button>
        )}
      </div>

      {participants.length < 2 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
          Agregá al menos 2 participantes individuales en el panel de participantes antes de armar los equipos.
        </div>
      ) : (
        <>
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 dark:border-[#CCFF00]/30 dark:bg-[#CCFF00]/10 dark:text-[#CCFF00]">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/75 p-4 sm:grid-cols-2 dark:border-white/[0.08] dark:bg-white/[0.03] classic:border-2 classic:border-[#1E4638] classic:bg-[#EFE2CC]">
            <div>
              <span className="mb-2 block text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400 classic:text-[#315E4E]">
                1. Cantidad de equipos
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTeamCountChange(teams.length - 1)}
                  disabled={teams.length <= 2}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-40 dark:border-white/10 dark:bg-[#141923] dark:text-white"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={teams.length}
                  onChange={(e) => handleTeamCountChange(e.target.value)}
                  className="h-11 w-16 rounded-xl border border-slate-200 bg-white text-center font-mono text-base font-black text-slate-900 tabular-nums focus:border-emerald-500 focus:outline-none dark:border-white/10 dark:bg-[#141923] dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => handleTeamCountChange(teams.length + 1)}
                  disabled={teams.length >= 20}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-40 dark:border-white/10 dark:bg-[#141923] dark:text-white"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400 classic:text-[#315E4E]">
                  <Layers className="h-3.5 w-3.5 text-amber-500" />
                  <span>2. Bombos (opcional)</span>
                </span>
                {onOpenPotManager && (
                  <button
                    type="button"
                    onClick={onOpenPotManager}
                    className="text-[11px] font-bold text-amber-700 underline underline-offset-2 dark:text-amber-300"
                  >
                    {potSets.length > 0 ? 'Gestionar' : 'Crear bombos'}
                  </button>
                )}
              </div>

              <select
                value={selectedPotSetId}
                onChange={(e) => {
                  setSelectedPotSetId(e.target.value);
                  setNotice('');
                }}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none dark:border-white/10 dark:bg-[#141923] dark:text-white"
              >
                <option value="">Sin bombos (azar puro)</option>
                {potSets.map((ps) => (
                  <option key={ps.id} value={ps.id}>
                    {ps.name} ({ps.pot_count} bombos)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={handleOpenLiveDraw}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-xs font-black tracking-wider text-white uppercase shadow-md transition hover:from-emerald-500 hover:to-teal-500 dark:bg-[#CCFF00] dark:bg-none dark:text-[#0B0E14] dark:shadow-[0_0_24px_-6px_rgba(204,255,0,0.45)] classic:border-2 classic:border-[#1E4638] classic:bg-[#D46F4D] classic:bg-none classic:text-[#FBF5E8] classic:shadow-[3px_3px_0_#1E4638]"
            >
              <Dices className="h-4 w-4" />
              <span>Sorteo en Vivo (Animado)</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={handleQuickDraw}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-extrabold tracking-wider text-slate-800 uppercase transition hover:bg-slate-50 dark:border-white/[0.1] dark:bg-white/5 dark:text-white dark:hover:bg-white/10 classic:border-2 classic:border-[#1E4638] classic:bg-[#FBF5E8] classic:text-[#1E4638]"
            >
              <Shuffle className="h-4 w-4 text-indigo-500 dark:text-[#CCFF00] classic:text-[#D46F4D]" />
              <span>
                {activePotSet ? 'Sorteo Rápido (Con Bombos)' : 'Sorteo Rápido'}
              </span>
            </motion.button>
          </div>

          <div>
            <span className="mb-2 block text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400 classic:text-[#315E4E]">
              3. Nombres de los equipos
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {teams.map((team, idx) => {
                const count = participantIds.filter(
                  (pId) => assignments[pId] === team.id
                ).length;
                return (
                  <div
                    key={team.id}
                    className="flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 dark:border-white/[0.08] dark:bg-[#0B0E14] classic:border-2 classic:border-[#1E4638] classic:bg-[#FFFBF4]"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 font-mono text-xs font-bold text-slate-600 dark:bg-white/10 dark:text-slate-200">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      maxLength={40}
                      value={team.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTeams((prev) =>
                          prev.map((t) =>
                            t.id === team.id ? { ...t, name: val } : t
                          )
                        );
                      }}
                      placeholder={`Equipo ${idx + 1}`}
                      className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-900 focus:outline-none dark:text-white classic:text-[#1E4638]"
                    />
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600 tabular-nums dark:bg-white/10 dark:text-slate-300">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400 classic:text-[#315E4E]">
              4. Asignación de jugadores (Manual o ajustar sorteo)
            </span>
            <div className="space-y-2">
              {participants.map((player) => {
                const assignedTeamId = assignments[player.id] || '';
                const playerPot = activePotMap.get(player.id);

                return (
                  <div
                    key={player.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200/90 bg-white/85 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.08] dark:bg-white/[0.03] classic:border-[#1E4638]/30 classic:bg-[#FBF5E8]"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        name={player.name}
                        url={resolveParticipantAvatar(player)}
                        size="xs"
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-white classic:text-[#1E4638]">
                        {player.name}
                      </span>
                      {playerPot && (
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${getPotBadgeColor(
                            playerPot
                          )}`}
                        >
                          B{playerPot}
                        </span>
                      )}
                    </div>

                    {teams.length <= 4 ? (
                      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                        {teams.map((team) => {
                          const active = assignedTeamId === team.id;
                          return (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() =>
                                setAssignments((prev) => ({
                                  ...prev,
                                  [player.id]: team.id,
                                }))
                              }
                              className={`min-h-[38px] truncate rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                                active
                                  ? 'border-emerald-600 bg-emerald-600 text-white dark:border-[#CCFF00] dark:bg-[#CCFF00] dark:text-[#0B0E14] classic:border-[#1E4638] classic:bg-[#1E4638] classic:text-[#FBF5E8]'
                                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                              }`}
                            >
                              {team.name.trim() || 'Equipo'}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <select
                        value={assignedTeamId}
                        onChange={(e) =>
                          setAssignments((prev) => ({
                            ...prev,
                            [player.id]: e.target.value,
                          }))
                        }
                        className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 dark:border-white/10 dark:bg-[#0B0E14] dark:text-white"
                      >
                        <option value="">Sin asignar</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name.trim() || 'Equipo'}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200/80 pt-4 dark:border-white/[0.08]">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              disabled={saving}
              onClick={handleConfirmSave}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black tracking-wider text-white uppercase shadow-md transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-[#CCFF00] dark:text-[#0B0E14] dark:hover:bg-[#d9ff33] classic:border-2 classic:border-[#1E4638] classic:bg-[#1E4638] classic:text-[#FBF5E8] classic:shadow-[3px_3px_0_#D9A441]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4 stroke-[2.5]" />
              )}
              <span>{saving ? 'Guardando...' : 'Guardar Equipos'}</span>
            </motion.button>
          </div>
        </>
      )}

      <LiveTeamDrawModal
        isOpen={liveDrawOpen}
        onClose={() => setLiveDrawOpen(false)}
        scopeName={scopeName}
        teams={teams}
        participants={participants}
        targetAssignments={liveDrawTargets}
        potMap={activePotSet ? activePotMap : null}
        potSetName={activePotSet?.name || ''}
        onBroadcastState={onBroadcastLiveDraw}
        onRequestReroll={handleRerollLiveDraw}
        onConfirmDraw={(confirmedAssign) => {
          setAssignments(confirmedAssign);
          setNotice(
            '¡Sorteo en vivo confirmado! Revisá los nombres y tocá "Guardar Equipos".'
          );
        }}
      />
    </div>
  );
}