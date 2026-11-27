import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Crown,
  Flame,
  Medal,
  Skull,
  Trophy,
  Users,
} from 'lucide-react';
import { resolveParticipantAvatar } from '../utils/avatarUpload';
import { getKnockoutSeriesStatus } from '../utils/tournamentEngine';
import Avatar from './Avatar';
import PlayerBadges from './PlayerBadges';
import WhatsAppShareButton from './WhatsAppShareButton';

const PODIUM_STYLES = {
  1: {
    cardClass: 'podium-gold sm:-translate-y-1.5',
    badgeClass:
      'bg-amber-400/25 text-amber-800 border-amber-400/60 dark:text-amber-200',
    iconClass: 'text-amber-500 dark:text-amber-300',
    label: '1.º Puesto',
  },
  2: {
    cardClass: 'podium-silver',
    badgeClass:
      'bg-slate-300/35 text-slate-800 border-slate-400/50 dark:text-slate-200',
    iconClass: 'text-slate-500 dark:text-slate-300',
    label: '2.º Puesto',
  },
  3: {
    cardClass: 'podium-bronze',
    badgeClass:
      'bg-orange-400/25 text-orange-800 border-orange-400/50 dark:text-orange-200',
    iconClass: 'text-orange-500 dark:text-orange-300',
    label: '3.º Puesto',
  },
};

