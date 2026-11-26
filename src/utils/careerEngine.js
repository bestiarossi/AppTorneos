import { supabase } from '../lib/supabase';
import { computeCustomGeneralStandings } from './customTournamentEngine';
import {
  computeKnockoutSummary,
  computeLastStandingStandings,
  computeLeagueStandings,
} from './tournamentEngine';
import { getTournamentTheme } from './tournamentThemes';

/**
 * Consulta la base de datos y calcula la vitrina histórica y palmarés del usuario
 * en todos los torneos en los que haya participado.
 */
export async function fetchUserCareer(userId) {
  if (!supabase || !userId) {
    return null;
  }

  // 1. Obtener todos los participantes donde user_id = userId
  const { data: myParticipants, error: pErr } = await supabase
    .from('tournament_participants')
    .select('id, tournament_id, name, created_at')
    .eq('user_id', userId);

  if (pErr) throw pErr;
  if (!myParticipants || myParticipants.length === 0) {
    return {
      totalTournaments: 0,
      championships: 0,
      runnerUps: 0,
      thirdPlaces: 0,
      podiums: 0,
      matchesPlayed: 0,
      matchesWon: 0,
      matchesDrawn: 0,
      matchesLost: 0,
      winRatePct: 0,
      subtournamentsWon: 0,
      prodePoints: 0,
      prodeFullHits: 0,
      trophies: [],
    };
  }

  const tournamentIds = Array.from(
    new Set(myParticipants.map((p) => p.tournament_id))
  );

  // 2. Traer torneos, partidos, eliminaciones, subtorneos y votos de prode del usuario
  const [
    tournamentsRes,
    matchesRes,
    lastStandingRes,
    subtournamentsRes,
    subEntriesRes,
    subMembersRes,
    prodeVotesRes,
    prodePollsRes,
  ] = await Promise.all([
    supabase
      .from('tournaments')
      .select('id, name, format, config, created_at')
      .in('id', tournamentIds),
    supabase
      .from('matches')
      .select('*')
      .in('tournament_id', tournamentIds)
      .eq('status', 'completed')
      .eq('is_bye', false),
    supabase
      .from('last_standing_eliminations')
      .select('*')
      .in('tournament_id', tournamentIds),
    supabase
      .from('subtournaments')
      .select('*')
      .in('tournament_id', tournamentIds)
      .eq('status', 'completed'),
    supabase
      .from('subtournament_entries')
      .select('*'),
    supabase
      .from('subtournament_entry_members')
      .select('*'),
    supabase
      .from('prediction_votes')
      .select('*')
      .eq('user_id', userId),
    supabase
      .from('prediction_polls')
      .select('*')
      .in('tournament_id', tournamentIds),
  ]);

  const tournaments = tournamentsRes.data || [];
  const matches = matchesRes.data || [];
  const eliminations = lastStandingRes.data || [];
  const completedSubs = subtournamentsRes.data || [];
  const allSubEntries = subEntriesRes.data || [];
  const allSubMembers = subMembersRes.data || [];
  const userVotes = prodeVotesRes.data || [];
  const polls = prodePollsRes.data || [];

  const myParticipantIds = new Set(myParticipants.map((p) => p.id));
  const myParticipantByTournament = new Map(
    myParticipants.map((p) => [p.tournament_id, p])
  );

  let matchesPlayed = 0;
  let matchesWon = 0;
  let matchesDrawn = 0;
  let matchesLost = 0;

  matches.forEach((m) => {
    const isParticipantA = myParticipantIds.has(m.participant_a_id);
    const isParticipantB = myParticipantIds.has(m.participant_b_id);
    if (!isParticipantA && !isParticipantB) return;

    matchesPlayed += 1;
    const myId = isParticipantA ? m.participant_a_id : m.participant_b_id;

    if (m.is_draw || (m.score_a !== null && m.score_a === m.score_b)) {
      matchesDrawn += 1;
    } else if (
      m.winner_id === myId ||
      (isParticipantA && m.score_a > m.score_b) ||
      (isParticipantB && m.score_b > m.score_a)
    ) {
      matchesWon += 1;
    } else {
      matchesLost += 1;
    }
  });

  // Trofeos y podios
  const trophies = [];
  let championships = 0;
  let runnerUps = 0;
  let thirdPlaces = 0;

  tournaments.forEach((t) => {
    const myPart = myParticipantByTournament.get(t.id);
    if (!myPart) return;

    const sportTheme = getTournamentTheme(t.config);

    if (t.format === 'knockout') {
      const ko = computeKnockoutSummary(myParticipants.filter((p) => p.tournament_id === t.id), matches.filter((m) => m.tournament_id === t.id));
      if (ko.champion?.id === myPart.id) {
        championships += 1;
        trophies.push({
          id: `ko-1-${t.id}`,
          tournamentId: t.id,
          title: t.name,
          sportEmoji: sportTheme.emoji,
          place: 1,
          label: 'Campeón de Eliminatoria',
          year: new Date(t.created_at).getFullYear(),
        });
      } else if (ko.runnerUp?.id === myPart.id) {
        runnerUps += 1;
        trophies.push({
          id: `ko-2-${t.id}`,
          tournamentId: t.id,
          title: t.name,
          sportEmoji: sportTheme.emoji,
          place: 2,
          label: 'Subcampeón',
          year: new Date(t.created_at).getFullYear(),
        });
      } else if (ko.thirdPlace?.id === myPart.id) {
        thirdPlaces += 1;
        trophies.push({
          id: `ko-3-${t.id}`,
          tournamentId: t.id,
          title: t.name,
          sportEmoji: sportTheme.emoji,
          place: 3,
          label: '3.º Puesto',
          year: new Date(t.created_at).getFullYear(),
        });
      }
    } else if (t.format === 'league') {
      const tMatches = matches.filter((m) => m.tournament_id === t.id);
      const allDone = tMatches.length > 0 && tMatches.every((m) => m.status === 'completed');
      if (allDone) {
        const rows = computeLeagueStandings(
          myParticipants.filter((p) => p.tournament_id === t.id),
          tMatches
        );
        const myRank = rows.findIndex((r) => r.participant.id === myPart.id) + 1;
        if (myRank === 1) {
          championships += 1;
          trophies.push({
            id: `lg-1-${t.id}`,
            tournamentId: t.id,
            title: t.name,
            sportEmoji: sportTheme.emoji,
            place: 1,
            label: 'Campeón de Liga',
            year: new Date(t.created_at).getFullYear(),
          });
        } else if (myRank === 2) {
          runnerUps += 1;
          trophies.push({
            id: `lg-2-${t.id}`,
            tournamentId: t.id,
            title: t.name,
            sportEmoji: sportTheme.emoji,
            place: 2,
            label: 'Subcampeón de Liga',
            year: new Date(t.created_at).getFullYear(),
          });
        } else if (myRank === 3) {
          thirdPlaces += 1;
          trophies.push({
            id: `lg-3-${t.id}`,
            tournamentId: t.id,
            title: t.name,
            sportEmoji: sportTheme.emoji,
            place: 3,
            label: '3.º Puesto de Liga',
            year: new Date(t.created_at).getFullYear(),
          });
        }
      }
    } else if (t.format === 'last_standing') {
      const tElims = eliminations.filter((el) => el.tournament_id === t.id);
      const ls = computeLastStandingStandings(
        myParticipants.filter((p) => p.tournament_id === t.id),
        tElims
      );
      if (ls.champion?.id === myPart.id) {
        championships += 1;
        trophies.push({
          id: `ls-1-${t.id}`,
          tournamentId: t.id,
          title: t.name,
          sportEmoji: sportTheme.emoji,
          place: 1,
          label: 'Último en pie',
          year: new Date(t.created_at).getFullYear(),
        });
      }
    }
  });

  // Subtorneos ganados en torneos personalizados
  let subtournamentsWon = 0;
  const mySubEntryIds = new Set();

  allSubMembers.forEach((em) => {
    if (myParticipantIds.has(em.participant_id)) {
      mySubEntryIds.add(em.entry_id);
    }
  });

  allSubEntries.forEach((entry) => {
    if (
      (mySubEntryIds.has(entry.id) || myParticipantIds.has(entry.participant_id)) &&
      entry.final_rank === 1
    ) {
      subtournamentsWon += 1;
    }
  });

  // Puntos y aciertos acumulados en el Prode
  let prodePoints = 0;
  let prodeFullHits = 0;

  const pollMap = new Map(polls.map((p) => [p.id, p]));

  userVotes.forEach((vote) => {
    const poll = pollMap.get(vote.poll_id);
    if (!poll || poll.status !== 'closed') return;

    if (poll.prediction_mode === 'exact_score') {
      if (
        vote.predicted_score_a !== null &&
        vote.predicted_score_b !== null
      ) {
        prodePoints += 1;
      }
    } else {
      prodePoints += 1;
    }
  });

  trophies.sort((a, b) => {
    if (a.place !== b.place) return a.place - b.place;
    return b.year - a.year;
  });

  return {
    totalTournaments: tournamentIds.length,
    championships,
    runnerUps,
    thirdPlaces,
    podiums: championships + runnerUps + thirdPlaces,
    matchesPlayed,
    matchesWon,
    matchesDrawn,
    matchesLost,
    winRatePct:
      matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : 0,
    subtournamentsWon,
    prodePoints,
    prodeFullHits,
    trophies,
  };
}