export function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getBracketRoundName(roundNumber, totalRounds) {
  const diff = totalRounds - roundNumber;
  if (diff === 0) return 'Final';
  if (diff === 1) return 'Semifinal';
  if (diff === 2) return 'Cuartos de final';
  if (diff === 3) return 'Octavos de final';
  if (diff === 4) return 'Dieciseisavos de final';
  return `Ronda ${roundNumber}`;
}

function getBracketSeedOrder(bracketSize) {
  let order = [1, 2];
  while (order.length < bracketSize) {
    const nextSum = order.length * 2 + 1;
    const expanded = [];
    for (const seed of order) {
      expanded.push(seed, nextSum - seed);
    }
    order = expanded;
  }
  return order;
}

export function getGroupLabel(index) {
  const idx = Math.max(0, Number(index) || 0);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (idx < 26) return `Grupo ${alphabet[idx]}`;
  const first = Math.floor(idx / 26) - 1;
  const second = idx % 26;
  return `Grupo ${alphabet[first] || 'A'}${alphabet[second]}`;
}

export function generateLeagueMatches(tournament, participants) {
  if (!participants || participants.length < 2) {
    throw new Error('Se necesitan al menos 2 participantes para generar la liga.');
  }

  const shuffled = shuffleArray(participants);
  const isOdd = shuffled.length % 2 === 1;
  const list = isOdd ? [...shuffled, null] : [...shuffled];
  const totalSlots = list.length;
  const roundsPerCycle = totalSlots - 1;

  const fixed = list[0];
  let rotating = list.slice(1);
  const firstCycle = [];

  for (let roundIdx = 0; roundIdx < roundsPerCycle; roundIdx += 1) {
    const roundPairs = [];
    const firstOpponent = rotating[0];

    if (roundIdx % 2 === 0) {
      roundPairs.push({ a: fixed, b: firstOpponent });
    } else {
      roundPairs.push({ a: firstOpponent, b: fixed });
    }

    for (let i = 1; i < totalSlots / 2; i += 1) {
      const left = rotating[i];
      const right = rotating[rotating.length - i];
      if ((roundIdx + i) % 2 === 0) {
        roundPairs.push({ a: left, b: right });
      } else {
        roundPairs.push({ a: right, b: left });
      }
    }

    firstCycle.push(roundPairs);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  const homeAndAway = Boolean(tournament.config?.home_and_away);
  const configuredRounds = Number.parseInt(tournament.config?.rounds, 10);
  const hasConfiguredRounds = !Number.isNaN(configuredRounds) && configuredRounds > 0;

  let allRounds = [];

  if (homeAndAway) {
    const secondCycle = firstCycle.map((pairs) =>
      pairs.map((pair) => ({
        a: pair.b,
        b: pair.a,
        leg: 2,
      }))
    );
    const fullDoubleCycle = [
      ...firstCycle.map((pairs) => pairs.map((pair) => ({ ...pair, leg: 1 }))),
      ...secondCycle,
    ];

    if (hasConfiguredRounds) {
      for (let r = 0; r < configuredRounds; r += 1) {
        const template = fullDoubleCycle[r % fullDoubleCycle.length];
        allRounds.push(template);
      }
    } else {
      allRounds = fullDoubleCycle;
    }
  } else if (hasConfiguredRounds) {
    for (let r = 0; r < configuredRounds; r += 1) {
      const cycleIndex = Math.floor(r / roundsPerCycle);
      const template = firstCycle[r % roundsPerCycle];
      const swapHome = cycleIndex % 2 === 1;
      allRounds.push(
        template.map((pair) => ({
          a: swapHome ? pair.b : pair.a,
          b: swapHome ? pair.a : pair.b,
          leg: swapHome ? 2 : 1,
        }))
      );
    }
  } else {
    allRounds = firstCycle.map((pairs) =>
      pairs.map((pair) => ({ ...pair, leg: 1 }))
    );
  }

  const rows = [];

  allRounds.forEach((pairs, roundIndex) => {
    const roundNumber = roundIndex + 1;
    const roundName = `Fecha ${roundNumber}`;
    let matchOrder = 1;
    let byePlayer = null;

    pairs.forEach((pair) => {
      if (pair.a && pair.b) {
        rows.push({
          tournament_id: tournament.id,
          round_number: roundNumber,
          round_name: roundName,
          match_order: matchOrder,
          leg: pair.leg || 1,
          participant_a_id: pair.a.id,
          participant_b_id: pair.b.id,
          score_a: null,
          score_b: null,
          winner_id: null,
          is_draw: false,
          is_bye: false,
          status: 'pending',
        });
        matchOrder += 1;
      } else if (pair.a || pair.b) {
        byePlayer = pair.a || pair.b;
      }
    });

    if (byePlayer) {
      rows.push({
        tournament_id: tournament.id,
        round_number: roundNumber,
        round_name: roundName,
        match_order: matchOrder,
        leg: 1,
        participant_a_id: byePlayer.id,
        participant_b_id: null,
        score_a: null,
        score_b: null,
        winner_id: null,
        is_draw: false,
        is_bye: true,
        status: 'completed',
      });
    }
  });

  return rows;
}

export function generateKnockoutMatches(tournament, participants) {
  if (!participants || participants.length < 2) {
    throw new Error('Se necesitan al menos 2 participantes para generar la eliminatoria.');
  }

  const shuffled = shuffleArray(participants);
  const count = shuffled.length;
  const bracketSize = 2 ** Math.ceil(Math.log2(count));
  const totalRounds = Math.log2(bracketSize);
  const homeAndAway = Boolean(tournament.config?.home_and_away);
  const thirdPlaceEnabled = Boolean(tournament.config?.third_place) && count >= 4;

  const seedOrder = getBracketSeedOrder(bracketSize);
  const slottedPlayers = seedOrder.map((seed) =>
    seed <= count ? shuffled[seed - 1] : null
  );

  const rows = [];
  const round1Byes = new Map();

  const round1MatchesCount = bracketSize / 2;
  const round1Name = getBracketRoundName(1, totalRounds);

  for (let m = 1; m <= round1MatchesCount; m += 1) {
    const playerA = slottedPlayers[(m - 1) * 2];
    const playerB = slottedPlayers[(m - 1) * 2 + 1];

    if ((playerA && !playerB) || (!playerA && playerB)) {
      const byePlayer = playerA || playerB;
      round1Byes.set(m, byePlayer.id);

      rows.push({
        tournament_id: tournament.id,
        round_number: 1,
        round_name: round1Name,
        match_order: m,
        leg: 1,
        participant_a_id: byePlayer.id,
        participant_b_id: null,
        score_a: null,
        score_b: null,
        winner_id: byePlayer.id,
        is_draw: false,
        is_bye: true,
        status: 'completed',
      });
    } else if (playerA && playerB) {
      rows.push({
        tournament_id: tournament.id,
        round_number: 1,
        round_name: round1Name,
        match_order: m,
        leg: 1,
        participant_a_id: playerA.id,
        participant_b_id: playerB.id,
        score_a: null,
        score_b: null,
        winner_id: null,
        is_draw: false,
        is_bye: false,
        status: 'pending',
      });

      if (homeAndAway) {
        rows.push({
          tournament_id: tournament.id,
          round_number: 1,
          round_name: round1Name,
          match_order: m,
          leg: 2,
          participant_a_id: playerB.id,
          participant_b_id: playerA.id,
          score_a: null,
          score_b: null,
          winner_id: null,
          is_draw: false,
          is_bye: false,
          status: 'pending',
        });
      }
    }
  }

  for (let r = 2; r <= totalRounds; r += 1) {
    const matchCount = bracketSize / 2 ** r;
    const roundName = getBracketRoundName(r, totalRounds);

    for (let m = 1; m <= matchCount; m += 1) {
      let topPlayerId = null;
      let bottomPlayerId = null;

      if (r === 2) {
        topPlayerId = round1Byes.get(m * 2 - 1) || null;
        bottomPlayerId = round1Byes.get(m * 2) || null;
      }

      rows.push({
        tournament_id: tournament.id,
        round_number: r,
        round_name: roundName,
        match_order: m,
        leg: 1,
        participant_a_id: topPlayerId,
        participant_b_id: bottomPlayerId,
        score_a: null,
        score_b: null,
        winner_id: null,
        is_draw: false,
        is_bye: false,
        status: 'pending',
      });

      if (homeAndAway) {
        rows.push({
          tournament_id: tournament.id,
          round_number: r,
          round_name: roundName,
          match_order: m,
          leg: 2,
          participant_a_id: bottomPlayerId,
          participant_b_id: topPlayerId,
          score_a: null,
          score_b: null,
          winner_id: null,
          is_draw: false,
          is_bye: false,
          status: 'pending',
        });
      }
    }
  }

  if (thirdPlaceEnabled) {
    rows.push({
      tournament_id: tournament.id,
      round_number: totalRounds,
      round_name: 'Tercer puesto',
      match_order: 2,
      leg: 1,
      participant_a_id: null,
      participant_b_id: null,
      score_a: null,
      score_b: null,
      winner_id: null,
      is_draw: false,
      is_bye: false,
      status: 'pending',
    });
  }

  return rows;
}

export function getSingleMatchWinner(match) {
  if (!match) return null;
  if (match.is_bye) return match.winner_id || match.participant_a_id || null;
  if (match.status !== 'completed') return null;

  if (match.score_a !== null && match.score_b !== null) {
    if (match.score_a > match.score_b) return match.participant_a_id;
    if (match.score_b > match.score_a) return match.participant_b_id;
    return match.winner_id || null;
  }

  if (match.is_draw) return null;
  return match.winner_id || null;
}

export function getKnockoutSeriesStatus(tieMatches) {
  const ordered = [...tieMatches].sort((a, b) => a.leg - b.leg);
  const leg1 = ordered[0] || null;
  const leg2 = ordered[1] || null;

  if (!leg1) {
    return {
      isBye: false,
      isCompleted: false,
      winnerId: null,
      loserId: null,
      player1Id: null,
      player2Id: null,
      agg1: null,
      agg2: null,
      hasAggregate: false,
      resolvedByTiebreak: false,
    };
  }

  if (leg1.is_bye) {
    const winnerId = leg1.winner_id || leg1.participant_a_id || null;
    return {
      isBye: true,
      isCompleted: true,
      winnerId,
      loserId: null,
      player1Id: leg1.participant_a_id,
      player2Id: null,
      agg1: null,
      agg2: null,
      hasAggregate: false,
      resolvedByTiebreak: false,
    };
  }

  const player1Id = leg1.participant_a_id;
  const player2Id = leg1.participant_b_id;

  if (!leg2) {
    if (leg1.status !== 'completed') {
      return {
        isBye: false,
        isCompleted: false,
        winnerId: null,
        loserId: null,
        player1Id,
        player2Id,
        agg1: null,
        agg2: null,
        hasAggregate: false,
        resolvedByTiebreak: false,
      };
    }

    const winnerId = leg1.winner_id || getSingleMatchWinner(leg1);
    const loserId = winnerId
      ? winnerId === player1Id
        ? player2Id
        : player1Id
      : null;
    const tiedScore =
      leg1.score_a !== null &&
      leg1.score_b !== null &&
      leg1.score_a === leg1.score_b;

    return {
      isBye: false,
      isCompleted: Boolean(winnerId),
      winnerId,
      loserId,
      player1Id,
      player2Id,
      agg1: leg1.score_a,
      agg2: leg1.score_b,
      hasAggregate: leg1.score_a !== null && leg1.score_b !== null,
      resolvedByTiebreak: Boolean(winnerId && (tiedScore || leg1.is_draw)),
    };
  }

  const bothHaveScores =
    leg1.status === 'completed' &&
    leg2.status === 'completed' &&
    leg1.score_a !== null &&
    leg1.score_b !== null &&
    leg2.score_a !== null &&
    leg2.score_b !== null;

  const totals = {
    [player1Id]: 0,
    [player2Id]: 0,
  };

  let scoredLegsCount = 0;
  [leg1, leg2].forEach((legMatch) => {
    if (
      legMatch.status === 'completed' &&
      legMatch.score_a !== null &&
      legMatch.score_b !== null
    ) {
      scoredLegsCount += 1;
      if (legMatch.participant_a_id && totals[legMatch.participant_a_id] !== undefined) {
        totals[legMatch.participant_a_id] += legMatch.score_a;
      }
      if (legMatch.participant_b_id && totals[legMatch.participant_b_id] !== undefined) {
        totals[legMatch.participant_b_id] += legMatch.score_b;
      }
    }
  });

  if (leg1.status !== 'completed' || leg2.status !== 'completed') {
    return {
      isBye: false,
      isCompleted: false,
      winnerId: null,
      loserId: null,
      player1Id,
      player2Id,
      agg1: scoredLegsCount > 0 ? totals[player1Id] : null,
      agg2: scoredLegsCount > 0 ? totals[player2Id] : null,
      hasAggregate: scoredLegsCount > 0,
      resolvedByTiebreak: false,
    };
  }

  if (bothHaveScores) {
    const agg1 = totals[player1Id];
    const agg2 = totals[player2Id];

    if (agg1 > agg2) {
      return {
        isBye: false,
        isCompleted: true,
        winnerId: player1Id,
        loserId: player2Id,
        player1Id,
        player2Id,
        agg1,
        agg2,
        hasAggregate: true,
        resolvedByTiebreak: false,
      };
    }

    if (agg2 > agg1) {
      return {
        isBye: false,
        isCompleted: true,
        winnerId: player2Id,
        loserId: player1Id,
        player1Id,
        player2Id,
        agg1,
        agg2,
        hasAggregate: true,
        resolvedByTiebreak: false,
      };
    }

    const tieWinnerId = leg2.winner_id || leg1.winner_id || null;
    const tieLoserId = tieWinnerId
      ? tieWinnerId === player1Id
        ? player2Id
        : player1Id
      : null;

    return {
      isBye: false,
      isCompleted: Boolean(tieWinnerId),
      winnerId: tieWinnerId,
      loserId: tieLoserId,
      player1Id,
      player2Id,
      agg1,
      agg2,
      hasAggregate: true,
      resolvedByTiebreak: Boolean(tieWinnerId),
    };
  }

  if (leg2.score_a === null && leg2.is_draw && leg2.winner_id) {
    const winnerId = leg2.winner_id;
    return {
      isBye: false,
      isCompleted: true,
      winnerId,
      loserId: winnerId === player1Id ? player2Id : player1Id,
      player1Id,
      player2Id,
      agg1: null,
      agg2: null,
      hasAggregate: false,
      resolvedByTiebreak: true,
    };
  }

  const w1 = getSingleMatchWinner(leg1);
  const w2 = getSingleMatchWinner(leg2);
  const points = {
    [player1Id]: 0,
    [player2Id]: 0,
  };

  if (w1 === player1Id) points[player1Id] += 1;
  else if (w1 === player2Id) points[player2Id] += 1;
  else {
    points[player1Id] += 0.5;
    points[player2Id] += 0.5;
  }

  if (w2 === player1Id) points[player1Id] += 1;
  else if (w2 === player2Id) points[player2Id] += 1;
  else {
    points[player1Id] += 0.5;
    points[player2Id] += 0.5;
  }

  if (points[player1Id] > points[player2Id]) {
    return {
      isBye: false,
      isCompleted: true,
      winnerId: player1Id,
      loserId: player2Id,
      player1Id,
      player2Id,
      agg1: null,
      agg2: null,
      hasAggregate: false,
      resolvedByTiebreak: false,
    };
  }

  if (points[player2Id] > points[player1Id]) {
    return {
      isBye: false,
      isCompleted: true,
      winnerId: player2Id,
      loserId: player1Id,
      player1Id,
      player2Id,
      agg1: null,
      agg2: null,
      hasAggregate: false,
      resolvedByTiebreak: false,
    };
  }

  const fallbackWinner = leg2.winner_id || null;
  return {
    isBye: false,
    isCompleted: Boolean(fallbackWinner),
    winnerId: fallbackWinner,
    loserId: fallbackWinner
      ? fallbackWinner === player1Id
        ? player2Id
        : player1Id
      : null,
    player1Id,
    player2Id,
    agg1: null,
    agg2: null,
    hasAggregate: false,
    resolvedByTiebreak: Boolean(fallbackWinner),
  };
}

export function computeLeagueStandings(participants, matches) {
  const statsMap = new Map();

  participants.forEach((participant) => {
    statsMap.set(participant.id, {
      participant,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      gf: 0,
      gc: 0,
      dg: 0,
      pts: 0,
    });
  });

  matches.forEach((match) => {
    if (match.status !== 'completed' || match.is_bye) return;
    const rowA = statsMap.get(match.participant_a_id);
    const rowB = statsMap.get(match.participant_b_id);
    if (!rowA || !rowB) return;

    rowA.pj += 1;
    rowB.pj += 1;

    const hasScores = match.score_a !== null && match.score_b !== null;
    if (hasScores) {
      rowA.gf += match.score_a;
      rowA.gc += match.score_b;
      rowB.gf += match.score_b;
      rowB.gc += match.score_a;
    }

    const isExactDraw = hasScores && match.score_a === match.score_b;
    if (match.is_draw || isExactDraw) {
      rowA.pe += 1;
      rowB.pe += 1;
      rowA.pts += 1;
      rowB.pts += 1;
      return;
    }

    let winnerId = match.winner_id;
    if (!winnerId && hasScores) {
      winnerId =
        match.score_a > match.score_b
          ? match.participant_a_id
          : match.participant_b_id;
    }

    if (winnerId === match.participant_a_id) {
      rowA.pg += 1;
      rowA.pts += 3;
      rowB.pp += 1;
    } else if (winnerId === match.participant_b_id) {
      rowB.pg += 1;
      rowB.pts += 3;
      rowA.pp += 1;
    }
  });

  const rows = Array.from(statsMap.values()).map((row) => ({
    ...row,
    dg: row.gf - row.gc,
  }));

  rows.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    if (b.pg !== a.pg) return b.pg - a.pg;
    return a.participant.name.localeCompare(b.participant.name, 'es');
  });

  return rows;
}

