import {
  computeCustomGeneralStandings,
  adaptEntriesToParticipants,
  adaptSubMatchesToMatches,
} from './customTournamentEngine';
import {
  computeKnockoutSummary,
  computeLastStandingStandings,
  computeLeagueStandings,
} from './tournamentEngine';

export function resolveMatchOutcome(match) {
  if (!match || match.is_bye || match.status !== 'completed') {
    return null;
  }

  const hasScores = match.score_a !== null && match.score_b !== null;
  if (hasScores) {
    if (match.score_a > match.score_b) {
      return {
        hasScores: true,
        isDraw: false,
        winnerId: match.participant_a_id,
        loserId: match.participant_b_id,
        scoreA: match.score_a,
        scoreB: match.score_b,
      };
    }
    if (match.score_b > match.score_a) {
      return {
        hasScores: true,
        isDraw: false,
        winnerId: match.participant_b_id,
        loserId: match.participant_a_id,
        scoreA: match.score_a,
        scoreB: match.score_b,
      };
    }
    return {
      hasScores: true,
      isDraw: true,
      winnerId: null,
      loserId: null,
      scoreA: match.score_a,
      scoreB: match.score_b,
    };
  }

  if (match.is_draw) {
    return {
      hasScores: false,
      isDraw: true,
      winnerId: null,
      loserId: null,
      scoreA: null,
      scoreB: null,
    };
  }

  if (match.winner_id) {
    const loserId =
      match.winner_id === match.participant_a_id
        ? match.participant_b_id
        : match.participant_a_id;
    return {
      hasScores: false,
      isDraw: false,
      winnerId: match.winner_id,
      loserId,
      scoreA: null,
      scoreB: null,
    };
  }

  return null;
}

function sortMatchesChronologically(matches) {
  return [...matches].sort((a, b) => {
    if (a.round_number !== b.round_number) {
      return a.round_number - b.round_number;
    }
    if (a.match_order !== b.match_order) {
      return a.match_order - b.match_order;
    }
    if (a.leg !== b.leg) {
      return a.leg - b.leg;
    }
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });
}

