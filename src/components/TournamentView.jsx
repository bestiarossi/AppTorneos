import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BarChart3,
  Camera,
  Check,
  ChevronDown,
  Copy,
  Crown,
  Eye,
  Layers,
  Link2,
  Loader2,
  PartyPopper,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  Table2,
  Target,
  Trash2,
  Unlink,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  resolveParticipantAvatar,
  uploadParticipantAvatar,
} from '../utils/avatarUpload';
import { computeTournamentBadges } from '../utils/badgesEngine';
import { triggerChampionConfetti } from '../utils/confetti';
import { computeCustomGeneralStandings } from '../utils/customTournamentEngine';
import {
  computeKnockoutSummary,
  computeLastStandingStandings,
  computeLeagueStandings,
  generateKnockoutMatches,
  generateLeagueMatches,
  getKnockoutSeriesStatus,
} from '../utils/tournamentEngine';
import {
  formatShortDate,
  getConfigSummaryItems,
  getFormatMeta,
  getRoleMeta,
} from '../utils/tournamentFormats';
import {
  TOURNAMENT_SPORT_LIST,
  getTournamentTheme,
} from '../utils/tournamentThemes';
import Avatar from './Avatar';
import CustomMatchdaysTab from './CustomMatchdaysTab';
import CustomStandingsTab from './CustomStandingsTab';
import LiveTeamDrawModal from './LiveTeamDrawModal';
import MatchResultModal from './MatchResultModal';
import PlayerBadges from './PlayerBadges';
import PotSetsModal from './PotSetsModal';
import PredictionsTab from './PredictionsTab';
import { TournamentViewSkeleton } from './Skeletons';
import TeamManagerPanel from './TeamManagerPanel';
import { useToast } from './ToastProvider';
import TournamentMatchesTab from './TournamentMatchesTab';
import TournamentScorersTab from './TournamentScorersTab';
import TournamentStandingsTab from './TournamentStandingsTab';
import TournamentStatsTab from './TournamentStatsTab';
import TournamentSummaryTab from './TournamentSummaryTab';

const PARTICIPANT_SELECT =
  'id, tournament_id, name, user_id, avatar_url, created_at, profile:profiles(id, display_name, avatar_url)';

const MEMBER_SELECT =
  'id, tournament_id, user_id, role, created_at, profile:profiles(id, display_name, avatar_url)';

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