export function computeKnockoutSummary(participants, matches) {
  const participantMap = new Map(participants.map((p) => [p.id, p]));
  const statsMap = new Map(
    participants.map((p) => [
      p.id,
      {
        participant: p,
        wins: 0,
        losses: 0,
        gf: 0,
        gc: 0,
        eliminatedInRound: null,
        eliminatedRoundNumber: 0,
        rankWeight: 500,
        statusLabel: 'Pendiente',
      },
    ])
  );

  const tieGroups = new Map();
  let maxRoundNumber = 0;

  matches.forEach((m) => {
    if (m.round_number > maxRoundNumber) {
      maxRoundNumber = m.round_number;
    }
    const key = `${m.round_number}-${m.match_order}-${m.round_name === 'Tercer puesto' ? '3p' : 'main'}`;
    if (!tieGroups.has(key)) {
      tieGroups.set(key, []);
    }
    tieGroups.get(key).push(m);

    if (m.status === 'completed' && !m.is_bye && m.score_a !== null && m.score_b !== null) {
      const sA = statsMap.get(m.participant_a_id);
      const sB = statsMap.get(m.participant_b_id);
      if (sA) {
        sA.gf += m.score_a;
        sA.gc += m.score_b;
      }
      if (sB) {
        sB.gf += m.score_b;
        sB.gc += m.score_a;
      }
    }
  });

  let totalTies = 0;
  let completedTies = 0;
  let champion = null;
  let runnerUp = null;
  let thirdPlace = null;
  let fourthPlace = null;
  const semifinalLosers = [];
  let hasThirdPlaceMatch = false;

  const activeRoundNames = new Set();

  tieGroups.forEach((tieMatches) => {
    const first = tieMatches[0];
    const isThirdPlaceTie = first.round_name === 'Tercer puesto';
    if (isThirdPlaceTie) hasThirdPlaceMatch = true;

    const series = getKnockoutSeriesStatus(tieMatches);
    if (!series.isBye) {
      totalTies += 1;
      if (series.isCompleted) {
        completedTies += 1;
      } else if (series.player1Id && series.player2Id) {
        activeRoundNames.add(first.round_name);
      }
    }

    if (series.isCompleted && !series.isBye && series.winnerId && series.loserId) {
      const winStats = statsMap.get(series.winnerId);
      const loseStats = statsMap.get(series.loserId);
      if (winStats) winStats.wins += 1;
      if (loseStats) loseStats.losses += 1;
    }

    if (first.round_name === 'Final') {
      if (series.isCompleted && series.winnerId) {
        champion = participantMap.get(series.winnerId) || null;
        runnerUp = participantMap.get(series.loserId) || null;
      }
    } else if (isThirdPlaceTie) {
      if (series.isCompleted && series.winnerId) {
        thirdPlace = participantMap.get(series.winnerId) || null;
        fourthPlace = participantMap.get(series.loserId) || null;
      }
    } else if (series.isCompleted && series.loserId) {
      const loseStats = statsMap.get(series.loserId);
      if (loseStats) {
        loseStats.eliminatedInRound = first.round_name;
        loseStats.eliminatedRoundNumber = first.round_number;
      }
      if (first.round_name === 'Semifinal') {
        const loserObj = participantMap.get(series.loserId);
        if (loserObj) semifinalLosers.push(loserObj);
      }
    }
  });

  statsMap.forEach((item, id) => {
    if (champion?.id === id) {
      item.statusLabel = 'Campeón';
      item.rankWeight = 1;
    } else if (runnerUp?.id === id) {
      item.statusLabel = 'Subcampeón';
      item.rankWeight = 2;
    } else if (thirdPlace?.id === id) {
      item.statusLabel = '3.º puesto';
      item.rankWeight = 3;
    } else if (fourthPlace?.id === id) {
      item.statusLabel = '4.º puesto';
      item.rankWeight = 4;
    } else if (item.eliminatedInRound) {
      item.statusLabel = `Eliminado en ${item.eliminatedInRound}`;
      item.rankWeight = 100 - item.eliminatedRoundNumber;
    } else if (matches.length > 0) {
      item.statusLabel = 'En competencia';
      item.rankWeight = 10;
    } else {
      item.statusLabel = 'Sin iniciar';
      item.rankWeight = 20;
    }
  });

  const rows = Array.from(statsMap.values()).sort((a, b) => {
    if (a.rankWeight !== b.rankWeight) return a.rankWeight - b.rankWeight;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.participant.name.localeCompare(b.participant.name, 'es');
  });

  return {
    totalTies,
    completedTies,
    pendingTies: totalTies - completedTies,
    activeRounds: Array.from(activeRoundNames),
    champion,
    runnerUp,
    thirdPlace,
    fourthPlace,
    hasThirdPlaceMatch,
    semifinalLosers,
    rows,
  };
}