export function computeMatchBasedStats(tournament, participants, matches) {
  const participantMap = new Map(participants.map((p) => [p.id, p]));
  const orderedMatches = sortMatchesChronologically(matches || []);
  const nonByeMatches = orderedMatches.filter((m) => !m.is_bye);
  const completedMatches = nonByeMatches.filter((m) => m.status === 'completed');
  const scoredMatches = completedMatches.filter(
    (m) => m.score_a !== null && m.score_b !== null
  );

  const playerStatsMap = new Map();
  participants.forEach((p) => {
    playerStatsMap.set(p.id, {
      participant: p,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      gf: 0,
      gc: 0,
      dg: 0,
      scoredMatchesPlayed: 0,
      cleanSheets: 0,
      pts: 0,
      winRate: 0,
      effectivenessPct: 0,
      avgGf: null,
      avgGc: null,
      form: [],
      recentForm: [],
      bestWinStreak: 0,
      currentWinStreak: 0,
      bestUnbeatenStreak: 0,
      currentUnbeatenStreak: 0,
      bestWin: null,
      worstLoss: null,
    });
  });

  let totalGoals = 0;
  let drawsCount = 0;
  let biggestMarginMatch = null;
  let highestScoringMatch = null;

  completedMatches.forEach((match) => {
    const outcome = resolveMatchOutcome(match);
    if (!outcome) return;

    const pA = participantMap.get(match.participant_a_id);
    const pB = participantMap.get(match.participant_b_id);
    const statsA = playerStatsMap.get(match.participant_a_id);
    const statsB = playerStatsMap.get(match.participant_b_id);
    if (!pA || !pB || !statsA || !statsB) return;

    statsA.pj += 1;
    statsB.pj += 1;

    if (outcome.hasScores) {
      const sum = outcome.scoreA + outcome.scoreB;
      const margin = Math.abs(outcome.scoreA - outcome.scoreB);
      totalGoals += sum;

      statsA.scoredMatchesPlayed += 1;
      statsB.scoredMatchesPlayed += 1;
      statsA.gf += outcome.scoreA;
      statsA.gc += outcome.scoreB;
      statsB.gf += outcome.scoreB;
      statsB.gc += outcome.scoreA;

      if (outcome.scoreB === 0) statsA.cleanSheets += 1;
      if (outcome.scoreA === 0) statsB.cleanSheets += 1;

      if (
        sum > 0 &&
        (!highestScoringMatch || sum > highestScoringMatch.total)
      ) {
        highestScoringMatch = {
          match,
          nameA: pA.name,
          nameB: pB.name,
          scoreA: outcome.scoreA,
          scoreB: outcome.scoreB,
          total: sum,
          roundName: match.round_name,
        };
      }

      if (
        margin > 0 &&
        (!biggestMarginMatch ||
          margin > biggestMarginMatch.margin ||
          (margin === biggestMarginMatch.margin &&
            sum > biggestMarginMatch.total))
      ) {
        const aWon = outcome.scoreA > outcome.scoreB;
        biggestMarginMatch = {
          match,
          winnerName: aWon ? pA.name : pB.name,
          loserName: aWon ? pB.name : pA.name,
          winnerScore: aWon ? outcome.scoreA : outcome.scoreB,
          loserScore: aWon ? outcome.scoreB : outcome.scoreA,
          margin,
          total: sum,
          roundName: match.round_name,
        };
      }
    }

    const scoreTextForA = outcome.hasScores
      ? `${outcome.scoreA}-${outcome.scoreB}`
      : outcome.isDraw
      ? 'Empate'
      : outcome.winnerId === pA.id
      ? 'Victoria'
      : 'Derrota';

    const scoreTextForB = outcome.hasScores
      ? `${outcome.scoreB}-${outcome.scoreA}`
      : outcome.isDraw
      ? 'Empate'
      : outcome.winnerId === pB.id
      ? 'Victoria'
      : 'Derrota';

    if (outcome.isDraw) {
      drawsCount += 1;
      statsA.pe += 1;
      statsB.pe += 1;
      statsA.pts += 1;
      statsB.pts += 1;

      statsA.form.push({
        matchId: match.id,
        roundName: match.round_name,
        opponentId: pB.id,
        opponentName: pB.name,
        outcome: 'D',
        scoreText: scoreTextForA,
      });
      statsB.form.push({
        matchId: match.id,
        roundName: match.round_name,
        opponentId: pA.id,
        opponentName: pA.name,
        outcome: 'D',
        scoreText: scoreTextForB,
      });
      return;
    }

    const aWon = outcome.winnerId === pA.id;
    const winnerStats = aWon ? statsA : statsB;
    const loserStats = aWon ? statsB : statsA;
    const winnerPlayer = aWon ? pA : pB;
    const loserPlayer = aWon ? pB : pA;

    winnerStats.pg += 1;
    winnerStats.pts += 3;
    loserStats.pp += 1;

    winnerStats.form.push({
      matchId: match.id,
      roundName: match.round_name,
      opponentId: loserPlayer.id,
      opponentName: loserPlayer.name,
      outcome: 'W',
      scoreText: aWon ? scoreTextForA : scoreTextForB,
    });
    loserStats.form.push({
      matchId: match.id,
      roundName: match.round_name,
      opponentId: winnerPlayer.id,
      opponentName: winnerPlayer.name,
      outcome: 'L',
      scoreText: aWon ? scoreTextForB : scoreTextForA,
    });

    if (outcome.hasScores) {
      const wScore = aWon ? outcome.scoreA : outcome.scoreB;
      const lScore = aWon ? outcome.scoreB : outcome.scoreA;
      const margin = wScore - lScore;

      if (
        !winnerStats.bestWin ||
        margin > winnerStats.bestWin.margin ||
        (margin === winnerStats.bestWin.margin &&
          wScore > winnerStats.bestWin.forScore)
      ) {
        winnerStats.bestWin = {
          opponentName: loserPlayer.name,
          forScore: wScore,
          againstScore: lScore,
          margin,
          roundName: match.round_name,
        };
      }

      if (
        !loserStats.worstLoss ||
        margin > loserStats.worstLoss.margin ||
        (margin === loserStats.worstLoss.margin &&
          lScore < loserStats.worstLoss.forScore)
      ) {
        loserStats.worstLoss = {
          opponentName: winnerPlayer.name,
          forScore: lScore,
          againstScore: wScore,
          margin,
          roundName: match.round_name,
        };
      }
    }
  });

  playerStatsMap.forEach((st) => {
    st.dg = st.gf - st.gc;
    st.winRate = st.pj > 0 ? Math.round((st.pg / st.pj) * 100) : 0;
    st.effectivenessPct =
      st.pj > 0 ? Math.round((st.pts / (st.pj * 3)) * 100) : 0;
    st.avgGf =
      st.scoredMatchesPlayed > 0
        ? Number((st.gf / st.scoredMatchesPlayed).toFixed(2))
        : null;
    st.avgGc =
      st.scoredMatchesPlayed > 0
        ? Number((st.gc / st.scoredMatchesPlayed).toFixed(2))
        : null;
    st.recentForm = st.form.slice(-5);

    let winRun = 0;
    let bestWinRun = 0;
    let unbeatenRun = 0;
    let bestUnbeatenRun = 0;

    st.form.forEach((f) => {
      if (f.outcome === 'W') {
        winRun += 1;
        unbeatenRun += 1;
      } else if (f.outcome === 'D') {
        winRun = 0;
        unbeatenRun += 1;
      } else {
        winRun = 0;
        unbeatenRun = 0;
      }
      if (winRun > bestWinRun) bestWinRun = winRun;
      if (unbeatenRun > bestUnbeatenRun) bestUnbeatenRun = unbeatenRun;
    });

    st.bestWinStreak = bestWinRun;
    st.currentWinStreak = winRun;
    st.bestUnbeatenStreak = bestUnbeatenRun;
    st.currentUnbeatenStreak = unbeatenRun;
  });

  const allPlayerStats = Array.from(playerStatsMap.values());

  const standingsOrder =
    tournament.format === 'knockout'
      ? computeKnockoutSummary(participants, matches).rows.map((r) =>
          playerStatsMap.get(r.participant.id)
        )
      : computeLeagueStandings(participants, matches).map((r) =>
          playerStatsMap.get(r.participant.id)
        );

  const orderedPlayerStats = standingsOrder.filter(Boolean);

  const playersWithScores = allPlayerStats.filter(
    (s) => s.scoredMatchesPlayed > 0
  );
  const playersWithMatches = allPlayerStats.filter((s) => s.pj > 0);

  const bestAttack =
    playersWithScores.length > 0
      ? [...playersWithScores].sort((a, b) => {
          if (b.gf !== a.gf) return b.gf - a.gf;
          return (b.avgGf ?? 0) - (a.avgGf ?? 0);
        })[0]
      : null;

  const bestDefense =
    playersWithScores.length > 0
      ? [...playersWithScores].sort((a, b) => {
          if ((a.avgGc ?? 999) !== (b.avgGc ?? 999)) {
            return (a.avgGc ?? 999) - (b.avgGc ?? 999);
          }
          if (b.scoredMatchesPlayed !== a.scoredMatchesPlayed) {
            return b.scoredMatchesPlayed - a.scoredMatchesPlayed;
          }
          return a.gc - b.gc;
        })[0]
      : null;

  const bestWinStreakLeader =
    playersWithMatches.length > 0
      ? [...playersWithMatches]
          .filter((s) => s.bestWinStreak > 0)
          .sort((a, b) => {
            if (b.bestWinStreak !== a.bestWinStreak) {
              return b.bestWinStreak - a.bestWinStreak;
            }
            return b.pg - a.pg;
          })[0] || null
      : null;

  const mostCleanSheetsLeader =
    playersWithScores.length > 0
      ? [...playersWithScores]
          .filter((s) => s.cleanSheets > 0)
          .sort((a, b) => {
            if (b.cleanSheets !== a.cleanSheets) {
              return b.cleanSheets - a.cleanSheets;
            }
            return b.scoredMatchesPlayed - a.scoredMatchesPlayed;
          })[0] || null
      : null;

  const bestEffectivenessLeader =
    playersWithMatches.length > 0
      ? [...playersWithMatches].sort((a, b) => {
          if (b.effectivenessPct !== a.effectivenessPct) {
            return b.effectivenessPct - a.effectivenessPct;
          }
          return b.pj - a.pj;
        })[0]
      : null;

  const totalMatches = nonByeMatches.length;
  const completedCount = completedMatches.length;
  const progressPct =
    totalMatches > 0 ? Math.round((completedCount / totalMatches) * 100) : 0;
  const avgGoalsPerMatch =
    scoredMatches.length > 0
      ? Number((totalGoals / scoredMatches.length).toFixed(2))
      : null;

  return {
    totalMatches,
    completedCount,
    pendingCount: totalMatches - completedCount,
    progressPct,
    scoredMatchesCount: scoredMatches.length,
    totalGoals,
    avgGoalsPerMatch,
    drawsCount,
    biggestMarginMatch,
    highestScoringMatch,
    bestAttack,
    bestDefense,
    bestWinStreakLeader,
    mostCleanSheetsLeader,
    bestEffectivenessLeader,
    playerStatsMap,
    orderedPlayerStats,
  };
}

