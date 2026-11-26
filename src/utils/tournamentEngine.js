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