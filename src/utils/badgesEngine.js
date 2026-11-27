import { computeCustomGeneralStandings } from './customTournamentEngine';
import { computeProdeLeaderboard } from './predictionsEngine';
import { computeTournamentSummary } from './statsEngine';
import {
  computeGroupStageStandings,
  computeKnockoutSummary,
  computeLastStandingStandings,
  computeLeagueStandings,
} from './tournamentEngine';

/**
 * Calcula las insignias en vivo de cada participante dentro del torneo.
 * Retorna Map<participantId, Badge[]>
 */
export function computeTournamentBadges({
  tournament,
  participants = [],
  matches = [],
  eliminations = [],
  customMatchdays = [],
  subtournaments = [],
  subEntries = [],
  subEntryMembers = [],
  subMatches = [],
  prodePolls = [],
  prodeVotes = [],
}) {
  const badgesMap = new Map();
  if (!tournament || participants.length === 0) return badgesMap;

  const participantMap = new Map(participants.map((p) => [p.id, p]));

  function addBadge(participantId, badge) {
    if (!participantId) return;
    if (!badgesMap.has(participantId)) {
      badgesMap.set(participantId, []);
    }
    const list = badgesMap.get(participantId);
    if (!list.some((b) => b.id === badge.id)) {
      list.push(badge);
    }
  }

  // 1. Líder / Campeón del torneo
  let leaderId = null;
  let isChampion = false;

  if (tournament.format === 'custom') {
    const completed = subtournaments.filter((s) => s.status === 'completed');
    if (completed.length > 0) {
      const rows = computeCustomGeneralStandings(
        participants,
        customMatchdays,
        subtournaments,
        subEntries,
        subEntryMembers
      );
      if (rows[0]?.totalPoints > 0) {
        leaderId = rows[0].participant.id;
        isChampion =
          subtournaments.length > 0 &&
          completed.length === subtournaments.length;
      }
    }
  } else if (tournament.format === 'league') {
    const rows = computeLeagueStandings(participants, matches);
    if (rows.some((r) => r.pj > 0) && rows[0]) {
      leaderId = rows[0].participant.id;
      const nonBye = matches.filter((m) => !m.is_bye);
      isChampion =
        nonBye.length > 0 && nonBye.every((m) => m.status === 'completed');
    }
  } else if (tournament.format === 'knockout') {
    const ko = computeKnockoutSummary(participants, matches);
    if (ko.champion) {
      leaderId = ko.champion.id;
      isChampion = true;
    }
  } else if (tournament.format === 'group_stage') {
    const gs = computeGroupStageStandings(tournament, participants, matches);
    if (gs.knockoutSummary.champion) {
      leaderId = gs.knockoutSummary.champion.id;
      isChampion = true;
    }
  } else if (tournament.format === 'last_standing') {
    const ls = computeLastStandingStandings(participants, eliminations);
    if (ls.champion) {
      leaderId = ls.champion.id;
      isChampion = true;
    }
  }

  if (leaderId) {
    addBadge(leaderId, {
      id: 'leader',
      emoji: '👑',
      label: isChampion ? 'Campeón' : 'Líder',
      tooltip: isChampion ? 'Campeón del torneo' : 'Líder actual del torneo',
      className:
        'border-amber-300/80 bg-amber-100/90 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-200',
    });
  }

  // 2. Rey del Prode
  if (prodePolls.length > 0 && prodeVotes.length > 0) {
    const prodeRows = computeProdeLeaderboard({
      participants,
      polls: prodePolls,
      votes: prodeVotes,
      matches,
      subMatches,
      subtournaments,
      subEntries,
      participantMap,
      subEntryMembers,
    });
    if (prodeRows[0]?.points > 0) {
      addBadge(prodeRows[0].participant.id, {
        id: 'prode_king',
        emoji: '🎯',
        label: 'Rey Prode',
        tooltip: `Líder del Prode (${prodeRows[0].points} pts)`,
        className:
          'border-violet-300/80 bg-violet-100/90 text-violet-900 dark:border-violet-500/40 dark:bg-violet-500/20 dark:text-violet-200',
      });
    }
  }

  // 3. Premios del motor de resumen (Racha, Goles, Paternidad, Cuchara)
  const summary = computeTournamentSummary({
    tournament,
    participants,
    matches,
    eliminations,
    customMatchdays,
    subtournaments,
    subEntries,
    subEntryMembers,
    subMatches,
  });

  if (summary.unbeatenStreak?.participant?.id) {
    addBadge(summary.unbeatenStreak.participant.id, {
      id: 'streak',
      emoji: '🔥',
      label: 'Racha',
      tooltip: summary.unbeatenStreak.headline,
      className:
        'border-orange-300/80 bg-orange-100/90 text-orange-900 dark:border-orange-500/40 dark:bg-orange-500/20 dark:text-orange-200',
    });
  }

  if (summary.goalMachine?.participant?.id) {
    addBadge(summary.goalMachine.participant.id, {
      id: 'goal_machine',
      emoji: '⚡',
      label: 'Goleador',
      tooltip: summary.goalMachine.headline,
      className:
        'border-emerald-300/80 bg-emerald-100/90 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-200',
    });
  }

  if (summary.biggestDaddy?.parent?.id && summary.biggestDaddy.diff >= 2) {
    addBadge(summary.biggestDaddy.parent.id, {
      id: 'daddy',
      emoji: '🕶️',
      label: 'Papá',
      tooltip: summary.biggestDaddy.headline,
      className:
        'border-sky-300/80 bg-sky-100/90 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/20 dark:text-sky-200',
    });
  }

  if (summary.woodenSpoon?.participant?.id) {
    addBadge(summary.woodenSpoon.participant.id, {
      id: 'spoon',
      emoji: '🥄',
      label: 'Cuchara',
      tooltip: `Cuchara de Madera: ${summary.woodenSpoon.headline}`,
      className:
        'border-rose-300/80 bg-rose-100/90 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/20 dark:text-rose-200',
    });
  }

  return badgesMap;
}