export function computeLastStandingStandings(participants, eliminations) {
  const eliminationMap = new Map(
    eliminations.map((el) => [el.participant_id, el])
  );

  const stillStanding = participants.filter((p) => !eliminationMap.has(p.id));
  const eliminated = participants
    .filter((p) => eliminationMap.has(p.id))
    .sort(
      (a, b) =>
        eliminationMap.get(b.id).elimination_order -
        eliminationMap.get(a.id).elimination_order
    );

  const champion =
    participants.length >= 2 && stillStanding.length === 1
      ? stillStanding[0]
      : null;

  const rows = [
    ...stillStanding.map((participant) => ({
      participant,
      rank: 1,
      isAlive: true,
      isChampion: Boolean(champion && champion.id === participant.id),
      eliminationOrder: null,
    })),
    ...eliminated.map((participant, index) => ({
      participant,
      rank: stillStanding.length + index + 1,
      isAlive: false,
      isChampion: false,
      eliminationOrder: eliminationMap.get(participant.id).elimination_order,
    })),
  ];

  return {
    stillStanding,
    eliminated,
    champion,
    eliminationMap,
    rows,
  };
}

// =============================================================================
// MOTOR DE FASE DE GRUPOS + PLAYOFF + ELIMINACIÓN (group_stage)
// =============================================================================