export function computeMatchH2H(matches, participantMap, playerAId, playerBId) {
  if (!playerAId || !playerBId || playerAId === playerBId) {
    return null;
  }

  const ordered = sortMatchesChronologically(matches || []);
  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let goalsA = 0;
  let goalsB = 0;
  let hasAnyScore = false;
  const history = [];

  ordered.forEach((m) => {
    if (m.is_bye || m.status !== 'completed') return;
    const isDirect =
      (m.participant_a_id === playerAId && m.participant_b_id === playerBId) ||
      (m.participant_a_id === playerBId && m.participant_b_id === playerAId);
    if (!isDirect) return;

    const outcome = resolveMatchOutcome(m);
    if (!outcome) return;

    const aIsHome = m.participant_a_id === playerAId;
    const scoreForA = outcome.hasScores
      ? aIsHome
        ? outcome.scoreA
        : outcome.scoreB
      : null;
    const scoreForB = outcome.hasScores
      ? aIsHome
        ? outcome.scoreB
        : outcome.scoreA
      : null;

    if (outcome.hasScores) {
      hasAnyScore = true;
      goalsA += scoreForA;
      goalsB += scoreForB;
    }

    let winnerSide = 'draw';
    if (outcome.isDraw) {
      draws += 1;
    } else if (outcome.winnerId === playerAId) {
      winsA += 1;
      winnerSide = 'A';
    } else if (outcome.winnerId === playerBId) {
      winsB += 1;
      winnerSide = 'B';
    }

    history.push({
      id: m.id,
      roundName: m.round_name,
      subtournamentName: m.subtournamentName || null,
      scoreForA,
      scoreForB,
      hasScores: outcome.hasScores,
      winnerSide,
    });
  });

  return {
    playerA: participantMap.get(playerAId) || null,
    playerB: participantMap.get(playerBId) || null,
    totalPlayed: history.length,
    winsA,
    winsB,
    draws,
    goalsA,
    goalsB,
    hasAnyScore,
    history,
  };
}

