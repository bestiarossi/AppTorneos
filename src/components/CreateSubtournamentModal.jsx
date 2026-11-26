import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckSquare,
  Layers,
  Loader2,
  Shuffle,
  Square,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  SUBTOURNAMENT_FORMAT_LIST,
  buildDefaultPointsScale,
  generateSubtournamentMatches,
} from '../utils/customTournamentEngine';
import {
  assignTeamsBalancedWithPots,
  getPotBadgeColor,
} from '../utils/potBalancer';
import { shuffleArray } from '../utils/tournamentEngine';

export default function CreateSubtournamentModal({
  isOpen,
  matchday,
  tournamentId,
  participants,
  potSets = [],
  potAssignments = [],
  disableEscape = false,
  onOpenPotManager,
  onClose,
  onCreated,
}) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState('league');
  const [homeAndAway, setHomeAndAway] = useState(false);
  const [thirdPlace, setThirdPlace] = useState(false);

  const [selectedParticipantIds, setSelectedParticipantIds] = useState([]);
  const [isTeamBased, setIsTeamBased] = useState(false);
  const [teams, setTeams] = useState([
    { id: 'team-1', name: 'Equipo 1' },
    { id: 'team-2', name: 'Equipo 2' },
  ]);
  const [assignments, setAssignments] = useState({});
  const [selectedPotSetId, setSelectedPotSetId] = useState('');
  const [potBalanceNotice, setPotBalanceNotice] = useState('');
  const [pointsScale, setPointsScale] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const allIds = participants.map((p) => p.id);
    setName('');
    setFormat('league');
    setHomeAndAway(false);
    setThirdPlace(false);
    setSelectedParticipantIds(allIds);
    setIsTeamBased(false);
    setTeams([
      { id: 'team-1', name: 'Equipo 1' },
      { id: 'team-2', name: 'Equipo 2' },
    ]);
    setAssignments({});
    setSelectedPotSetId(potSets[0]?.id || '');
    setPotBalanceNotice('');
    setPointsScale(buildDefaultPointsScale(allIds.length));
    setError('');
    setSubmitting(false);
  }, [isOpen, participants]);

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedPotSetId && potSets.length > 0) {
      setSelectedPotSetId(potSets[0].id);
    } else if (
      selectedPotSetId &&
      !potSets.some((ps) => ps.id === selectedPotSetId)
    ) {
      setSelectedPotSetId(potSets[0]?.id || '');
    }
  }, [isOpen, potSets, selectedPotSetId]);

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
    ? teams.length
    : selectedParticipantIds.length;

  useEffect(() => {
    if (!isOpen) return;
    setPointsScale((prev) => buildDefaultPointsScale(competitorCount, prev));
  }, [competitorCount, isOpen]);

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

  if (!isOpen || !matchday) return null;

  const participantMap = new Map(participants.map((p) => [p.id, p]));
  const selectedSet = new Set(selectedParticipantIds);

  function toggleParticipant(participantId) {
    setPotBalanceNotice('');
    setSelectedParticipantIds((prev) => {
      if (prev.includes(participantId)) {
        return prev.filter((id) => id !== participantId);
      }
      return [...prev, participantId];
    });
  }

  function selectAllParticipants() {
    setPotBalanceNotice('');
    setSelectedParticipantIds(participants.map((p) => p.id));
  }

  function clearAllParticipants() {
    setPotBalanceNotice('');
    setSelectedParticipantIds([]);
  }

  function handleTeamCountChange(nextCountRaw) {
    const parsed = Number.parseInt(nextCountRaw, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.max(2, Math.min(20, parsed));
    setPotBalanceNotice('');

    setTeams((prev) => {
      const nextTeams = [];
      for (let i = 0; i < clamped; i += 1) {
        if (prev[i]) {
          nextTeams.push(prev[i]);
        } else {
          nextTeams.push({ id: `team-${i + 1}`, name: `Equipo ${i + 1}` });
        }
      }

      const validTeamIds = new Set(nextTeams.map((t) => t.id));
      setAssignments((prevAssign) => {
        const cleaned = {};
        Object.entries(prevAssign).forEach(([pId, tId]) => {
          if (validTeamIds.has(tId)) {
            cleaned[pId] = tId;
          }
        });
        return cleaned;
      });

      return nextTeams;
    });
  }

  function handleRandomizeTeams() {
    if (selectedParticipantIds.length < 2 || teams.length < 2) return;
    setPotBalanceNotice('');
    const shuffled = shuffleArray(selectedParticipantIds);
    const nextAssignments = {};
    shuffled.forEach((pId, index) => {
      const team = teams[index % teams.length];
      nextAssignments[pId] = team.id;
    });
    setAssignments(nextAssignments);
  }

  function handleBalancedWithPots() {
    setError('');
    setPotBalanceNotice('');

    if (!activePotSet) {
      setError('Selecciona un set de bombos primero.');
      return;
    }

    if (selectedParticipantIds.length < teams.length) {
      setError(
        `Necesitas al menos ${teams.length} jugadores seleccionados para armar ${teams.length} equipos.`
      );
      return;
    }

    const balanced = assignTeamsBalancedWithPots(
      selectedParticipantIds,
      teams,
      activePotMap,
      activePotSet.pot_count
    );

    setAssignments(balanced);
    setPotBalanceNotice(
      `Equipos armados de forma equilibrada usando "${activePotSet.name}".`
    );
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

    if (isTeamBased) {
      if (teams.length < 2) {
        setError('Debe haber al menos 2 equipos.');
        return;
      }

      if (selectedParticipantIds.length < teams.length) {
        setError(
          `Seleccionaste ${selectedParticipantIds.length} jugadores para ${teams.length} equipos. Reduce la cantidad de equipos o selecciona más jugadores.`
        );
        return;
      }

      const emptyTeamName = teams.find((t) => !t.name.trim());
      if (emptyTeamName) {
        setError('Todos los equipos deben tener un nombre.');
        return;
      }

      const unassignedPlayers = selectedParticipantIds.filter(
        (pId) => !assignments[pId]
      );
      if (unassignedPlayers.length > 0) {
        setError(
          `Faltan ${unassignedPlayers.length} jugadores por asignar a un equipo.`
        );
        return;
      }

      const teamMemberCounts = new Map(teams.map((t) => [t.id, 0]));
      selectedParticipantIds.forEach((pId) => {
        const tId = assignments[pId];
        if (teamMemberCounts.has(tId)) {
          teamMemberCounts.set(tId, teamMemberCounts.get(tId) + 1);
        }
      });

      const emptyTeam = teams.find((t) => (teamMemberCounts.get(t.id) || 0) === 0);
      if (emptyTeam) {
        setError(`El equipo "${emptyTeam.name}" no tiene jugadores asignados.`);
        return;
      }
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

    const config = {
      is_team_based: isTeamBased,
    };
    if (format === 'league') {
      config.home_and_away = homeAndAway;
    } else if (format === 'knockout') {
      config.home_and_away = homeAndAway;
      config.third_place = thirdPlace && competitorCount >= 4;
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
          format,
          config,
          points_scale: parsedScale,
          status: 'active',
        })
        .select()
        .single();

      if (subError) throw subError;
      createdSubId = createdSub.id;

      let entryPayloads = [];
      if (!isTeamBased) {
        entryPayloads = selectedParticipantIds.map((pId) => ({
          subtournament_id: createdSub.id,
          entry_name: participantMap.get(pId)?.name || 'Jugador',
          participant_id: pId,
        }));
      } else {
        entryPayloads = teams.map((team) => ({
          subtournament_id: createdSub.id,
          entry_name: team.name.trim(),
          participant_id: null,
        }));
      }

      const { data: createdEntries, error: entriesError } = await supabase
        .from('subtournament_entries')
        .insert(entryPayloads)
        .select();

      if (entriesError) throw entriesError;

      const memberPayloads = [];
      if (!isTeamBased) {
        createdEntries.forEach((entry) => {
          if (entry.participant_id) {
            memberPayloads.push({
              entry_id: entry.id,
              participant_id: entry.participant_id,
            });
          }
        });
      } else {
        createdEntries.forEach((entry, index) => {
          const team = teams[index];
          selectedParticipantIds.forEach((pId) => {
            if (assignments[pId] === team.id) {
              memberPayloads.push({
                entry_id: entry.id,
                participant_id: pId,
              });
            }
          });
        });
      }

      if (memberPayloads.length > 0) {
        const { error: membersError } = await supabase
          .from('subtournament_entry_members')
          .insert(memberPayloads);

        if (membersError) throw membersError;
      }

      if (format === 'league' || format === 'knockout') {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Crear Subtorneo — {matchday.name}
              </h2>
              <p className="text-xs text-slate-500">
                Define formato, competidores o equipos y los puntos que reparte.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Nombre y Formato */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="subtournament-name"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
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
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
            </div>

            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                      className={`rounded-xl border p-3 text-left transition ${
                        selected
                          ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">
                          {item.label}
                        </span>
                        <span
                          className={`h-3.5 w-3.5 rounded-full border-2 ${
                            selected
                              ? 'border-emerald-600 bg-emerald-600'
                              : 'border-slate-300 bg-white'
                          }`}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {(format === 'league' || format === 'knockout') && (
                <div className="mt-3 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={homeAndAway}
                      onChange={(e) => setHomeAndAway(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                    />
                    <span>
                      {format === 'league' ? 'Ida y vuelta' : 'Cruces a ida y vuelta'}
                    </span>
                  </label>

                  {format === 'knockout' && (
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={thirdPlace}
                        onChange={(e) => setThirdPlace(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                      />
                      <span>Partido por el 3.º puesto (4+ competidores)</span>
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Participantes */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                <Users className="h-3.5 w-3.5 text-emerald-600" />
                <span>
                  Participantes ({selectedParticipantIds.length} de{' '}
                  {participants.length})
                </span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllParticipants}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Seleccionar todos
                </button>
                <button
                  type="button"
                  onClick={clearAllParticipants}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Ninguno
                </button>
              </div>
            </div>

            {participants.length < 2 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Agrega al menos 2 participantes al torneo general antes de crear un
                subtorneo.
              </div>
            ) : (
              <div className="grid max-h-44 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
                {participants.map((p) => {
                  const isChecked = selectedSet.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleParticipant(p.id)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                        isChecked
                          ? 'border-emerald-400 bg-white text-emerald-900 shadow-2xs'
                          : 'border-slate-200 bg-white/60 text-slate-500 hover:bg-white'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <Square className="h-4 w-4 shrink-0 text-slate-300" />
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
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Modalidad de competencia
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsTeamBased(false)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  !isTeamBased
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <User className="h-4 w-4" />
                <span>Individual</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTeamBased(true)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  isTeamBased
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Por Equipos</span>
              </button>
            </div>

            {isTeamBased && (
              <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <label
                      htmlFor="team-count-input"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Cantidad de equipos:
                    </label>
                    <input
                      id="team-count-input"
                      type="number"
                      min={2}
                      max={20}
                      value={teams.length}
                      onChange={(e) => handleTeamCountChange(e.target.value)}
                      className="w-20 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-center text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleRandomizeTeams}
                    disabled={selectedParticipantIds.length < 2}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    <Shuffle className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Armar equipos al azar</span>
                  </button>
                </div>

                {/* Armado equilibrado con Bombos guardados */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <Layers className="h-3.5 w-3.5 text-amber-600" />
                      <span>Equipos equilibrados con Bombos</span>
                    </span>

                    {onOpenPotManager && (
                      <button
                        type="button"
                        onClick={onOpenPotManager}
                        className="text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-950"
                      >
                        {potSets.length > 0 ? 'Gestionar bombos' : 'Crear bombos'}
                      </button>
                    )}
                  </div>

                  {potSets.length === 0 ? (
                    <p className="mt-1.5 text-xs text-amber-800/80">
                      Todavía no creaste sets de bombos (ej: Bombos FIFA o Truco)
                      para este torneo.
                    </p>
                  ) : (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <select
                        value={selectedPotSetId}
                        onChange={(e) => {
                          setSelectedPotSetId(e.target.value);
                          setPotBalanceNotice('');
                        }}
                        className="min-w-[180px] flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none"
                      >
                        {potSets.map((ps) => (
                          <option key={ps.id} value={ps.id}>
                            {ps.name} ({ps.pot_count} bombos)
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleBalancedWithPots}
                        disabled={!activePotSet || selectedParticipantIds.length < 2}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-amber-700 disabled:opacity-50"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>Armar equilibrados</span>
                      </button>
                    </div>
                  )}

                  {potBalanceNotice && (
                    <p className="mt-2 text-xs font-semibold text-emerald-700">
                      {potBalanceNotice}
                    </p>
                  )}
                </div>

                {/* Nombres de equipos */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {teams.map((team, idx) => {
                    const countInTeam = selectedParticipantIds.filter(
                      (pId) => assignments[pId] === team.id
                    ).length;

                    return (
                      <div
                        key={team.id}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-600">
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
                          className="min-w-0 flex-1 text-sm font-semibold text-slate-900 focus:outline-none"
                        />
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {countInTeam}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Asignación de jugadores */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-600">
                    Asigna cada jugador seleccionado a su equipo:
                  </p>

                  {selectedParticipantIds.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      Selecciona participantes arriba primero.
                    </p>
                  ) : (
                    <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                      {selectedParticipantIds.map((pId) => {
                        const player = participantMap.get(pId);
                        const assignedTeamId = assignments[pId] || '';
                        const playerPot = activePotMap.get(pId);

                        return (
                          <div
                            key={pId}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800">
                                {player?.name}
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
                              <div className="flex flex-wrap gap-1.5">
                                {teams.map((team) => {
                                  const active = assignedTeamId === team.id;
                                  return (
                                    <button
                                      key={team.id}
                                      type="button"
                                      onClick={() =>
                                        setAssignments((prev) => ({
                                          ...prev,
                                          [pId]: team.id,
                                        }))
                                      }
                                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                                        active
                                          ? 'border-emerald-600 bg-emerald-600 text-white'
                                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
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
                                    [pId]: e.target.value,
                                  }))
                                }
                                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none"
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
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 4. Escala de puntos por puesto */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                Puntos que otorga al torneo general
              </span>
              <span className="text-xs text-slate-500">
                {competitorCount}{' '}
                {isTeamBased
                  ? competitorCount === 1
                    ? 'equipo'
                    : 'equipos'
                  : competitorCount === 1
                  ? 'competidor'
                  : 'competidores'}
              </span>
            </div>

            {competitorCount < 2 ? (
              <p className="text-xs text-slate-500">
                Selecciona al menos 2 competidores para configurar los puntos por
                puesto.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
                  {pointsScale.map((pts, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-slate-200 bg-white p-2.5"
                    >
                      <label className="mb-1 block text-[11px] font-bold text-slate-500">
                        {index + 1}.º puesto
                      </label>
                      <input
                        type="number"
                        step="any"
                        min={0}
                        value={pts}
                        onChange={(e) =>
                          handlePointInputChange(index, e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-sm font-bold text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
                {isTeamBased && (
                  <p className="mt-2.5 text-[11px] text-slate-500">
                    En modalidad por equipos, cada integrante del equipo recibirá los
                    puntos asignados al puesto obtenido por su equipo.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || participants.length < 2}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{submitting ? 'Creando...' : 'Crear Subtorneo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}