export function parseGroupStageConfig(config = {}) {
  const groupCount = Math.max(1, Number.parseInt(config.group_count ?? 2, 10) || 2);
  const directPerGroup = Math.max(
    0,
    Number.parseInt(config.direct_per_group ?? 2, 10) || 0
  );
  const playoffPerGroup = Math.max(
    0,
    Number.parseInt(config.playoff_per_group ?? 0, 10) || 0
  );
  const bestThirdsCount = Math.max(
    0,
    Number.parseInt(config.best_thirds_count ?? 0, 10) || 0
  );
  const bestThirdsDest =
    config.best_thirds_destination === 'playoff' ? 'playoff' : 'direct';

  const totalDirect =
    groupCount * directPerGroup +
    (bestThirdsCount > 0 && bestThirdsDest === 'direct' ? bestThirdsCount : 0);
  const totalPlayoff =
    groupCount * playoffPerGroup +
    (bestThirdsCount > 0 && bestThirdsDest === 'playoff' ? bestThirdsCount : 0);
  const totalAdvancing = totalDirect + totalPlayoff;

  const playoffSurvivors = Math.ceil(totalPlayoff / 2);
  const mainBracketCount = totalDirect + playoffSurvivors;
  const mainBracketSize =
    mainBracketCount >= 2 ? 2 ** Math.ceil(Math.log2(mainBracketCount)) : 2;
  const mainRoundsCount = Math.log2(mainBracketSize);

  return {
    groupCount,
    directPerGroup,
    playoffPerGroup,
    bestThirdsCount,
    bestThirdsDest,
    totalDirect,
    totalPlayoff,
    totalAdvancing,
    playoffTies: Math.floor(totalPlayoff / 2),
    playoffHasBye: totalPlayoff % 2 === 1,
    playoffSurvivors,
    mainBracketCount,
    mainBracketSize,
    mainRoundsCount,
    minPerGroup: Math.max(2, directPerGroup + playoffPerGroup),
  };
}