export function computeLastStandingStats(participants, eliminations) {
  const ls = computeLastStandingStandings(participants, eliminations);
  const sortedEliminations = [...(eliminations || [])].sort(
    (a, b) => a.elimination_order - b.elimination_order
  );
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  const totalPlayers = participants.length;
  const aliveCount = ls.stillStanding.length;
  const eliminatedCount = ls.eliminated.length;
  const survivalRatePct =
    totalPlayers > 0 ? Math.round((aliveCount / totalPlayers) * 100) : 0;

  const firstEliminatedRow = sortedEliminations[0] || null;
  const lastEliminatedRow =
    sortedEliminations.length > 0
      ? sortedEliminations[sortedEliminations.length - 1]
      : null;

  const maxOrder = Math.max(1, eliminatedCount + (aliveCount > 0 ? 1 : 0));

  const survivalRows = ls.rows.map((row) => {
    const score = row.isAlive ? maxOrder : row.eliminationOrder || 1;
    const barPct = Math.round((score / maxOrder) * 100);
    return {
      ...row,
      survivalScore: score,
      barPct,
    };
  });

  return {
    totalPlayers,
    aliveCount,
    eliminatedCount,
    survivalRatePct,
    champion: ls.champion,
    firstEliminated: firstEliminatedRow
      ? participantMap.get(firstEliminatedRow.participant_id) || null
      : null,
    lastEliminated: lastEliminatedRow
      ? participantMap.get(lastEliminatedRow.participant_id) || null
      : null,
    eliminationTimeline: sortedEliminations.map((el) => ({
      id: el.id,
      order: el.elimination_order,
      participant: participantMap.get(el.participant_id) || null,
    })),
    survivalRows,
  };
}

