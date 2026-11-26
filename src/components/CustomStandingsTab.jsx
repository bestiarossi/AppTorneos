import { Fragment, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  ChevronDown,
  Crown,
  Info,
  Medal,
  Trophy,
  Users,
} from 'lucide-react';
import WhatsAppShareButton from './WhatsAppShareButton';

function formatPoints(value) {
  const num = Number(value) || 0;
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

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

function CustomPodiumShowcase({ items = [] }) {
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

            <div className="mt-2.5">
              <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                {item.name}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {item.subtitle}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function CustomStandingsTab({
  tournament,
  participants = [],
  matchdays = [],
  subtournaments = [],
  subEntries = [],
  subEntryMembers = [],
  currentUserId,
}) {
  const [expandedParticipantId, setExpandedParticipantId] = useState(null);

  const completedSubtournaments = useMemo(
    () => subtournaments.filter((s) => s.status === 'completed'),
    [subtournaments]
  );

  const sortedMatchdays = useMemo(
    () =>
      [...matchdays].sort(
        (a, b) => (a.matchday_number ?? 0) - (b.matchday_number ?? 0)
      ),
    [matchdays]
  );

  const standings = useMemo(() => {
    const completedSubMap = new Map(
      completedSubtournaments.map((s) => [s.id, s])
    );
    const matchdayMap = new Map(matchdays.map((m) => [m.id, m]));

    const membersByEntryId = new Map();
    subEntryMembers.forEach((em) => {
      if (!membersByEntryId.has(em.entry_id)) {
        membersByEntryId.set(em.entry_id, new Set());
      }
      membersByEntryId.get(em.entry_id).add(em.participant_id);
    });

    subEntries.forEach((entry) => {
      if (entry.participant_id) {
        if (!membersByEntryId.has(entry.id)) {
          membersByEntryId.set(entry.id, new Set());
        }
        membersByEntryId.get(entry.id).add(entry.participant_id);
      }
    });

    const statsMap = new Map();
    participants.forEach((p) => {
      statsMap.set(p.id, {
        participant: p,
        totalPoints: 0,
        playedCount: 0,
        firstPlaces: 0,
        podiums: 0,
        pointsByMatchday: {},
        history: [],
      });
    });

    subEntries.forEach((entry) => {
      const sub = completedSubMap.get(entry.subtournament_id);
      if (!sub) return;

      const memberIds = membersByEntryId.get(entry.id);
      if (!memberIds || memberIds.size === 0) return;

      const pts = Number(entry.points_awarded) || 0;
      const rank = entry.final_rank ?? null;
      const md = matchdayMap.get(sub.matchday_id);

      memberIds.forEach((pId) => {
        const row = statsMap.get(pId);
        if (!row) return;

        row.totalPoints += pts;
        row.playedCount += 1;
        if (rank === 1) row.firstPlaces += 1;
        if (rank !== null && rank >= 1 && rank <= 3) row.podiums += 1;

        if (sub.matchday_id) {
          row.pointsByMatchday[sub.matchday_id] =
            (row.pointsByMatchday[sub.matchday_id] || 0) + pts;
        }

        row.history.push({
          subtournamentId: sub.id,
          subtournamentName: sub.name,
          matchdayNumber: md?.matchday_number ?? 0,
          matchdayName: md?.name || 'Jornada',
          entryName: entry.entry_name,
          isTeamBased: Boolean(sub.config?.is_team_based),
          rank,
          points: pts,
        });
      });
    });

    const rows = Array.from(statsMap.values()).map((row) => ({
      ...row,
      history: row.history.sort(
        (a, b) => a.matchdayNumber - b.matchdayNumber
      ),
    }));

    rows.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
      if (b.podiums !== a.podiums) return b.podiums - a.podiums;
      if (b.playedCount !== a.playedCount) return b.playedCount - a.playedCount;
      return a.participant.name.localeCompare(b.participant.name, 'es');
    });

    return rows.map((row, idx) => {
      if (idx === 0) {
        return { ...row, rank: 1 };
      }
      const prev = rows[idx - 1];
      const isTied =
        row.totalPoints === prev.totalPoints &&
        row.firstPlaces === prev.firstPlaces &&
        row.podiums === prev.podiums;

      return {
        ...row,
        rank: isTied ? null : idx + 1,
      };
    });
  }, [
    participants,
    matchdays,
    completedSubtournaments,
    subEntries,
    subEntryMembers,
  ]);

  const resolvedStandings = useMemo(() => {
    let lastRank = 1;
    return standings.map((row, idx) => {
      if (row.rank !== null) {
        lastRank = row.rank;
        return { ...row, displayRank: row.rank };
      }
      return { ...row, displayRank: idx === 0 ? 1 : lastRank };
    });
  }, [standings]);

  const podiumItems = useMemo(() => {
    const scorers = resolvedStandings.filter((r) => r.totalPoints > 0);
    if (scorers.length === 0) return [];

    return scorers.slice(0, 3).map((row, idx) => ({
      id: row.participant.id,
      place: idx + 1,
      name: row.participant.name,
      subtitle: `${formatPoints(row.totalPoints)} pts · ${row.firstPlaces} ${
        row.firstPlaces === 1 ? 'victoria' : 'victorias'
      }`,
      isCurrentUser:
        Boolean(currentUserId) && row.participant.user_id === currentUserId,
    }));
  }, [resolvedStandings, currentUserId]);

  function buildWhatsAppStandingsText() {
    const lines = [
      `🏆 *${tournament?.name || 'Torneo'}* — Tabla General`,
      `📊 ${completedSubtournaments.length} de ${subtournaments.length} subtorneos finalizados`,
      '',
    ];

    resolvedStandings.forEach((row) => {
      const medal =
        row.totalPoints > 0 && row.displayRank === 1
          ? '🥇 '
          : row.totalPoints > 0 && row.displayRank === 2
          ? '🥈 '
          : row.totalPoints > 0 && row.displayRank === 3
          ? '🥉 '
          : '';
      lines.push(
        `${row.displayRank}. ${medal}${row.participant.name} — *${formatPoints(
          row.totalPoints
        )} pts*`
      );
    });

    return lines.join('\n');
  }

  const showMatchdayColumns =
    sortedMatchdays.length > 0 && sortedMatchdays.length <= 6;

  const leader =
    resolvedStandings.length > 0 && resolvedStandings[0].totalPoints > 0
      ? resolvedStandings[0]
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Tabla General de Puntos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Acumulado automático de todos los subtorneos finalizados en cada
            jornada.
          </p>
        </div>

        {resolvedStandings.length > 0 && (
          <WhatsAppShareButton
            compact
            label="Compartir Tabla"
            getText={buildWhatsAppStandingsText}
          />
        )}
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-3.5 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/60"
        >
          <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Subtorneos finalizados
          </span>
          <span className="mt-1 block text-lg font-black text-slate-900 dark:text-white">
            {completedSubtournaments.length}{' '}
            <span className="text-xs font-semibold text-slate-400">
              / {subtournaments.length}
            </span>
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.04 }}
          className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-3.5 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/60"
        >
          <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Jornadas
          </span>
          <span className="mt-1 block text-lg font-black text-slate-900 dark:text-white">
            {sortedMatchdays.length}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.08 }}
          className={`col-span-2 rounded-2xl border p-3.5 backdrop-blur-xs sm:col-span-1 ${
            leader
              ? 'podium-gold'
              : 'border-amber-200/80 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/10'
          }`}
        >
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            <Trophy className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
            <span>Líder actual</span>
          </span>
          <span className="mt-1 block truncate text-sm font-black text-slate-900 dark:text-white">
            {leader
              ? `${leader.participant.name} (${formatPoints(
                  leader.totalPoints
                )} pts)`
              : 'Sin puntos aún'}
          </span>
        </motion.div>
      </div>

      <CustomPodiumShowcase items={podiumItems} />

      {completedSubtournaments.length === 0 && participants.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-sky-200/80 bg-sky-50/70 p-3.5 text-xs text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/12 dark:text-sky-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <span>
            Aún no hay subtorneos finalizados. Cuando cierres un subtorneo y
            repartas los puntos, la tabla general se actualizará
            automáticamente.
          </span>
        </div>
      )}

      {participants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <Users className="mx-auto mb-2.5 h-8 w-8 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            No hay participantes inscritos
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Agrega participantes para comenzar a sumar puntos.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-2xs backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400">
                  <th className="w-12 px-3 py-3 text-center">Pos</th>
                  <th className="px-3 py-3">Participante</th>
                  <th
                    className="px-2.5 py-3 text-center"
                    title="Subtorneos finalizados jugados"
                  >
                    Jug
                  </th>
                  <th
                    className="px-2.5 py-3 text-center"
                    title="Primeros puestos"
                  >
                    1.º
                  </th>
                  <th
                    className="hidden px-2.5 py-3 text-center sm:table-cell"
                    title="Podios (Top 3)"
                  >
                    Podios
                  </th>
                  {showMatchdayColumns &&
                    sortedMatchdays.map((md) => (
                      <th
                        key={md.id}
                        className="hidden px-2.5 py-3 text-center md:table-cell"
                        title={md.name}
                      >
                        J{md.matchday_number}
                      </th>
                    ))}
                  <th className="px-4 py-3 text-right">Pts</th>
                  <th className="w-9 px-2 py-3" />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {resolvedStandings.map((row, idx) => {
                  const isCurrentUser =
                    Boolean(currentUserId) &&
                    row.participant.user_id === currentUserId;
                  const isExpanded =
                    expandedParticipantId === row.participant.id;
                  const hasPoints = row.totalPoints > 0;

                  let rankBadgeClass =
                    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
                  if (hasPoints && row.displayRank === 1) {
                    rankBadgeClass =
                      'podium-gold text-amber-800 dark:text-amber-200';
                  } else if (hasPoints && row.displayRank === 2) {
                    rankBadgeClass =
                      'podium-silver text-slate-800 dark:text-slate-200';
                  } else if (hasPoints && row.displayRank === 3) {
                    rankBadgeClass =
                      'podium-bronze text-orange-800 dark:text-orange-200';
                  }

                  const totalColSpan =
                    6 + (showMatchdayColumns ? sortedMatchdays.length : 0);

                  return (
                    <Fragment key={row.participant.id}>
                      <motion.tr
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: Math.min(idx * 0.035, 0.35),
                        }}
                        onClick={() =>
                          setExpandedParticipantId(
                            isExpanded ? null : row.participant.id
                          )
                        }
                        className={`cursor-pointer transition-colors ${
                          isCurrentUser
                            ? 'bg-emerald-50/60 hover:bg-emerald-50/90 dark:bg-emerald-500/12 dark:hover:bg-emerald-500/18'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-extrabold ${rankBadgeClass}`}
                          >
                            {row.displayRank}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {row.participant.name}
                            </span>
                            {isCurrentUser && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                Tú
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-2.5 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {row.playedCount}
                        </td>

                        <td className="px-2.5 py-3 text-center text-xs font-bold text-amber-700 dark:text-amber-300">
                          {row.firstPlaces}
                        </td>

                        <td className="hidden px-2.5 py-3 text-center text-xs font-semibold text-slate-600 sm:table-cell dark:text-slate-300">
                          {row.podiums}
                        </td>

                        {showMatchdayColumns &&
                          sortedMatchdays.map((md) => {
                            const mdPts = row.pointsByMatchday[md.id];
                            return (
                              <td
                                key={md.id}
                                className="hidden px-2.5 py-3 text-center text-xs font-medium text-slate-500 md:table-cell dark:text-slate-400"
                              >
                                {mdPts !== undefined ? formatPoints(mdPts) : '—'}
                              </td>
                            );
                          })}

                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex rounded-lg bg-emerald-500/15 px-2.5 py-1 text-sm font-black text-emerald-700 dark:text-emerald-300">
                            {formatPoints(row.totalPoints)}
                          </span>
                        </td>

                        <td className="px-2 py-3 text-center text-slate-400">
                          <motion.span
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="inline-flex items-center justify-center"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </motion.span>
                        </td>
                      </motion.tr>

                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <tr
                            key={`${row.participant.id}-details`}
                            className="bg-slate-50/85 dark:bg-slate-950/60"
                          >
                            <td colSpan={totalColSpan} className="p-0">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                                className="overflow-hidden"
                              >
                                <div className="space-y-2.5 px-4 py-3.5">
                                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    <Award className="h-3.5 w-3.5 text-emerald-500" />
                                    <span>
                                      Historial de puntos de{' '}
                                      {row.participant.name}
                                    </span>
                                  </p>

                                  {row.history.length === 0 ? (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      Todavía no sumó puntos en subtorneos
                                      finalizados.
                                    </p>
                                  ) : (
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      {row.history.map((item) => (
                                        <div
                                          key={`${row.participant.id}-${item.subtournamentId}`}
                                          className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/90"
                                        >
                                          <div className="min-w-0">
                                            <p className="truncate font-bold text-slate-800 dark:text-slate-100">
                                              {item.subtournamentName}
                                            </p>
                                            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                              {item.matchdayName}
                                              {item.isTeamBased
                                                ? ` · Equipo: ${item.entryName}`
                                                : ''}
                                            </p>
                                          </div>

                                          <div className="ml-2 flex shrink-0 items-center gap-1.5">
                                            <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                              <Medal className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                                              <span>{item.rank ?? '-'}°</span>
                                            </span>
                                            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-extrabold text-emerald-800 dark:text-emerald-300">
                                              +{formatPoints(item.points)}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}