export function isPowerOfTwo(n) {
  return Number.isInteger(n) && n >= 2 && (n & (n - 1)) === 0;
}

export function validateGroupStageConfig(config = {}, groupsRosterMap = null) {
  const parsed = parseGroupStageConfig(config);
  const errors = [];

  if (parsed.totalAdvancing < 2) {
    errors.push('Debe avanzar al menos 2 competidores en total.');
  } else if (parsed.totalPlayoff > 0) {
    if (parsed.totalPlayoff % 2 !== 0) {
      errors.push(
        `Los cupos al Playoff deben ser un número par (actualmente: ${parsed.totalPlayoff}) para armar cruces 1 vs 1.`
      );
    } else if (!isPowerOfTwo(parsed.mainBracketCount)) {
      errors.push(
        `Luego del Playoff quedarían ${parsed.mainBracketCount} equipos en la llave final (${parsed.totalDirect} directos + ${parsed.playoffSurvivors} ganadores de Playoff). Debe ser potencia de 2 (2, 4, 8, 16, 32).`
      );
    }
  } else if (!isPowerOfTwo(parsed.totalDirect)) {
    errors.push(
      `El total de cupos que avanzan debe ser potencia de 2: 2, 4, 8, 16 o 32 (actualmente: ${parsed.totalDirect}).`
    );
  }

  if (parsed.bestThirdsCount > parsed.groupCount) {
    errors.push(
      `No puedes elegir ${parsed.bestThirdsCount} mejores ${
        parsed.directPerGroup + parsed.playoffPerGroup + 1
      }.º si solo hay ${parsed.groupCount} grupos.`
    );
  }

  if (groupsRosterMap && groupsRosterMap instanceof Map) {
    for (let i = 0; i < parsed.groupCount; i += 1) {
      const label = getGroupLabel(i);
      const countInGroup = (groupsRosterMap.get(label) || []).length;
      if (countInGroup < parsed.minPerGroup) {
        errors.push(
          `${label} necesita al menos ${parsed.minPerGroup} integrantes (tiene ${countInGroup}).`
        );
      }
    }

    if (parsed.bestThirdsCount > 0) {
      const targetPos = parsed.directPerGroup + parsed.playoffPerGroup + 1;
      let eligibleGroups = 0;
      for (let i = 0; i < parsed.groupCount; i += 1) {
        const label = getGroupLabel(i);
        if ((groupsRosterMap.get(label) || []).length >= targetPos) {
          eligibleGroups += 1;
        }
      }
      if (eligibleGroups < parsed.bestThirdsCount) {
        errors.push(
          `Solo ${eligibleGroups} grupos tienen ${targetPos}.º puesto, pero configuraste ${parsed.bestThirdsCount} mejores ${targetPos}.º.`
        );
      }
    }
  }

  const stageNames = [];
  if (parsed.totalPlayoff > 0) {
    stageNames.push(
      `Playoff (${parsed.playoffTies} ${
        parsed.playoffTies === 1 ? 'cruce' : 'cruces'
      })`
    );
  }
  for (let r = 1; r <= parsed.mainRoundsCount; r += 1) {
    stageNames.push(getBracketRoundName(r, parsed.mainRoundsCount));
  }

  return {
    isValid: errors.length === 0,
    errors,
    parsed,
    bracketPreview: stageNames.join(' → '),
  };
}

