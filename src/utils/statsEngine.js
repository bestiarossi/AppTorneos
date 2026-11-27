import { resolveParticipantAvatar } from './avatarUpload';
import { computeCustomGeneralStandings } from './customTournamentEngine';
import {
  computeKnockoutSummary,
  computeLastStandingStandings,
  computeLeagueStandings,
} from './tournamentEngine';
import { resolveMatchOutcome } from './tournamentStatsEngine';

function formatPts(value) {
  const num = Number(value) || 0;
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function getParticipantIdsForEntry(entry, membersByEntryId) {
  if (!entry) return [];
  const memberIds = membersByEntryId.get(entry.id);
  if (memberIds && memberIds.length > 0) return memberIds;
  return entry.participant_id ? [entry.participant_id] : [];
}

function buildChronologicalCustomMatches(
  matchdays = [],
  subtournaments = [],
  subMatches = []
) {
  const matchdayMap = new Map(matchdays.map((md) => [md.id, md]));
  const subMap = new Map(subtournaments.map((s) => [s.id, s]));

  return [...(subMatches || [])]
    .filter((m) => !m.is_bye && m.status === 'completed')
    .sort((a, b) => {
      const subA = subMap.get(a.subtournament_id);
      const subB = subMap.get(b.subtournament_id);
      const mdA = subA ? matchdayMap.get(subA.matchday_id)?.matchday_number ?? 0 : 0;
      const mdB = subB ? matchdayMap.get(subB.matchday_id)?.matchday_number ?? 0 : 0;
      if (mdA !== mdB) return mdA - mdB;

      const subCreatedA = String(subA?.created_at || '');
      const subCreatedB = String(subB?.created_at || '');
      if (subCreatedA !== subCreatedB) {
        return subCreatedA.localeCompare(subCreatedB);
      }

      if (a.round_number !== b.round_number) return a.round_number - b.round_number;
      if (a.match_order !== b.match_order) return a.match_order - b.match_order;
      if (a.leg !== b.leg) return a.leg - b.leg;
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
}

function buildChronologicalStandardMatches(matches = []) {
  return [...(matches || [])]
    .filter((m) => !m.is_bye && m.status === 'completed')
    .sort((a, b) => {
      if (a.round_number !== b.round_number) return a.round_number - b.round_number;
      if (a.match_order !== b.match_order) return a.match_order - b.match_order;
      if (a.leg !== b.leg) return a.leg - b.leg;
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
}

export function computeTournamentSummary({
  tournament,
  participants = [],
  matches = [],
  eliminations = [],
  customMatchdays = [],
  subtournaments = [],
  subEntries = [],
  subEntryMembers = [],
  subMatches = [],
}) {
  if (!tournament || participants.length === 0) {
    return {
      hasData: false,
      podium: [],
      mvp: null,
      woodenSpoon: null,
      biggestDaddy: null,
      drawKing: null,
      goalMachine: null,
      sieveDefense: null,
      unbeatenStreak: null,
      rollerCoaster: null,
      progressLabel: 'Sin actividad aún',
    };} else if (format === 'group_stage') {
    const gs = computeGroupStageStandings(tournament, participants, matches);
    if (gs.knockoutSummary.champion) {
      podium.push({
        place: 1,
        participant: gs.knockoutSummary.champion,
        metric: 'Campeón',
        subtext: 'Ganador de la llave final',
      });
    }
    if (gs.knockoutSummary.runnerUp) {
      podium.push({
        place: 2,
        participant: gs.knockoutSummary.runnerUp,
        metric: 'Subcampeón',
        subtext: 'Finalista',
      });
    }
    if (gs.knockoutSummary.thirdPlace) {
      podium.push({
        place: 3,
        participant: gs.knockoutSummary.thirdPlace,
        metric: '3.º Puesto',
        subtext: 'Ganador del 3.º puesto',
      });
    }
    const regularAll = matches.filter((m) => !m.is_bye);
    const doneAll = regularAll.filter((m) => m.status === 'completed');
    progressLabel = `${doneAll.length} de ${regularAll.length} partidos jugados (${gs.groups.length} grupos + eliminación)`;
  }

  const format = tournament.format;
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  const membersByEntryId = new Map();
  subEntryMembers.forEach((em) => {
    if (!membersByEntryId.has(em.entry_id)) {
      membersByEntryId.set(em.entry_id, []);
    }
    membersByEntryId.get(em.entry_id).push(em.participant_id);
  });

  const subMap = new Map(subtournaments.map((s) => [s.id, s]));
  const matchdayMap = new Map(customMatchdays.map((md) => [md.id, md]));
  const entryMap = new Map(subEntries.map((e) => [e.id, e]));

  const pStats = new Map();
  participants.forEach((p) => {
    pStats.set(p.id, {
      participant: p,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      pts: 0,
      gf: 0,
      gc: 0,
      scoredMatches: 0,
      margins: [],
      outcomes: [],
      bestUnbeatenStreak: 0,
      currentUnbeatenStreak: 0,
      subRanks: [],
    });
  });

  const pairClashes = new Map();

  function recordPairClash(idA, idB, outcomeForA, scoreA = null, scoreB = null) {
    if (!idA || !idB || idA === idB) return;
    const [first, second] = idA < idB ? [idA, idB] : [idB, idA];
    const key = `${first}|${second}`;
    if (!pairClashes.has(key)) {
      pairClashes.set(key, {
        id1: first,
        id2: second,
        wins1: 0,
        wins2: 0,
        draws: 0,
        goals1: 0,
        goals2: 0,
        hasScores: false,
      });
    }
    const rec = pairClashes.get(key);
    const aIsFirst = idA === first;

    if (scoreA !== null && scoreB !== null) {
      rec.hasScores = true;
      rec.goals1 += aIsFirst ? scoreA : scoreB;
      rec.goals2 += aIsFirst ? scoreB : scoreA;
    }

    if (outcomeForA === 'D') {
      rec.draws += 1;
    } else if (outcomeForA === 'W') {
      if (aIsFirst) rec.wins1 += 1;
      else rec.wins2 += 1;
    } else if (outcomeForA === 'L') {
      if (aIsFirst) rec.wins2 += 1;
      else rec.wins1 += 1;
    }
  }

  let completedMatchesTotal = 0;

  if (format === 'custom') {
    const orderedSubMatches = buildChronologicalCustomMatches(
      customMatchdays,
      subtournaments,
      subMatches
    );
    completedMatchesTotal = orderedSubMatches.length;

    orderedSubMatches.forEach((m) => {
      const adapted = {
        ...m,
        participant_a_id: m.entry_a_id,
        participant_b_id: m.entry_b_id,
        winner_id: m.winner_entry_id,
      };
      const outcome = resolveMatchOutcome(adapted);
      if (!outcome) return;

      const entryA = entryMap.get(m.entry_a_id);
      const entryB = entryMap.get(m.entry_b_id);
      const idsA = getParticipantIdsForEntry(entryA, membersByEntryId);
      const idsB = getParticipantIdsForEntry(entryB, membersByEntryId);

      const applySideStats = (ids, isWinner, isDraw, gfVal, gcVal) => {
        ids.forEach((pid) => {
          const st = pStats.get(pid);
          if (!st) return;
          st.pj += 1;
          if (isDraw) {
            st.pe += 1;
            st.pts += 1;
            st.outcomes.push('D');
          } else if (isWinner) {
            st.pg += 1;
            st.pts += 3;
            st.outcomes.push('W');
          } else {
            st.pp += 1;
            st.outcomes.push('L');
          }
          if (outcome.hasScores) {
            st.scoredMatches += 1;
            st.gf += gfVal;
            st.gc += gcVal;
            st.margins.push(gfVal - gcVal);
          }
        });
      };

      const aWon = !outcome.isDraw && outcome.winnerId === m.entry_a_id;
      const bWon = !outcome.isDraw && outcome.winnerId === m.entry_b_id;

      applySideStats(idsA, aWon, outcome.isDraw, outcome.scoreA ?? 0, outcome.scoreB ?? 0);
      applySideStats(idsB, bWon, outcome.isDraw, outcome.scoreB ?? 0, outcome.scoreA ?? 0);

      idsA.forEach((idA) => {
        idsB.forEach((idB) => {
          if (idA === idB) return;
          const outA = outcome.isDraw ? 'D' : aWon ? 'W' : 'L';
          recordPairClash(
            idA,
            idB,
            outA,
            outcome.hasScores ? outcome.scoreA : null,
            outcome.hasScores ? outcome.scoreB : null
          );
        });
      });
    });
  } else {
    const orderedStdMatches = buildChronologicalStandardMatches(matches);
    completedMatchesTotal = orderedStdMatches.length;

    orderedStdMatches.forEach((m) => {
      const outcome = resolveMatchOutcome(m);
      if (!outcome) return;

      const stA = pStats.get(m.participant_a_id);
      const stB = pStats.get(m.participant_b_id);
      if (!stA || !stB) return;

      const aWon = !outcome.isDraw && outcome.winnerId === m.participant_a_id;
      const bWon = !outcome.isDraw && outcome.winnerId === m.participant_b_id;

      stA.pj += 1;
      stB.pj += 1;

      if (outcome.isDraw) {
        stA.pe += 1;
        stB.pe += 1;
        stA.pts += 1;
        stB.pts += 1;
        stA.outcomes.push('D');
        stB.outcomes.push('D');
      } else if (aWon) {
        stA.pg += 1;
        stA.pts += 3;
        stB.pp += 1;
        stA.outcomes.push('W');
        stB.outcomes.push('L');
      } else if (bWon) {
        stB.pg += 1;
        stB.pts += 3;
        stA.pp += 1;
        stB.outcomes.push('W');
        stA.outcomes.push('L');
      }

      if (outcome.hasScores) {
        stA.scoredMatches += 1;
        stB.scoredMatches += 1;
        stA.gf += outcome.scoreA;
        stA.gc += outcome.scoreB;
        stB.gf += outcome.scoreB;
        stB.gc += outcome.scoreA;
        stA.margins.push(outcome.scoreA - outcome.scoreB);
        stB.margins.push(outcome.scoreB - outcome.scoreA);
      }

      const outA = outcome.isDraw ? 'D' : aWon ? 'W' : 'L';
      recordPairClash(
        m.participant_a_id,
        m.participant_b_id,
        outA,
        outcome.hasScores ? outcome.scoreA : null,
        outcome.hasScores ? outcome.scoreB : null
      );
    });
  }

  pStats.forEach((st) => {
    let run = 0;
    let best = 0;
    st.outcomes.forEach((out) => {
      if (out === 'W' || out === 'D') {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    });
    st.bestUnbeatenStreak = best;
    st.currentUnbeatenStreak = run;
  });

  const allStatsList = Array.from(pStats.values());

  let podium = [];
  let progressLabel = '';

  if (format === 'custom') {
    const completedSubs = subtournaments.filter((s) => s.status === 'completed');
    const generalRows = computeCustomGeneralStandings(
      participants,
      customMatchdays,
      subtournaments,
      subEntries,
      subEntryMembers
    );

    if (completedSubs.length > 0) {
      podium = generalRows
        .filter((r) => r.totalPoints > 0 || completedSubs.length > 0)
        .slice(0, 3)
        .map((r, idx) => ({
          place: idx + 1,
          participant: r.participant,
          metric: `${formatPts(r.totalPoints)} pts`,
          subtext: `${r.firstPlaces} ${r.firstPlaces === 1 ? 'título' : 'títulos'} · ${r.podiums} podios`,
        }));
    }

    progressLabel = `${completedSubs.length} de ${subtournaments.length} subtorneos finalizados`;
  } else if (format === 'league') {
    const rows = computeLeagueStandings(participants, matches);
    const playedAny = rows.some((r) => r.pj > 0);
    if (playedAny) {
      podium = rows.slice(0, 3).map((r, idx) => ({
        place: idx + 1,
        participant: r.participant,
        metric: `${r.pts} pts`,
        subtext: `${r.pg}G ${r.pe}E ${r.pp}P · DG ${r.dg > 0 ? `+${r.dg}` : r.dg}`,
      }));
    }
    const nonBye = matches.filter((m) => !m.is_bye);
    const done = nonBye.filter((m) => m.status === 'completed');
    progressLabel = `${done.length} de ${nonBye.length} partidos completados`;
  } else if (format === 'knockout') {
    const summary = computeKnockoutSummary(participants, matches);
    if (summary.champion) {
      podium.push({
        place: 1,
        participant: summary.champion,
        metric: 'Campeón',
        subtext: 'Ganador de la llave final',
      });
    }
    if (summary.runnerUp) {
      podium.push({
        place: 2,
        participant: summary.runnerUp,
        metric: 'Subcampeón',
        subtext: 'Finalista',
      });
    }
    if (summary.thirdPlace) {
      podium.push({
        place: 3,
        participant: summary.thirdPlace,
        metric: '3.º Puesto',
        subtext: 'Ganador del 3.º puesto',
      });
    }
    progressLabel = `${summary.completedTies} de ${summary.totalTies} llaves definidas`;
  } else if (format === 'last_standing') {
    const ls = computeLastStandingStandings(participants, eliminations);
    if (ls.champion) {
      podium.push({
        place: 1,
        participant: ls.champion,
        metric: 'Campeón',
        subtext: 'Último superviviente en pie',
      });
      const revElims = [...ls.eliminated];
      if (revElims[0]) {
        podium.push({
          place: 2,
          participant: revElims[0],
          metric: '2.º Puesto',
          subtext: 'Cayó en el mano a mano final',
        });
      }
      if (revElims[1]) {
        podium.push({
          place: 3,
          participant: revElims[1],
          metric: '3.º Puesto',
          subtext: 'Top 3 de resistencia',
        });
      }
    }
    progressLabel = `${ls.stillStanding.length} en pie de ${participants.length} jugadores`;
  }

  let mvp = null;
  let woodenSpoon = null;
  let rollerCoaster = null;

  if (format === 'custom') {
    const completedSubs = subtournaments.filter((s) => s.status === 'completed');
    const completedSubMap = new Map(completedSubs.map((s) => [s.id, s]));

    const entryCountBySub = new Map();
    subEntries.forEach((e) => {
      entryCountBySub.set(
        e.subtournament_id,
        (entryCountBySub.get(e.subtournament_id) || 0) + 1
      );
    });

    const singleSubPerformances = [];

    subEntries.forEach((entry) => {
      const sub = completedSubMap.get(entry.subtournament_id);
      if (!sub) return;
      const md = matchdayMap.get(sub.matchday_id);
      const totalInSub = entryCountBySub.get(sub.id) || 1;
      const pts = Number(entry.points_awarded || 0);
      const rank = entry.final_rank ?? null;
      const memberIds = getParticipantIdsForEntry(entry, membersByEntryId);

      memberIds.forEach((pid) => {
        const participant = participantMap.get(pid);
        if (!participant) return;

        if (rank !== null) {
          const st = pStats.get(pid);
          if (st) {
            st.subRanks.push({
              subName: sub.name,
              matchdayName: md?.name || 'Jornada',
              rank,
              totalInSub,
              points: pts,
            });
          }
        }

        singleSubPerformances.push({
          participant,
          subName: sub.name,
          matchdayName: md?.name || 'Jornada',
          points: pts,
          rank,
          totalInSub,
          entryName: entry.entry_name,
          isTeamBased: Boolean(sub.config?.is_team_based),
        });
      });
    });

    if (singleSubPerformances.length > 0) {
      const bestPerf = [...singleSubPerformances].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const rA = a.rank ?? 999;
        const rB = b.rank ?? 999;
        if (rA !== rB) return rA - rB;
        return b.totalInSub - a.totalInSub;
      })[0];

      if (bestPerf && (bestPerf.points > 0 || bestPerf.rank === 1)) {
        mvp = {
          participant: bestPerf.participant,
          headline: `${formatPts(bestPerf.points)} pts en "${bestPerf.subName}"`,
          detail: `${bestPerf.matchdayName} · ${
            bestPerf.rank ? `${bestPerf.rank}.º puesto de ${bestPerf.totalInSub}` : 'Subtorneo finalizado'
          }${bestPerf.isTeamBased ? ` (${bestPerf.entryName})` : ''}`,
        };
      }

      const worstPerf = [...singleSubPerformances].sort((a, b) => {
        if (a.points !== b.points) return a.points - b.points;
        const relA = a.rank ? a.rank / a.totalInSub : 0;
        const relB = b.rank ? b.rank / b.totalInSub : 0;
        if (relB !== relA) return relB - relA;
        return (b.rank ?? 0) - (a.rank ?? 0);
      })[0];

      if (worstPerf && singleSubPerformances.length > 1) {
        woodenSpoon = {
          participant: worstPerf.participant,
          headline: `${
            worstPerf.rank
              ? `${worstPerf.rank}.º de ${worstPerf.totalInSub}`
              : `${formatPts(worstPerf.points)} pts`
          } en "${worstPerf.subName}"`,
          detail: `${formatPts(worstPerf.points)} pts · ¡Alguien tenía que cuidar la tabla desde abajo!`,
        };
      }
    }

    if (!mvp) {
      const activePlayer = [...allStatsList]
        .filter((s) => s.pj > 0)
        .sort((a, b) => {
          const effA = a.pts / (a.pj * 3);
          const effB = b.pts / (b.pj * 3);
          if (effB !== effA) return effB - effA;
          return b.pts - a.pts;
        })[0];

      if (activePlayer) {
        const effPct = Math.round((activePlayer.pts / (activePlayer.pj * 3)) * 100);
        mvp = {
          participant: activePlayer.participant,
          headline: `${effPct}% de efectividad`,
          detail: `${activePlayer.pg}G-${activePlayer.pe}E-${activePlayer.pp}P en cruces internos`,
        };
      }
    }

    const irregularCandidates = allStatsList
      .filter((st) => st.subRanks.length >= 2)
      .map((st) => {
        const ranks = st.subRanks.map((r) => r.rank);
        const mean = ranks.reduce((acc, r) => acc + r, 0) / ranks.length;
        const variance =
          ranks.reduce((acc, r) => acc + (r - mean) ** 2, 0) / ranks.length;
        const minRank = Math.min(...ranks);
        const maxRank = Math.max(...ranks);
        return {
          participant: st.participant,
          variance,
          spread: maxRank - minRank,
          minRank,
          maxRank,
          count: ranks.length,
        };
      })
      .filter((c) => c.spread > 0 && c.variance > 0)
      .sort((a, b) => {
        if (b.variance !== a.variance) return b.variance - a.variance;
        if (b.spread !== a.spread) return b.spread - a.spread;
        return b.count - a.count;
      });

    if (irregularCandidates.length > 0) {
      const rc = irregularCandidates[0];
      rollerCoaster = {
        participant: rc.participant,
        headline: `Del ${rc.minRank}.º al ${rc.maxRank}.º puesto`,
        detail: `Varianza ${rc.variance.toFixed(1)} en ${rc.count} subtorneos · ¡Impredecible!`,
      };
    }
  } else if (format === 'last_standing') {
    const ls = computeLastStandingStandings(participants, eliminations);
    if (ls.champion) {
      mvp = {
        participant: ls.champion,
        headline: 'Superviviente absoluto',
        detail: 'Ganó el mano a mano definitivo sin caer nunca',
      };
    }
    const sortedElims = [...(eliminations || [])].sort(
      (a, b) => a.elimination_order - b.elimination_order
    );
    if (sortedElims[0]) {
      const firstOut = participantMap.get(sortedElims[0].participant_id);
      if (firstOut) {
        woodenSpoon = {
          participant: firstOut,
          headline: 'Primer eliminado (#1)',
          detail: 'Apenas alcanzó a acomodarse en la silla y ya quedó afuera',
        };
      }
    }
  } else {
    const playersPlayed = allStatsList.filter((s) => s.pj > 0);
    if (playersPlayed.length > 0) {
      const best = [...playersPlayed].sort((a, b) => {
        const effA = a.pts / (a.pj * 3);
        const effB = b.pts / (b.pj * 3);
        if (effB !== effA) return effB - effA;
        if (b.pts !== a.pts) return b.pts - a.pts;
        return (b.gf - b.gc) - (a.gf - a.gc);
      })[0];

      const bestEff = Math.round((best.pts / (best.pj * 3)) * 100);
      mvp = {
        participant: best.participant,
        headline: `${bestEff}% de efectividad`,
        detail: `${best.pg}G-${best.pe}E-${best.pp}P · ${best.pts} pts acumulados`,
      };

      if (playersPlayed.length > 1) {
        const worst = [...playersPlayed].sort((a, b) => {
          const effA = a.pts / (a.pj * 3);
          const effB = b.pts / (b.pj * 3);
          if (effA !== effB) return effA - effB;
          if (a.pts !== b.pts) return a.pts - b.pts;
          return (a.gf - a.gc) - (b.gf - b.gc);
        })[0];

        if (worst.participant.id !== best.participant.id) {
          const worstEff = Math.round((worst.pts / (worst.pj * 3)) * 100);
          woodenSpoon = {
            participant: worst.participant,
            headline: `${worstEff}% de efectividad (${worst.pts} pts)`,
            detail: `${worst.pg}G-${worst.pe}E-${worst.pp}P · ¡La próxima remontamos!`,
          };
        }
      }

      const marginSwings = playersPlayed
        .filter((s) => s.margins.length >= 2)
        .map((s) => {
          const mean =
            s.margins.reduce((acc, m) => acc + m, 0) / s.margins.length;
          const variance =
            s.margins.reduce((acc, m) => acc + (m - mean) ** 2, 0) /
            s.margins.length;
          const minM = Math.min(...s.margins);
          const maxM = Math.max(...s.margins);
          return {
            participant: s.participant,
            variance,
            spread: maxM - minM,
            minM,
            maxM,
          };
        })
        .filter((c) => c.spread > 0 && c.variance > 0)
        .sort((a, b) => b.variance - a.variance);

      if (marginSwings.length > 0) {
        const rc = marginSwings[0];
        rollerCoaster = {
          participant: rc.participant,
          headline: `De ${rc.maxM > 0 ? `+${rc.maxM}` : rc.maxM} a ${
            rc.minM > 0 ? `+${rc.minM}` : rc.minM
          } de diferencia`,
          detail: 'Un día golea, al otro sufre · Montaña rusa emocional',
        };
      }
    }
  }

  let biggestDaddy = null;
  const clashCandidates = Array.from(pairClashes.values())
    .map((c) => {
      const diff = Math.abs(c.wins1 - c.wins2);
      const firstIsParent = c.wins1 > c.wins2;
      const parentId = firstIsParent ? c.id1 : c.id2;
      const childId = firstIsParent ? c.id2 : c.id1;
      const winsParent = firstIsParent ? c.wins1 : c.wins2;
      const winsChild = firstIsParent ? c.wins2 : c.wins1;
      return {
        parent: participantMap.get(parentId) || null,
        child: participantMap.get(childId) || null,
        winsParent,
        winsChild,
        draws: c.draws,
        diff,
        total: winsParent + winsChild + c.draws,
        source: 'matches',
      };
    })
    .filter((item) => item.parent && item.child && item.diff >= 1)
    .sort((a, b) => {
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.winsParent !== a.winsParent) return b.winsParent - a.winsParent;
      return b.total - a.total;
    });

  if (clashCandidates.length > 0) {
    const top = clashCandidates[0];
    biggestDaddy = {
      ...top,
      headline: `${top.parent.name} es papá de ${top.child.name}: ${top.winsParent} a ${top.winsChild}`,
      detail: `Historial ${top.winsParent}G - ${top.draws}E - ${top.winsChild}P (${top.total} cruces)`,
    };
  } else if (format === 'custom') {
    const completedSubs = subtournaments.filter((s) => s.status === 'completed');
    const rankCompMap = new Map();
    const entriesBySub = new Map();
    subEntries.forEach((e) => {
      if (!entriesBySub.has(e.subtournament_id)) {
        entriesBySub.set(e.subtournament_id, []);
      }
      entriesBySub.get(e.subtournament_id).push(e);
    });

    completedSubs.forEach((sub) => {
      const list = entriesBySub.get(sub.id) || [];
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const eA = list[i];
          const eB = list[j];
          if (eA.final_rank === null || eB.final_rank === null) continue;
          const idsA = getParticipantIdsForEntry(eA, membersByEntryId);
          const idsB = getParticipantIdsForEntry(eB, membersByEntryId);
          idsA.forEach((pA) => {
            idsB.forEach((pB) => {
              if (pA === pB) return;
              const [first, second] = pA < pB ? [pA, pB] : [pB, pA];
              const key = `${first}|${second}`;
              if (!rankCompMap.has(key)) {
                rankCompMap.set(key, { id1: first, id2: second, ahead1: 0, ahead2: 0 });
              }
              const rec = rankCompMap.get(key);
              const aIsFirst = pA === first;
              if (eA.final_rank < eB.final_rank) {
                if (aIsFirst) rec.ahead1 += 1;
                else rec.ahead2 += 1;
              } else if (eB.final_rank < eA.final_rank) {
                if (aIsFirst) rec.ahead2 += 1;
                else rec.ahead1 += 1;
              }
            });
          });
        }
      }
    });

    const rankDaddy = Array.from(rankCompMap.values())
      .map((c) => {
        const diff = Math.abs(c.ahead1 - c.ahead2);
        const firstIsParent = c.ahead1 > c.ahead2;
        return {
          parent: participantMap.get(firstIsParent ? c.id1 : c.id2),
          child: participantMap.get(firstIsParent ? c.id2 : c.id1),
          winsParent: firstIsParent ? c.ahead1 : c.ahead2,
          winsChild: firstIsParent ? c.ahead2 : c.ahead1,
          draws: 0,
          diff,
          source: 'ranks',
        };
      })
      .filter((x) => x.parent && x.child && x.diff >= 2)
      .sort((a, b) => b.diff - a.diff)[0];

    if (rankDaddy) {
      biggestDaddy = {
        ...rankDaddy,
        headline: `${rankDaddy.parent.name} supera a ${rankDaddy.child.name}: ${rankDaddy.winsParent} a ${rankDaddy.winsChild}`,
        detail: 'Veces mejor ubicado en subtorneos compartidos',
      };
    }
  }

  const drawCandidates = allStatsList
    .filter((s) => s.pe > 0 && s.pj > 0)
    .map((s) => ({
      ...s,
      drawPct: Math.round((s.pe / s.pj) * 100),
    }))
    .sort((a, b) => {
      if (b.pe !== a.pe) return b.pe - a.pe;
      if (b.drawPct !== a.drawPct) return b.drawPct - a.drawPct;
      return a.pj - b.pj;
    });

  const drawKing = drawCandidates[0]
    ? {
        participant: drawCandidates[0].participant,
        headline: `${drawCandidates[0].pe} ${
          drawCandidates[0].pe === 1 ? 'empate' : 'empates'
        } (${drawCandidates[0].drawPct}%)`,
        detail: `No pierde ni gana: abonado al reparto en ${drawCandidates[0].pj} partidos`,
      }
    : null;

  const scoredPlayers = allStatsList.filter((s) => s.scoredMatches > 0);
  let goalMachine = null;
  let sieveDefense = null;

  if (scoredPlayers.length > 0) {
    const topAttack = [...scoredPlayers]
      .filter((s) => s.gf > 0)
      .sort((a, b) => {
        if (b.gf !== a.gf) return b.gf - a.gf;
        return b.gf / b.scoredMatches - a.gf / a.scoredMatches;
      })[0];

    if (topAttack) {
      const avg = (topAttack.gf / topAttack.scoredMatches).toFixed(2);
      goalMachine = {
        participant: topAttack.participant,
        headline: `${topAttack.gf} goles a favor`,
        detail: `Promedio de ${avg} por partido en ${topAttack.scoredMatches} jugados`,
      };
    }

    const worstDefense = [...scoredPlayers]
      .filter((s) => s.gc > 0)
      .sort((a, b) => {
        if (b.gc !== a.gc) return b.gc - a.gc;
        return b.gc / b.scoredMatches - a.gc / a.scoredMatches;
      })[0];

    if (worstDefense) {
      const avg = (worstDefense.gc / worstDefense.scoredMatches).toFixed(2);
      sieveDefense = {
        participant: worstDefense.participant,
        headline: `${worstDefense.gc} goles recibidos`,
        detail: `${avg} en contra por partido · ¡Hay que cerrar el arco!`,
      };
    }
  }

  const streakLeader = [...allStatsList]
    .filter((s) => s.bestUnbeatenStreak > 0)
    .sort((a, b) => {
      if (b.bestUnbeatenStreak !== a.bestUnbeatenStreak) {
        return b.bestUnbeatenStreak - a.bestUnbeatenStreak;
      }
      return b.pg - a.pg;
    })[0];

  const unbeatenStreak = streakLeader
    ? {
        participant: streakLeader.participant,
        headline: `${streakLeader.bestUnbeatenStreak} ${
          streakLeader.bestUnbeatenStreak === 1
            ? 'partido invicto'
            : 'partidos seguidos sin perder'
        }`,
        detail:
          streakLeader.currentUnbeatenStreak === streakLeader.bestUnbeatenStreak &&
          streakLeader.currentUnbeatenStreak > 0
            ? '¡Racha activa todavía en juego!'
            : `Cerró con ${streakLeader.pg}G y ${streakLeader.pe}E`,
      }
    : null;

  const hasData =
    completedMatchesTotal > 0 ||
    podium.length > 0 ||
    Boolean(mvp) ||
    Boolean(woodenSpoon) ||
    (eliminations && eliminations.length > 0);

  return {
    hasData,
    progressLabel,
    podium,
    mvp,
    woodenSpoon,
    biggestDaddy,
    drawKing,
    goalMachine,
    sieveDefense,
    unbeatenStreak,
    rollerCoaster,
  };
}

export function computeQuickH2H({
  tournament,
  participantMap,
  playerAId,
  playerBId,
  matches = [],
  customMatchdays = [],
  subtournaments = [],
  subEntries = [],
  subEntryMembers = [],
  subMatches = [],
}) {
  if (!playerAId || !playerBId || playerAId === playerBId) return null;
  const playerA = participantMap.get(playerAId) || null;
  const playerB = participantMap.get(playerBId) || null;
  if (!playerA || !playerB) return null;

  const membersByEntryId = new Map();
  subEntryMembers.forEach((em) => {
    if (!membersByEntryId.has(em.entry_id)) {
      membersByEntryId.set(em.entry_id, []);
    }
    membersByEntryId.get(em.entry_id).push(em.participant_id);
  });

  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let goalsA = 0;
  let goalsB = 0;
  let hasScores = false;
  const recentClashes = [];

  if (tournament?.format === 'custom') {
    const entryMap = new Map(subEntries.map((e) => [e.id, e]));
    const subMap = new Map(subtournaments.map((s) => [s.id, s]));
    const ordered = buildChronologicalCustomMatches(
      customMatchdays,
      subtournaments,
      subMatches
    );

    ordered.forEach((m) => {
      const entryA = entryMap.get(m.entry_a_id);
      const entryB = entryMap.get(m.entry_b_id);
      const idsA = getParticipantIdsForEntry(entryA, membersByEntryId);
      const idsB = getParticipantIdsForEntry(entryB, membersByEntryId);

      const aInSideA = idsA.includes(playerAId);
      const aInSideB = idsB.includes(playerAId);
      const bInSideA = idsA.includes(playerBId);
      const bInSideB = idsB.includes(playerBId);

      const areOpponents =
        (aInSideA && bInSideB) || (aInSideB && bInSideA);
      if (!areOpponents) return;

      const adapted = {
        ...m,
        participant_a_id: m.entry_a_id,
        participant_b_id: m.entry_b_id,
        winner_id: m.winner_entry_id,
      };
      const outcome = resolveMatchOutcome(adapted);
      if (!outcome) return;

      const sA = outcome.hasScores
        ? aInSideA
          ? outcome.scoreA
          : outcome.scoreB
        : null;
      const sB = outcome.hasScores
        ? aInSideA
          ? outcome.scoreB
          : outcome.scoreA
        : null;

      if (outcome.hasScores) {
        hasScores = true;
        goalsA += sA;
        goalsB += sB;
      }

      let winnerSide = 'draw';
      if (outcome.isDraw) {
        draws += 1;
      } else {
        const playerASideEntryId = aInSideA ? m.entry_a_id : m.entry_b_id;
        if (outcome.winnerId === playerASideEntryId) {
          winsA += 1;
          winnerSide = 'A';
        } else {
          winsB += 1;
          winnerSide = 'B';
        }
      }

      recentClashes.push({
        id: m.id,
        label: `${subMap.get(m.subtournament_id)?.name || 'Subtorneo'} · ${m.round_name}`,
        scoreA: sA,
        scoreB: sB,
        hasScores: outcome.hasScores,
        winnerSide,
      });
    });
  } else {
    const ordered = buildChronologicalStandardMatches(matches);
    ordered.forEach((m) => {
      const isDirect =
        (m.participant_a_id === playerAId && m.participant_b_id === playerBId) ||
        (m.participant_a_id === playerBId && m.participant_b_id === playerAId);
      if (!isDirect) return;

      const outcome = resolveMatchOutcome(m);
      if (!outcome) return;

      const aIsHome = m.participant_a_id === playerAId;
      const sA = outcome.hasScores
        ? aIsHome
          ? outcome.scoreA
          : outcome.scoreB
        : null;
      const sB = outcome.hasScores
        ? aIsHome
          ? outcome.scoreB
          : outcome.scoreA
        : null;

      if (outcome.hasScores) {
        hasScores = true;
        goalsA += sA;
        goalsB += sB;
      }

      let winnerSide = 'draw';
      if (outcome.isDraw) {
        draws += 1;
      } else if (outcome.winnerId === playerAId) {
        winsA += 1;
        winnerSide = 'A';
      } else {
        winsB += 1;
        winnerSide = 'B';
      }

      recentClashes.push({
        id: m.id,
        label: m.round_name,
        scoreA: sA,
        scoreB: sB,
        hasScores: outcome.hasScores,
        winnerSide,
      });
    });
  }

  return {
    playerA,
    playerB,
    avatarA: resolveParticipantAvatar(playerA),
    avatarB: resolveParticipantAvatar(playerB),
    totalPlayed: recentClashes.length,
    winsA,
    winsB,
    draws,
    goalsA,
    goalsB,
    hasScores,
    recentClashes: recentClashes.slice(-6).reverse(),
  };
}

export function buildTournamentSummaryWhatsAppText(tournament, summary) {
  if (!tournament || !summary) return '';

  const lines = [
    `🏆 *RESUMEN: ${tournament.name}*`,
    summary.progressLabel ? `📊 _${summary.progressLabel}_` : null,
    '',
  ].filter((x) => x !== null);

  if (summary.podium?.length > 0) {
    lines.push('🏅 *PODIO ACTUAL*');
    summary.podium.forEach((p) => {
      const medal = p.place === 1 ? '🥇' : p.place === 2 ? '🥈' : '🥉';
      lines.push(`${medal} *${p.participant.name}* — ${p.metric}`);
    });
    lines.push('');
  }

  const awards = [];
  if (summary.mvp) {
    awards.push(`⭐ *MVP:* ${summary.mvp.participant.name} (${summary.mvp.headline})`);
  }
  if (summary.woodenSpoon) {
    awards.push(
      `🥄 *Cuchara de Madera:* ${summary.woodenSpoon.participant.name} (${summary.woodenSpoon.headline})`
    );
  }
  if (summary.biggestDaddy) {
    awards.push(`👶 *Mayor Paternidad:* ${summary.biggestDaddy.headline}`);
  }
  if (summary.drawKing) {
    awards.push(
      `🤝 *Abonado al Empate:* ${summary.drawKing.participant.name} (${summary.drawKing.headline})`
    );
  }
  if (summary.goalMachine) {
    awards.push(
      `⚽ *Máquina de Goles:* ${summary.goalMachine.participant.name} (${summary.goalMachine.headline})`
    );
  }
  if (summary.sieveDefense) {
    awards.push(
      `🥅 *El Colador:* ${summary.sieveDefense.participant.name} (${summary.sieveDefense.headline})`
    );
  }
  if (summary.unbeatenStreak) {
    awards.push(
      `🛡️ *Racha Imbatible:* ${summary.unbeatenStreak.participant.name} (${summary.unbeatenStreak.headline})`
    );
  }
  if (summary.rollerCoaster) {
    awards.push(
      `🎢 *Montaña Rusa:* ${summary.rollerCoaster.participant.name} (${summary.rollerCoaster.headline})`
    );
  }

  if (awards.length > 0) {
    lines.push('🎭 *PREMIOS Y CURIOSIDADES*');
    lines.push(...awards);
  }

  return lines.join('\n').trim();
}