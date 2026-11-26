import { resolveParticipantAvatar } from './avatarUpload';
import { resolveMatchOutcome } from './tournamentStatsEngine';

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

export function evaluateVote(poll, vote, targetDetails) {
  if (!poll || !vote || !targetDetails || !targetDetails.isCompleted) {
    return {
      resolved: false,
      points: 0,
      fullHit: false,
      outcomeHit: false,
      status: 'pending',
    };
  }

  if (poll.prediction_mode === 'champion') {
    const hit = targetDetails.championEntryIds.includes(vote.predicted_entry_id);
    return {
      resolved: true,
      points: hit ? Number(poll.points_champion || 0) : 0,
      fullHit: hit,
      outcomeHit: hit,
      status: hit ? 'exact' : 'miss',
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

  if (poll.prediction_mode === 'winner') {
    const hit = vote.predicted_outcome === targetDetails.actualOutcome;
    return {
      resolved: true,
      points: hit ? Number(poll.points_outcome || 0) : 0,
      fullHit: hit,
      outcomeHit: hit,
      status: hit ? 'exact' : 'miss',
    };
  }

  // Modo 'exact_score'
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
      points: Number(poll.points_exact || 0),
      fullHit: true,
      outcomeHit: true,
      status: 'exact',
    };
  }

  if (voteOutcome && voteOutcome === targetDetails.actualOutcome) {
    return {
      resolved: true,
      points: Number(poll.points_outcome || 0),
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
  const targetDetailsByPollId = new Map();
  polls.forEach((poll) => {
    targetDetailsByPollId.set(
      poll.id,
      getPollTargetDetails(poll, {
        matches,
        subMatches,
        subtournaments,
        subEntries,
        participantMap,
        subEntryMembers,
      })
    );
  });

  const pollMap = new Map(polls.map((p) => [p.id, p]));
  const rowsMap = new Map();

  // Incluir todos los participantes con cuenta vinculada (y/o que hayan votado)
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
    const evalRes = evaluateVote(poll, vote, target);

    if (evalRes.resolved) {
      row.resolvedVotes += 1;
      row.points += evalRes.points;
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
      `${medal}*${row.participant.name}* — *${row.points} pts* (${row.fullHits} plenos · ${row.effectivenessPct}% efect.)`
    );
  });

  return lines.join('\n');
}