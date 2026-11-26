import { shuffleArray } from './tournamentEngine';

const POT_BADGE_COLORS = [
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-slate-200 text-slate-800 border-slate-300',
];

export function getPotBadgeColor(potNumber) {
  const idx = Math.max(0, (Number(potNumber) || 1) - 1) % POT_BADGE_COLORS.length;
  return POT_BADGE_COLORS[idx];
}

export function assignTeamsBalancedWithPots(
  selectedParticipantIds,
  teams,
  potAssignmentsMap,
  potCount
) {
  if (!selectedParticipantIds.length || teams.length < 2) {
    return {};
  }

  const buckets = new Map();
  for (let p = 1; p <= potCount; p += 1) {
    buckets.set(p, []);
  }
  const unassignedBucket = [];

  selectedParticipantIds.forEach((participantId) => {
    const potNum = potAssignmentsMap.get(participantId);
    if (potNum && potNum >= 1 && potNum <= potCount) {
      buckets.get(potNum).push(participantId);
    } else {
      unassignedBucket.push(participantId);
    }
  });

  const orderedPlayers = [];
  for (let p = 1; p <= potCount; p += 1) {
    const shuffledPot = shuffleArray(buckets.get(p));
    orderedPlayers.push(...shuffledPot);
  }
  if (unassignedBucket.length > 0) {
    orderedPlayers.push(...shuffleArray(unassignedBucket));
  }

  const shuffledTeams = shuffleArray(teams);
  const teamCount = shuffledTeams.length;
  const assignments = {};

  // Distribución en serpentina (Snake Draft) para equilibrar calidad y tamaño
  orderedPlayers.forEach((participantId, index) => {
    const roundIdx = Math.floor(index / teamCount);
    const posInRound = index % teamCount;
    const teamIdx =
      roundIdx % 2 === 0 ? posInRound : teamCount - 1 - posInRound;
    assignments[participantId] = shuffledTeams[teamIdx].id;
  });

  return assignments;
}