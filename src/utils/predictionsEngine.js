import { resolveParticipantAvatar } from './avatarUpload';
import { resolveMatchOutcome } from './tournamentStatsEngine';

function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

export function formatProdePoints(value) {
  const num = Number(value) || 0;
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function getEntryAvatarUrl(entry, subEntryMembers, participantMap) {
  if (!entry) return null;
  const members = subEntryMembers.filter((em) => em.entry_id === entry.id);
  const singleParticipantId =
    members.length === 1
      ? members[0].participant_id
      : members.length === 0
      ? entry.participant_id
      : null;

  if (!singleParticipantId) return null;
  const p = participantMap.get(singleParticipantId);
  return p ? resolveParticipantAvatar(p) : null;
}

export function getPollTargetDetails(
  poll,
  {
    matches = [],
    subMatches = [],
    subtournaments = [],
    subEntries = [],
    participantMap = new Map(),
    subEntryMembers = [],
  }
) {
  if (!poll) return null;

  if (poll.poll_type === 'match') {
    const match = matches.find((m) => m.id === poll.match_id) || null;
    if (!match) return null;

    const pA = participantMap.get(match.participant_a_id);
    const pB = participantMap.get(match.participant_b_id);
    const outcome = resolveMatchOutcome(match);

    let actualOutcome = null;
    if (outcome) {
      if (outcome.isDraw) actualOutcome = 'draw';
      else if (outcome.winnerId === match.participant_a_id) actualOutcome = 'a';
      else if (outcome.winnerId === match.participant_b_id) actualOutcome = 'b';
    }

    return {
      kind: 'match',
      isCompleted: match.status === 'completed',
      roundLabel: match.round_name,
      subName: null,
      sideA: {
        id: match.participant_a_id,
        name: pA?.name || 'Por definir',
        avatarUrl: resolveParticipantAvatar(pA),
      },
      sideB: {
        id: match.participant_b_id,
        name: pB?.name || 'Por definir',
        avatarUrl: resolveParticipantAvatar(pB),
      },
      hasScores: Boolean(outcome?.hasScores),
      scoreA: outcome?.scoreA ?? null,
      scoreB: outcome?.scoreB ?? null,
      actualOutcome,
    };
  }

  if (poll.poll_type === 'subtournament_match') {
    const sm = subMatches.find((m) => m.id === poll.subtournament_match_id) || null;
    if (!sm) return null;

    const sub = subtournaments.find((s) => s.id === sm.subtournament_id) || null;
    const entryA = subEntries.find((e) => e.id === sm.entry_a_id) || null;
    const entryB = subEntries.find((e) => e.id === sm.entry_b_id) || null;

    const adapted = {
      ...sm,
      participant_a_id: sm.entry_a_id,
      participant_b_id: sm.entry_b_id,
      winner_id: sm.winner_entry_id,
    };
    const outcome = resolveMatchOutcome(adapted);

    let actualOutcome = null;
    if (outcome) {
      if (outcome.isDraw) actualOutcome = 'draw';
      else if (outcome.winnerId === sm.entry_a_id) actualOutcome = 'a';
      else if (outcome.winnerId === sm.entry_b_id) actualOutcome = 'b';
    }

    return {
      kind: 'match',
      isCompleted: sm.status === 'completed',
      roundLabel: sm.round_name,
      subName: sub?.name || null,
      sideA: {
        id: sm.entry_a_id,
        name: entryA?.entry_name || 'Por definir',
        avatarUrl: getEntryAvatarUrl(entryA, subEntryMembers, participantMap),
      },
      sideB: {
        id: sm.entry_b_id,
        name: entryB?.entry_name || 'Por definir',
        avatarUrl: getEntryAvatarUrl(entryB, subEntryMembers, participantMap),
      },
      hasScores: Boolean(outcome?.hasScores),
      scoreA: outcome?.scoreA ?? null,
      scoreB: outcome?.scoreB ?? null,
      actualOutcome,
    };
  }

  if (poll.poll_type === 'subtournament_winner') {
    const sub = subtournaments.find((s) => s.id === poll.subtournament_id) || null;
    if (!sub) return null;

    const entries = subEntries
      .filter((e) => e.subtournament_id === sub.id)
      .map((e) => ({
        id: e.id,
        name: e.entry_name,
        finalRank: e.final_rank,
        avatarUrl: getEntryAvatarUrl(e, subEntryMembers, participantMap),
      }));

    const isCompleted = sub.status === 'completed';
    const championEntryIds = isCompleted
      ? entries.filter((e) => e.finalRank === 1).map((e) => e.id)
      : [];

    return {
      kind: 'subtournament',
      subtournament: sub,
      isCompleted,
      entries,
      championEntryIds,
    };
  }

  return null;
}

/**
 * Calcula cuotas dinámicas según popularidad para encuestas ('winner' o 'champion'):
 * La opción más elegida entrega menos puntos (hasta minPts) y la menos elegida más (hasta maxPts).
 */
export function computePollOptionStats(poll, votes = [], targetDetails = null) {
  if (!poll || poll.prediction_mode === 'exact_score') {
    return null;
  }

  const minPts = Math.max(0, Number(poll.points_outcome ?? 1));
  const rawMax =
    poll.prediction_mode === 'champion'
      ? Number(poll.points_champion ?? 5)
      : Number(poll.points_exact ?? 5);
  const maxPts = Math.max(minPts, rawMax);

  const optionKeys = [];
  if (poll.prediction_mode === 'winner') {
    optionKeys.push('a');
    if (poll.allow_draw) optionKeys.push('draw');
    optionKeys.push('b');
  } else if (poll.prediction_mode === 'champion' && targetDetails?.entries) {
    targetDetails.entries.forEach((e) => optionKeys.push(e.id));
  }

  const counts = new Map();
  optionKeys.forEach((k) => counts.set(k, 0));

  votes.forEach((v) => {
    const key =
      poll.prediction_mode === 'champion'
        ? v.predicted_entry_id
        : v.predicted_outcome;
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const totalVotes = votes.length;
  const byOption = new Map();

  counts.forEach((count, key) => {
    const share = totalVotes > 0 ? count / totalVotes : 0;
    const pct = totalVotes > 0 ? Math.round(share * 100) : 0;
    const currentPoints =
      totalVotes > 0 && count > 0
        ? round1(minPts + (maxPts - minPts) * (1 - share))
        : maxPts;

    byOption.set(key, {
      count,
      pct,
      currentPoints,
    });
  });

  return {
    totalVotes,
    minPts,
    maxPts,
    byOption,
    getProjectedPoints(key, myCurrentVoteKey) {
      const count = counts.get(key) || 0;
      if (myCurrentVoteKey === key) {
        return byOption.get(key)?.currentPoints ?? maxPts;
      }
      const nextTotal = myCurrentVoteKey ? Math.max(1, totalVotes) : totalVotes + 1;
      const nextCount = count + 1;
      return round1(minPts + (maxPts - minPts) * (1 - nextCount / nextTotal));
    },
  };
}

export function evaluateVote(poll, vote, targetDetails, optionStats = null) {
  if (!poll || !vote || !targetDetails || !targetDetails.isCompleted) {
    return {
      resolved: false,
      points: 0,
      fullHit: false,
      outcomeHit: false,
      status: 'pending',
    };
  }

  // Tipo 2A: Encuesta de Campeón de Subtorneo (cuotas dinámicas)
  if (poll.prediction_mode === 'champion') {
    const hit = targetDetails.championEntryIds.includes(vote.predicted_entry_id);
    if (!hit) {
      return {
        resolved: true,
        points: 0,
        fullHit: false,
        outcomeHit: false,
        status: 'miss',
      };
    }
    const dynamicPts =
      optionStats?.byOption?.get(vote.predicted_entry_id)?.currentPoints ??
      Number(poll.points_champion || 5);
    return {
      resolved: true,
      points: dynamicPts,
      fullHit: true,
      outcomeHit: true,
      status: 'exact',
    };
  }

  if (!targetDetails.actualOutcome) {
    return {
      resolved: false,
      points: 0,
      fullHit: false,
      outcomeHit: false,
      status: 'pending',
    };
  }

  // Tipo 2B: Encuesta de Ganador / Empate en cruce directo (cuotas dinámicas)
  if (poll.prediction_mode === 'winner') {
    const hit = vote.predicted_outcome === targetDetails.actualOutcome;
    if (!hit) {
      return {
        resolved: true,
        points: 0,
        fullHit: false,
        outcomeHit: false,
        status: 'miss',
      };
    }
    const dynamicPts =
      optionStats?.byOption?.get(vote.predicted_outcome)?.currentPoints ??
      Number(poll.points_outcome || 1);
    return {
      resolved: true,
      points: dynamicPts,
      fullHit: true,
      outcomeHit: true,
      status: 'exact',
    };
  }

  // Tipo 1: Prode Clásico (Marcador Exacto: 3 pts exacto, 1 pt ganador/empate)
  const sA = vote.predicted_score_a;
  const sB = vote.predicted_score_b;
  const voteOutcome =
    sA !== null && sB !== null
      ? sA > sB
        ? 'a'
        : sB > sA
        ? 'b'
        : 'draw'
      : vote.predicted_outcome;

  if (
    targetDetails.hasScores &&
    sA !== null &&
    sB !== null &&
    sA === targetDetails.scoreA &&
    sB === targetDetails.scoreB
  ) {
    return {
      resolved: true,
      points: Number(poll.points_exact ?? 3),
      fullHit: true,
      outcomeHit: true,
      status: 'exact',
    };
  }

  if (voteOutcome && voteOutcome === targetDetails.actualOutcome) {
    return {
      resolved: true,
      points: Number(poll.points_outcome ?? 1),
      fullHit: false,
      outcomeHit: true,
      status: 'outcome',
    };
  }

  return {
    resolved: true,
    points: 0,
    fullHit: false,
    outcomeHit: false,
    status: 'miss',
  };
}

export function computeProdeLeaderboard({
  participants = [],
  polls = [],
  votes = [],
  matches = [],
  subMatches = [],
  subtournaments = [],
  subEntries = [],
  participantMap = new Map(),
  subEntryMembers = [],
}) {
  const votesByPollId = new Map();
  votes.forEach((v) => {
    if (!votesByPollId.has(v.poll_id)) votesByPollId.set(v.poll_id, []);
    votesByPollId.get(v.poll_id).push(v);
  });

  const targetDetailsByPollId = new Map();
  const optionStatsByPollId = new Map();

  polls.forEach((poll) => {
    const target = getPollTargetDetails(poll, {
      matches,
      subMatches,
      subtournaments,
      subEntries,
      participantMap,
      subEntryMembers,
    });
    targetDetailsByPollId.set(poll.id, target);
    optionStatsByPollId.set(
      poll.id,
      computePollOptionStats(poll, votesByPollId.get(poll.id) || [], target)
    );
  });

  const pollMap = new Map(polls.map((p) => [p.id, p]));
  const rowsMap = new Map();

  participants.forEach((p) => {
    if (p.user_id) {
      rowsMap.set(p.id, {
        participant: p,
        points: 0,
        fullHits: 0,
        outcomeHits: 0,
        totalHits: 0,
        totalVotes: 0,
        resolvedVotes: 0,
        effectivenessPct: 0,
      });
    }
  });

  votes.forEach((vote) => {
    const p = participantMap.get(vote.participant_id);
    if (!p) return;
    if (!rowsMap.has(p.id)) {
      rowsMap.set(p.id, {
        participant: p,
        points: 0,
        fullHits: 0,
        outcomeHits: 0,
        totalHits: 0,
        totalVotes: 0,
        resolvedVotes: 0,
        effectivenessPct: 0,
      });
    }

    const row = rowsMap.get(p.id);
    row.totalVotes += 1;

    const poll = pollMap.get(vote.poll_id);
    const target = targetDetailsByPollId.get(vote.poll_id);
    const optStats = optionStatsByPollId.get(vote.poll_id);
    const evalRes = evaluateVote(poll, vote, target, optStats);

    if (evalRes.resolved) {
      row.resolvedVotes += 1;
      row.points = round1(row.points + evalRes.points);
      if (evalRes.fullHit) row.fullHits += 1;
      else if (evalRes.outcomeHit) row.outcomeHits += 1;
      if (evalRes.outcomeHit || evalRes.fullHit) row.totalHits += 1;
    }
  });

  const rows = Array.from(rowsMap.values()).map((r) => ({
    ...r,
    effectivenessPct:
      r.resolvedVotes > 0
        ? Math.round((r.totalHits / r.resolvedVotes) * 100)
        : 0,
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.fullHits !== a.fullHits) return b.fullHits - a.fullHits;
    if (b.effectivenessPct !== a.effectivenessPct) {
      return b.effectivenessPct - a.effectivenessPct;
    }
    if (b.totalHits !== a.totalHits) return b.totalHits - a.totalHits;
    return a.participant.name.localeCompare(b.participant.name, 'es');
  });

  return rows.map((row, idx) => ({
    ...row,
    rank: idx + 1,
  }));
}

export function buildProdeWhatsAppText(tournament, leaderboard = []) {
  const lines = [`🎯 *PRODE: ${tournament?.name || 'Torneo'}*`, ''];

  leaderboard.forEach((row) => {
    const medal =
      row.points > 0 && row.rank === 1
        ? '🥇 '
        : row.points > 0 && row.rank === 2
        ? '🥈 '
        : row.points > 0 && row.rank === 3
        ? '🥉 '
        : `${row.rank}. `;
    lines.push(
      `${medal}*${row.participant.name}* — *${formatProdePoints(
        row.points
      )} pts* (${row.fullHits} plenos · ${row.effectivenessPct}% efect.)`
    );
  });

  return lines.join('\n');
}