export function generateGroupStageMatches(
  tournament,
  participants,
  customGroupAssignments = null
) {
  const cfg = tournament.config || {};
  const parsed = parseGroupStageConfig(cfg);
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  // Construir rosters por grupo
  const groupsRosterMap = new Map();
  for (let i = 0; i < parsed.groupCount; i += 1) {
    groupsRosterMap.set(getGroupLabel(i), []);
  }

  const rawAssignments = customGroupAssignments || cfg.group_assignments || null;
  if (rawAssignments && typeof rawAssignments === 'object') {
    const usedIds = new Set();
    for (let i = 0; i < parsed.groupCount; i += 1) {
      const label = getGroupLabel(i);
      const ids = Array.isArray(rawAssignments[label])
        ? rawAssignments[label]
        : [];
      const validMembers = [];
      ids.forEach((id) => {
        if (participantMap.has(id) && !usedIds.has(id)) {
          usedIds.add(id);
          validMembers.push(participantMap.get(id));
        }
      });
      groupsRosterMap.set(label, validMembers);
    }

    // Si algún participante nuevo quedó afuera, repartirlo en el grupo más chico
    const remaining = participants.filter((p) => !usedIds.has(p.id));
    remaining.forEach((p) => {
      let smallestLabel = getGroupLabel(0);
      let smallestCount = Infinity;
      groupsRosterMap.forEach((list, label) => {
        if (list.length < smallestCount) {
          smallestCount = list.length;
          smallestLabel = label;
        }
      });
      groupsRosterMap.get(smallestLabel).push(p);
    });
  } else {
    const shuffled = shuffleArray(participants);
    shuffled.forEach((p, idx) => {
      const label = getGroupLabel(idx % parsed.groupCount);
      groupsRosterMap.get(label).push(p);
    });
  }

  const validation = validateGroupStageConfig(cfg, groupsRosterMap);
  if (!validation.isValid) {
    throw new Error(validation.errors[0]);
  }

  const rows = [];
  let maxGroupRound = 0;

  // 1. Generar partidos de cada grupo (stage: 'group')
  for (let i = 0; i < parsed.groupCount; i += 1) {
    const groupLabel = getGroupLabel(i);
    const members = groupsRosterMap.get(groupLabel) || [];
    const groupLeagueMatches = generateLeagueMatches(
      {
        id: tournament.id,
        config: { home_and_away: Boolean(cfg.group_home_and_away) },
      },
      members
    );

    groupLeagueMatches.forEach((m) => {
      if (m.round_number > maxGroupRound) {
        maxGroupRound = m.round_number;
      }
      rows.push({
        ...m,
        stage: 'group',
        group_name: groupLabel,
        round_name: `${groupLabel} · ${m.round_name}`,
      });
    });
  }

  const koHomeAndAway = Boolean(cfg.knockout_home_and_away);
  let nextRoundNumber = maxGroupRound + 1;

  // 2. Generar Playoff previo si existen cupos de playoff (stage: 'playoff')
  if (parsed.totalPlayoff > 0) {
    const playoffRound = nextRoundNumber;
    nextRoundNumber += 1;

    let orderCounter = 1;
    if (parsed.playoffHasBye) {
      rows.push({
        tournament_id: tournament.id,
        stage: 'playoff',
        group_name: null,
        round_number: playoffRound,
        round_name: 'Playoff',
        match_order: orderCounter,
        leg: 1,
        participant_a_id: null,
        participant_b_id: null,
        score_a: null,
        score_b: null,
        winner_id: null,
        is_draw: false,
        is_bye: true,
        status: 'completed',
      });
      orderCounter += 1;
    }

    for (let t = 0; t < parsed.playoffTies; t += 1) {
      const mOrder = orderCounter + t;
      rows.push({
        tournament_id: tournament.id,
        stage: 'playoff',
        group_name: null,
        round_number: playoffRound,
        round_name: 'Playoff',
        match_order: mOrder,
        leg: 1,
        participant_a_id: null,
        participant_b_id: null,
        score_a: null,
        score_b: null,
        winner_id: null,
        is_draw: false,
        is_bye: false,
        status: 'pending',
      });

      if (koHomeAndAway) {
        rows.push({
          tournament_id: tournament.id,
          stage: 'playoff',
          group_name: null,
          round_number: playoffRound,
          round_name: 'Playoff',
          match_order: mOrder,
          leg: 2,
          participant_a_id: null,
          participant_b_id: null,
          score_a: null,
          score_b: null,
          winner_id: null,
          is_draw: false,
          is_bye: false,
          status: 'pending',
        });
      }
    }
  }

  // 3. Generar llave principal de Eliminación (stage: 'knockout')
  const koBaseRound = nextRoundNumber - 1;
  const seedOrder = getBracketSeedOrder(parsed.mainBracketSize);

  for (let r = 1; r <= parsed.mainRoundsCount; r += 1) {
    const matchCount = parsed.mainBracketSize / 2 ** r;
    const roundNumber = koBaseRound + r;
    const roundName = getBracketRoundName(r, parsed.mainRoundsCount);

    for (let m = 1; m <= matchCount; m += 1) {
      const isRound1Bye =
        r === 1 &&
        (seedOrder[(m - 1) * 2] > parsed.mainBracketCount ||
          seedOrder[(m - 1) * 2 + 1] > parsed.mainBracketCount);

      if (isRound1Bye) {
        rows.push({
          tournament_id: tournament.id,
          stage: 'knockout',
          group_name: null,
          round_number: roundNumber,
          round_name: roundName,
          match_order: m,
          leg: 1,
          participant_a_id: null,
          participant_b_id: null,
          score_a: null,
          score_b: null,
          winner_id: null,
          is_draw: false,
          is_bye: true,
          status: 'completed',
        });
      } else {
        rows.push({
          tournament_id: tournament.id,
          stage: 'knockout',
          group_name: null,
          round_number: roundNumber,
          round_name: roundName,
          match_order: m,
          leg: 1,
          participant_a_id: null,
          participant_b_id: null,
          score_a: null,
          score_b: null,
          winner_id: null,
          is_draw: false,
          is_bye: false,
          status: 'pending',
        });

        if (koHomeAndAway) {
          rows.push({
            tournament_id: tournament.id,
            stage: 'knockout',
            group_name: null,
            round_number: roundNumber,
            round_name: roundName,
            match_order: m,
            leg: 2,
            participant_a_id: null,
            participant_b_id: null,
            score_a: null,
            score_b: null,
            winner_id: null,
            is_draw: false,
            is_bye: false,
            status: 'pending',
          });
        }
      }
    }
  }

  const thirdPlaceEnabled =
    Boolean(cfg.third_place) && parsed.mainBracketCount >= 4;
  if (thirdPlaceEnabled) {
    rows.push({
      tournament_id: tournament.id,
      stage: 'knockout',
      group_name: null,
      round_number: koBaseRound + parsed.mainRoundsCount,
      round_name: 'Tercer puesto',
      match_order: 2,
      leg: 1,
      participant_a_id: null,
      participant_b_id: null,
      score_a: null,
      score_b: null,
      winner_id: null,
      is_draw: false,
      is_bye: false,
      status: 'pending',
    });
  }

  return rows;
}