export function computeCustomStats(
  participants,
  matchdays,
  subtournaments,
  subEntries,
  subEntryMembers,
  subMatches,
  subEliminations
) {
  const participantMap = new Map(participants.map((p) => [p.id, p]));
  const matchdayMap = new Map(matchdays.map((md) => [md.id, md]));
  const subMap = new Map(subtournaments.map((s) => [s.id, s]));

  const membersByEntry = new Map();
  subEntryMembers.forEach((em) => {
    if (!membersByEntry.has(em.entry_id)) {
      membersByEntry.set(em.entry_id, []);
    }
    membersByEntry.get(em.entry_id).push(em.participant_id);
  });

  const entriesById = new Map(subEntries.map((e) => [e.id, e]));

  const generalRows = computeCustomGeneralStandings(
    participants,
    matchdays,
    subtournaments,
    subEntries,
    subEntryMembers
  );

  const playerStatsMap = new Map();
  generalRows.forEach((row) => {
    const timeline = [];
    let runningTotal = 0;
    matchdays.forEach((md) => {
      const mdInfo = row.matchdayPoints.get(md.id) || {
        participated: false,
        points: 0,
      };
      runningTotal += mdInfo.points;
      timeline.push({
        matchdayId: md.id,
        matchdayNumber: md.matchday_number,
        name: md.name,
        points: mdInfo.points,
        cumulativePoints: runningTotal,
        participated: mdInfo.participated,
      });
    });

    playerStatsMap.set(row.participant.id, {
      participant: row.participant,
      totalPoints: row.totalPoints,
      completedSubtournamentsPlayed: 0,
      totalSubtournamentsJoined: 0,
      firstPlaces: 0,
      podiums: 0,
      bestRank: null,
      avgPointsPerSub: 0,
      matchdayPoints: row.matchdayPoints,
      timeline,
      bestMatchday: null,
      history: [],
      internalMatchesPlayed: 0,
      internalWins: 0,
      internalDraws: 0,
      internalLosses: 0,
      internalGf: 0,
      internalGc: 0,
    });
  });

  let bestSingleSubtournament = null;
  let totalPointsDistributed = 0;

  subEntries.forEach((entry) => {
    const sub = subMap.get(entry.subtournament_id);
    if (!sub) return;

    const matchday = matchdayMap.get(sub.matchday_id) || null;
    const isTeamBased = Boolean(sub.config?.is_team_based);
    const memberIdsRaw = membersByEntry.get(entry.id) || [];
    const memberIds =
      memberIdsRaw.length > 0
        ? memberIdsRaw
        : entry.participant_id
        ? [entry.participant_id]
        : [];

    const teammatesNames = memberIds
      .map((id) => participantMap.get(id)?.name)
      .filter(Boolean);

    const isCompleted = sub.status === 'completed';
    const pts = isCompleted ? Number(entry.points_awarded || 0) : 0;

    memberIds.forEach((pId) => {
      const st = playerStatsMap.get(pId);
      if (!st) return;

      st.totalSubtournamentsJoined += 1;

      if (isCompleted) {
        totalPointsDistributed += pts;
        st.completedSubtournamentsPlayed += 1;
        if (entry.final_rank === 1) st.firstPlaces += 1;
        if (entry.final_rank !== null && entry.final_rank <= 3) st.podiums += 1;
        if (
          entry.final_rank !== null &&
          (st.bestRank === null || entry.final_rank < st.bestRank)
        ) {
          st.bestRank = entry.final_rank;
        }

        if (
          pts > 0 &&
          (!bestSingleSubtournament || pts > bestSingleSubtournament.points)
        ) {
          bestSingleSubtournament = {
            participant: st.participant,
            subtournament: sub,
            points: pts,
            rank: entry.final_rank,
          };
        }
      }

      st.history.push({
        subId: sub.id,
        subName: sub.name,
        matchdayName: matchday?.name || 'Jornada',
        matchdayNumber: matchday?.matchday_number || 0,
        format: sub.format,
        isTeamBased,
        entryName: entry.entry_name,
        teammates: teammatesNames.filter(
          (name) => name !== st.participant.name
        ),
        status: sub.status,
        finalRank: entry.final_rank,
        pointsAwarded: pts,
      });
    });
  });

  // Agregar stats de partidos internos de subtorneos (incluyendo equipos)
  const completedInternalMatches = (subMatches || []).filter(
    (m) => !m.is_bye && m.status === 'completed'
  );
  const scoredInternalMatches = completedInternalMatches.filter(
    (m) => m.score_a !== null && m.score_b !== null
  );

  let biggestInternalMatch = null;
  let highestScoringInternalMatch = null;

  completedInternalMatches.forEach((m) => {
    const adapted = {
      ...m,
      participant_a_id: m.entry_a_id,
      participant_b_id: m.entry_b_id,
      winner_id: m.winner_entry_id,
    };
    const outcome = resolveMatchOutcome(adapted);
    if (!outcome) return;

    const entryA = entriesById.get(m.entry_a_id);
    const entryB = entriesById.get(m.entry_b_id);
    const sub = subMap.get(m.subtournament_id);
    if (!entryA || !entryB || !sub) return;

    if (outcome.hasScores) {
      const sum = outcome.scoreA + outcome.scoreB;
      const margin = Math.abs(outcome.scoreA - outcome.scoreB);

      if (
        sum > 0 &&
        (!highestScoringInternalMatch || sum > highestScoringInternalMatch.total)
      ) {
        highestScoringInternalMatch = {
          subName: sub.name,
          nameA: entryA.entry_name,
          nameB: entryB.entry_name,
          scoreA: outcome.scoreA,
          scoreB: outcome.scoreB,
          total: sum,
        };
      }

      if (
        margin > 0 &&
        (!biggestInternalMatch ||
          margin > biggestInternalMatch.margin ||
          (margin === biggestInternalMatch.margin &&
            sum > biggestInternalMatch.total))
      ) {
        const aWon = outcome.scoreA > outcome.scoreB;
        biggestInternalMatch = {
          subName: sub.name,
          winnerName: aWon ? entryA.entry_name : entryB.entry_name,
          loserName: aWon ? entryB.entry_name : entryA.entry_name,
          winnerScore: aWon ? outcome.scoreA : outcome.scoreB,
          loserScore: aWon ? outcome.scoreB : outcome.scoreA,
          margin,
          total: sum,
        };
      }
    }

    const membersA =
      membersByEntry.get(entryA.id) ||
      (entryA.participant_id ? [entryA.participant_id] : []);
    const membersB =
      membersByEntry.get(entryB.id) ||
      (entryB.participant_id ? [entryB.participant_id] : []);

    membersA.forEach((pId) => {
      const st = playerStatsMap.get(pId);
      if (!st) return;
      st.internalMatchesPlayed += 1;
      if (outcome.hasScores) {
        st.internalGf += outcome.scoreA;
        st.internalGc += outcome.scoreB;
      }
      if (outcome.isDraw) st.internalDraws += 1;
      else if (outcome.winnerId === entryA.id) st.internalWins += 1;
      else st.internalLosses += 1;
    });

    membersB.forEach((pId) => {
      const st = playerStatsMap.get(pId);
      if (!st) return;
      st.internalMatchesPlayed += 1;
      if (outcome.hasScores) {
        st.internalGf += outcome.scoreB;
        st.internalGc += outcome.scoreA;
      }
      if (outcome.isDraw) st.internalDraws += 1;
      else if (outcome.winnerId === entryB.id) st.internalWins += 1;
      else st.internalLosses += 1;
    });
  });

  let bestMatchdayOverall = null;

  playerStatsMap.forEach((st) => {
    st.avgPointsPerSub =
      st.completedSubtournamentsPlayed > 0
        ? Number((st.totalPoints / st.completedSubtournamentsPlayed).toFixed(2))
        : 0;

    st.history.sort((a, b) => a.matchdayNumber - b.matchdayNumber);

    st.timeline.forEach((tl) => {
      if (
        tl.participated &&
        (!st.bestMatchday || tl.points > st.bestMatchday.points)
      ) {
        st.bestMatchday = tl;
      }

      if (
        tl.participated &&
        tl.points > 0 &&
        (!bestMatchdayOverall || tl.points > bestMatchdayOverall.points)
      ) {
        bestMatchdayOverall = {
          participant: st.participant,
          matchdayName: tl.name,
          points: tl.points,
        };
      }
    });
  });

  const orderedPlayerStats = generalRows
    .map((r) => playerStatsMap.get(r.participant.id))
    .filter(Boolean);

  const completedSubtournaments = subtournaments.filter(
    (s) => s.status === 'completed'
  );

  const mostTitlesLeader =
    [...orderedPlayerStats]
      .filter((s) => s.firstPlaces > 0)
      .sort((a, b) => {
        if (b.firstPlaces !== a.firstPlaces) {
          return b.firstPlaces - a.firstPlaces;
        }
        return b.totalPoints - a.totalPoints;
      })[0] || null;

  const mostPodiumsLeader =
    [...orderedPlayerStats]
      .filter((s) => s.podiums > 0)
      .sort((a, b) => {
        if (b.podiums !== a.podiums) return b.podiums - a.podiums;
        return b.totalPoints - a.totalPoints;
      })[0] || null;

  const bestAverageLeader =
    [...orderedPlayerStats]
      .filter((s) => s.completedSubtournamentsPlayed > 0)
      .sort((a, b) => {
        if (b.avgPointsPerSub !== a.avgPointsPerSub) {
          return b.avgPointsPerSub - a.avgPointsPerSub;
        }
        return (
          b.completedSubtournamentsPlayed - a.completedSubtournamentsPlayed
        );
      })[0] || null;

  const formatCounts = {
    league: 0,
    knockout: 0,
    last_standing: 0,
    manual: 0,
    teamBased: 0,
    individual: 0,
  };

  subtournaments.forEach((s) => {
    if (formatCounts[s.format] !== undefined) {
      formatCounts[s.format] += 1;
    }
    if (s.config?.is_team_based) {
      formatCounts.teamBased += 1;
    } else {
      formatCounts.individual += 1;
    }
  });

  return {
    totalMatchdays: matchdays.length,
    totalSubtournaments: subtournaments.length,
    completedSubtournamentsCount: completedSubtournaments.length,
    activeSubtournamentsCount:
      subtournaments.length - completedSubtournaments.length,
    totalPointsDistributed,
    totalInternalMatchesPlayed: completedInternalMatches.length,
    scoredInternalMatchesCount: scoredInternalMatches.length,
    totalInternalEliminations: (subEliminations || []).length,
    formatCounts,
    mostTitlesLeader,
    mostPodiumsLeader,
    bestAverageLeader,
    bestMatchdayOverall,
    bestSingleSubtournament,
    biggestInternalMatch,
    highestScoringInternalMatch,
    playerStatsMap,
    orderedPlayerStats,
  };
}