export default function TournamentView({
  tournamentId,
  user,
  profile,
  onBack,
}) {
  const toast = useToast();

  const [tournament, setTournament] = useState(null);
  const [membership, setMembership] = useState(null);
  const [members, setMembers] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [matches, setMatches] = useState([]);
  const [eliminations, setEliminations] = useState([]);

  const [prodePolls, setProdePolls] = useState([]);
  const [prodeVotes, setProdeVotes] = useState([]);
  const [prodeLoading, setProdeLoading] = useState(true);

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
  const [statsSubTab, setStatsSubTab] = useState('summary');
  const [savingTeams, setSavingTeams] = useState(false);
  const [liveDrawState, setLiveDrawState] = useState(null);
  const [spectatorDrawOpen, setSpectatorDrawOpen] = useState(false);
  const [mobileHeaderExpanded, setMobileHeaderExpanded] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);

  const [newParticipantName, setNewParticipantName] = useState('');
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [participantActionError, setParticipantActionError] = useState('');

  const [claimingId, setClaimingId] = useState(null);

  const [editingParticipantId, setEditingParticipantId] = useState(null);
  const [editingParticipantName, setEditingParticipantName] = useState('');
  const [savingParticipantId, setSavingParticipantId] = useState(null);
  const [uploadingAvatarId, setUploadingAvatarId] = useState(null);
  const [removingParticipantId, setRemovingParticipantId] = useState(null);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState(null);

  const participantAvatarInputRef = useRef(null);
  const participantAvatarTargetRef = useRef(null);
  const tournamentRef = useRef(null);
  const liveDrawChannelRef = useRef(null);
  const liveDrawStateRef = useRef(null);

  useEffect(() => {
    tournamentRef.current = tournament;
  }, [tournament]);

  useEffect(() => {
    liveDrawStateRef.current = liveDrawState;
  }, [liveDrawState]);

  const [isEditingTournament, setIsEditingTournament] = useState(false);
  const [editTournamentName, setEditTournamentName] = useState('');
  const [editSport, setEditSport] = useState('general');
  const [editHomeAndAway, setEditHomeAndAway] = useState(false);
  const [editThirdPlace, setEditThirdPlace] = useState(false);
  const [editRounds, setEditRounds] = useState('');
  const [editInitialLives, setEditInitialLives] = useState('1');
  const [editNotes, setEditNotes] = useState('');
  const [editAllowSelfJoin, setEditAllowSelfJoin] = useState(true);
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

  const refreshProdeData = useCallback(async () => {
    if (!supabase || !tournamentId) return;
    try {
      const { data: pollRows, error: pollErr } = await supabase
        .from('prediction_polls')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: false });

      if (pollErr) throw pollErr;
      const list = pollRows || [];
      setProdePolls(list);

      if (list.length > 0) {
        const { data: voteRows, error: voteErr } = await supabase
          .from('prediction_votes')
          .select('*')
          .in(
            'poll_id',
            list.map((p) => p.id)
          );
        if (voteErr) throw voteErr;
        setProdeVotes(voteRows || []);
      } else {
        setProdeVotes([]);
      }
    } finally {
      setProdeLoading(false);
    }
  }, [tournamentId]);

  const fetchPotsOnly = useCallback(async (tId) => {
    const { data: potSetsData, error: potErr } = await supabase
      .from('tournament_pot_sets')
      .select('*')
      .eq('tournament_id', tId)
      .order('created_at', { ascending: true });

    if (potErr) throw potErr;
    const loadedPotSets = potSetsData || [];
    const potSetIds = loadedPotSets.map((ps) => ps.id);
    let loadedPotAssignments = [];

    if (potSetIds.length > 0) {
      const { data: assignData, error: assignErr } = await supabase
        .from('tournament_pot_assignments')
        .select('*')
        .in('pot_set_id', potSetIds);
      if (assignErr) throw assignErr;
      loadedPotAssignments = assignData || [];
    }

    setPotSets(loadedPotSets);
    setPotAssignments(loadedPotAssignments);
  }, []);

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

    const hasAdminPriv = role === 'owner' || role === 'admin';
    if (
      hasAdminPriv &&
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

  const refreshParticipantsAndMembers = useCallback(async () => {
    const [membersRes, participantsRes] = await Promise.all([
      supabase
        .from('tournament_members')
        .select(MEMBER_SELECT)
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true }),
      supabase
        .from('tournament_participants')
        .select(PARTICIPANT_SELECT)
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true }),
    ]);

    if (!membersRes.error && membersRes.data) {
      setMembers(membersRes.data);
      const mine = membersRes.data.find((m) => m.user_id === user.id);
      if (mine) setMembership(mine);
    }

    if (!participantsRes.error && participantsRes.data) {
      setParticipants(participantsRes.data);
    }
  }, [tournamentId, user.id]);

  const loadTournamentData = useCallback(async () => {
    setLoading(true);
    setProdeLoading(true);
    setError('');

    try {
      const [tournamentRes, membersRes, participantsRes] = await Promise.all([
        supabase
          .from('tournaments')
          .select('*')
          .eq('id', tournamentId)
          .single(),
        supabase
          .from('tournament_members')
          .select(MEMBER_SELECT)
          .eq('tournament_id', tournamentId)
          .order('created_at', { ascending: true }),
        supabase
          .from('tournament_participants')
          .select(PARTICIPANT_SELECT)
          .eq('tournament_id', tournamentId)
          .order('created_at', { ascending: true }),
      ]);

      if (tournamentRes.error) throw tournamentRes.error;
      if (membersRes.error) throw membersRes.error;
      if (participantsRes.error) throw participantsRes.error;

      const allMembers = membersRes.data || [];
      const mData = allMembers.find((m) => m.user_id === user.id) || null;

      if (!mData) {
        throw new Error('No tienes acceso a este torneo.');
      }

      const tData = tournamentRes.data;

      setTournament(tData);
      setLiveDrawState(tData.config?.live_draw?.active ? tData.config.live_draw : null);
      setMembership(mData);
      setMembers(allMembers);
      setParticipants(participantsRes.data || []);

      if (tData.format === 'custom') {
        setMatches([]);
        setEliminations([]);
        await Promise.all([fetchCustomData(tData, mData.role), refreshProdeData()]);
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

        if (tData.config?.is_team_based) {
          await Promise.all([fetchPotsOnly(tData.id), refreshProdeData()]);
          if (!Array.isArray(tData.config?.teams) || tData.config.teams.length === 0) {
            setActiveTab('teams');
          }
        } else {
          setPotSets([]);
          setPotAssignments([]);
          await refreshProdeData();
        }
      }
    } catch (err) {
      setError(err?.message || 'No se pudo cargar la información del torneo.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, user.id, fetchCustomData, fetchPotsOnly, refreshProdeData]);

  useEffect(() => {
    setSelectedSubtournamentId(null);
    setIsPotModalOpen(false);
    setMobileHeaderExpanded(false);
    setSpectatorDrawOpen(false);
    setLiveDrawState(null);
    loadTournamentData();
  }, [loadTournamentData]);

  useEffect(() => {
    if (!profile?.id) return;
    setParticipants((prev) =>
      prev.map((p) =>
        p.user_id === profile.id
          ? {
              ...p,
              profile: {
                id: profile.id,
                display_name: profile.display_name,
                avatar_url: profile.avatar_url,
              },
            }
          : p
      )
    );
    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === profile.id
          ? {
              ...m,
              profile: {
                id: profile.id,
                display_name: profile.display_name,
                avatar_url: profile.avatar_url,
              },
            }
          : m
      )
    );
  }, [profile]);

  // Canal Realtime Broadcast dedicado para el Sorteo en Vivo + auto-sincronización (request_sync)
  useEffect(() => {
    if (!supabase || !tournamentId) return;

    const liveChannel = supabase
      .channel(`live-draw-${tournamentId}`, {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'live_draw_update' }, ({ payload }) => {
        if (payload?.liveDraw?.active) {
          setLiveDrawState(payload.liveDraw);
        } else {
          setLiveDrawState(null);
          setSpectatorDrawOpen(false);
        }
      })
      .on('broadcast', { event: 'request_sync' }, () => {
        if (liveDrawStateRef.current?.active) {
          liveChannel.send({
            type: 'broadcast',
            event: 'live_draw_update',
            payload: { liveDraw: liveDrawStateRef.current },
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          liveChannel.send({
            type: 'broadcast',
            event: 'request_sync',
            payload: {},
          });
        }
      });

    liveDrawChannelRef.current = liveChannel;

    return () => {
      liveDrawChannelRef.current = null;
      supabase.removeChannel(liveChannel);
    };
  }, [tournamentId]);

  useEffect(() => {
    if (!supabase || !tournamentId) return;

    const channel = supabase
      .channel(`tournament-core-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_participants',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          refreshParticipantsAndMembers();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_members',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          refreshParticipantsAndMembers();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournaments',
          filter: `id=eq.${tournamentId}`,
        },
        (payload) => {
          if (payload?.new) {
            setTournament((prev) => (prev ? { ...prev, ...payload.new } : payload.new));
            const remoteDraw = payload.new?.config?.live_draw;
            setLiveDrawState(remoteDraw?.active ? remoteDraw : null);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prediction_polls',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          refreshProdeData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prediction_votes',
        },
        () => {
          refreshProdeData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, refreshParticipantsAndMembers, refreshProdeData]);

  const enrichedParticipants = useMemo(
    () =>
      participants.map((p) => ({
        ...p,
        effective_avatar_url: resolveParticipantAvatar(p),
      })),
    [participants]
  );

  const isTeamBasedTournament =
    tournament?.format !== 'custom' && Boolean(tournament?.config?.is_team_based);

  const savedTournamentTeams = useMemo(() => {
    if (!isTeamBasedTournament) return [];
    return Array.isArray(tournament?.config?.teams) ? tournament.config.teams : [];
  }, [isTeamBasedTournament, tournament?.config]);

  const teamRosterPlayers = useMemo(() => {
    if (!isTeamBasedTournament) return [];
    if (
      Array.isArray(tournament?.config?.roster_players) &&
      tournament.config.roster_players.length > 0
    ) {
      return tournament.config.roster_players;
    }
    return enrichedParticipants;
  }, [isTeamBasedTournament, tournament?.config, enrichedParticipants]);

  const participantMap = useMemo(
    () => new Map(enrichedParticipants.map((p) => [p.id, p])),
    [enrichedParticipants]
  );

  const memberByUserId = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members]
  );

  const spectatorMembers = useMemo(() => {
    const linkedUserIds = new Set(
      participants.map((p) => p.user_id).filter(Boolean)
    );
    return members.filter((m) => !linkedUserIds.has(m.user_id));
  }, [members, participants]);

  const badgesMap = useMemo(
    () =>
      computeTournamentBadges({
        tournament,
        participants: enrichedParticipants,
        matches,
        eliminations,
        customMatchdays,
        subtournaments,
        subEntries,
        subEntryMembers,
        subMatches,
        prodePolls,
        prodeVotes,
      }),
    [
      tournament,
      enrichedParticipants,
      matches,
      eliminations,
      customMatchdays,
      subtournaments,
      subEntries,
      subEntryMembers,
      subMatches,
      prodePolls,
      prodeVotes,
    ]
  );

  const crownedChampion = useMemo(() => {
    if (!tournament || enrichedParticipants.length === 0) return null;

    if (tournament.format === 'knockout') {
      return computeKnockoutSummary(enrichedParticipants, matches).champion || null;
    }

    if (tournament.format === 'last_standing') {
      return (
        computeLastStandingStandings(enrichedParticipants, eliminations)
          .champion || null
      );
    }

    if (tournament.format === 'league') {
      const nonBye = matches.filter((m) => !m.is_bye);
      if (nonBye.length > 0 && nonBye.every((m) => m.status === 'completed')) {
        return (
          computeLeagueStandings(enrichedParticipants, matches)[0]
            ?.participant || null
        );
      }
      return null;
    }

    if (tournament.format === 'custom') {
      if (
        subtournaments.length > 0 &&
        subtournaments.every((s) => s.status === 'completed')
      ) {
        const rows = computeCustomGeneralStandings(
          enrichedParticipants,
          customMatchdays,
          subtournaments,
          subEntries,
          subEntryMembers
        );
        return rows[0]?.totalPoints > 0 ? rows[0].participant : null;
      }
    }

    return null;
  }, [
    tournament,
    enrichedParticipants,
    matches,
    eliminations,
    subtournaments,
    customMatchdays,
    subEntries,
    subEntryMembers,
  ]);

  useEffect(() => {
    if (!tournament?.id || !crownedChampion?.id || typeof window === 'undefined') {
      return;
    }
    const key = `confetti-${tournament.id}-${crownedChampion.id}`;
    if (!window.sessionStorage.getItem(key)) {
      window.sessionStorage.setItem(key, '1');
      triggerChampionConfetti();
    }
  }, [tournament?.id, crownedChampion?.id]);

  const isOwner = membership?.role === 'owner';
  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';
  const myLinkedParticipant =
    enrichedParticipants.find((p) => p.user_id === user.id) || null;

  // Transmisión del Sorteo en Vivo: Broadcast instantáneo + persistencia en DB
  const handleBroadcastLiveDraw = useCallback(
    async (liveDrawPayload) => {
      const currentT = tournamentRef.current;
      if (!isAdmin || !currentT) return;

      const nextState = liveDrawPayload?.active ? liveDrawPayload : null;
      setLiveDrawState(nextState);
      liveDrawStateRef.current = nextState;

      liveDrawChannelRef.current?.send({
        type: 'broadcast',
        event: 'live_draw_update',
        payload: { liveDraw: nextState },
      });

      const nextConfig = { ...(currentT.config || {}) };
      if (nextState) {
        nextConfig.live_draw = nextState;
      } else {
        delete nextConfig.live_draw;
      }

      setTournament((prev) => (prev ? { ...prev, config: nextConfig } : prev));

      const { error: updErr } = await supabase
        .from('tournaments')
        .update({ config: nextConfig })
        .eq('id', currentT.id);

      if (updErr) {
        console.error('Error guardando live_draw:', updErr);
      }
    },
    [isAdmin]
  );

  const refreshCustomDataSilently = useCallback(async () => {
    if (!tournament || !membership) return;
    if (tournament.format === 'custom') {
      await Promise.all([
        fetchCustomData(tournament, membership.role),
        refreshProdeData(),
      ]);
    } else if (tournament.config?.is_team_based) {
      await fetchPotsOnly(tournament.id);
    }
  }, [tournament, membership, fetchCustomData, fetchPotsOnly, refreshProdeData]);

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

  async function handleSaveTournamentTeams(teamsPayload) {
    if (!isAdmin || !tournament) return;
    setError('');
    setSavingTeams(true);

    try {
      const rosterSnapshot =
        Array.isArray(tournament.config?.roster_players) &&
        tournament.config.roster_players.length > 0
          ? tournament.config.roster_players
          : enrichedParticipants.map((p) => ({
              id: p.id,
              name: p.name,
              user_id: p.user_id || null,
              avatar_url: p.effective_avatar_url || p.avatar_url || null,
            }));

      await supabase.from('matches').delete().eq('tournament_id', tournament.id);
      await supabase
        .from('last_standing_eliminations')
        .delete()
        .eq('tournament_id', tournament.id);
      await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', tournament.id);

      const { data: createdTeamParticipants, error: insErr } = await supabase
        .from('tournament_participants')
        .insert(
          teamsPayload.map((t) => ({
            tournament_id: tournament.id,
            name: t.name,
          }))
        )
        .select(PARTICIPANT_SELECT);

      if (insErr) throw insErr;

      const syncedTeams = teamsPayload.map((t, idx) => ({
        id: createdTeamParticipants[idx]?.id || t.id,
        name: t.name,
        memberIds: t.memberIds,
      }));

      const nextConfig = {
        ...(tournament.config || {}),
        is_team_based: true,
        roster_players: rosterSnapshot,
        teams: syncedTeams,
      };
      delete nextConfig.live_draw;

      const { data: updatedTournament, error: updErr } = await supabase
        .from('tournaments')
        .update({ config: nextConfig })
        .eq('id', tournament.id)
        .select()
        .single();

      if (updErr) throw updErr;

      setLiveDrawState(null);
      liveDrawStateRef.current = null;
      liveDrawChannelRef.current?.send({
        type: 'broadcast',
        event: 'live_draw_update',
        payload: { liveDraw: null },
      });
      setTournament(updatedTournament);
      setParticipants(createdTeamParticipants || []);
      setMatches([]);
      setEliminations([]);
      toast.success('¡Equipos registrados! Ya podés generar los cruces y la tabla.');
    } catch (err) {
      setError(err?.message || 'No se pudieron guardar los equipos.');
    } finally {
      setSavingTeams(false);
    }
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
        generatedRows = generateLeagueMatches(tournament, enrichedParticipants);
      } else if (tournament.format === 'knockout') {
        generatedRows = generateKnockoutMatches(tournament, enrichedParticipants);
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
      toast.success('¡Cruces generados correctamente!');
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
    await refreshProdeData();
    toast.success('Resultado guardado');
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
    await refreshProdeData();
    toast.info('Resultado reiniciado');
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
      toast.info('Eliminaciones reiniciadas');
    } catch (err) {
      setError(err?.message || 'No se pudieron reiniciar las eliminaciones.');
    } finally {
      setMutatingElimination(false);
    }
  }

  async function handleCopyInviteCode() {
    if (!tournament?.invite_code) return;
    await copyTextToClipboard(tournament.invite_code);
    setCopiedCode(true);
    toast.success(`Código #${tournament.invite_code} copiado`);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  async function handleCopyInviteLink() {
    if (!tournament?.invite_code) return;
    const url = `${window.location.origin}/?invite=${tournament.invite_code}`;
    await copyTextToClipboard(url);
    setCopiedInviteLink(true);
    toast.success('¡Link de invitación copiado para compartir!');
    setTimeout(() => setCopiedInviteLink(false), 2200);
  }

  async function handleRegenerateInviteCode() {
    if (!isAdmin || !tournament) return;
    setRegeneratingCode(true);
    setError('');

    try {
      const { data: newCode, error: rpcError } = await supabase.rpc(
        'regenerate_tournament_invite_code',
        { p_tournament_id: tournament.id }
      );

      if (rpcError) throw rpcError;

      setTournament((prev) => (prev ? { ...prev, invite_code: newCode } : prev));
      toast.success(`Nuevo código generado: #${newCode}`);
    } catch (err) {
      toast.error(err?.message || 'No se pudo regenerar el código de invitación.');
    } finally {
      setRegeneratingCode(false);
    }
  }

  async function handleClaimParticipant(participantId) {
    setParticipantActionError('');
    setClaimingId(participantId);

    try {
      const { error: rpcError } = await supabase.rpc(
        'claim_tournament_participant',
        { p_participant_id: participantId }
      );

      if (rpcError) throw rpcError;
      await refreshParticipantsAndMembers();
      toast.success('¡Cuenta vinculada a tu jugador!');
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
        .select(PARTICIPANT_SELECT)
        .single();

      if (insertError) throw insertError;

      setParticipants((prev) => [...prev, data]);
      setNewParticipantName('');
      toast.success(`Se agregó a "${cleanName}"`);
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
        .select(PARTICIPANT_SELECT)
        .single();

      if (updateError) throw updateError;

      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? data : p))
      );
      setEditingParticipantId(null);
      setEditingParticipantName('');
      toast.success('Participante actualizado');
    } catch (err) {
      setParticipantActionError(
        err?.message || 'No se pudo actualizar el nombre del participante.'
      );
    } finally {
      setSavingParticipantId(null);
    }
  }

  function triggerParticipantAvatarUpload(participantId) {
    if (!isAdmin) return;
    participantAvatarTargetRef.current = participantId;
    participantAvatarInputRef.current?.click();
  }

  async function handleParticipantAvatarFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const participantId = participantAvatarTargetRef.current;
    participantAvatarTargetRef.current = null;

    if (!file || !participantId || !isAdmin || !tournament) return;

    setParticipantActionError('');
    setUploadingAvatarId(participantId);

    try {
      const { publicUrl } = await uploadParticipantAvatar(
        tournament.id,
        participantId,
        file
      );

      const { data, error: updateError } = await supabase
        .from('tournament_participants')
        .update({ avatar_url: publicUrl })
        .eq('id', participantId)
        .select(PARTICIPANT_SELECT)
        .single();

      if (updateError) throw updateError;

      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? data : p))
      );
      toast.success('Foto del participante actualizada');
    } catch (err) {
      setParticipantActionError(
        err?.message || 'No se pudo subir la foto del participante.'
      );
    } finally {
      setUploadingAvatarId(null);
    }
  }

  async function handleClearParticipantAvatar(participantId) {
    if (!isAdmin) return;
    setParticipantActionError('');
    setUploadingAvatarId(participantId);

    try {
      const { data, error: updateError } = await supabase
        .from('tournament_participants')
        .update({ avatar_url: null })
        .eq('id', participantId)
        .select(PARTICIPANT_SELECT)
        .single();

      if (updateError) throw updateError;

      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? data : p))
      );
      toast.info('Foto personalizada eliminada');
    } catch (err) {
      setParticipantActionError(
        err?.message || 'No se pudo quitar la foto del participante.'
      );
    } finally {
      setUploadingAvatarId(null);
    }
  }

  async function handleToggleAdminRole(targetUserId, currentRole) {
    if (!isOwner || !tournament || !targetUserId) return;
    const nextRole = currentRole === 'admin' ? 'member' : 'admin';

    setParticipantActionError('');
    setUpdatingRoleUserId(targetUserId);

    try {
      const { error: rpcError } = await supabase.rpc(
        'update_tournament_member_role',
        {
          p_tournament_id: tournament.id,
          p_user_id: targetUserId,
          p_new_role: nextRole,
        }
      );

      if (rpcError) throw rpcError;
      await refreshParticipantsAndMembers();
      toast.success(
        nextRole === 'admin'
          ? 'Permisos de administrador otorgados'
          : 'Permisos de administrador removidos'
      );
    } catch (err) {
      setParticipantActionError(
        err?.message || 'No se pudo actualizar el rol del participante.'
      );
    } finally {
      setUpdatingRoleUserId(null);
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
        .select(PARTICIPANT_SELECT)
        .single();

      if (unlinkError) throw unlinkError;

      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? data : p))
      );
      toast.info('Cuenta desvinculada del jugador');
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
      toast.info('Participante eliminado');
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
    setEditSport(cfg.sport || 'general');
    setEditHomeAndAway(Boolean(cfg.home_and_away));
    setEditThirdPlace(Boolean(cfg.third_place));
    setEditRounds(cfg.rounds ? String(cfg.rounds) : '');
    setEditInitialLives(cfg.initial_lives ? String(cfg.initial_lives) : '1');
    setEditNotes(cfg.notes || '');
    setEditAllowSelfJoin(cfg.allow_self_join !== false);
    setIsEditingTournament(true);
    setMobileHeaderExpanded(true);
  }

  async function handleSaveTournamentEdit(e) {
    e.preventDefault();
    if (!isAdmin || !tournament) return;

    const cleanName = editTournamentName.trim();
    if (!cleanName) return;

    const parsedRounds = editRounds.trim()
      ? Number.parseInt(editRounds.trim(), 10)
      : null;

    let baseConfig = {};
    if (tournament.format === 'league') {
      baseConfig = {
        home_and_away: editHomeAndAway,
        ...(parsedRounds && parsedRounds > 0 ? { rounds: parsedRounds } : {}),
      };
    } else if (tournament.format === 'knockout') {
      baseConfig = {
        home_and_away: editHomeAndAway,
        third_place: editThirdPlace,
      };
    } else if (tournament.format === 'last_standing') {
      const parsedLives = Number.parseInt(editInitialLives.trim() || '1', 10);
      baseConfig = {
        initial_lives: Number.isNaN(parsedLives) || parsedLives < 1 ? 1 : parsedLives,
        ...(parsedRounds && parsedRounds > 0 ? { rounds: parsedRounds } : {}),
      };
    } else {
      baseConfig = {
        ...(parsedRounds && parsedRounds > 0 ? { rounds: parsedRounds } : {}),
        ...(editNotes.trim() ? { notes: editNotes.trim() } : {}),
      };
    }

    const nextConfig = {
      ...(tournament.config || {}),
      ...baseConfig,
      sport: editSport,
      allow_self_join: editAllowSelfJoin,
    };

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
      toast.success('Configuración del torneo actualizada');
    } catch (err) {
      setError(err?.message || 'No se pudo guardar la edición del torneo.');
    } finally {
      setSavingTournament(false);
    }
  }

  async function handleDeleteTournament() {
    if (!isOwner || !tournament) return;
    setDeletingTournament(true);

    try {
      const { error: deleteError } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournament.id);

      if (deleteError) throw deleteError;
      toast.info('Torneo eliminado');
      onBack();
    } catch (err) {
      setError(err?.message || 'No se pudo eliminar el torneo.');
      setDeletingTournament(false);
      setConfirmDeleteTournament(false);
    }
  }
  const [confirmLeaveTournament, setConfirmLeaveTournament] = useState(false);
  const [leavingTournament, setLeavingTournament] = useState(false);

  async function handleLeaveTournament() {
    if (isOwner || !tournament) return;
    setLeavingTournament(true);
    setError('');

    try {
      // Si tenía un jugador vinculado, lo desvinculamos para no borrar sus partidos
      await supabase
        .from('tournament_participants')
        .update({ user_id: null })
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id);

      const { error: leaveErr } = await supabase
        .from('tournament_members')
        .delete()
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id);

      if (leaveErr) throw leaveErr;

      toast.info('Abandonaste el torneo');
      onBack();
    } catch (err) {
      setError(err?.message || 'No se pudo abandonar el torneo.');
      setLeavingTournament(false);
      setConfirmLeaveTournament(false);
    }
  }

  const mainTabs = useMemo(() => {
    const list = [
      { id: 'standings', label: 'Tabla', shortLabel: 'Tabla', icon: Table2 },
      {
        id: 'matches',
        label: tournament?.format === 'custom' ? 'Jornadas' : 'Cruces',
        shortLabel: tournament?.format === 'custom' ? 'Jornadas' : 'Cruces',
        icon: Swords,
      },
    ];
    if (isTeamBasedTournament) {
      list.push({
        id: 'teams',
        label: 'Equipos',
        shortLabel: 'Equipos',
        icon: Users,
      });
    }
    list.push(
      { id: 'scorers', label: 'Goleadores', shortLabel: 'Goles', icon: Award },
      { id: 'stats', label: 'Resumen y Stats', shortLabel: 'Stats', icon: BarChart3 }
    );
    return list;
  }, [tournament?.format, isTeamBasedTournament]);

  if (loading) {
    return <TournamentViewSkeleton />;
  }

  if (error && !tournament) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white classic:text-[#1E4638]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a mis torneos</span>
        </button>

        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">No se pudo abrir el torneo</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  const formatMeta = getFormatMeta(tournament.format);
  const roleMeta = getRoleMeta(membership.role);
  const sportTheme = getTournamentTheme(tournament.config);
  const configItems = getConfigSummaryItems(tournament.format, tournament.config);
  const activeTabMeta =
    activeTab === 'predictions'
      ? { id: 'predictions', label: 'Prode', shortLabel: 'Prode', icon: Target }
      : mainTabs.find((t) => t.id === activeTab) || mainTabs[0];
  const ActiveTabIcon = activeTabMeta.icon;
  const openPollsCount = prodePolls.filter((p) => p.status === 'open').length;
  const showMobileDetails = mobileHeaderExpanded || isEditingTournament;
  const liveDraw = liveDrawState || tournament?.config?.live_draw || null;

  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-4 pb-28 sm:px-6 sm:py-6 md:pb-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={onBack}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-extrabold tracking-wider text-slate-600 uppercase transition hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white classic:text-[#1E4638] classic:hover:bg-[#EFE2CC]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Mis torneos</span>
          </motion.button>

          {/* Acceso dedicado al Prode */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() =>
              setActiveTab(activeTab === 'predictions' ? 'standings' : 'predictions')
            }
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold tracking-wider uppercase transition ${
              activeTab === 'predictions'
                ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm dark:border-[#CCFF00] dark:bg-[#CCFF00] dark:text-[#0B0E14] classic:border-2 classic:border-[#1E4638] classic:bg-[#D46F4D] classic:text-[#FBF5E8]'
                : 'border-slate-200/90 bg-white/85 text-slate-700 hover:border-emerald-400 dark:border-white/[0.1] dark:bg-[#141923] dark:text-slate-200 dark:hover:border-[#CCFF00]/50 classic:border-2 classic:border-[#1E4638] classic:bg-[#FBF5E8] classic:text-[#1E4638]'
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            <span>Prode</span>
            {openPollsCount > 0 && (
              <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 font-mono text-[10px] font-black text-white tabular-nums dark:bg-[#CCFF00] dark:text-[#0B0E14] classic:bg-[#1E4638] classic:text-[#FBF5E8]">
                {openPollsCount}
              </span>
            )}
          </motion.button>
        </div>

        {/* Anuncio pulsante EN VIVO para todos los participantes cuando hay un sorteo activo */}
        <AnimatePresence>
          {liveDraw?.active && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => setSpectatorDrawOpen(true)}
              className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-rose-400/50 bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500 px-4 py-3 text-left text-white shadow-lg shadow-rose-600/25 dark:border-[#CCFF00]/60 dark:from-[#141923] dark:via-[#141923] dark:to-[#1a2410] dark:shadow-[0_0_24px_-6px_rgba(204,255,0,0.35)] classic:border-2 classic:border-[#1E4638] classic:from-[#D46F4D] classic:to-[#C45D3B] classic:shadow-[3px_3px_0_#1E4638]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 dark:bg-[#CCFF00] dark:text-[#0B0E14] classic:bg-[#FBF5E8] classic:text-[#D46F4D]">
                  <Radio className="h-5 w-5 animate-pulse" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-ping rounded-full bg-white dark:bg-[#CCFF00]" />
                    <span className="text-[10px] font-black tracking-widest uppercase dark:text-[#CCFF00]">
                      Sorteo en Vivo ahora
                    </span>
                  </div>
                  <p className="truncate text-sm font-extrabold">
                    {liveDraw.scopeName || tournament.name} — Tocá para ver el bolillero en directo
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-black tracking-wider uppercase dark:bg-[#CCFF00] dark:text-[#0B0E14] classic:bg-[#1E4638] classic:text-[#FBF5E8]">
                Ver →
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Encabezado del Torneo */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="glass-card relative mb-5 overflow-hidden rounded-2xl p-4 sm:p-5 lg:mb-6 lg:p-6"
        >
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${sportTheme.cardRibbon}`}
          />
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${sportTheme.heroGradient} classic:opacity-40`}
          />

          {!isEditingTournament && (
            <div className="relative flex items-center justify-between gap-3 lg:hidden">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="text-xl leading-none" aria-hidden="true">
                  {sportTheme.emoji}
                </span>
                <h1 className="truncate text-lg font-black tracking-tight text-slate-900 uppercase sm:text-xl dark:text-white classic:text-[#1E4638]">
                  {tournament.name}
                </h1>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setMobileHeaderExpanded((prev) => !prev)}
                aria-expanded={mobileHeaderExpanded}
                className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl border border-slate-200/90 bg-white/85 px-2.5 py-1.5 text-[11px] font-extrabold tracking-wider text-slate-700 uppercase transition hover:bg-white dark:border-white/[0.1] dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 classic:border-2 classic:border-[#1E4638] classic:bg-[#EFE2CC] classic:text-[#1E4638]"
              >
                <span>{mobileHeaderExpanded ? 'Ocultar' : 'Info'}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    mobileHeaderExpanded ? 'rotate-180' : ''
                  }`}
                />
              </motion.button>
            </div>
          )}

          <div
            className={`relative flex-col gap-5 lg:flex lg:flex-row lg:items-start lg:justify-between ${
              showMobileDetails
                ? 'mt-4 flex border-t border-slate-200/70 pt-4 dark:border-white/[0.06] classic:border-[#1E4638]/15 lg:mt-0 lg:border-t-0 lg:pt-0'
                : 'hidden'
            }`}
          >
            <div className="flex-1">
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase ${roleMeta.badgeClass}`}
                >
                  {membership.role === 'owner' ? (
                    <Crown className="h-3 w-3" />
                  ) : membership.role === 'admin' ? (
                    <ShieldCheck className="h-3 w-3" />
                  ) : (
                    <User className="h-3 w-3" />
                  )}
                  <span>{roleMeta.fullLabel}</span>
                </span>

                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${sportTheme.badgeClass}`}
                >
                  <span>{sportTheme.emoji}</span>
                  <span>{sportTheme.label}</span>
                </span>

                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${formatMeta.badgeClass}`}
                >
                  {formatMeta.label}
                </span>

                {isTeamBasedTournament && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/15 dark:text-indigo-300">
                    <Users className="h-3 w-3" />
                    <span>Por Equipos</span>
                  </span>
                )}

                {tournament.created_at && (
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 classic:text-[#4C6B5E]">
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
                    className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 dark:border-white/[0.08] dark:bg-[#0B0E14]/90 classic:border-2 classic:border-[#1E4638] classic:bg-[#EFE2CC]"
                  >
                    <div>
                      <label className="mb-1 block text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400 classic:text-[#315E4E]">
                        Nombre del torneo
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={80}
                        value={editTournamentName}
                        onChange={(e) => setEditTournamentName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-bold text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-white/[0.08] dark:bg-[#141923] dark:text-white dark:focus:border-[#CCFF00]"
                      />
                    </div>

                    <div>
                      <span className="mb-1.5 block text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400 classic:text-[#315E4E]">
                        Deporte / Temática
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {TOURNAMENT_SPORT_LIST.map((sp) => (
                          <button
                            key={sp.id}
                            type="button"
                            onClick={() => setEditSport(sp.id)}
                            className={`inline-flex min-h-[40px] items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                              editSport === sp.id
                                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:border-[#CCFF00] dark:bg-[#CCFF00]/15 dark:text-[#CCFF00] classic:border-[#1E4638] classic:bg-[#1E4638] classic:text-[#FBF5E8]'
                                : 'border-slate-200 bg-white text-slate-600 dark:border-white/[0.08] dark:bg-[#141923] dark:text-slate-300'
                            }`}
                          >
                            <span>{sp.emoji}</span>
                            <span>{sp.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {tournament.format === 'league' && (
                      <div className="flex flex-wrap gap-3">
                        <label className="flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/[0.08] dark:bg-[#141923] dark:text-slate-200">
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
                          className="w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-xs dark:border-white/[0.08] dark:bg-[#141923] dark:text-white"
                        />
                      </div>
                    )}

                    {tournament.format === 'knockout' && (
                      <div className="flex flex-wrap gap-3">
                        <label className="flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/[0.08] dark:bg-[#141923] dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={editHomeAndAway}
                            onChange={(e) => setEditHomeAndAway(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                          />
                          <span>Cruces ida y vuelta</span>
                        </label>
                        <label className="flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/[0.08] dark:bg-[#141923] dark:text-slate-200">
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
                          className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-xs dark:border-white/[0.08] dark:bg-[#141923] dark:text-white"
                        />
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={editRounds}
                          onChange={(e) => setEditRounds(e.target.value)}
                          placeholder="Máx. jornadas"
                          className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-xs dark:border-white/[0.08] dark:bg-[#141923] dark:text-white"
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
                          className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-xs dark:border-white/[0.08] dark:bg-[#141923] dark:text-white"
                        />
                        <input
                          type="text"
                          maxLength={80}
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Regla o nota"
                          className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-xs dark:border-white/[0.08] dark:bg-[#141923] dark:text-white"
                        />
                      </div>
                    )}

                    <label className="flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/[0.08] dark:bg-[#141923] dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={editAllowSelfJoin}
                        onChange={(e) => setEditAllowSelfJoin(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                      />
                      <span>Permitir que nuevos invitados se anoten solos como participantes</span>
                    </label>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        type="submit"
                        disabled={savingTournament}
                        className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold tracking-wider text-white uppercase shadow-sm hover:bg-emerald-700 disabled:opacity-60 dark:bg-[#CCFF00] dark:text-[#0B0E14] dark:hover:bg-[#d9ff33] classic:border-2 classic:border-[#1E4638] classic:bg-[#D46F4D] classic:text-[#FBF5E8]"
                      >
                        {savingTournament && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        <span>Guardar cambios</span>
                      </motion.button>
                      <button
                        type="button"
                        onClick={() => setIsEditingTournament(false)}
                        disabled={savingTournament}
                        className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-white/[0.08] dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
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
                      <h1 className="hidden text-2xl font-black tracking-tight text-slate-900 uppercase sm:text-3xl lg:block dark:text-white classic:text-[#1E4638]">
                        {tournament.name}
                      </h1>

                      {isAdmin && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={openTournamentEdit}
                            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/[0.08] dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 classic:border-2 classic:border-[#1E4638] classic:bg-[#EFE2CC] classic:text-[#1E4638]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Editar</span>
                          </motion.button>

                          {isOwner &&
                            (!confirmDeleteTournament ? (
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                type="button"
                                onClick={() => setConfirmDeleteTournament(true)}
                                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 dark:border-white/[0.08] dark:bg-white/5 dark:text-rose-400 dark:hover:bg-rose-500/15"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Eliminar</span>
                              </motion.button>
                            ) : (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 p-1.5 dark:border-rose-500/35 dark:bg-rose-500/15"
                              >
                                <span className="px-1.5 text-xs font-bold text-rose-700 dark:text-rose-200">
                                  ¿Eliminar torneo?
                                </span>
                                <button
                                  type="button"
                                  onClick={handleDeleteTournament}
                                  disabled={deletingTournament}
                                  className="min-h-[36px] rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
                                >
                                  {deletingTournament ? 'Eliminando...' : 'Sí, eliminar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteTournament(false)}
                                  disabled={deletingTournament}
                                  className="min-h-[36px] rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:bg-white/10 dark:text-slate-200"
                                >
                                  No
                                </button>
                              </motion.div>
                            ))}
                        </div>
                      )}
                      {!isOwner &&
                        (!confirmLeaveTournament ? (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={() => setConfirmLeaveTournament(true)}
                            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 dark:border-white/[0.08] dark:bg-white/5 dark:text-rose-400 dark:hover:bg-rose-500/15"
                          >
                            <Unlink className="h-3.5 w-3.5" />
                            <span>Abandonar torneo</span>
                          </motion.button>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 p-1.5 dark:border-rose-500/35 dark:bg-rose-500/15"
                          >
                            <span className="px-1.5 text-xs font-bold text-rose-700 dark:text-rose-200">
                              ¿Salir del torneo?
                            </span>
                            <button
                              type="button"
                              onClick={handleLeaveTournament}
                              disabled={leavingTournament}
                              className="min-h-[36px] rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                              {leavingTournament ? 'Saliendo...' : 'Sí, salir'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmLeaveTournament(false)}
                              disabled={leavingTournament}
                              className="min-h-[36px] rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:bg-white/10 dark:text-slate-200"
                            >
                              No
                            </button>
                          </motion.div>
                        ))}
                    </div>

                    {configItems.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {configItems.map((item, index) => (
                          <span
                            key={index}
                            className="rounded-lg border border-slate-200/70 bg-slate-100/80 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:border-white/[0.06] dark:bg-white/[0.05] dark:text-slate-300 classic:border-[#1E4638]/20 classic:bg-[#EFE2CC] classic:text-[#1E4638]"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    )}

                    {crownedChampion && (
                      <div className="podium-gold mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={crownedChampion.name}
                            url={resolveParticipantAvatar(crownedChampion)}
                            size="sm"
                            highlight
                          />
                          <div>
                            <p className="text-[10px] font-extrabold tracking-wider text-amber-800 uppercase dark:text-amber-300 classic:text-[#7D5310]">
                              🏆 Campeón Oficial
                            </p>
                            <p className="text-sm font-black text-slate-900 dark:text-white classic:text-[#1E4638]">
                              {crownedChampion.name}
                            </p>
                          </div>
                        </div>

                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          type="button"
                          onClick={triggerChampionConfetti}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-amber-500/20 px-3 py-1.5 text-xs font-extrabold text-amber-900 transition hover:bg-amber-500/30 dark:text-amber-200 classic:border classic:border-[#1E4638] classic:bg-[#1E4638] classic:text-[#FBF5E8]"
                        >
                          <PartyPopper className="h-3.5 w-3.5" />
                          <span>Celebrar</span>
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex shrink-0 flex-col gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/85 p-3.5 backdrop-blur-sm sm:min-w-[270px] dark:border-white/[0.08] dark:bg-[#0B0E14]/85 classic:border-2 classic:border-[#1E4638] classic:bg-[#EFE2CC]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold tracking-wider text-slate-500 uppercase dark:text-slate-400 classic:text-[#315E4E]">
                  Invitación al torneo
                </span>
                {isAdmin && (
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    type="button"
                    disabled={regeneratingCode}
                    onClick={handleRegenerateInviteCode}
                    title="Regenerar código de invitación"
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white classic:text-[#1E4638]"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${regeneratingCode ? 'animate-spin' : ''}`}
                    />
                    <span>Regenerar</span>
                  </motion.button>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-lg font-extrabold tracking-widest text-slate-900 tabular-nums dark:text-[#CCFF00] classic:text-[#1E4638]">
                  {tournament.invite_code}
                </span>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  type="button"
                  onClick={handleCopyInviteCode}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    copiedCode
                      ? 'bg-emerald-600 text-white shadow-sm dark:bg-[#CCFF00] dark:text-[#0B0E14]'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/[0.1] dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 classic:border-2 classic:border-[#1E4638] classic:bg-[#FBF5E8] classic:text-[#1E4638]'
                  }`}
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Código</span>
                    </>
                  )}
                </motion.button>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={handleCopyInviteLink}
                className={`inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold tracking-wider uppercase transition ${
                  copiedInviteLink
                    ? 'bg-emerald-600 text-white shadow-sm dark:bg-[#CCFF00] dark:text-[#0B0E14]'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-[#CCFF00]/30 dark:bg-[#CCFF00]/12 dark:text-[#CCFF00] dark:hover:bg-[#CCFF00]/20 classic:border-2 classic:border-[#1E4638] classic:bg-[#D46F4D] classic:text-[#FBF5E8] classic:shadow-[2px_2px_0_#1E4638]'
                }`}
              >
                {copiedInviteLink ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>¡Link copiado!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    <span>Invitar con link</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.05 }}
            className="lg:col-span-8"
          >
            <div className="glass-card overflow-hidden rounded-2xl">
              {/* Tabs escritorio */}
              <div className="relative hidden overflow-x-auto border-b border-slate-200/80 px-2 pt-2 md:flex dark:border-white/[0.08] classic:border-[#1E4638]/20">
                {mainTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative inline-flex min-h-[44px] shrink-0 items-center gap-1.5 px-3.5 py-3 text-xs font-extrabold tracking-wider uppercase transition ${
                        isActive
                          ? 'text-emerald-700 dark:text-[#CCFF00] classic:text-[#1E4638]'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white classic:text-[#4C6B5E] classic:hover:text-[#1E4638]'
                      }`}
                    >
                      <Icon className="relative z-10 h-4 w-4" />
                      <span className="relative z-10">{tab.label}</span>

                      {isActive && (
                        <motion.div
                          layoutId="tournament-active-tab-pill"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          className="absolute inset-x-1 top-1 bottom-0 rounded-t-xl border-b-2 border-emerald-500 bg-emerald-500/10 dark:border-[#CCFF00] dark:bg-[#CCFF00]/10 classic:border-[#D46F4D] classic:bg-[#EFE2CC]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Barra compacta de sección activa en móvil */}
              <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-2.5 md:hidden dark:border-white/[0.08] classic:border-[#1E4638]/20 classic:bg-[#EFE2CC]/60">
                <div className="flex items-center gap-2">
                  <ActiveTabIcon className="h-4 w-4 text-emerald-600 dark:text-[#CCFF00] classic:text-[#D46F4D]" />
                  <span className="text-xs font-extrabold tracking-wider text-slate-900 uppercase dark:text-white classic:text-[#1E4638]">
                    {activeTabMeta.label}
                  </span>
                </div>
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase classic:text-[#4C6B5E]">
                  Menú abajo
                </span>
              </div>

              <div className="p-4 sm:p-5">
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
                          participants={enrichedParticipants}
                          matchdays={customMatchdays}
                          subtournaments={subtournaments}
                          subEntries={subEntries}
                          subEntryMembers={subEntryMembers}
                          currentUserId={user.id}
                          badgesMap={badgesMap}
                        />
                      ) : (
                        <TournamentStandingsTab
                          tournament={tournament}
                          participants={enrichedParticipants}
                          matches={matches}
                          eliminations={eliminations}
                          currentUserId={user.id}
                          badgesMap={badgesMap}
                        />
                      ))}

                    {activeTab === 'matches' &&
                      (tournament.format === 'custom' ? (
                        <CustomMatchdaysTab
                          tournament={tournament}
                          participants={enrichedParticipants}
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
                          onBroadcastLiveDraw={handleBroadcastLiveDraw}
                          onRefreshCustomData={refreshCustomDataSilently}
                        />
                      ) : (
                        <TournamentMatchesTab
                          tournament={tournament}
                          participants={enrichedParticipants}
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
                          prodePolls={prodePolls}
                          prodeVotes={prodeVotes}
                          onOpenProde={() => setActiveTab('predictions')}
                        />
                      ))}

                    {activeTab === 'teams' && isTeamBasedTournament && (
                      <TeamManagerPanel
                        scopeName={tournament.name}
                        participants={teamRosterPlayers}
                        potSets={potSets}
                        potAssignments={potAssignments}
                        savedTeams={savedTournamentTeams}
                        isAdmin={isAdmin}
                        saving={savingTeams}
                        hasMatchesGenerated={matches.length > 0}
                        generatingMatches={generatingMatches}
                        onBroadcastLiveDraw={handleBroadcastLiveDraw}
                        onOpenPotManager={() => setIsPotModalOpen(true)}
                        onSaveTeams={handleSaveTournamentTeams}
                        onGenerateMatches={
                          tournament.format === 'league' ||
                          tournament.format === 'knockout'
                            ? handleGenerateMatches
                            : undefined
                        }
                      />
                    )}

                    {activeTab === 'scorers' && (
                      <TournamentScorersTab
                        tournament={tournament}
                        participants={enrichedParticipants}
                        participantMap={participantMap}
                        isAdmin={isAdmin}
                        currentUserId={user.id}
                        onTournamentUpdated={(updated) => setTournament(updated)}
                      />
                    )}

                    {activeTab === 'predictions' && (
                      <PredictionsTab
                        tournament={tournament}
                        participants={enrichedParticipants}
                        participantMap={participantMap}
                        matches={matches}
                        subtournaments={subtournaments}
                        subEntries={subEntries}
                        subEntryMembers={subEntryMembers}
                        subMatches={subMatches}
                        isAdmin={isAdmin}
                        currentUserId={user.id}
                        myLinkedParticipant={myLinkedParticipant}
                        externalPolls={prodePolls}
                        externalVotes={prodeVotes}
                        externalLoading={prodeLoading}
                        onRefreshExternal={refreshProdeData}
                      />
                    )}

                    {activeTab === 'stats' && (
                      <div className="space-y-4">
                        <div className="inline-flex rounded-xl border border-slate-200/80 bg-slate-100/85 p-1 dark:border-white/[0.08] dark:bg-[#0B0E14] classic:border-2 classic:border-[#1E4638] classic:bg-[#EFE2CC]">
                          <button
                            type="button"
                            onClick={() => setStatsSubTab('summary')}
                            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-extrabold tracking-wider uppercase transition ${
                              statsSubTab === 'summary'
                                ? 'bg-white text-slate-900 shadow-xs dark:bg-[#CCFF00] dark:text-[#0B0E14] classic:bg-[#1E4638] classic:text-[#FBF5E8]'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                            }`}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Resumen</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatsSubTab('stats')}
                            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-extrabold tracking-wider uppercase transition ${
                              statsSubTab === 'stats'
                                ? 'bg-white text-slate-900 shadow-xs dark:bg-[#CCFF00] dark:text-[#0B0E14] classic:bg-[#1E4638] classic:text-[#FBF5E8]'
                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                            }`}
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                            <span>Estadísticas</span>
                          </button>
                        </div>

                        {statsSubTab === 'summary' ? (
                          <TournamentSummaryTab
                            tournament={tournament}
                            participants={enrichedParticipants}
                            matches={matches}
                            eliminations={eliminations}
                            customMatchdays={customMatchdays}
                            subtournaments={subtournaments}
                            subEntries={subEntries}
                            subEntryMembers={subEntryMembers}
                            subMatches={subMatches}
                            currentUserId={user.id}
                          />
                        ) : (
                          <TournamentStatsTab
                            tournament={tournament}
                            participants={enrichedParticipants}
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
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.1 }}
            className="lg:col-span-4"
          >
            <div className="glass-card rounded-2xl p-5">
              <input
                ref={participantAvatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleParticipantAvatarFileChange}
                className="hidden"
              />

              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-slate-900 uppercase dark:text-white classic:text-[#1E4638]">
                  <Users className="h-4 w-4 text-emerald-500 dark:text-[#CCFF00] classic:text-[#D46F4D]" />
                  <span>
                    Participantes{' '}
                    <span className="font-mono tabular-nums">
                      ({enrichedParticipants.length})
                    </span>
                  </span>
                </h2>

                {(tournament.format === 'custom' || isTeamBasedTournament) && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setIsPotModalOpen(true)}
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-extrabold tracking-wider text-amber-800 uppercase transition hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-400/12 dark:text-amber-300 classic:border-2 classic:border-[#1E4638] classic:bg-[#D9A441]/35 classic:text-[#1E4638]"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span className="font-mono tabular-nums">
                      Bombos ({potSets.length})
                    </span>
                  </motion.button>
                )}
              </div>

              {!myLinkedParticipant &&
                enrichedParticipants.some((p) => !p.user_id) && (
                  <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-800 dark:border-[#2563EB]/35 dark:bg-[#2563EB]/15 dark:text-blue-200 classic:border-2 classic:border-[#D46F4D] classic:bg-[#D46F4D]/12 classic:text-[#1E4638]">
                    ¿Tu nombre ya está en la lista? Toca{' '}
                    <strong>Vincularme</strong> para asociar tu cuenta y tu avatar.
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
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-white/[0.08] dark:bg-[#0B0E14] dark:text-white dark:focus:border-[#CCFF00] classic:border-2 classic:border-[#1E4638]/40 classic:bg-[#FFFBF4]"
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={addingParticipant}
                    className="inline-flex min-h-[42px] shrink-0 items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold tracking-wider text-white uppercase shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 dark:bg-[#CCFF00] dark:text-[#0B0E14] dark:hover:bg-[#d9ff33] classic:border-2 classic:border-[#1E4638] classic:bg-[#1E4638] classic:text-[#FBF5E8]"
                    aria-label="Agregar participante"
                  >
                    {addingParticipant ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 stroke-[2.5]" />
                    )}
                    <span>Agregar</span>
                  </motion.button>
                </form>
              )}

              {participantActionError && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{participantActionError}</span>
                </div>
              )}

              {enrichedParticipants.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                  {isAdmin
                    ? 'Aún no hay participantes. Usa el campo de arriba para agregar jugadores.'
                    : 'El administrador todavía no agregó participantes al torneo.'}
                </div>
              ) : (
                <ul className="space-y-2">
                  <AnimatePresence initial={false}>
                    {enrichedParticipants.map((participant) => {
                      const isMine = participant.user_id === user.id;
                      const isLinked = Boolean(participant.user_id);
                      const linkedMember = isLinked
                        ? memberByUserId.get(participant.user_id)
                        : null;
                      const linkedRole = linkedMember?.role || null;
                      const linkedRoleMeta = linkedRole
                        ? getRoleMeta(linkedRole)
                        : null;
                      const playerBadges = badgesMap.get(participant.id) || [];

                      const canClaim = !isLinked && !myLinkedParticipant;
                      const canOwnerToggleRole =
                        isOwner &&
                        isLinked &&
                        participant.user_id !== user.id &&
                        linkedMember &&
                        linkedMember.role !== 'owner';

                      const isEditingThis =
                        isAdmin && editingParticipantId === participant.id;
                      const isBusy =
                        claimingId === participant.id ||
                        savingParticipantId === participant.id ||
                        uploadingAvatarId === participant.id ||
                        removingParticipantId === participant.id ||
                        (isLinked && updatingRoleUserId === participant.user_id);

                      return (
                        <motion.li
                          layout
                          key={participant.id}
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.94 }}
                          transition={{ duration: 0.2 }}
                          className={`rounded-xl border p-3 transition ${
                            isMine
                              ? 'border-emerald-300/80 bg-emerald-50/60 dark:border-[#CCFF00]/35 dark:bg-[#CCFF00]/[0.08] classic:border-2 classic:border-[#1E4638] classic:bg-[#EFE2CC]'
                              : 'border-slate-200/80 bg-white/70 hover:border-slate-300 dark:border-white/[0.07] dark:bg-white/[0.03] dark:hover:border-white/15 classic:border-[#1E4638]/20 classic:bg-[#FFFBF4]'
                          }`}
                        >
                          {isEditingThis ? (
                            <div className="space-y-2">
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
                                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-base text-slate-900 focus:border-emerald-500 focus:outline-none sm:text-sm dark:border-white/15 dark:bg-[#0B0E14] dark:text-white"
                                />
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleSaveParticipantName(participant.id)
                                  }
                                  className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-[#CCFF00] dark:text-[#0B0E14]"
                                  aria-label="Guardar nombre"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => setEditingParticipantId(null)}
                                  className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                                  aria-label="Cancelar edición"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>

                              {participant.avatar_url && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleClearParticipantAvatar(participant.id)
                                  }
                                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-300"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Quitar foto personalizada</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <div className="relative shrink-0">
                                    <Avatar
                                      name={participant.name}
                                      url={participant.effective_avatar_url}
                                      size="md"
                                      highlight={isMine}
                                    />
                                    {uploadingAvatarId === participant.id && (
                                      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/60 text-white">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      </span>
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <p className="truncate text-sm font-bold text-slate-900 dark:text-white classic:text-[#1E4638]">
                                        {participant.name}
                                      </p>
                                      {linkedRoleMeta && linkedRole !== 'member' && (
                                        <span
                                          className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${linkedRoleMeta.badgeClass}`}
                                        >
                                          {linkedRole === 'owner' ? (
                                            <Crown className="h-2.5 w-2.5" />
                                          ) : (
                                            <ShieldCheck className="h-2.5 w-2.5" />
                                          )}
                                          <span>{linkedRoleMeta.label}</span>
                                        </span>
                                      )}
                                    </div>

                                    {playerBadges.length > 0 && (
                                      <div className="mt-1">
                                        <PlayerBadges badges={playerBadges} max={2} />
                                      </div>
                                    )}

                                    <div className="mt-0.5 flex items-center gap-1 text-[11px]">
                                      {isMine ? (
                                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-[#CCFF00] classic:text-[#D46F4D]">
                                          <UserCheck className="h-3 w-3" />
                                          <span>Tu perfil</span>
                                        </span>
                                      ) : isLinked ? (
                                        <span className="inline-flex items-center gap-1 font-semibold text-sky-700 dark:text-blue-400 classic:text-[#315E4E]">
                                          <UserCheck className="h-3 w-3" />
                                          <span>Cuenta vinculada</span>
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 dark:text-slate-500">
                                          Sin cuenta vinculada
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-0.5">
                                  {canClaim && (
                                    <motion.button
                                      whileTap={{ scale: 0.94 }}
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() =>
                                        handleClaimParticipant(participant.id)
                                      }
                                      className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-[#CCFF00]/30 dark:bg-[#CCFF00]/12 dark:text-[#CCFF00] classic:border-[#1E4638] classic:bg-[#1E4638] classic:text-[#FBF5E8]"
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
                                          triggerParticipantAvatarUpload(
                                            participant.id
                                          )
                                        }
                                        className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-emerald-600 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-[#CCFF00]"
                                        title="Subir foto del participante"
                                        aria-label={`Subir foto de ${participant.name}`}
                                      >
                                        <Camera className="h-4 w-4" />
                                      </button>

                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() =>
                                          startEditingParticipant(participant)
                                        }
                                        className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white"
                                        title="Editar nombre"
                                        aria-label={`Editar a ${participant.name}`}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>

                                      {isLinked && (
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          onClick={() =>
                                            handleUnlinkParticipant(participant.id)
                                          }
                                          className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-slate-400 transition hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 dark:hover:bg-amber-500/15 dark:hover:text-amber-300"
                                          title="Desvincular cuenta"
                                          aria-label={`Desvincular cuenta de ${participant.name}`}
                                        >
                                          <Unlink className="h-4 w-4" />
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() =>
                                          handleDeleteParticipant(participant.id)
                                        }
                                        className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/15 dark:hover:text-rose-400"
                                        title="Eliminar participante"
                                        aria-label={`Eliminar a ${participant.name}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {canOwnerToggleRole && (
                                <div className="flex items-center justify-end border-t border-slate-100 pt-2 dark:border-white/[0.06] classic:border-[#1E4638]/12">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleToggleAdminRole(
                                        participant.user_id,
                                        linkedMember.role
                                      )
                                    }
                                    className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                                      linkedMember.role === 'admin'
                                        ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-300'
                                        : 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-500/35 dark:bg-violet-500/15 dark:text-violet-300'
                                    }`}
                                  >
                                    {updatingRoleUserId === participant.user_id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : linkedMember.role === 'admin' ? (
                                      <Shield className="h-3.5 w-3.5" />
                                    ) : (
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                    )}
                                    <span>
                                      {linkedMember.role === 'admin'
                                        ? 'Quitar rol Admin'
                                        : 'Promover a Admin'}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}

              {spectatorMembers.length > 0 && (
                <div className="mt-5 border-t border-slate-200/80 pt-4 dark:border-white/[0.08] classic:border-[#1E4638]/15">
                  <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400 classic:text-[#4C6B5E]">
                    <Eye className="h-3.5 w-3.5" />
                    <span>Espectadores / Otros miembros ({spectatorMembers.length})</span>
                  </h3>
                  <ul className="space-y-2">
                    {spectatorMembers.map((m) => {
                      const mName = m.profile?.display_name || 'Usuario';
                      const mRoleMeta = getRoleMeta(m.role);
                      const canToggle =
                        isOwner && m.user_id !== user.id && m.role !== 'owner';
                      const isRoleBusy = updatingRoleUserId === m.user_id;

                      return (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.03] classic:border-[#1E4638]/15 classic:bg-[#EFE2CC]/60"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar
                              name={mName}
                              url={m.profile?.avatar_url}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200 classic:text-[#1E4638]">
                                {mName}
                              </p>
                              <span
                                className={`mt-0.5 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${mRoleMeta.badgeClass}`}
                              >
                                {mRoleMeta.label}
                              </span>
                            </div>
                          </div>

                          {canToggle && (
                            <button
                              type="button"
                              disabled={isRoleBusy}
                              onClick={() => handleToggleAdminRole(m.user_id, m.role)}
                              className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-500/35 dark:bg-violet-500/15 dark:text-violet-300"
                            >
                              {isRoleBusy && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              <span>
                                {m.role === 'admin' ? 'Quitar Admin' : 'Hacer Admin'}
                              </span>
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
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
          leagueTiebreakerEnabled={Boolean(tournament.config?.league_tiebreaker)}
          onClose={() =>
            setMatchModalState({ isOpen: false, match: null, siblingLeg: null })
          }
          onSave={handleSaveMatchResult}
          onReset={handleResetMatchResult}
        />

        {/* Modal Espectador del Sorteo en Vivo */}
        <LiveTeamDrawModal
          isOpen={spectatorDrawOpen && Boolean(liveDraw?.active)}
          onClose={() => setSpectatorDrawOpen(false)}
          isSpectator
          remoteState={liveDraw}
          participants={enrichedParticipants}
        />

        {(tournament.format === 'custom' || isTeamBasedTournament) && (
          <PotSetsModal
            isOpen={isPotModalOpen}
            tournamentId={tournament.id}
            participants={
              isTeamBasedTournament ? teamRosterPlayers : enrichedParticipants
            }
            potSets={potSets}
            potAssignments={potAssignments}
            isAdmin={isAdmin}
            onClose={() => setIsPotModalOpen(false)}
            onChanged={refreshCustomDataSilently}
          />
        )}
      </main>

      {typeof document !== 'undefined' &&
        createPortal(
          <nav
            aria-label="Navegación del torneo"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/85 bg-white/92 px-1.5 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.16)] backdrop-blur-xl md:hidden dark:border-white/[0.08] dark:bg-[#141923]/95 dark:shadow-[0_-12px_36px_-10px_rgba(0,0,0,0.75)] classic:border-t-2 classic:border-[#143026] classic:bg-[#1E4638] classic:backdrop-blur-none"
          >
            <div className="mx-auto flex max-w-md items-center justify-around gap-0.5">
              {mainTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`relative flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 transition-colors ${
                      isActive
                        ? 'text-emerald-600 dark:text-[#CCFF00] classic:text-[#FBF5E8]'
                        : 'text-slate-500 dark:text-slate-400 classic:text-[#B9CFC5]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="mobile-bottom-tab-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0.5 rounded-xl bg-emerald-500/12 dark:bg-[#CCFF00]/15 classic:border classic:border-[#D9A441] classic:bg-[#285947]"
                      />
                    )}
                    <div className="relative z-10">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="relative z-10 text-[9.5px] font-extrabold tracking-tight uppercase">
                      {tab.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>,
          document.body
        )}
    </>
  );
}