export function computeGroupStageStandings(
  tournament,
  participants,
  matches
) {
  const cfg = tournament?.config || {};
  const parsed = parseGroupStageConfig(cfg);
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  const groupMatchesAll = (matches || []).filter((m) => m.stage === 'group');
  const playoffMatchesAll = (matches || []).filter((m) => m.stage === 'playoff');
  const knockoutMatchesAll = (matches || []).filter(
    (m) => m.stage === 'knockout'
  );

  // Agrupar partidos y miembros por group_name
  const matchesByGroup = new Map();
  const memberIdsByGroup = new Map();

  for (let i = 0; i < parsed.groupCount; i += 1) {
    const label = getGroupLabel(i);
    matchesByGroup.set(label, []);
    memberIdsByGroup.set(label, new Set());
  }

  groupMatchesAll.forEach((m) => {
    const label = m.group_name || getGroupLabel(0);
    if (!matchesByGroup.has(label)) {
      matchesByGroup.set(label, []);
      memberIdsByGroup.set(label, new Set());
    }
    matchesByGroup.get(label).push(m);
    if (m.participant_a_id) memberIdsByGroup.get(label).add(m.participant_a_id);
    if (m.participant_b_id) memberIdsByGroup.get(label).add(m.participant_b_id);
  });

  const nonByeGroupMatches = groupMatchesAll.filter((m) => !m.is_bye);
  const allGroupsCompleted =
    nonByeGroupMatches.length > 0 &&
    nonByeGroupMatches.every((m) => m.status === 'completed');

  const groups = [];
  const thirdCandidates = [];

  Array.from(matchesByGroup.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .forEach(([groupName, gMatches]) => {
      const gMembers = Array.from(memberIdsByGroup.get(groupName) || [])
        .map((id) => participantMap.get(id))
        .filter(Boolean);

      const rawRows = computeLeagueStandings(gMembers, gMatches);
      const rows = rawRows.map((row, idx) => {
        const rank = idx + 1;
        const ppg = row.pj > 0 ? row.pts / row.pj : 0;
        const dgPerGame = row.pj > 0 ? row.dg / row.pj : 0;
        const gfPerGame = row.pj > 0 ? row.gf / row.pj : 0;

        let zone = 'eliminated';
        if (rank <= parsed.directPerGroup) {
          zone = 'direct';
        } else if (rank <= parsed.directPerGroup + parsed.playoffPerGroup) {
          zone = 'playoff';
        }

        return {
          ...row,
          groupName,
          rank,
          ppg,
          dgPerGame,
          gfPerGame,
          zone,
          isBestThird: false,
        };
      });

      const targetThirdIdx = parsed.directPerGroup + parsed.playoffPerGroup;
      if (parsed.bestThirdsCount > 0 && rows[targetThirdIdx]) {
        thirdCandidates.push(rows[targetThirdIdx]);
      }

      const regularG = gMatches.filter((m) => !m.is_bye);
      const doneG = regularG.filter((m) => m.status === 'completed');

      groups.push({
        groupName,
        matches: gMatches,
        totalMatches: regularG.length,
        completedMatches: doneG.length,
        isCompleted:
          regularG.length > 0 && doneG.length === regularG.length,
        rows,
      });
    });

  // Ordenar mejores terceros (o mejores siguientes) por PPG para soportar grupos de distinto tamaño
  thirdCandidates.sort((a, b) => {
    if (Math.abs(b.ppg - a.ppg) > 1e-6) return b.ppg - a.ppg;
    if (Math.abs(b.dgPerGame - a.dgPerGame) > 1e-6) {
      return b.dgPerGame - a.dgPerGame;
    }
    if (Math.abs(b.gfPerGame - a.gfPerGame) > 1e-6) {
      return b.gfPerGame - a.gfPerGame;
    }
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.participant.name.localeCompare(b.participant.name, 'es');
  });

  const bestThirdsTable = thirdCandidates.map((row, idx) => {
    const qualified = idx < parsed.bestThirdsCount;
    if (qualified) {
      row.zone = parsed.bestThirdsDest;
      row.isBestThird = true;
    }
    return {
      ...row,
      thirdRank: idx + 1,
      qualified,
    };
  });

  // Recoger listas finales de clasificados ordenados para seeding
  const compareSeeds = (a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.isBestThird !== b.isBestThird) return a.isBestThird ? 1 : -1;
    if (Math.abs(b.ppg - a.ppg) > 1e-6) return b.ppg - a.ppg;
    if (Math.abs(b.dgPerGame - a.dgPerGame) > 1e-6) {
      return b.dgPerGame - a.dgPerGame;
    }
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    return a.participant.name.localeCompare(b.participant.name, 'es');
  };

  const directQualifiers = [];
  const playoffQualifiers = [];
  groups.forEach((g) => {
    g.rows.forEach((r) => {
      if (r.zone === 'direct') directQualifiers.push(r);
      else if (r.zone === 'playoff') playoffQualifiers.push(r);
    });
  });

  directQualifiers.sort(compareSeeds);
  playoffQualifiers.sort(compareSeeds);

  const knockoutSummary = computeKnockoutSummary(
    participants,
    knockoutMatchesAll
  );

  return {
    parsed,
    groups,
    bestThirdsTable,
    directQualifiers,
    playoffQualifiers,
    allGroupsCompleted,
    groupMatches: groupMatchesAll,
    playoffMatches: playoffMatchesAll,
    knockoutMatches: knockoutMatchesAll,
    knockoutSummary,
  };
}

function pairPlayoffQualifiersAvoidingSameGroup(qualifiers) {
  const n = qualifiers.length;
  if (n < 2) return [];
  const pool = [...qualifiers];
  const pairs = [];

  // Emparejamiento 1 vs N, 2 vs N-1... evitando mismo grupo si hay alternativa
  for (let i = 0; i < Math.floor(n / 2); i += 1) {
    const top = pool[i];
    let oppIdx = n - 1 - i;

    if (top.groupName === pool[oppIdx].groupName && oppIdx - 1 > i) {
      for (let alt = oppIdx - 1; alt > i; alt -= 1) {
        if (pool[alt].groupName !== top.groupName) {
          const temp = pool[oppIdx];
          pool[oppIdx] = pool[alt];
          pool[alt] = temp;
          break;
        }
      }
    }
    pairs.push([top, pool[oppIdx]]);
  }

  return pairs;
}

