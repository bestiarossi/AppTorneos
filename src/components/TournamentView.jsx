import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Check,
  Copy,
  Crown,
  Layers,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Swords,
  Table2,
  Trash2,
  Unlink,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  formatShortDate,
  getConfigSummaryItems,
  getFormatMeta,
  getRoleMeta,
} from '../utils/tournamentFormats';
import {
  generateKnockoutMatches,
  generateLeagueMatches,
  getKnockoutSeriesStatus,
} from '../utils/tournamentEngine';
import CustomMatchdaysTab from './CustomMatchdaysTab';
import CustomStandingsTab from './CustomStandingsTab';
import MatchResultModal from './MatchResultModal';
import PotSetsModal from './PotSetsModal';
import TournamentMatchesTab from './TournamentMatchesTab';
import TournamentStandingsTab from './TournamentStandingsTab';
import TournamentStatsTab from './TournamentStatsTab';

const TABS = [
  { id: 'standings', label: 'Tabla', icon: Table2 },
  { id: 'matches', label: 'Cruces / Jornadas', icon: Swords },
  { id: 'stats', label: 'Estadísticas', icon: BarChart3 },
];

const HERO_GLOW_BY_FORMAT = {
  league: 'from-emerald-500/18 via-teal-500/6 to-transparent',
  knockout: 'from-amber-500/18 via-orange-500/6 to-transparent',
  last_standing: 'from-rose-500/18 via-pink-500/6 to-transparent',
  custom: 'from-indigo-500/18 via-violet-500/6 to-transparent',
};

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function TournamentView({ tournamentId, user, onBack }) {
  const [tournament, setTournament] = useState(null);
  const [membership, setMembership] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [matches, setMatches] = useState([]);
  const [eliminations, setEliminations] = useState([]);

  // Estado específico de formato 'custom'
  const [customMatchdays, setCustomMatchdays] = useState([]);
  const [subtournaments, setSubtournaments] = useState([]);
  const [subEntries, setSubEntries] = useState([]);
  const [subEntryMembers, setSubEntryMembers] = useState([]);
  const [subMatches, setSubMatches] = useState([]);
  const [subEliminations, setSubEliminations] = useState([]);
  const [potSets, setPotSets] = useState([]);
  const [potAssignments, setPotAssignments] = useState([]);
  const [isPotModalOpen, setIsPotModalOpen] = useState(false);
  const [selectedSubtournamentId, setSelectedSubtournamentId] = useState(null);
  const autoInitMatchdaysTournamentRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('standings');
  const [copiedCode, setCopiedCode] = useState(false);

  const [newParticipantName, setNewParticipantName] = useState('');
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [participantActionError, setParticipantActionError] = useState('');

  const [claimingId, setClaimingId] = useState(null);

  const [editingParticipantId, setEditingParticipantId] = useState(null);
  const [editingParticipantName, setEditingParticipantName] = useState('');
  const [savingParticipantId, setSavingParticipantId] = useState(null);
  const [removingParticipantId, setRemovingParticipantId] = useState(null);

  const [isEditingTournament, setIsEditingTournament] = useState(false);
  const [editTournamentName, setEditTournamentName] = useState('');
  const [editHomeAndAway, setEditHomeAndAway] = useState(false);
  const [editThirdPlace, setEditThirdPlace] = useState(false);
  const [editRounds, setEditRounds] = useState('');
  const [editInitialLives, setEditInitialLives] = useState('1');
  const [editNotes, setEditNotes] = useState('');
  const [savingTournament, setSavingTournament] = useState(false);

  const [confirmDeleteTournament, setConfirmDeleteTournament] = useState(false);
  const [deletingTournament, setDeletingTournament] = useState(false);

  const [generatingMatches, setGeneratingMatches] = useState(false);
  const [mutatingElimination, setMutatingElimination] = useState(false);
  const [matchModalState, setMatchModalState] = useState({
    isOpen: false,
    match: null,
    siblingLeg: null,
  });

  const fetchCustomData = useCallback(async (tData, role) => {
    const [matchdaysRes, subsRes, potSetsRes] = await Promise.all([
      supabase
        .from('custom_matchdays')
        .select('*')
        .eq('tournament_id', tData.id)
        .order('matchday_number', { ascending: true }),
      supabase
        .from('subtournaments')
        .select('*')
        .eq('tournament_id', tData.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('tournament_pot_sets')
        .select('*')
        .eq('tournament_id', tData.id)
        .order('created_at', { ascending: true }),
    ]);

    if (matchdaysRes.error) throw matchdaysRes.error;
    if (subsRes.error) throw subsRes.error;
    if (potSetsRes.error) throw potSetsRes.error;

    let finalMatchdays = matchdaysRes.data || [];

    if (
      role === 'admin' &&
      finalMatchdays.length === 0 &&
      autoInitMatchdaysTournamentRef.current !== tData.id
    ) {
      autoInitMatchdaysTournamentRef.current = tData.id;
      const configuredRounds = Number.parseInt(tData.config?.rounds, 10);
      if (!Number.isNaN(configuredRounds) && configuredRounds > 0) {
        const count = Math.min(configuredRounds, 50);
        const rowsToInsert = Array.from({ length: count }, (_, idx) => ({
          tournament_id: tData.id,
          matchday_number: idx + 1,
          name: `Jornada ${idx + 1}`,
        }));

        const { data: createdMatchdays, error: initError } = await supabase
          .from('custom_matchdays')
          .insert(rowsToInsert)
          .select();

        if (initError) throw initError;
        finalMatchdays = (createdMatchdays || []).sort(
          (a, b) => a.matchday_number - b.matchday_number
        );
      }
    } else {
      autoInitMatchdaysTournamentRef.current = tData.id;
    }

    const subs = subsRes.data || [];
    const subIds = subs.map((s) => s.id);

    let entries = [];
    let entryMembers = [];
    let sMatches = [];
    let sEliminations = [];

    if (subIds.length > 0) {
      const [entriesRes, sMatchesRes, sElimRes] = await Promise.all([
        supabase
          .from('subtournament_entries')
          .select('*')
          .in('subtournament_id', subIds)
          .order('created_at', { ascending: true }),
        supabase
          .from('subtournament_matches')
          .select('*')
          .in('subtournament_id', subIds)
          .order('round_number', { ascending: true })
          .order('match_order', { ascending: true })
          .order('leg', { ascending: true }),
        supabase
          .from('subtournament_eliminations')
          .select('*')
          .in('subtournament_id', subIds)
          .order('elimination_order', { ascending: true }),
      ]);

      if (entriesRes.error) throw entriesRes.error;
      if (sMatchesRes.error) throw sMatchesRes.error;
      if (sElimRes.error) throw sElimRes.error;

      entries = entriesRes.data || [];
      sMatches = sMatchesRes.data || [];
      sEliminations = sElimRes.data || [];

      const entryIds = entries.map((e) => e.id);
      if (entryIds.length > 0) {
        const membersRes = await supabase
          .from('subtournament_entry_members')
          .select('*')
          .in('entry_id', entryIds);

        if (membersRes.error) throw membersRes.error;
        entryMembers = membersRes.data || [];
      }
    }

    const loadedPotSets = potSetsRes.data || [];
    const potSetIds = loadedPotSets.map((ps) => ps.id);
    let loadedPotAssignments = [];

    if (potSetIds.length > 0) {
      const potAssignRes = await supabase
        .from('tournament_pot_assignments')
        .select('*')
        .in('pot_set_id', potSetIds);

      if (potAssignRes.error) throw potAssignRes.error;
      loadedPotAssignments = potAssignRes.data || [];
    }

    setCustomMatchdays(finalMatchdays);
    setSubtournaments(subs);
    setSubEntries(entries);
    setSubEntryMembers(entryMembers);
    setSubMatches(sMatches);
    setSubEliminations(sEliminations);
    setPotSets(loadedPotSets);
    setPotAssignments(loadedPotAssignments);
  }, []);

  const loadTournamentData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [tournamentRes, membershipRes, participantsRes] = await Promise.all([
        supabase
          .from('tournaments')
          .select('*')
          .eq('id', tournamentId)
          .single(),
        supabase
          .from('tournament_members')
          .select('id, role, user_id')
          .eq('tournament_id', tournamentId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('tournament_participants')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('created_at', { ascending: true }),
      ]);

      if (tournamentRes.error) throw tournamentRes.error;
      if (membershipRes.error) throw membershipRes.error;
      if (participantsRes.error) throw participantsRes.error;

      if (!membershipRes.data) {
        throw new Error('No tienes acceso a este torneo.');
      }

      const tData = tournamentRes.data;
      const mData = membershipRes.data;

      setTournament(tData);
      setMembership(mData);
      setParticipants(participantsRes.data || []);

      if (tData.format === 'custom') {
        setMatches([]);
        setEliminations([]);
        await fetchCustomData(tData, mData.role);
      } else {
        const [matchesRes, eliminationsRes] = await Promise.all([
          supabase
            .from('matches')
            .select('*')
            .eq('tournament_id', tournamentId)
            .order('round_number', { ascending: true })
            .order('match_order', { ascending: true })
            .order('leg', { ascending: true }),
          supabase
            .from('last_standing_eliminations')
            .select('*')
            .eq('tournament_id', tournamentId)
            .order('elimination_order', { ascending: true }),
        ]);

        if (matchesRes.error) throw matchesRes.error;
        if (eliminationsRes.error) throw eliminationsRes.error;

        setMatches(matchesRes.data || []);
        setEliminations(eliminationsRes.data || []);
        setCustomMatchdays([]);
        setSubtournaments([]);
        setSubEntries([]);
        setSubEntryMembers([]);
        setSubMatches([]);
        setSubEliminations([]);
        setPotSets([]);
        setPotAssignments([]);
      }
    } catch (err) {
      setError(err?.message || 'No se pudo cargar la información del torneo.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, user.id, fetchCustomData]);

  useEffect(() => {
    setSelectedSubtournamentId(null);
    setIsPotModalOpen(false);
    loadTournamentData();
  }, [loadTournamentData]);

  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants]
  );

  const isAdmin = membership?.role === 'admin';
  const myLinkedParticipant =
    participants.find((p) => p.user_id === user.id) || null;

  const refreshCustomDataSilently = useCallback(async () => {
    if (!tournament || tournament.format !== 'custom' || !membership) return;
    await fetchCustomData(tournament, membership.role);
  }, [tournament, membership, fetchCustomData]);

  async function refreshMatchesOnly() {
    const { data, error: fetchError } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round_number', { ascending: true })
      .order('match_order', { ascending: true })
      .order('leg', { ascending: true });

    if (fetchError) throw fetchError;
    setMatches(data || []);
    return data || [];
  }

  async function syncKnockoutProgression(latestMatches) {
    if (tournament?.format !== 'knockout') return latestMatches;

    const regularBracketRounds = latestMatches
      .filter((m) => m.round_name !== 'Tercer puesto')
      .reduce((max, m) => Math.max(max, m.round_number), 0);

    if (regularBracketRounds < 2) return latestMatches;

    const working = latestMatches.map((m) => ({ ...m }));
    const updatesById = new Map();

    for (let r = 1; r < regularBracketRounds; r += 1) {
      const roundMatches = working.filter(
        (m) => m.round_number === r && m.round_name !== 'Tercer puesto'
      );
      const matchOrders = Array.from(
        new Set(roundMatches.map((m) => m.match_order))
      ).sort((a, b) => a - b);

      matchOrders.forEach((order) => {
        const tieMatches = roundMatches.filter((m) => m.match_order === order);
        const series = getKnockoutSeriesStatus(tieMatches);

        const nextRound = r + 1;
        const nextOrder = Math.ceil(order / 2);
        const isTopSlot = order % 2 === 1;
        const nextWinnerId = series.isCompleted ? series.winnerId : null;

        const targetMatches = working.filter(
          (m) =>
            m.round_number === nextRound &&
            m.match_order === nextOrder &&
            m.round_name !== 'Tercer puesto'
        );

        targetMatches.forEach((target) => {
          let fieldToSet = null;
          if (target.leg === 1) {
            fieldToSet = isTopSlot ? 'participant_a_id' : 'participant_b_id';
          } else {
            fieldToSet = isTopSlot ? 'participant_b_id' : 'participant_a_id';
          }

          if (target[fieldToSet] !== nextWinnerId) {
            target[fieldToSet] = nextWinnerId;
            target.score_a = null;
            target.score_b = null;
            target.winner_id = null;
            target.is_draw = false;
            target.status = 'pending';

            updatesById.set(target.id, {
              id: target.id,
              [fieldToSet]: nextWinnerId,
              score_a: null,
              score_b: null,
              winner_id: null,
              is_draw: false,
              status: 'pending',
            });
          }
        });

        const isSemifinalRound = r === regularBracketRounds - 1;
        if (isSemifinalRound) {
          const thirdPlaceMatch = working.find(
            (m) => m.round_name === 'Tercer puesto'
          );
          if (thirdPlaceMatch) {
            const loserId = series.isCompleted ? series.loserId : null;
            const fieldToSet = isTopSlot ? 'participant_a_id' : 'participant_b_id';

            if (thirdPlaceMatch[fieldToSet] !== loserId) {
              thirdPlaceMatch[fieldToSet] = loserId;
              thirdPlaceMatch.score_a = null;
              thirdPlaceMatch.score_b = null;
              thirdPlaceMatch.winner_id = null;
              thirdPlaceMatch.is_draw = false;
              thirdPlaceMatch.status = 'pending';

              updatesById.set(thirdPlaceMatch.id, {
                id: thirdPlaceMatch.id,
                [fieldToSet]: loserId,
                score_a: null,
                score_b: null,
                winner_id: null,
                is_draw: false,
                status: 'pending',
              });
            }
          }
        }
      });
    }

    if (updatesById.size > 0) {
      await Promise.all(
        Array.from(updatesById.values()).map(({ id, ...patch }) =>
          supabase.from('matches').update(patch).eq('id', id)
        )
      );
      return refreshMatchesOnly();
    }

    return latestMatches;
  }

  async function handleGenerateMatches() {
    if (!isAdmin || !tournament) return;
    setError('');
    setGeneratingMatches(true);

    try {
      let generatedRows = [];
      if (tournament.format === 'league') {
        generatedRows = generateLeagueMatches(tournament, participants);
      } else if (tournament.format === 'knockout') {
        generatedRows = generateKnockoutMatches(tournament, participants);
      } else {
        throw new Error('Este formato no utiliza generación automática de cruces.');
      }

      const { error: deleteError } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournament.id);

      if (deleteError) throw deleteError;

      const { data: insertedRows, error: insertError } = await supabase
        .from('matches')
        .insert(generatedRows)
        .select();

      if (insertError) throw insertError;

      const sorted = (insertedRows || []).sort((a, b) => {
        if (a.round_number !== b.round_number) {
          return a.round_number - b.round_number;
        }
        if (a.match_order !== b.match_order) {
          return a.match_order - b.match_order;
        }
        return a.leg - b.leg;
      });

      setMatches(sorted);
    } catch (err) {
      setError(err?.message || 'No se pudieron generar los cruces del torneo.');
    } finally {
      setGeneratingMatches(false);
    }
  }

  async function handleSaveMatchResult({ primaryUpdate, siblingUpdate }) {
    if (!isAdmin || !matchModalState.match) return;
    const targetMatch = matchModalState.match;

    const { error: updateError } = await supabase
      .from('matches')
      .update(primaryUpdate)
      .eq('id', targetMatch.id);

    if (updateError) throw updateError;

    if (siblingUpdate) {
      const { error: sibError } = await supabase
        .from('matches')
        .update(siblingUpdate.patch)
        .eq('id', siblingUpdate.id);

      if (sibError) throw sibError;
    }

    const latest = await refreshMatchesOnly();
    await syncKnockoutProgression(latest);
  }

  async function handleResetMatchResult(targetMatch) {
    if (!isAdmin || !targetMatch) return;

    const { error: resetError } = await supabase
      .from('matches')
      .update({
        score_a: null,
        score_b: null,
        winner_id: null,
        is_draw: false,
        status: 'pending',
      })
      .eq('id', targetMatch.id);

    if (resetError) throw resetError;

    const latest = await refreshMatchesOnly();
    await syncKnockoutProgression(latest);
  }

  async function handleEliminateParticipant(participantId) {
    if (!isAdmin || !tournament) return;
    setError('');
    setMutatingElimination(true);

    try {
      const nextOrder =
        eliminations.reduce(
          (max, item) => Math.max(max, item.elimination_order),
          0
        ) + 1;

      const { data, error: insertError } = await supabase
        .from('last_standing_eliminations')
        .insert({
          tournament_id: tournament.id,
          participant_id: participantId,
          elimination_order: nextOrder,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setEliminations((prev) =>
        [...prev, data].sort((a, b) => a.elimination_order - b.elimination_order)
      );
    } catch (err) {
      setError(err?.message || 'No se pudo registrar la eliminación.');
    } finally {
      setMutatingElimination(false);
    }
  }

  async function handleRevertElimination(eliminationRow) {
    if (!isAdmin || !eliminationRow) return;
    setError('');
    setMutatingElimination(true);

    try {
      const { error: deleteError } = await supabase
        .from('last_standing_eliminations')
        .delete()
        .eq('id', eliminationRow.id);

      if (deleteError) throw deleteError;

      setEliminations((prev) =>
        prev.filter((item) => item.id !== eliminationRow.id)
      );
    } catch (err) {
      setError(err?.message || 'No se pudo revertir la eliminación.');
    } finally {
      setMutatingElimination(false);
    }
  }

  async function handleResetAllEliminations() {
    if (!isAdmin || !tournament) return;
    setError('');
    setMutatingElimination(true);

    try {
      const { error: deleteError } = await supabase
        .from('last_standing_eliminations')
        .delete()
        .eq('tournament_id', tournament.id);

      if (deleteError) throw deleteError;
      setEliminations([]);
    } catch (err) {
      setError(err?.message || 'No se pudieron reiniciar las eliminaciones.');
    } finally {
      setMutatingElimination(false);
    }
  }

  async function handleCopyInviteCode() {
    if (!tournament?.invite_code) return;

    try {
      await navigator.clipboard.writeText(tournament.invite_code);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = tournament.invite_code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  async function handleClaimParticipant(participantId) {
    setParticipantActionError('');
    setClaimingId(participantId);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'claim_tournament_participant',
        { p_participant_id: participantId }
      );

      if (rpcError) throw rpcError;

      setParticipants((prev) =>
        prev.map((item) => (item.id === participantId ? data : item))
      );
    } catch (err) {
      setParticipantActionError(
        err?.message || 'No se pudo vincular tu cuenta a este participante.'
      );
    } finally {
      setClaimingId(null);
    }
  }

  async function handleAddParticipant(e) {
    e.preventDefault();
    if (!isAdmin) return;

    setParticipantActionError('');
    const cleanName = newParticipantName.trim();
    if (!cleanName) {
      setParticipantActionError('Ingresa un nombre para agregar.');
      return;
    }

    const duplicate = participants.some(
      (p) => p.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      setParticipantActionError('Ya existe un participante con ese nombre.');
      return;
    }

    setAddingParticipant(true);

    try {
      const { data, error: insertError } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournament.id,
          name: cleanName,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setParticipants((prev) => [...prev, data]);
      setNewParticipantName('');
    } catch (err) {
      setParticipantActionError(
        err?.message || 'No se pudo agregar al participante.'
      );
    } finally {
      setAddingParticipant(false);
    }
  }

  function startEditingParticipant(participant) {
    if (!isAdmin) return;
    setParticipantActionError('');
    setEditingParticipantId(participant.id);
    setEditingParticipantName(participant.name);
  }

  async function handleSaveParticipantName(participantId) {
    if (!isAdmin) return;
    setParticipantActionError('');

    const cleanName = editingParticipantName.trim();
    if (!cleanName) {
      setParticipantActionError('El nombre no puede quedar vacío.');
      return;
    }

    setSavingParticipantId(participantId);

    try {
      const { data, error: updateError } = await supabase
        .from('tournament_participants')
        .update({ name: cleanName })
        .eq('id', participantId)
        .select()
        .single();

      if (updateError) throw updateError;

      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? data : p))
      );
      setEditingParticipantId(null);
      setEditingParticipantName('');
    } catch (err) {
      setParticipantActionError(
        err?.message || 'No se pudo actualizar el nombre del participante.'
      );
    } finally {
      setSavingParticipantId(null);
    }
  }

  async function handleUnlinkParticipant(participantId) {
    if (!isAdmin) return;
    setParticipantActionError('');
    setSavingParticipantId(participantId);

    try {
      const { data, error: unlinkError } = await supabase
        .from('tournament_participants')
        .update({ user_id: null })
        .eq('id', participantId)
        .select()
        .single();

      if (unlinkError) throw unlinkError;

      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? data : p))
      );
    } catch (err) {
      setParticipantActionError(
        err?.message || 'No se pudo desvincular la cuenta.'
      );
    } finally {
      setSavingParticipantId(null);
    }
  }

  async function handleDeleteParticipant(participantId) {
    if (!isAdmin) return;
    setParticipantActionError('');
    setRemovingParticipantId(participantId);

    try {
      const { error: deleteError } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('id', participantId);

      if (deleteError) throw deleteError;

      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
      setEliminations((prev) =>
        prev.filter((el) => el.participant_id !== participantId)
      );

      if (tournament?.format === 'custom') {
        await refreshCustomDataSilently();
      }
    } catch (err) {
      setParticipantActionError(
        err?.message || 'No se pudo eliminar al participante.'
      );
    } finally {
      setRemovingParticipantId(null);
    }
  }

  function openTournamentEdit() {
    if (!isAdmin || !tournament) return;
    const cfg = tournament.config || {};
    setEditTournamentName(tournament.name);
    setEditHomeAndAway(Boolean(cfg.home_and_away));
    setEditThirdPlace(Boolean(cfg.third_place));
    setEditRounds(cfg.rounds ? String(cfg.rounds) : '');
    setEditInitialLives(cfg.initial_lives ? String(cfg.initial_lives) : '1');
    setEditNotes(cfg.notes || '');
    setIsEditingTournament(true);
  }

  async function handleSaveTournamentEdit(e) {
    e.preventDefault();
    if (!isAdmin || !tournament) return;

    const cleanName = editTournamentName.trim();
    if (!cleanName) return;

    const parsedRounds = editRounds.trim()
      ? Number.parseInt(editRounds.trim(), 10)
      : null;

    let nextConfig = {};
    if (tournament.format === 'league') {
      nextConfig = {
        home_and_away: editHomeAndAway,
        ...(parsedRounds && parsedRounds > 0 ? { rounds: parsedRounds } : {}),
      };
    } else if (tournament.format === 'knockout') {
      nextConfig = {
        home_and_away: editHomeAndAway,
        third_place: editThirdPlace,
      };
    } else if (tournament.format === 'last_standing') {
      const parsedLives = Number.parseInt(editInitialLives.trim() || '1', 10);
      nextConfig = {
        initial_lives: Number.isNaN(parsedLives) || parsedLives < 1 ? 1 : parsedLives,
        ...(parsedRounds && parsedRounds > 0 ? { rounds: parsedRounds } : {}),
      };
    } else {
      nextConfig = {
        ...(parsedRounds && parsedRounds > 0 ? { rounds: parsedRounds } : {}),
        ...(editNotes.trim() ? { notes: editNotes.trim() } : {}),
      };
    }

    setSavingTournament(true);
    setError('');

    try {
      const { data, error: updateError } = await supabase
        .from('tournaments')
        .update({
          name: cleanName,
          config: nextConfig,
        })
        .eq('id', tournament.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setTournament(data);
      setIsEditingTournament(false);
    } catch (err) {
      setError(err?.message || 'No se pudo guardar la edición del torneo.');
    } finally {
      setSavingTournament(false);
    }
  }

  async function handleDeleteTournament() {
    if (!isAdmin || !tournament) return;
    setDeletingTournament(true);

    try {
      const { error: deleteError } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournament.id);

      if (deleteError) throw deleteError;
      onBack();
    } catch (err) {
      setError(err?.message || 'No se pudo eliminar el torneo.');
      setDeletingTournament(false);
      setConfirmDeleteTournament(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="glass-card flex items-center justify-center rounded-2xl py-24">
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
            <span>Cargando torneo...</span>
          </div>
        </div>
      </main>
    );
  }

  if (error && !tournament) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a mis torneos</span>
        </button>

        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">No se pudo abrir el torneo</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  const formatMeta = getFormatMeta(tournament.format);
  const roleMeta = getRoleMeta(membership.role);
  const configItems = getConfigSummaryItems(tournament.format, tournament.config);
  const heroGlow =
    HERO_GLOW_BY_FORMAT[tournament.format] || HERO_GLOW_BY_FORMAT.league;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4">
        <motion.button
          type="button"
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a mis torneos</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Encabezado Glass del Torneo */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="glass-card relative mb-6 overflow-hidden rounded-3xl p-5 sm:p-6"
      >
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${heroGlow}`}
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${roleMeta.badgeClass}`}
              >
                {isAdmin ? <Crown className="h-3 w-3" /> : <User className="h-3 w-3" />}
                <span>{roleMeta.fullLabel}</span>
              </span>

              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${formatMeta.badgeClass}`}
              >
                {formatMeta.label}
              </span>

              {tournament.created_at && (
                <span className="text-xs text-slate-400">
                  Creado el {formatShortDate(tournament.created_at)}
                </span>
              )}
            </div>

            <AnimatePresence mode="wait">
              {isAdmin && isEditingTournament ? (
                <motion.form
                  key="edit-form"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  onSubmit={handleSaveTournamentEdit}
                  className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-700/80 dark:bg-slate-900/80"
                >
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Nombre del torneo
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={editTournamentName}
                      onChange={(e) => setEditTournamentName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                    />
                  </div>

                  {tournament.format === 'league' && (
                    <div className="flex flex-wrap gap-3">
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={editHomeAndAway}
                          onChange={(e) => setEditHomeAndAway(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                        />
                        <span>Ida y vuelta</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={editRounds}
                        onChange={(e) => setEditRounds(e.target.value)}
                        placeholder="Jornadas (opcional)"
                        className="w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {tournament.format === 'knockout' && (
                    <div className="flex flex-wrap gap-3">
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={editHomeAndAway}
                          onChange={(e) => setEditHomeAndAway(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                        />
                        <span>Cruces ida y vuelta</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={editThirdPlace}
                          onChange={(e) => setEditThirdPlace(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                        />
                        <span>Con 3.º puesto</span>
                      </label>
                    </div>
                  )}

                  {tournament.format === 'last_standing' && (
                    <div className="flex flex-wrap gap-3">
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={editInitialLives}
                        onChange={(e) => setEditInitialLives(e.target.value)}
                        placeholder="Vidas iniciales"
                        className="w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                      />
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={editRounds}
                        onChange={(e) => setEditRounds(e.target.value)}
                        placeholder="Máx. jornadas"
                        className="w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {tournament.format === 'custom' && (
                    <div className="flex flex-wrap gap-3">
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={editRounds}
                        onChange={(e) => setEditRounds(e.target.value)}
                        placeholder="Jornadas"
                        className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        maxLength={80}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Regla o nota"
                        className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      type="submit"
                      disabled={savingTournament}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {savingTournament && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <span>Guardar cambios</span>
                    </motion.button>
                    <button
                      type="button"
                      onClick={() => setIsEditingTournament(false)}
                      disabled={savingTournament}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.div
                  key="title-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                      {tournament.name}
                    </h1>

                    {isAdmin && (
                      <div className="flex items-center gap-1.5">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          onClick={openTournamentEdit}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </motion.button>

                        {!confirmDeleteTournament ? (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={() => setConfirmDeleteTournament(true)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800/80"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Eliminar</span>
                          </motion.button>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1"
                          >
                            <span className="text-xs font-semibold text-rose-700">
                              ¿Confirmar?
                            </span>
                            <button
                              type="button"
                              onClick={handleDeleteTournament}
                              disabled={deletingTournament}
                              className="rounded-lg bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                              {deletingTournament ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTournament(false)}
                              disabled={deletingTournament}
                              className="rounded-lg bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                            >
                              No
                            </button>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>

                  {configItems.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {configItems.map((item, index) => (
                        <span
                          key={index}
                          className="rounded-xl border border-slate-200/70 bg-slate-100/80 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-300"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Código de invitación con animación al copiar */}
          <div className="flex shrink-0 flex-col rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 backdrop-blur-sm sm:min-w-[235px] dark:border-slate-700/80 dark:bg-slate-900/75">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Código de invitación
            </span>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="font-mono text-lg font-extrabold tracking-widest text-slate-900 dark:text-emerald-300">
                {tournament.invite_code}
              </span>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={handleCopyInviteCode}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  copiedCode
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copiedCode ? (
                    <motion.span
                      key="copied"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      className="inline-flex items-center gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>¡Copiado!</span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      className="inline-flex items-center gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copiar</span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Cuerpo principal: Pestañas animadas + Participantes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06 }}
          className="lg:col-span-8"
        >
          <div className="glass-card overflow-hidden rounded-3xl">
            <div className="relative flex overflow-x-auto border-b border-slate-200/80 px-2 pt-2 dark:border-slate-800">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative inline-flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold transition ${
                      isActive
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="relative z-10 h-4 w-4" />
                    <span className="relative z-10">{tab.label}</span>

                    {isActive && (
                      <motion.div
                        layoutId="tournament-active-tab-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-x-1.5 top-1 bottom-0 rounded-t-xl border-b-2 border-emerald-500 bg-emerald-500/10 dark:bg-emerald-400/12"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-5 sm:p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  {activeTab === 'standings' &&
                    (tournament.format === 'custom' ? (
                      <CustomStandingsTab
                        tournament={tournament}
                        participants={participants}
                        matchdays={customMatchdays}
                        subtournaments={subtournaments}
                        subEntries={subEntries}
                        subEntryMembers={subEntryMembers}
                        currentUserId={user.id}
                      />
                    ) : (
                      <TournamentStandingsTab
                        tournament={tournament}
                        participants={participants}
                        matches={matches}
                        eliminations={eliminations}
                        currentUserId={user.id}
                      />
                    ))}

                  {activeTab === 'matches' &&
                    (tournament.format === 'custom' ? (
                      <CustomMatchdaysTab
                        tournament={tournament}
                        participants={participants}
                        matchdays={customMatchdays}
                        subtournaments={subtournaments}
                        subEntries={subEntries}
                        subEntryMembers={subEntryMembers}
                        subMatches={subMatches}
                        subEliminations={subEliminations}
                        potSets={potSets}
                        potAssignments={potAssignments}
                        isPotModalOpen={isPotModalOpen}
                        participantMap={participantMap}
                        isAdmin={isAdmin}
                        currentUserId={user.id}
                        selectedSubtournamentId={selectedSubtournamentId}
                        onSelectSubtournament={setSelectedSubtournamentId}
                        onOpenPotManager={() => setIsPotModalOpen(true)}
                        onRefreshCustomData={refreshCustomDataSilently}
                      />
                    ) : (
                      <TournamentMatchesTab
                        tournament={tournament}
                        participants={participants}
                        matches={matches}
                        eliminations={eliminations}
                        isAdmin={isAdmin}
                        currentUserId={user.id}
                        participantMap={participantMap}
                        generating={generatingMatches}
                        mutatingElimination={mutatingElimination}
                        onGenerateMatches={handleGenerateMatches}
                        onOpenMatchModal={(match, siblingLeg) =>
                          setMatchModalState({
                            isOpen: true,
                            match,
                            siblingLeg: siblingLeg || null,
                          })
                        }
                        onEliminateParticipant={handleEliminateParticipant}
                        onRevertElimination={handleRevertElimination}
                        onResetAllEliminations={handleResetAllEliminations}
                      />
                    ))}

                  {activeTab === 'stats' && (
                    <TournamentStatsTab
                      tournament={tournament}
                      participants={participants}
                      matches={matches}
                      eliminations={eliminations}
                      customMatchdays={customMatchdays}
                      subtournaments={subtournaments}
                      subEntries={subEntries}
                      subEntryMembers={subEntryMembers}
                      subMatches={subMatches}
                      subEliminations={subEliminations}
                      currentUserId={user.id}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.section>

        {/* Lista de Participantes */}
        <motion.aside
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12 }}
          className="lg:col-span-4"
        >
          <div className="glass-card rounded-3xl p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <Users className="h-4 w-4 text-emerald-500" />
                <span>Participantes ({participants.length})</span>
              </h2>

              {tournament.format === 'custom' && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => setIsPotModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Bombos ({potSets.length})</span>
                </motion.button>
              )}
            </div>

            {!myLinkedParticipant && participants.some((p) => !p.user_id) && (
              <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-800">
                ¿Tu nombre ya está en la lista? Haz clic en{' '}
                <strong>Vincularme</strong> para asociar tu cuenta a tu jugador.
              </div>
            )}

            {isAdmin && (
              <form onSubmit={handleAddParticipant} className="mb-4 flex gap-2">
                <input
                  type="text"
                  maxLength={50}
                  value={newParticipantName}
                  onChange={(e) => {
                    setNewParticipantName(e.target.value);
                    if (participantActionError) setParticipantActionError('');
                  }}
                  placeholder="Agregar participante..."
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={addingParticipant}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:opacity-60"
                  aria-label="Agregar participante"
                >
                  {addingParticipant ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>Agregar</span>
                </motion.button>
              </form>
            )}

            {participantActionError && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{participantActionError}</span>
              </div>
            )}

            {participants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
                {isAdmin
                  ? 'Aún no hay participantes. Usa el campo de arriba para agregar jugadores.'
                  : 'El administrador todavía no agregó participantes al torneo.'}
              </div>
            ) : (
              <ul className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {participants.map((participant) => {
                    const isMine = participant.user_id === user.id;
                    const isLinked = Boolean(participant.user_id);
                    const canClaim = !isLinked && !myLinkedParticipant;
                    const isEditingThis =
                      isAdmin && editingParticipantId === participant.id;
                    const isBusy =
                      claimingId === participant.id ||
                      savingParticipantId === participant.id ||
                      removingParticipantId === participant.id;

                    return (
                      <motion.li
                        layout
                        key={participant.id}
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.94 }}
                        transition={{ duration: 0.2 }}
                        className={`rounded-2xl border p-3 transition ${
                          isMine
                            ? 'border-emerald-300/80 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/12'
                            : 'border-slate-200/80 bg-white/70 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700'
                        }`}
                      >
                        {isEditingThis ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              maxLength={50}
                              autoFocus
                              value={editingParticipantName}
                              onChange={(e) =>
                                setEditingParticipantName(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveParticipantName(participant.id);
                                } else if (e.key === 'Escape') {
                                  setEditingParticipantId(null);
                                }
                              }}
                              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleSaveParticipantName(participant.id)
                              }
                              className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
                              aria-label="Guardar nombre"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setEditingParticipantId(null)}
                              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100"
                              aria-label="Cancelar edición"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold shadow-xs ${
                                  isMine
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                                    : isLinked
                                    ? 'bg-gradient-to-br from-sky-500/20 to-indigo-500/20 text-sky-700 dark:text-sky-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {getInitials(participant.name)}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {participant.name}
                                </p>
                                <div className="mt-0.5 flex items-center gap-1 text-[11px]">
                                  {isMine ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                                      <UserCheck className="h-3 w-3" />
                                      <span>Tu perfil vinculado</span>
                                    </span>
                                  ) : isLinked ? (
                                    <span className="inline-flex items-center gap-1 font-medium text-sky-700 dark:text-sky-300">
                                      <UserCheck className="h-3 w-3" />
                                      <span>Cuenta vinculada</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">
                                      Sin cuenta vinculada
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              {canClaim && (
                                <motion.button
                                  whileTap={{ scale: 0.94 }}
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleClaimParticipant(participant.id)
                                  }
                                  className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                                >
                                  {claimingId === participant.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Link2 className="h-3.5 w-3.5" />
                                  )}
                                  <span>Vincularme</span>
                                </motion.button>
                              )}

                              {isAdmin && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      startEditingParticipant(participant)
                                    }
                                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                                    title="Editar nombre"
                                    aria-label={`Editar a ${participant.name}`}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>

                                  {isLinked && (
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() =>
                                        handleUnlinkParticipant(participant.id)
                                      }
                                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                                      title="Desvincular cuenta"
                                      aria-label={`Desvincular cuenta de ${participant.name}`}
                                    >
                                      <Unlink className="h-3.5 w-3.5" />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleDeleteParticipant(participant.id)
                                    }
                                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                                    title="Eliminar participante"
                                    aria-label={`Eliminar a ${participant.name}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </motion.aside>
      </div>

      <MatchResultModal
        isOpen={matchModalState.isOpen}
        match={matchModalState.match}
        siblingLeg={matchModalState.siblingLeg}
        tournamentFormat={tournament.format}
        participantMap={participantMap}
        onClose={() =>
          setMatchModalState({ isOpen: false, match: null, siblingLeg: null })
        }
        onSave={handleSaveMatchResult}
        onReset={handleResetMatchResult}
      />

      {tournament.format === 'custom' && (
        <PotSetsModal
          isOpen={isPotModalOpen}
          tournamentId={tournament.id}
          participants={participants}
          potSets={potSets}
          potAssignments={potAssignments}
          isAdmin={isAdmin}
          onClose={() => setIsPotModalOpen(false)}
          onChanged={refreshCustomDataSilently}
        />
      )}
    </main>
  );
}