function PodiumShowcase({ items = [], badgesMap = null }) {
  if (items.length === 0) return null;

  const displayOrder =
    items.length >= 3
      ? [
          items.find((i) => i.place === 2),
          items.find((i) => i.place === 1),
          items.find((i) => i.place === 3),
        ].filter(Boolean)
      : items;

  return (
    <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-3">
      {displayOrder.map((item, idx) => {
        const style = PODIUM_STYLES[item.place] || PODIUM_STYLES[3];
        const Icon = item.place === 1 ? Crown : Medal;
        const playerBadges = badgesMap?.get(item.id) || [];

        return (
          <motion.div
            key={`${item.place}-${item.id}`}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 360,
              damping: 26,
              delay: idx * 0.06,
            }}
            className={`relative flex flex-col justify-between rounded-2xl border p-3.5 backdrop-blur-sm transition-transform ${style.cardClass}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${style.badgeClass}`}
              >
                <Icon className={`h-3 w-3 ${style.iconClass}`} />
                <span>{style.label}</span>
              </span>

              {item.isCurrentUser && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  Tú
                </span>
              )}
            </div>

            <div className="mt-2.5 flex items-center gap-2.5">
              <Avatar
                name={item.name}
                url={item.avatarUrl}
                size="md"
                highlight={item.place === 1}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1">
                  <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                    {item.name}
                  </p>
                  <PlayerBadges badges={playerBadges} max={1} compact />
                </div>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-600 tabular-nums dark:text-slate-300">
                  {item.subtitle}
                </p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function TournamentStandingsTab({
  tournament,
  participants = [],
  matches = [],
  eliminations = [],
  currentUserId,
  badgesMap = null,
}) {
  const format = tournament?.format || 'league';

  const leagueStandings = useMemo(() => {
    if (format !== 'league') return [];

    const statsMap = new Map();
    participants.forEach((p) => {
      statsMap.set(p.id, {
        participant: p,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
      });
    });

    matches.forEach((m) => {
      if (m.status !== 'completed') return;
      if (!m.participant_a_id || !m.participant_b_id) return;

      const rowA = statsMap.get(m.participant_a_id);
      const rowB = statsMap.get(m.participant_b_id);
      if (!rowA || !rowB) return;

      const scoreA = Number(m.score_a) || 0;
      const scoreB = Number(m.score_b) || 0;

      rowA.played += 1;
      rowB.played += 1;

      rowA.goalsFor += scoreA;
      rowA.goalsAgainst += scoreB;
      rowB.goalsFor += scoreB;
      rowB.goalsAgainst += scoreA;

      if (scoreA > scoreB || m.winner_id === m.participant_a_id) {
        rowA.won += 1;
        rowA.points += 3;
        rowB.lost += 1;
      } else if (scoreB > scoreA || m.winner_id === m.participant_b_id) {
        rowB.won += 1;
        rowB.points += 3;
        rowA.lost += 1;
      } else {
        rowA.drawn += 1;
        rowB.drawn += 1;
        rowA.points += 1;
        rowB.points += 1;
      }
    });

    const rows = Array.from(statsMap.values()).map((r) => ({
      ...r,
      goalDiff: r.goalsFor - r.goalsAgainst,
    }));

    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      if (b.won !== a.won) return b.won - a.won;
      return a.participant.name.localeCompare(b.participant.name, 'es');
    });

    return rows.map((r, idx) => ({
      ...r,
      rank: idx + 1,
    }));
  }, [format, participants, matches]);

  const knockoutStandings = useMemo(() => {
    if (format !== 'knockout') return [];

    const statsMap = new Map();
    participants.forEach((p) => {
      statsMap.set(p.id, {
        participant: p,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        maxRound: 0,
        finalPlace: null,
        statusLabel: 'En competencia',
        isEliminated: false,
      });
    });

    matches.forEach((m) => {
      if (m.participant_a_id && statsMap.has(m.participant_a_id)) {
        const rA = statsMap.get(m.participant_a_id);
        if (m.round_name !== 'Tercer puesto') {
          rA.maxRound = Math.max(rA.maxRound, m.round_number || 0);
        }
        if (m.status === 'completed') {
          const sA = Number(m.score_a) || 0;
          const sB = Number(m.score_b) || 0;
          rA.played += 1;
          rA.goalsFor += sA;
          rA.goalsAgainst += sB;
          if (sA > sB) rA.won += 1;
          else if (sB > sA) rA.lost += 1;
          else rA.drawn += 1;
        }
      }

      if (m.participant_b_id && statsMap.has(m.participant_b_id)) {
        const rB = statsMap.get(m.participant_b_id);
        if (m.round_name !== 'Tercer puesto') {
          rB.maxRound = Math.max(rB.maxRound, m.round_number || 0);
        }
        if (m.status === 'completed') {
          const sA = Number(m.score_a) || 0;
          const sB = Number(m.score_b) || 0;
          rB.played += 1;
          rB.goalsFor += sB;
          rB.goalsAgainst += sA;
          if (sB > sA) rB.won += 1;
          else if (sA > sB) rB.lost += 1;
          else rB.drawn += 1;
        }
      }
    });

    const regularMatches = matches.filter(
      (m) => m.round_name !== 'Tercer puesto'
    );
    const maxRegularRound = regularMatches.reduce(
      (max, m) => Math.max(max, m.round_number || 0),
      0
    );

    for (let r = 1; r <= maxRegularRound; r += 1) {
      const roundMatches = regularMatches.filter((m) => m.round_number === r);
      const orders = Array.from(
        new Set(roundMatches.map((m) => m.match_order))
      );

      orders.forEach((order) => {
        const tieMatches = roundMatches.filter((m) => m.match_order === order);
        const series = getKnockoutSeriesStatus(tieMatches);
        if (!series.isCompleted) return;

        if (r === maxRegularRound) {
          if (series.winnerId && statsMap.has(series.winnerId)) {
            const w = statsMap.get(series.winnerId);
            w.finalPlace = 1;
            w.statusLabel = 'Campeón';
          }
          if (series.loserId && statsMap.has(series.loserId)) {
            const l = statsMap.get(series.loserId);
            l.finalPlace = 2;
            l.statusLabel = 'Subcampeón';
            l.isEliminated = true;
          }
        } else if (series.loserId && statsMap.has(series.loserId)) {
          const l = statsMap.get(series.loserId);
          l.isEliminated = true;
          const roundLabel = tieMatches[0]?.round_name || `Ronda ${r}`;
          if (!l.finalPlace) {
            l.statusLabel = `Eliminado en ${roundLabel}`;
          }
        }
      });
    }

    const thirdPlaceMatches = matches.filter(
      (m) => m.round_name === 'Tercer puesto'
    );
    if (thirdPlaceMatches.length > 0) {
      const thirdSeries = getKnockoutSeriesStatus(thirdPlaceMatches);
      if (thirdSeries.isCompleted) {
        if (thirdSeries.winnerId && statsMap.has(thirdSeries.winnerId)) {
          const w3 = statsMap.get(thirdSeries.winnerId);
          w3.finalPlace = 3;
          w3.statusLabel = '3.º Puesto';
        }
        if (thirdSeries.loserId && statsMap.has(thirdSeries.loserId)) {
          const l4 = statsMap.get(thirdSeries.loserId);
          l4.finalPlace = 4;
          l4.statusLabel = '4.º Puesto';
        }
      }
    }

    const rows = Array.from(statsMap.values()).map((r) => ({
      ...r,
      goalDiff: r.goalsFor - r.goalsAgainst,
    }));

    rows.sort((a, b) => {
      const placeA = a.finalPlace ?? 999;
      const placeB = b.finalPlace ?? 999;
      if (placeA !== placeB) return placeA - placeB;
      if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
      if (b.maxRound !== a.maxRound) return b.maxRound - a.maxRound;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.participant.name.localeCompare(b.participant.name, 'es');
    });

    return rows.map((r, idx) => ({
      ...r,
      rank: r.finalPlace ?? idx + 1,
    }));
  }, [format, participants, matches]);

  const lastStandingStandings = useMemo(() => {
    if (format !== 'last_standing') return [];

    const elimByParticipant = new Map();
    eliminations.forEach((el) => {
      elimByParticipant.set(el.participant_id, el.elimination_order);
    });

    const active = participants.filter((p) => !elimByParticipant.has(p.id));
    const eliminated = participants
      .filter((p) => elimByParticipant.has(p.id))
      .sort(
        (a, b) =>
          (elimByParticipant.get(b.id) ?? 0) -
          (elimByParticipant.get(a.id) ?? 0)
      );

    const hasChampion = active.length === 1 && eliminated.length > 0;

    const rows = [];
    active.forEach((p) => {
      rows.push({
        participant: p,
        rank: 1,
        isActive: true,
        isChampion: hasChampion,
        eliminationOrder: null,
        statusLabel: hasChampion ? 'Campeón (Último en pie)' : 'En pie',
      });
    });

    eliminated.forEach((p, idx) => {
      const order = elimByParticipant.get(p.id);
      rows.push({
        participant: p,
        rank: active.length + idx + 1,
        isActive: false,
        isChampion: false,
        eliminationOrder: order,
        statusLabel: `Eliminado #${order}`,
      });
    });

    return rows;
  }, [format, participants, eliminations]);

  const podiumItems = useMemo(() => {
    if (format === 'league') {
      const hasAnyPlayed = leagueStandings.some((r) => r.played > 0);
      if (!hasAnyPlayed) return [];
      return leagueStandings.slice(0, 3).map((row) => {
        const dg = row.goalDiff > 0 ? `+${row.goalDiff}` : `${row.goalDiff}`;
        return {
          id: row.participant.id,
          place: row.rank,
          name: row.participant.name,
          avatarUrl: resolveParticipantAvatar(row.participant),
          subtitle: `${row.points} pts · DG ${dg}`,
          isCurrentUser:
            Boolean(currentUserId) && row.participant.user_id === currentUserId,
        };
      });
    }

    if (format === 'knockout') {
      const placed = knockoutStandings
        .filter((r) => r.finalPlace && r.finalPlace <= 3)
        .sort((a, b) => a.finalPlace - b.finalPlace);
      if (placed.length === 0) return [];
      return placed.map((row) => ({
        id: row.participant.id,
        place: row.finalPlace,
        name: row.participant.name,
        avatarUrl: resolveParticipantAvatar(row.participant),
        subtitle: row.statusLabel,
        isCurrentUser:
          Boolean(currentUserId) && row.participant.user_id === currentUserId,
      }));
    }

    return [];
  }, [format, leagueStandings, knockoutStandings, currentUserId]);

  function buildWhatsAppText() {
    const title = `🏆 *${tournament?.name || 'Torneo'}* — Tabla de Posiciones`;
    const lines = [title, ''];

    if (format === 'league') {
      leagueStandings.forEach((row) => {
        const medal =
          row.played > 0 && row.rank === 1
            ? '🥇 '
            : row.played > 0 && row.rank === 2
            ? '🥈 '
            : row.played > 0 && row.rank === 3
            ? '🥉 '
            : '';
        const dg = row.goalDiff > 0 ? `+${row.goalDiff}` : `${row.goalDiff}`;
        lines.push(
          `${row.rank}. ${medal}${row.participant.name} — *${row.points} pts* (${row.played} PJ, DG ${dg})`
        );
      });
    } else if (format === 'knockout') {
      knockoutStandings.forEach((row) => {
        lines.push(
          `${row.rank}. ${row.participant.name} — ${row.statusLabel}`
        );
      });
    } else {
      lastStandingStandings.forEach((row) => {
        lines.push(
          `${row.rank}. ${row.participant.name} — ${row.statusLabel}`
        );
      });
    }

    return lines.join('\n');
  }

  if (participants.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
        <Users className="mx-auto mb-2.5 h-8 w-8 text-slate-400" />
        <h3 className="text-sm font-bold text-slate-900">
          No hay participantes inscritos
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Agrega participantes para visualizar la tabla de posiciones.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Tabla de Posiciones
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {format === 'league'
            ? '3 pts por victoria · 1 pt por empate · Desempate por diferencia y goles a favor.'
            : format === 'knockout'
            ? 'Clasificación según avance y resultados en las llaves eliminatorias.'
            : 'Orden de supervivencia según las eliminaciones registradas.'}
        </p>
      </div>

      <PodiumShowcase items={podiumItems} badgesMap={badgesMap} />

      {format === 'league' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-2xs backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400">
                  <th className="w-12 px-3 py-3 text-center">Pos</th>
                  <th className="px-3 py-3">Competidor</th>
                  <th className="px-2 py-3 text-center" title="Partidos Jugados">
                    PJ
                  </th>
                  <th className="px-2 py-3 text-center" title="Ganados">
                    G
                  </th>
                  <th className="px-2 py-3 text-center" title="Empatados">
                    E
                  </th>
                  <th className="px-2 py-3 text-center" title="Perdidos">
                    P
                  </th>
                  <th
                    className="hidden px-2 py-3 text-center sm:table-cell"
                    title="Goles a Favor"
                  >
                    GF
                  </th>
                  <th
                    className="hidden px-2 py-3 text-center sm:table-cell"
                    title="Goles en Contra"
                  >
                    GC
                  </th>
                  <th className="px-2 py-3 text-center" title="Diferencia de Gol">
                    DG
                  </th>
                  <th className="px-3.5 py-3 text-right">Pts</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-slate-800/80">
                {leagueStandings.map((row, idx) => {
                  const isCurrentUser =
                    Boolean(currentUserId) &&
                    row.participant.user_id === currentUserId;
                  const hasPlayed = row.played > 0;
                  const playerBadges = badgesMap?.get(row.participant.id) || [];

                  let badgeClass =
                    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
                  if (hasPlayed && row.rank === 1) {
                    badgeClass =
                      'podium-gold text-amber-800 dark:text-amber-200';
                  } else if (hasPlayed && row.rank === 2) {
                    badgeClass =
                      'podium-silver text-slate-800 dark:text-slate-200';
                  } else if (hasPlayed && row.rank === 3) {
                    badgeClass =
                      'podium-bronze text-orange-800 dark:text-orange-200';
                  }

                  return (
                    <motion.tr
                      key={row.participant.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: Math.min(idx * 0.035, 0.35),
                      }}
                      className={
                        isCurrentUser
                          ? 'bg-emerald-50/60 dark:bg-emerald-500/12'
                          : 'transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                      }
                    >
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-extrabold ${badgeClass}`}
                        >
                          {row.rank}
                        </span>
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Avatar
                            name={row.participant.name}
                            url={resolveParticipantAvatar(row.participant)}
                            size="sm"
                            highlight={isCurrentUser}
                          />
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {row.participant.name}
                          </span>
                          <PlayerBadges badges={playerBadges} max={2} compact />
                          {isCurrentUser && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Tú
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-2 py-2.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {row.played}
                      </td>
                      <td className="px-2 py-2.5 text-center text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {row.won}
                      </td>
                      <td className="px-2 py-2.5 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                        {row.drawn}
                      </td>
                      <td className="px-2 py-2.5 text-center text-xs font-medium text-rose-600 dark:text-rose-400">
                        {row.lost}
                      </td>
                      <td className="hidden px-2 py-2.5 text-center text-xs text-slate-600 sm:table-cell dark:text-slate-300">
                        {row.goalsFor}
                      </td>
                      <td className="hidden px-2 py-2.5 text-center text-xs text-slate-600 sm:table-cell dark:text-slate-300">
                        {row.goalsAgainst}
                      </td>
                      <td className="px-2 py-2.5 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <span className="inline-flex rounded-lg bg-emerald-500/15 px-2.5 py-0.5 text-sm font-black text-emerald-700 dark:text-emerald-300">
                          {row.points}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {format === 'knockout' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-2xs backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400">
                  <th className="w-12 px-3 py-3 text-center">Pos</th>
                  <th className="px-3 py-3">Competidor</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="hidden px-2.5 py-3 text-center sm:table-cell">
                    PJ
                  </th>
                  <th className="hidden px-2.5 py-3 text-center sm:table-cell">
                    G-E-P
                  </th>
                  <th className="px-3 py-3 text-right">DG</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-slate-800/80">
                {knockoutStandings.map((row, idx) => {
                  const isCurrentUser =
                    Boolean(currentUserId) &&
                    row.participant.user_id === currentUserId;
                  const playerBadges = badgesMap?.get(row.participant.id) || [];

                  let badgeClass =
                    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
                  if (row.finalPlace === 1) {
                    badgeClass =
                      'podium-gold text-amber-800 dark:text-amber-200';
                  } else if (row.finalPlace === 2) {
                    badgeClass =
                      'podium-silver text-slate-800 dark:text-slate-200';
                  } else if (row.finalPlace === 3) {
                    badgeClass =
                      'podium-bronze text-orange-800 dark:text-orange-200';
                  }

                  return (
                    <motion.tr
                      key={row.participant.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: Math.min(idx * 0.035, 0.35),
                      }}
                      className={
                        isCurrentUser
                          ? 'bg-emerald-50/60 dark:bg-emerald-500/12'
                          : 'transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                      }
                    >
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-extrabold ${badgeClass}`}
                        >
                          {row.rank}
                        </span>
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Avatar
                            name={row.participant.name}
                            url={resolveParticipantAvatar(row.participant)}
                            size="sm"
                            highlight={isCurrentUser}
                          />
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {row.participant.name}
                          </span>
                          <PlayerBadges badges={playerBadges} max={2} compact />
                          {isCurrentUser && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Tú
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            row.finalPlace === 1
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                              : row.isEliminated
                              ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              : 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300'
                          }`}
                        >
                          {row.finalPlace === 1 && (
                            <Trophy className="h-3 w-3" />
                          )}
                          <span>{row.statusLabel}</span>
                        </span>
                      </td>

                      <td className="hidden px-2.5 py-2.5 text-center text-xs font-semibold text-slate-600 sm:table-cell dark:text-slate-300">
                        {row.played}
                      </td>

                      <td className="hidden px-2.5 py-2.5 text-center text-xs text-slate-600 sm:table-cell dark:text-slate-300">
                        {row.won}-{row.drawn}-{row.lost}
                      </td>

                      <td className="px-3 py-2.5 text-right text-xs font-bold text-slate-700 dark:text-slate-200">
                        {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {format === 'last_standing' && (
        <div className="space-y-2">
          {lastStandingStandings.map((row, idx) => {
            const isCurrentUser =
              Boolean(currentUserId) &&
              row.participant.user_id === currentUserId;
            const playerBadges = badgesMap?.get(row.participant.id) || [];

            return (
              <motion.div
                layout
                key={row.participant.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.22,
                  delay: Math.min(idx * 0.04, 0.35),
                }}
                className={`flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-3 transition ${
                  row.isChampion
                    ? 'podium-gold'
                    : row.isActive
                    ? 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-500/35 dark:bg-emerald-500/12'
                    : 'border-slate-200/80 bg-white/75 opacity-85 dark:border-slate-800 dark:bg-slate-900/50'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold tabular-nums ${
                      row.isChampion
                        ? 'bg-amber-400/30 text-amber-900 dark:text-amber-200'
                        : row.isActive
                        ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {row.rank}
                  </span>

                  <Avatar
                    name={row.participant.name}
                    url={resolveParticipantAvatar(row.participant)}
                    size="sm"
                    highlight={row.isChampion}
                  />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`truncate text-sm font-bold ${
                          row.isActive
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-500 line-through dark:text-slate-400'
                        }`}
                      >
                        {row.participant.name}
                      </span>
                      <PlayerBadges badges={playerBadges} max={2} compact />
                      {isCurrentUser && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Tú
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                    row.isChampion
                      ? 'bg-amber-400/25 text-amber-900 dark:text-amber-200'
                      : row.isActive
                      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {row.isChampion ? (
                    <Crown className="h-3.5 w-3.5" />
                  ) : row.isActive ? (
                    <Flame className="h-3.5 w-3.5" />
                  ) : (
                    <Skull className="h-3.5 w-3.5" />
                  )}
                  <span>{row.statusLabel}</span>
                </span>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Botón de compartir por WhatsApp debajo de la tabla */}
      <div className="flex justify-end pt-1">
        <WhatsAppShareButton
          compact
          label="Compartir Tabla"
          getText={buildWhatsAppText}
        />
      </div>
    </div>
  );
}