export function buildGroupStageProgressionPatches(
  tournament,
  participants,
  latestMatches
) {
  if (tournament?.format !== 'group_stage') return [];

  const groupData = computeGroupStageStandings(
    tournament,
    participants,
    latestMatches
  );
  const {
    parsed,
    allGroupsCompleted,
    directQualifiers,
    playoffQualifiers,
    playoffMatches,
    knockoutMatches,
  } = groupData;

  const workingPlayoff = playoffMatches.map((m) => ({ ...m }));
  const workingKo = knockoutMatches.map((m) => ({ ...m }));
  const updatesById = new Map();

  function queuePatch(target, patch) {
    Object.assign(target, patch);
    updatesById.set(target.id, {
      id: target.id,
      ...(updatesById.get(target.id) || {}),
      ...patch,
    });
  }

  // 1. Sincronizar Playoff (stage === 'playoff')
  const playoffOrders = Array.from(
    new Set(workingPlayoff.map((m) => m.match_order))
  ).sort((a, b) => a - b);

  const playoffWinnersByOrder = new Map();

  if (playoffOrders.length > 0) {
    if (!allGroupsCompleted) {
      workingPlayoff.forEach((m) => {
        if (
          m.participant_a_id !== null ||
          m.participant_b_id !== null ||
          m.winner_id !== null ||
          (!m.is_bye && m.status === 'completed')
        ) {
          queuePatch(m, {
            participant_a_id: null,
            participant_b_id: null,
            score_a: null,
            score_b: null,
            winner_id: null,
            is_draw: false,
            status: m.is_bye ? 'completed' : 'pending',
          });
        }
      });
    } else {
      let remainingPlayoff = [...playoffQualifiers];
      let byeTeam = null;
      if (parsed.playoffHasBye && remainingPlayoff.length > 0) {
        byeTeam = remainingPlayoff.shift();
      }
      const pairs = pairPlayoffQualifiersAvoidingSameGroup(remainingPlayoff);
      let pairCursor = 0;

      playoffOrders.forEach((order) => {
        const tieMatches = workingPlayoff
          .filter((m) => m.match_order === order)
          .sort((a, b) => a.leg - b.leg);

        const first = tieMatches[0];
        if (!first) return;

        if (first.is_bye) {
          const byeId = byeTeam?.participant?.id || null;
          if (first.participant_a_id !== byeId || first.winner_id !== byeId) {
            queuePatch(first, {
              participant_a_id: byeId,
              participant_b_id: null,
              winner_id: byeId,
              status: 'completed',
            });
          }
          playoffWinnersByOrder.set(order, byeId);
        } else {
          const pair = pairs[pairCursor] || [null, null];
          pairCursor += 1;
          const id1 = pair[0]?.participant?.id || null;
          const id2 = pair[1]?.participant?.id || null;

          tieMatches.forEach((target) => {
            const expectedA = target.leg === 1 ? id1 : id2;
            const expectedB = target.leg === 1 ? id2 : id1;
            if (
              target.participant_a_id !== expectedA ||
              target.participant_b_id !== expectedB
            ) {
              queuePatch(target, {
                participant_a_id: expectedA,
                participant_b_id: expectedB,
                score_a: null,
                score_b: null,
                winner_id: null,
                is_draw: false,
                status: 'pending',
              });
            }
          });

          const series = getKnockoutSeriesStatus(tieMatches);
          playoffWinnersByOrder.set(
            order,
            series.isCompleted ? series.winnerId : null
          );
        }
      });
    }
  }

  // 2. Armar lista de semillas para la llave principal (stage === 'knockout')
  const mainSeeds = [];
  for (let i = 0; i < parsed.totalDirect; i += 1) {
    mainSeeds.push(
      allGroupsCompleted ? directQualifiers[i]?.participant?.id || null : null
    );
  }
  playoffOrders.forEach((order) => {
    mainSeeds.push(
      allGroupsCompleted ? playoffWinnersByOrder.get(order) || null : null
    );
  });

  // 3. Sembrar Ronda 1 de stage === 'knockout' y propagar BYEs + rondas siguientes
  const koRoundNumbers = Array.from(
    new Set(
      workingKo
        .filter((m) => m.round_name !== 'Tercer puesto')
        .map((m) => m.round_number)
    )
  ).sort((a, b) => a - b);

  if (koRoundNumbers.length > 0) {
    const firstKoRound = koRoundNumbers[0];
    const lastKoRound = koRoundNumbers[koRoundNumbers.length - 1];
    const seedOrder = getBracketSeedOrder(parsed.mainBracketSize);

    const round1Matches = workingKo.filter(
      (m) => m.round_number === firstKoRound && m.round_name !== 'Tercer puesto'
    );
    const round1Orders = Array.from(
      new Set(round1Matches.map((m) => m.match_order))
    ).sort((a, b) => a - b);

    round1Orders.forEach((order) => {
      const tieMatches = round1Matches
        .filter((m) => m.match_order === order)
        .sort((a, b) => a.leg - b.leg);
      const first = tieMatches[0];
      if (!first) return;

      const seedIdxA = seedOrder[(order - 1) * 2] - 1;
      const seedIdxB = seedOrder[(order - 1) * 2 + 1] - 1;
      const idA =
        seedIdxA < mainSeeds.length ? mainSeeds[seedIdxA] || null : null;
      const idB =
        seedIdxB < mainSeeds.length ? mainSeeds[seedIdxB] || null : null;

      if (first.is_bye) {
        const byeWinner = idA || idB || null;
        if (
          first.participant_a_id !== byeWinner ||
          first.winner_id !== byeWinner
        ) {
          queuePatch(first, {
            participant_a_id: byeWinner,
            participant_b_id: null,
            winner_id: byeWinner,
            status: 'completed',
          });
        }
      } else {
        tieMatches.forEach((target) => {
          const expectedA = target.leg === 1 ? idA : idB;
          const expectedB = target.leg === 1 ? idB : idA;
          if (
            target.participant_a_id !== expectedA ||
            target.participant_b_id !== expectedB
          ) {
            queuePatch(target, {
              participant_a_id: expectedA,
              participant_b_id: expectedB,
              score_a: null,
              score_b: null,
              winner_id: null,
              is_draw: false,
              status: 'pending',
            });
          }
        });
      }
    });

    // Cascada entre rondas de Knockout
    for (let idx = 0; idx < koRoundNumbers.length - 1; idx += 1) {
      const currentRound = koRoundNumbers[idx];
      const nextRound = koRoundNumbers[idx + 1];

      const curMatches = workingKo.filter(
        (m) =>
          m.round_number === currentRound && m.round_name !== 'Tercer puesto'
      );
      const curOrders = Array.from(
        new Set(curMatches.map((m) => m.match_order))
      ).sort((a, b) => a - b);

      curOrders.forEach((order) => {
        const tieMatches = curMatches.filter((m) => m.match_order === order);
        const series = getKnockoutSeriesStatus(tieMatches);
        const nextOrder = Math.ceil(order / 2);
        const isTopSlot = order % 2 === 1;
        const nextWinnerId = series.isCompleted ? series.winnerId : null;

        const targetMatches = workingKo.filter(
          (m) =>
            m.round_number === nextRound &&
            m.match_order === nextOrder &&
            m.round_name !== 'Tercer puesto'
        );

        targetMatches.forEach((target) => {
          const fieldToSet =
            target.leg === 1
              ? isTopSlot
                ? 'participant_a_id'
                : 'participant_b_id'
              : isTopSlot
              ? 'participant_b_id'
              : 'participant_a_id';

          if (target[fieldToSet] !== nextWinnerId) {
            queuePatch(target, {
              [fieldToSet]: nextWinnerId,
              score_a: null,
              score_b: null,
              winner_id: null,
              is_draw: false,
              status: 'pending',
            });
          }
        });

        const isSemi = nextRound === lastKoRound;
        if (isSemi) {
          const thirdPlaceMatch = workingKo.find(
            (m) => m.round_name === 'Tercer puesto'
          );
          if (thirdPlaceMatch) {
            const loserId = series.isCompleted ? series.loserId : null;
            const fieldToSet = isTopSlot ? 'participant_a_id' : 'participant_b_id';
            if (thirdPlaceMatch[fieldToSet] !== loserId) {
              queuePatch(thirdPlaceMatch, {
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
  }

  return Array.from(updatesById.values());
}