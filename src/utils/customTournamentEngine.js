import {
  computeKnockoutSummary,
  computeLastStandingStandings,
  computeLeagueStandings,
  generateKnockoutMatches,
  generateLeagueMatches,
} from './tournamentEngine';

export const DEFAULT_POINTS_TEMPLATE = [10, 7, 5, 4, 3, 2, 1];

export const SUBTOURNAMENT_FORMATS = {
  league: {
    value: 'league',
    label: 'Liga',
    description: 'Todos contra todos acumulando puntos en tabla interna.',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  knockout: {
    value: 'knockout',
    label: 'Eliminatoria',
    description: 'Llaves directas con avance automático hasta la final.',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  last_standing: {
    value: 'last_standing',
    label: 'Último en pie',
    description: 'Se eliminan competidores en orden hasta quedar el ganador.',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  manual: {
    value: 'manual',
    label: 'Posiciones manuales',
    description: 'Asigna directamente los puestos 1.º, 2.º, 3.º... al finalizar.',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
};

export const SUBTOURNAMENT_FORMAT_LIST = Object.values(SUBTOURNAMENT_FORMATS);

export function getSubtournamentFormatMeta(format) {
  return (
    SUBTOURNAMENT_FORMATS[format] || {
      value: format,
      label: 'Personalizado',
      description: '',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    }
  );
}

export function buildDefaultPointsScale(count, existingScale = []) {
  const safeCount = Math.max(0, Number(count) || 0);
  const scale = [];
  for (let i = 0; i < safeCount; i += 1) {
    if (i < existingScale.length && existingScale[i] !== undefined && existingScale[i] !== null) {
      scale.push(existingScale[i]);
    } else {
      scale.push(i < DEFAULT_POINTS_TEMPLATE.length ? DEFAULT_POINTS_TEMPLATE[i] : 0);
    }
  }
  return scale;
}

export function getPointsForRank(pointsScale, rank) {
  const numericRank = Number(rank);
  if (!Array.isArray(pointsScale) || Number.isNaN(numericRank) || numericRank < 1) {
    return 0;
  }
  const index = numericRank - 1;
  if (index >= pointsScale.length) return 0;
  const val = Number(pointsScale[index]);
  return Number.isNaN(val) ? 0 : val;
}

export function adaptEntriesToParticipants(entries, entryMembers, currentUserId, participantMap) {
  const membersByEntry = new Map();
  (entryMembers || []).forEach((em) => {
    if (!membersByEntry.has(em.entry_id)) {
      membersByEntry.set(em.entry_id, []);
    }
    membersByEntry.get(em.entry_id).push(em.participant_id);
  });

  return (entries || []).map((entry) => {
    const memberIds = membersByEntry.get(entry.id) || [];
    const effectiveMemberIds =
      memberIds.length > 0
        ? memberIds
        : entry.participant_id
        ? [entry.participant_id]
        : [];

    const containsCurrentUser = effectiveMemberIds.some((pId) => {
      const p = participantMap?.get(pId);
      return p?.user_id && p.user_id === currentUserId;
    });

    return {
      ...entry,
      id: entry.id,
      name: entry.entry_name,
      user_id: containsCurrentUser ? currentUserId : null,
      memberIds: effectiveMemberIds,
    };
  });
}

export function adaptSubMatchesToMatches(subMatches) {
  return (subMatches || []).map((m) => ({
    ...m,
    tournament_id: m.subtournament_id,
    participant_a_id: m.entry_a_id,
    participant_b_id: m.entry_b_id,
    winner_id: m.winner_entry_id,
  }));
}

export function adaptSubEliminationsToEliminations(subEliminations) {
  return (subEliminations || []).map((el) => ({
    ...el,
    tournament_id: el.subtournament_id,
    participant_id: el.entry_id,
  }));
}

export function generateSubtournamentMatches(subtournament, entries) {
  const adaptedEntries = (entries || []).map((e) => ({
    id: e.id,
    name: e.entry_name || e.name,
  }));

  const pseudoTournament = {
    id: subtournament.id,
    config: subtournament.config || {},
  };

  let rawMatches = [];
  if (subtournament.format === 'league') {
    rawMatches = generateLeagueMatches(pseudoTournament, adaptedEntries);
  } else if (subtournament.format === 'knockout') {
    rawMatches = generateKnockoutMatches(pseudoTournament, adaptedEntries);
  } else {
    return [];
  }

  return rawMatches.map((m) => ({
    subtournament_id: subtournament.id,
    round_number: m.round_number,
    round_name: m.round_name,
    match_order: m.match_order,
    leg: m.leg,
    entry_a_id: m.participant_a_id,
    entry_b_id: m.participant_b_id,
    score_a: m.score_a,
    score_b: m.score_b,
    winner_entry_id: m.winner_id,
    is_draw: m.is_draw,
    is_bye: m.is_bye,
    status: m.status,
  }));
}

export function computeSuggestedSubtournamentRanks(
  subtournament,
  entries,
  subMatches,
  subEliminations,
  manualRanks = {},
  participantMap = null,
  entryMembers = [],
  currentUserId = null
) {
  const adaptedEntries = adaptEntriesToParticipants(
    entries,
    entryMembers,
    currentUserId,
    participantMap
  );
  const adaptedMatches = adaptSubMatchesToMatches(subMatches);
  const adaptedEliminations = adaptSubEliminationsToEliminations(subEliminations);
  const pointsScale = Array.isArray(subtournament.points_scale)
    ? subtournament.points_scale
    : [];

  if (subtournament.format === 'league') {
    const rows = computeLeagueStandings(adaptedEntries, adaptedMatches);
    return rows.map((row, index) => {
      const rank = index + 1;
      return {
        entry: row.participant,
        rank,
        points: getPointsForRank(pointsScale, rank),
        detail: `${row.pts} pts · DG ${row.dg >= 0 ? `+${row.dg}` : row.dg}`,
      };
    });
  }

  if (subtournament.format === 'knockout') {
    const summary = computeKnockoutSummary(adaptedEntries, adaptedMatches);
    let currentRank = 1;
    let lastGroupKey = null;

    return summary.rows.map((row, index) => {
      const groupKey =
        row.statusLabel === 'Campeón' ||
        row.statusLabel === 'Subcampeón' ||
        row.statusLabel === '3.º puesto' ||
        row.statusLabel === '4.º puesto'
          ? row.statusLabel
          : row.eliminatedInRound
          ? `elim-${row.eliminatedRoundNumber}`
          : `idx-${index}`;

      if (index > 0 && groupKey !== lastGroupKey) {
        currentRank = index + 1;
      }
      lastGroupKey = groupKey;

      return {
        entry: row.participant,
        rank: currentRank,
        points: getPointsForRank(pointsScale, currentRank),
        detail: row.statusLabel,
      };
    });
  }

  if (subtournament.format === 'last_standing') {
    const ls = computeLastStandingStandings(adaptedEntries, adaptedEliminations);
    return ls.rows.map((row) => ({
      entry: row.participant,
      rank: row.rank,
      points: getPointsForRank(pointsScale, row.rank),
      detail: row.isChampion
        ? 'Campeón'
        : row.isAlive
        ? 'En pie'
        : `Eliminado #${row.eliminationOrder}`,
    }));
  }

  // Formato 'manual'
  const sorted = [...adaptedEntries]
    .map((entry, idx) => {
      const assignedRank = Number.parseInt(
        manualRanks[entry.id] ?? entry.final_rank ?? idx + 1,
        10
      );
      const safeRank =
        Number.isNaN(assignedRank) || assignedRank < 1 ? idx + 1 : assignedRank;
      return { entry, safeRank };
    })
    .sort((a, b) => {
      if (a.safeRank !== b.safeRank) return a.safeRank - b.safeRank;
      return a.entry.name.localeCompare(b.entry.name, 'es');
    });

  return sorted.map(({ entry, safeRank }) => ({
    entry,
    rank: safeRank,
    points: getPointsForRank(pointsScale, safeRank),
    detail: `${safeRank}.º puesto`,
  }));
}

export function isSubtournamentNaturallyFinished(
  subtournament,
  entries,
  subMatches,
  subEliminations
) {
  if (subtournament.format === 'manual') return true;

  if (subtournament.format === 'last_standing') {
    const aliveCount = Math.max(0, entries.length - subEliminations.length);
    return entries.length >= 2 && aliveCount <= 1;
  }

  const regularMatches = subMatches.filter((m) => !m.is_bye);
  if (regularMatches.length === 0) return false;
  return regularMatches.every((m) => m.status === 'completed');
}

export function computeCustomGeneralStandings(
  participants,
  matchdays,
  subtournaments,
  entries,
  entryMembers
) {
  const subMap = new Map(subtournaments.map((s) => [s.id, s]));
  const membersByEntry = new Map();

  entryMembers.forEach((em) => {
    if (!membersByEntry.has(em.entry_id)) {
      membersByEntry.set(em.entry_id, new Set());
    }
    membersByEntry.get(em.entry_id).add(em.participant_id);
  });

  const statsMap = new Map();
  participants.forEach((p) => {
    const matchdayPoints = new Map();
    matchdays.forEach((md) => {
      matchdayPoints.set(md.id, { participated: false, points: 0 });
    });

    statsMap.set(p.id, {
      participant: p,
      totalPoints: 0,
      playedSubtournaments: 0,
      firstPlaces: 0,
      matchdayPoints,
    });
  });

  entries.forEach((entry) => {
    const sub = subMap.get(entry.subtournament_id);
    if (!sub || sub.status !== 'completed') return;

    const pts = Number(entry.points_awarded || 0);
    const memberSet = membersByEntry.get(entry.id);
    const targetParticipantIds =
      memberSet && memberSet.size > 0
        ? Array.from(memberSet)
        : entry.participant_id
        ? [entry.participant_id]
        : [];

    targetParticipantIds.forEach((pId) => {
      const pStats = statsMap.get(pId);
      if (!pStats) return;

      pStats.totalPoints += pts;
      pStats.playedSubtournaments += 1;
      if (entry.final_rank === 1) {
        pStats.firstPlaces += 1;
      }

      const mdEntry = pStats.matchdayPoints.get(sub.matchday_id) || {
        participated: false,
        points: 0,
      };
      pStats.matchdayPoints.set(sub.matchday_id, {
        participated: true,
        points: mdEntry.points + pts,
      });
    });
  });

  const rows = Array.from(statsMap.values());
  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
    if (b.playedSubtournaments !== a.playedSubtournaments) {
      return b.playedSubtournaments - a.playedSubtournaments;
    }
    return a.participant.name.localeCompare(b.participant.name, 'es');
  });

  return rows;
}

export function computeCustomMatchdayStandings(
  participants,
  matchdaySubtournaments,
  entries,
  entryMembers
) {
  const subIds = new Set(matchdaySubtournaments.map((s) => s.id));
  const subMap = new Map(matchdaySubtournaments.map((s) => [s.id, s]));
  const membersByEntry = new Map();

  entryMembers.forEach((em) => {
    if (!membersByEntry.has(em.entry_id)) {
      membersByEntry.set(em.entry_id, new Set());
    }
    membersByEntry.get(em.entry_id).add(em.participant_id);
  });

  const statsMap = new Map();
  participants.forEach((p) => {
    statsMap.set(p.id, {
      participant: p,
      totalPoints: 0,
      subResults: new Map(),
    });
  });

  entries.forEach((entry) => {
    if (!subIds.has(entry.subtournament_id)) return;
    const sub = subMap.get(entry.subtournament_id);
    if (!sub) return;

    const memberSet = membersByEntry.get(entry.id);
    const targetParticipantIds =
      memberSet && memberSet.size > 0
        ? Array.from(memberSet)
        : entry.participant_id
        ? [entry.participant_id]
        : [];

    const isCompleted = sub.status === 'completed';
    const pts = isCompleted ? Number(entry.points_awarded || 0) : 0;

    targetParticipantIds.forEach((pId) => {
      const pStats = statsMap.get(pId);
      if (!pStats) return;

      if (isCompleted) {
        pStats.totalPoints += pts;
      }

      pStats.subResults.set(sub.id, {
        participated: true,
        completed: isCompleted,
        points: pts,
        finalRank: entry.final_rank,
        entryName: entry.entry_name,
      });
    });
  });

  const rows = Array.from(statsMap.values());
  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return a.participant.name.localeCompare(b.participant.name, 'es');
  });

  return rows;
}