export function computeCustomPairStats(
  playerAId,
  playerBId,
  participantMap,
  subtournaments,
  subEntries,
  subEntryMembers,
  subMatches
) {
  if (!playerAId || !playerBId || playerAId === playerBId) return null;

  const subMap = new Map(subtournaments.map((s) => [s.id, s]));
  const membersByEntry = new Map();

  subEntryMembers.forEach((em) => {
    if (!membersByEntry.has(em.entry_id)) {
      membersByEntry.set(em.entry_id, new Set());
    }
    membersByEntry.get(em.entry_id).add(em.participant_id);
  });

  // subId -> { entryA, entryB }
  const pairEntriesBySub = new Map();

  subEntries.forEach((entry) => {
    const memberSet = membersByEntry.get(entry.id);
    const hasA = memberSet
      ? memberSet.has(playerAId)
      : entry.participant_id === playerAId;
    const hasB = memberSet
      ? memberSet.has(playerBId)
      : entry.participant_id === playerBId;

    if (!hasA && !hasB) return;

    if (!pairEntriesBySub.has(entry.subtournament_id)) {
      pairEntriesBySub.set(entry.subtournament_id, {
        entryA: null,
        entryB: null,
      });
    }
    const bucket = pairEntriesBySub.get(entry.subtournament_id);
    if (hasA) bucket.entryA = entry;
    if (hasB) bucket.entryB = entry;
  });

  let timesTeammates = 0;
  let teammateWins = 0;
  let timesOpponentsInCompletedSubs = 0;
  let aheadCountA = 0;
  let aheadCountB = 0;
  let tiedRankCount = 0;

  const entryIdToRoleBySub = new Map();

  pairEntriesBySub.forEach(({ entryA, entryB }, subId) => {
    if (!entryA || !entryB) return;
    const sub = subMap.get(subId);
    if (!sub) return;

    if (entryA.id === entryB.id) {
      timesTeammates += 1;
      if (sub.status === 'completed' && entryA.final_rank === 1) {
        teammateWins += 1;
      }
      return;
    }

    entryIdToRoleBySub.set(subId, {
      entryAId: entryA.id,
      entryBId: entryB.id,
      subName: sub.name,
    });

    if (
      sub.status === 'completed' &&
      entryA.final_rank !== null &&
      entryB.final_rank !== null
    ) {
      timesOpponentsInCompletedSubs += 1;
      if (entryA.final_rank < entryB.final_rank) aheadCountA += 1;
      else if (entryB.final_rank < entryA.final_rank) aheadCountB += 1;
      else tiedRankCount += 1;
    }
  });

  // Partidos directos entre sus entries en subtorneos donde fueron rivales
  let matchWinsA = 0;
  let matchWinsB = 0;
  let matchDraws = 0;
  const directMatches = [];

  (subMatches || []).forEach((m) => {
    if (m.is_bye || m.status !== 'completed') return;
    const roles = entryIdToRoleBySub.get(m.subtournament_id);
    if (!roles) return;

    const isDirect =
      (m.entry_a_id === roles.entryAId && m.entry_b_id === roles.entryBId) ||
      (m.entry_a_id === roles.entryBId && m.entry_b_id === roles.entryAId);

    if (!isDirect) return;

    const adapted = {
      ...m,
      participant_a_id: m.entry_a_id,
      participant_b_id: m.entry_b_id,
      winner_id: m.winner_entry_id,
    };
    const outcome = resolveMatchOutcome(adapted);
    if (!outcome) return;

    const aIsHome = m.entry_a_id === roles.entryAId;
    const scoreForA = outcome.hasScores
      ? aIsHome
        ? outcome.scoreA
        : outcome.scoreB
      : null;
    const scoreForB = outcome.hasScores
      ? aIsHome
        ? outcome.scoreB
        : outcome.scoreA
      : null;

    let winnerSide = 'draw';
    if (outcome.isDraw) {
      matchDraws += 1;
    } else if (outcome.winnerId === roles.entryAId) {
      matchWinsA += 1;
      winnerSide = 'A';
    } else if (outcome.winnerId === roles.entryBId) {
      matchWinsB += 1;
      winnerSide = 'B';
    }

    directMatches.push({
      id: m.id,
      subName: roles.subName,
      roundName: m.round_name,
      scoreForA,
      scoreForB,
      hasScores: outcome.hasScores,
      winnerSide,
    });
  });

  return {
    playerA: participantMap.get(playerAId) || null,
    playerB: participantMap.get(playerBId) || null,
    timesTeammates,
    teammateWins,
    timesOpponentsInCompletedSubs,
    aheadCountA,
    aheadCountB,
    tiedRankCount,
    matchTotal: directMatches.length,
    matchWinsA,
    matchWinsB,
    matchDraws,
    directMatches,
  };
}