import { resolveMatchOutcome } from './tournamentStatsEngine';

const INITIAL_ELO = 1200;
const K_FACTOR = 32;

export const ELO_TIERS = {
  diamond: {
    id: 'diamond',
    label: 'Diamante',
    emoji: '💎',
    badgeClass:
      'border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-500/35 dark:bg-cyan-500/15 dark:text-cyan-200',
  },
  gold: {
    id: 'gold',
    label: 'Oro',
    emoji: '🥇',
    badgeClass:
      'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-200',
  },
  silver: {
    id: 'silver',
    label: 'Plata',
    emoji: '🥈',
    badgeClass:
      'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
  },
  bronze: {
    id: 'bronze',
    label: 'Bronce',
    emoji: '🥉',
    badgeClass:
      'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-500/35 dark:bg-orange-500/15 dark:text-orange-200',
  },
};

export function getEloTier(elo = INITIAL_ELO) {
  if (elo >= 1350) return ELO_TIERS.diamond;
  if (elo >= 1250) return ELO_TIERS.gold;
  if (elo >= 1150) return ELO_TIERS.silver;
  return ELO_TIERS.bronze;
}

function calculateExpectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

function sortChronologicalMatches(matches = []) {
  return [...matches]
    .filter((m) => !m.is_bye && m.status === 'completed')
    .sort((a, b) => {
      if (a.round_number !== b.round_number) {
        return a.round_number - b.round_number;
      }
      if (a.match_order !== b.match_order) {
        return a.match_order - b.match_order;
      }
      if ((a.leg || 1) !== (b.leg || 1)) {
        return (a.leg || 1) - (b.leg || 1);
      }
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
}

/**
 * Calcula el Elo de cada participante recalculando cronológicamente todos los enfrentamientos.
 */
export function computeTournamentElo({
  tournament,
  participants = [],
  matches = [],
  customMatchdays = [],
  subtournaments = [],
  subEntries = [],
  subEntryMembers = [],
  subMatches = [],
}) {
  const eloState = new Map();

  participants.forEach((p) => {
    eloState.set(p.id, {
      participant: p,
      currentElo: INITIAL_ELO,
      peakElo: INITIAL_ELO,
      lowestElo: INITIAL_ELO,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      lastDelta: 0,
    });
  });

  const isCustom = tournament?.format === 'custom';

  if (isCustom) {
    const entryMap = new Map(subEntries.map((e) => [e.id, e]));
    const membersByEntry = new Map();
    subEntryMembers.forEach((em) => {
      if (!membersByEntry.has(em.entry_id)) membersByEntry.set(em.entry_id, []);
      membersByEntry.get(em.entry_id).push(em.participant_id);
    });

    const orderedSubMatches = sortChronologicalMatches(subMatches);

    orderedSubMatches.forEach((sm) => {
      const entryA = entryMap.get(sm.entry_a_id);
      const entryB = entryMap.get(sm.entry_b_id);
      if (!entryA || !entryB) return;

      const idsA =
        membersByEntry.get(entryA.id) ||
        (entryA.participant_id ? [entryA.participant_id] : []);
      const idsB =
        membersByEntry.get(entryB.id) ||
        (entryB.participant_id ? [entryB.participant_id] : []);

      if (idsA.length === 0 || idsB.length === 0) return;

      const adapted = {
        ...sm,
        participant_a_id: sm.entry_a_id,
        participant_b_id: sm.entry_b_id,
        winner_id: sm.winner_entry_id,
      };
      const outcome = resolveMatchOutcome(adapted);
      if (!outcome) return;

      const avgEloA =
        idsA.reduce((sum, id) => sum + (eloState.get(id)?.currentElo || INITIAL_ELO), 0) /
        idsA.length;
      const avgEloB =
        idsB.reduce((sum, id) => sum + (eloState.get(id)?.currentElo || INITIAL_ELO), 0) /
        idsB.length;

      const expectedA = calculateExpectedScore(avgEloA, avgEloB);
      const expectedB = 1 - expectedA;

      let actualA = 0.5;
      let actualB = 0.5;
      if (!outcome.isDraw) {
        if (outcome.winnerId === sm.entry_a_id) {
          actualA = 1;
          actualB = 0;
        } else {
          actualA = 0;
          actualB = 1;
        }
      }

      const deltaA = Math.round(K_FACTOR * (actualA - expectedA));
      const deltaB = Math.round(K_FACTOR * (actualB - expectedB));

      idsA.forEach((id) => {
        const s = eloState.get(id);
        if (!s) return;
        s.matchesPlayed += 1;
        s.currentElo += deltaA;
        s.lastDelta = deltaA;
        if (s.currentElo > s.peakElo) s.peakElo = s.currentElo;
        if (s.currentElo < s.lowestElo) s.lowestElo = s.currentElo;
        if (actualA === 1) s.wins += 1;
        else if (actualA === 0.5) s.draws += 1;
        else s.losses += 1;
      });

      idsB.forEach((id) => {
        const s = eloState.get(id);
        if (!s) return;
        s.matchesPlayed += 1;
        s.currentElo += deltaB;
        s.lastDelta = deltaB;
        if (s.currentElo > s.peakElo) s.peakElo = s.currentElo;
        if (s.currentElo < s.lowestElo) s.lowestElo = s.currentElo;
        if (actualB === 1) s.wins += 1;
        else if (actualB === 0.5) s.draws += 1;
        else s.losses += 1;
      });
    });
  } else {
    const ordered = sortChronologicalMatches(matches);

    ordered.forEach((m) => {
      const outcome = resolveMatchOutcome(m);
      if (!outcome) return;

      const sA = eloState.get(m.participant_a_id);
      const sB = eloState.get(m.participant_b_id);
      if (!sA || !sB) return;

      const expectedA = calculateExpectedScore(sA.currentElo, sB.currentElo);
      const expectedB = 1 - expectedA;

      let actualA = 0.5;
      let actualB = 0.5;
      if (!outcome.isDraw) {
        if (outcome.winnerId === m.participant_a_id) {
          actualA = 1;
          actualB = 0;
        } else {
          actualA = 0;
          actualB = 1;
        }
      }

      const deltaA = Math.round(K_FACTOR * (actualA - expectedA));
      const deltaB = Math.round(K_FACTOR * (actualB - expectedB));

      sA.matchesPlayed += 1;
      sA.currentElo += deltaA;
      sA.lastDelta = deltaA;
      if (sA.currentElo > sA.peakElo) sA.peakElo = sA.currentElo;
      if (sA.currentElo < sA.lowestElo) sA.lowestElo = sA.currentElo;
      if (actualA === 1) sA.wins += 1;
      else if (actualA === 0.5) sA.draws += 1;
      else sA.losses += 1;

      sB.matchesPlayed += 1;
      sB.currentElo += deltaB;
      sB.lastDelta = deltaB;
      if (sB.currentElo > sB.peakElo) sB.peakElo = sB.currentElo;
      if (sB.currentElo < sB.lowestElo) sB.lowestElo = sB.currentElo;
      if (actualB === 1) sB.wins += 1;
      else if (actualB === 0.5) sB.draws += 1;
      else sB.losses += 1;
    });
  }

  const rows = Array.from(eloState.values())
    .map((r) => ({
      ...r,
      tier: getEloTier(r.currentElo),
      overallDelta: r.currentElo - INITIAL_ELO,
    }))
    .sort((a, b) => {
      if (b.currentElo !== a.currentElo) return b.currentElo - a.currentElo;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.participant.name.localeCompare(b.participant.name, 'es');
    });

  return rows.map((r, idx) => ({
    ...r,
    rank: idx + 1,
  }));
}