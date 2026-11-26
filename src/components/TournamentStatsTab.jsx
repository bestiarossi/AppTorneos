import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Crown,
  Flame,
  Handshake,
  Medal,
  ShieldCheck,
  Star,
  Swords,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { resolveParticipantAvatar } from '../utils/avatarUpload';
import { getSubtournamentFormatMeta } from '../utils/customTournamentEngine';
import {
  computeCustomPairStats,
  computeCustomStats,
  computeLastStandingStats,
  computeMatchBasedStats,
  computeMatchH2H,
} from '../utils/tournamentStatsEngine';
import Avatar from './Avatar';

function FormBadge({ item }) {
  const styles =
    item.outcome === 'W'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/35'
      : item.outcome === 'D'
      ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/35'
      : 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/35';

  const letter = item.outcome === 'W' ? 'G' : item.outcome === 'D' ? 'E' : 'P';

  return (
    <span
      title={`${item.roundName}: vs ${item.opponentName} (${item.scoreText})`}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-extrabold ${styles}`}
    >
      {letter}
    </span>
  );
}

function KpiCard({ icon: Icon, iconBg, label, value, subtext }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 truncate text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      {subtext && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {subtext}
        </p>
      )}
    </div>
  );
}

function HighlightCard({
  icon: Icon,
  iconClass,
  title,
  primary,
  secondary,
  participant = null,
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/55">
      {participant ? (
        <Avatar
          name={participant.name}
          url={resolveParticipantAvatar(participant)}
          size="md"
        />
      ) : (
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-700 dark:bg-slate-800 ${iconClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {participant && <Icon className={`h-3.5 w-3.5 ${iconClass}`} />}
          <span>{title}</span>
        </p>
        <p className="mt-0.5 truncate text-sm font-extrabold text-slate-900 dark:text-white">
          {primary}
        </p>
        {secondary && (
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
            {secondary}
          </p>
        )}
      </div>
    </div>
  );
}

export default function TournamentStatsTab({
  tournament,
  participants,
  matches,
  eliminations,
  customMatchdays,
  subtournaments,
  subEntries,
  subEntryMembers,
  subMatches,
  subEliminations,
  currentUserId,
}) {
  const myParticipant = useMemo(
    () => participants.find((p) => p.user_id === currentUserId) || null,
    [participants, currentUserId]
  );

  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [h2hPlayerAId, setH2hPlayerAId] = useState('');
  const [h2hPlayerBId, setH2hPlayerBId] = useState('');

  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants]
  );

  useEffect(() => {
    if (participants.length === 0) {
      setSelectedPlayerId('');
      setH2hPlayerAId('');
      setH2hPlayerBId('');
      return;
    }

    if (!selectedPlayerId || !participantMap.has(selectedPlayerId)) {
      setSelectedPlayerId(myParticipant?.id || participants[0].id);
    }

    if (!h2hPlayerAId || !participantMap.has(h2hPlayerAId)) {
      setH2hPlayerAId(participants[0].id);
    }

    if (!h2hPlayerBId || !participantMap.has(h2hPlayerBId)) {
      const second = participants[1]?.id || participants[0].id;
      setH2hPlayerBId(second);
    }
  }, [
    participants,
    participantMap,
    myParticipant,
    selectedPlayerId,
    h2hPlayerAId,
    h2hPlayerBId,
  ]);

  if (participants.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900/40">
        <BarChart3 className="mx-auto mb-3 h-8 w-8 text-slate-400" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Sin datos estadísticos todavía
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Agrega participantes al torneo para comenzar a registrar estadísticas.
        </p>
      </div>
    );
  }

  if (tournament.format === 'last_standing') {
    return (
      <LastStandingStatsView
        participants={participants}
        eliminations={eliminations}
        currentUserId={currentUserId}
      />
    );
  }

  if (tournament.format === 'custom') {
    return (
      <CustomStatsView
        participants={participants}
        participantMap={participantMap}
        matchdays={customMatchdays}
        subtournaments={subtournaments}
        subEntries={subEntries}
        subEntryMembers={subEntryMembers}
        subMatches={subMatches}
        subEliminations={subEliminations}
        currentUserId={currentUserId}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={setSelectedPlayerId}
        h2hPlayerAId={h2hPlayerAId}
        h2hPlayerBId={h2hPlayerBId}
        onSelectH2HA={setH2hPlayerAId}
        onSelectH2HB={setH2hPlayerBId}
      />
    );
  }

  return (
    <MatchBasedStatsView
      tournament={tournament}
      participants={participants}
      participantMap={participantMap}
      matches={matches}
      currentUserId={currentUserId}
      selectedPlayerId={selectedPlayerId}
      onSelectPlayer={setSelectedPlayerId}
      h2hPlayerAId={h2hPlayerAId}
      h2hPlayerBId={h2hPlayerBId}
      onSelectH2HA={setH2hPlayerAId}
      onSelectH2HB={setH2hPlayerBId}
    />
  );
}

function MatchBasedStatsView({
  tournament,
  participants,
  participantMap,
  matches,
  currentUserId,
  selectedPlayerId,
  onSelectPlayer,
  h2hPlayerAId,
  h2hPlayerBId,
  onSelectH2HA,
  onSelectH2HB,
}) {
  const stats = useMemo(
    () => computeMatchBasedStats(tournament, participants, matches),
    [tournament, participants, matches]
  );

  const selectedStats =
    stats.playerStatsMap.get(selectedPlayerId) ||
    stats.orderedPlayerStats[0] ||
    null;

  const h2h = useMemo(
    () => computeMatchH2H(matches, participantMap, h2hPlayerAId, h2hPlayerBId),
    [matches, participantMap, h2hPlayerAId, h2hPlayerBId]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={CheckCircle2}
          iconBg="bg-emerald-50 text-emerald-600"
          label="Progreso"
          value={`${stats.progressPct}%`}
          subtext={`${stats.completedCount} de ${stats.totalMatches} partidos`}
        />
        <KpiCard
          icon={Activity}
          iconBg="bg-sky-50 text-sky-600"
          label="Goles / Puntos"
          value={stats.scoredMatchesCount > 0 ? stats.totalGoals : '—'}
          subtext={
            stats.avgGoalsPerMatch !== null
              ? `Promedio ${stats.avgGoalsPerMatch} por partido`
              : 'Sin marcadores exactos'
          }
        />
        <KpiCard
          icon={Handshake}
          iconBg="bg-amber-50 text-amber-600"
          label="Empates"
          value={stats.drawsCount}
          subtext={
            stats.completedCount > 0
              ? `${Math.round(
                  (stats.drawsCount / stats.completedCount) * 100
                )}% de los jugados`
              : 'Sin partidos jugados'
          }
        />
        <KpiCard
          icon={TrendingUp}
          iconBg="bg-indigo-50 text-indigo-600"
          label="Mayor eficacia"
          value={
            stats.bestEffectivenessLeader
              ? `${stats.bestEffectivenessLeader.effectivenessPct}%`
              : '—'
          }
          subtext={
            stats.bestEffectivenessLeader
              ? stats.bestEffectivenessLeader.participant.name
              : 'Aún sin datos'
          }
        />
      </div>

      {stats.completedCount > 0 ? (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Award className="h-4 w-4 text-amber-500" />
            <span>Récords y líderes del torneo</span>
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {stats.bestAttack && (
              <HighlightCard
                icon={Zap}
                iconClass="text-emerald-600"
                title="Mejor ataque"
                participant={stats.bestAttack.participant}
                primary={stats.bestAttack.participant.name}
                secondary={`${stats.bestAttack.gf} a favor (${stats.bestAttack.avgGf} por partido)`}
              />
            )}

            {stats.bestDefense && (
              <HighlightCard
                icon={ShieldCheck}
                iconClass="text-sky-600"
                title="Mejor defensa"
                participant={stats.bestDefense.participant}
                primary={stats.bestDefense.participant.name}
                secondary={`${stats.bestDefense.gc} en contra (${stats.bestDefense.avgGc} por partido)`}
              />
            )}

            {stats.bestWinStreakLeader && (
              <HighlightCard
                icon={Flame}
                iconClass="text-orange-600"
                title="Mejor racha ganadora"
                participant={stats.bestWinStreakLeader.participant}
                primary={stats.bestWinStreakLeader.participant.name}
                secondary={`${stats.bestWinStreakLeader.bestWinStreak} ${
                  stats.bestWinStreakLeader.bestWinStreak === 1
                    ? 'victoria seguida'
                    : 'victorias seguidas'
                }`}
              />
            )}

            {stats.biggestMarginMatch && (
              <HighlightCard
                icon={Trophy}
                iconClass="text-amber-600"
                title="Mayor goleada / diferencia"
                primary={`${stats.biggestMarginMatch.winnerName} ${stats.biggestMarginMatch.winnerScore} - ${stats.biggestMarginMatch.loserScore} ${stats.biggestMarginMatch.loserName}`}
                secondary={`Diferencia de +${stats.biggestMarginMatch.margin} (${stats.biggestMarginMatch.roundName})`}
              />
            )}

            {stats.highestScoringMatch && (
              <HighlightCard
                icon={Star}
                iconClass="text-indigo-600"
                title="Partido con más anotaciones"
                primary={`${stats.highestScoringMatch.nameA} ${stats.highestScoringMatch.scoreA} - ${stats.highestScoringMatch.scoreB} ${stats.highestScoringMatch.nameB}`}
                secondary={`${stats.highestScoringMatch.total} goles/puntos totales (${stats.highestScoringMatch.roundName})`}
              />
            )}

            {stats.mostCleanSheetsLeader && (
              <HighlightCard
                icon={Medal}
                iconClass="text-teal-600"
                title="Más vallas invictas"
                participant={stats.mostCleanSheetsLeader.participant}
                primary={stats.mostCleanSheetsLeader.participant.name}
                secondary={`${stats.mostCleanSheetsLeader.cleanSheets} ${
                  stats.mostCleanSheetsLeader.cleanSheets === 1
                    ? 'arco en cero'
                    : 'arcos en cero'
                }`}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
          Carga el resultado de al menos un partido en{' '}
          <strong>Cruces / Jornadas</strong> para desbloquear los récords y
          estadísticas avanzadas.
        </div>
      )}

      {stats.completedCount > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/70">
          <h3 className="mb-1 text-sm font-bold text-slate-900 dark:text-white">
            Efectividad por participante
          </h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Porcentaje de puntos obtenidos sobre el máximo posible en partidos
            jugados.
          </p>

          <div className="space-y-3">
            {stats.orderedPlayerStats.map((st) => {
              const isMine = st.participant.user_id === currentUserId;
              return (
                <div key={st.participant.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={st.participant.name}
                        url={resolveParticipantAvatar(st.participant)}
                        size="xs"
                        highlight={isMine}
                      />
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {st.participant.name}
                      </span>
                      {isMine && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Tú
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                      <span className="hidden text-[11px] sm:inline">
                        {st.pg}G · {st.pe}E · {st.pp}P
                      </span>
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {st.pj > 0 ? `${st.effectivenessPct}%` : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isMine ? 'bg-emerald-600' : 'bg-slate-800 dark:bg-indigo-500'
                      }`}
                      style={{ width: `${st.effectivenessPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedStats && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <Avatar
                name={selectedStats.participant.name}
                url={resolveParticipantAvatar(selectedStats.participant)}
                size="sm"
              />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Ficha individual del jugador
              </h3>
            </div>

            <select
              value={selectedStats.participant.id}
              onChange={(e) => onSelectPlayer(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-bold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none sm:text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                % Victorias
              </p>
              <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                {selectedStats.pj > 0 ? `${selectedStats.winRate}%` : '—'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {selectedStats.pg} de {selectedStats.pj} partidos
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Prom. GF / GC
              </p>
              <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                {selectedStats.avgGf !== null
                  ? `${selectedStats.avgGf} / ${selectedStats.avgGc}`
                  : '—'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {selectedStats.gf} GF · {selectedStats.gc} GC
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Racha invicto máx.
              </p>
              <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                {selectedStats.bestUnbeatenStreak}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Actual: {selectedStats.currentUnbeatenStreak}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Arcos en cero
              </p>
              <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                {selectedStats.cleanSheets}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Mejor racha G: {selectedStats.bestWinStreak}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Últimos partidos
              </p>
              {selectedStats.recentForm.length > 0 ? (
                <div className="mt-2 flex items-center gap-1.5">
                  {selectedStats.recentForm.map((f) => (
                    <FormBadge key={f.matchId} item={f} />
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  Sin partidos jugados aún.
                </p>
              )}
            </div>

            <div className="space-y-1 text-xs">
              {selectedStats.bestWin && (
                <p className="text-emerald-800 dark:text-emerald-300">
                  <strong>Mejor victoria:</strong> {selectedStats.bestWin.forScore}-
                  {selectedStats.bestWin.againstScore} vs{' '}
                  {selectedStats.bestWin.opponentName} (
                  {selectedStats.bestWin.roundName})
                </p>
              )}
              {selectedStats.worstLoss && (
                <p className="text-rose-700 dark:text-rose-300">
                  <strong>Peor derrota:</strong> {selectedStats.worstLoss.forScore}-
                  {selectedStats.worstLoss.againstScore} vs{' '}
                  {selectedStats.worstLoss.opponentName} (
                  {selectedStats.worstLoss.roundName})
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {participants.length >= 2 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Cara a Cara (Historial directo)
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={h2hPlayerAId}
                onChange={(e) => onSelectH2HA(e.target.value)}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-bold text-slate-800 focus:border-emerald-500 focus:outline-none sm:text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <span className="text-xs font-bold text-slate-400">vs</span>

              <select
                value={h2hPlayerBId}
                onChange={(e) => onSelectH2HB(e.target.value)}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-bold text-slate-800 focus:border-emerald-500 focus:outline-none sm:text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {h2hPlayerAId === h2hPlayerBId ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
              Selecciona dos jugadores distintos para comparar su historial.
            </p>
          ) : !h2h || h2h.totalPlayed === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
              {participantMap.get(h2hPlayerAId)?.name} y{' '}
              {participantMap.get(h2hPlayerBId)?.name} todavía no tienen partidos
              completados entre sí en este torneo.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-center dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex flex-col items-center gap-1">
                  <Avatar
                    name={h2h.playerA?.name}
                    url={resolveParticipantAvatar(h2h.playerA)}
                    size="sm"
                  />
                  <p className="max-w-full truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                    {h2h.playerA?.name}
                  </p>
                  <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
                    {h2h.winsA}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Victorias
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Empates
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-700 dark:text-slate-200">
                    {h2h.draws}
                  </p>
                  {h2h.hasAnyScore && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Goles: {h2h.goalsA} - {h2h.goalsB}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1">
                  <Avatar
                    name={h2h.playerB?.name}
                    url={resolveParticipantAvatar(h2h.playerB)}
                    size="sm"
                  />
                  <p className="max-w-full truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                    {h2h.playerB?.name}
                  </p>
                  <p className="text-2xl font-extrabold text-sky-700 dark:text-sky-400">
                    {h2h.winsB}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Victorias
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {h2h.history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                  >
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                      {item.roundName}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {item.hasScores
                        ? `${h2h.playerA?.name} ${item.scoreForA} - ${item.scoreForB} ${h2h.playerB?.name}`
                        : item.winnerSide === 'draw'
                        ? 'Empate'
                        : `Ganó ${
                            item.winnerSide === 'A'
                              ? h2h.playerA?.name
                              : h2h.playerB?.name
                          }`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LastStandingStatsView({ participants, eliminations, currentUserId }) {
  const lsStats = useMemo(
    () => computeLastStandingStats(participants, eliminations),
    [participants, eliminations]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={Users}
          iconBg="bg-slate-100 text-slate-700"
          label="Participantes"
          value={lsStats.totalPlayers}
          subtext="Inscriptos totales"
        />
        <KpiCard
          icon={CheckCircle2}
          iconBg="bg-emerald-50 text-emerald-600"
          label="En pie"
          value={lsStats.aliveCount}
          subtext={`${lsStats.survivalRatePct}% sigue compitiendo`}
        />
        <KpiCard
          icon={Flame}
          iconBg="bg-rose-50 text-rose-600"
          label="Eliminados"
          value={lsStats.eliminatedCount}
          subtext={
            lsStats.aliveCount <= 1
              ? 'Competencia definida'
              : `Faltan ${Math.max(0, lsStats.aliveCount - 1)} bajas`
          }
        />
        <KpiCard
          icon={Crown}
          iconBg="bg-amber-50 text-amber-600"
          label="Campeón"
          value={lsStats.champion ? lsStats.champion.name : 'En juego'}
          subtext={
            lsStats.champion
              ? 'Último superviviente'
              : 'Se define al quedar 1'
          }
        />
      </div>

      {lsStats.eliminatedCount > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lsStats.firstEliminated && (
            <HighlightCard
              icon={Zap}
              iconClass="text-rose-600"
              title="Primer eliminado"
              participant={lsStats.firstEliminated}
              primary={lsStats.firstEliminated.name}
              secondary="Baja #1 de la competencia"
            />
          )}

          {lsStats.lastEliminated && (
            <HighlightCard
              icon={Medal}
              iconClass="text-amber-600"
              title="Último eliminado"
              participant={lsStats.lastEliminated}
              primary={lsStats.lastEliminated.name}
              secondary={`Cayó en el orden #${lsStats.eliminatedCount}`}
            />
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/70">
        <h3 className="mb-1 text-sm font-bold text-slate-900 dark:text-white">
          Índice de resistencia
        </h3>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Comparativa visual según el orden en que cada jugador permaneció en pie.
        </p>

        <div className="space-y-3">
          {lsStats.survivalRows.map((row) => {
            const isMine = row.participant.user_id === currentUserId;
            return (
              <div key={row.participant.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={row.participant.name}
                      url={resolveParticipantAvatar(row.participant)}
                      size="xs"
                      highlight={row.isChampion || isMine}
                    />
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {row.participant.name}
                    </span>
                    {isMine && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Tú
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {row.isChampion
                      ? 'Campeón'
                      : row.isAlive
                      ? 'En pie'
                      : `Eliminado #${row.eliminationOrder}`}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      row.isChampion
                        ? 'bg-amber-500'
                        : row.isAlive
                        ? 'bg-emerald-600'
                        : 'bg-slate-400'
                    }`}
                    style={{ width: `${row.barPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CustomStatsView({
  participants,
  participantMap,
  matchdays,
  subtournaments,
  subEntries,
  subEntryMembers,
  subMatches,
  subEliminations,
  currentUserId,
  selectedPlayerId,
  onSelectPlayer,
  h2hPlayerAId,
  h2hPlayerBId,
  onSelectH2HA,
  onSelectH2HB,
}) {
  const stats = useMemo(
    () =>
      computeCustomStats(
        participants,
        matchdays,
        subtournaments,
        subEntries,
        subEntryMembers,
        subMatches,
        subEliminations
      ),
    [
      participants,
      matchdays,
      subtournaments,
      subEntries,
      subEntryMembers,
      subMatches,
      subEliminations,
    ]
  );

  const selectedStats =
    stats.playerStatsMap.get(selectedPlayerId) ||
    stats.orderedPlayerStats[0] ||
    null;

  const pairStats = useMemo(
    () =>
      computeCustomPairStats(
        h2hPlayerAId,
        h2hPlayerBId,
        participantMap,
        subtournaments,
        subEntries,
        subEntryMembers,
        subMatches
      ),
    [
      h2hPlayerAId,
      h2hPlayerBId,
      participantMap,
      subtournaments,
      subEntries,
      subEntryMembers,
      subMatches,
    ]
  );

  const topPoints = Math.max(
    1,
    stats.orderedPlayerStats[0]?.totalPoints || 1
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={Calendar}
          iconBg="bg-indigo-50 text-indigo-600"
          label="Jornadas"
          value={stats.totalMatchdays}
          subtext={`${stats.totalSubtournaments} subtorneos creados`}
        />
        <KpiCard
          icon={CheckCircle2}
          iconBg="bg-emerald-50 text-emerald-600"
          label="Finalizados"
          value={`${stats.completedSubtournamentsCount}/${stats.totalSubtournaments}`}
          subtext={`${stats.activeSubtournamentsCount} en juego`}
        />
        <KpiCard
          icon={Trophy}
          iconBg="bg-amber-50 text-amber-600"
          label="Puntos repartidos"
          value={stats.totalPointsDistributed}
          subtext={`${stats.formatCounts.teamBased} por equipos · ${stats.formatCounts.individual} indiv.`}
        />
        <KpiCard
          icon={Swords}
          iconBg="bg-sky-50 text-sky-600"
          label="Partidos jugados"
          value={stats.totalInternalMatchesPlayed}
          subtext={`${stats.totalInternalEliminations} bajas en Último en pie`}
        />
      </div>

      {stats.completedSubtournamentsCount > 0 ||
      stats.totalInternalMatchesPlayed > 0 ? (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Award className="h-4 w-4 text-amber-500" />
            <span>Récords y destacados del torneo</span>
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {stats.mostTitlesLeader && (
              <HighlightCard
                icon={Crown}
                iconClass="text-amber-600"
                title="Más subtorneos ganados (1.º)"
                participant={stats.mostTitlesLeader.participant}
                primary={stats.mostTitlesLeader.participant.name}
                secondary={`${stats.mostTitlesLeader.firstPlaces} ${
                  stats.mostTitlesLeader.firstPlaces === 1
                    ? 'título obtenido'
                    : 'títulos obtenidos'
                }`}
              />
            )}

            {stats.mostPodiumsLeader && (
              <HighlightCard
                icon={Medal}
                iconClass="text-indigo-600"
                title="Más podios (Top 3)"
                participant={stats.mostPodiumsLeader.participant}
                primary={stats.mostPodiumsLeader.participant.name}
                secondary={`${stats.mostPodiumsLeader.podiums} podios en ${stats.mostPodiumsLeader.completedSubtournamentsPlayed} subtorneos`}
              />
            )}

            {stats.bestAverageLeader && (
              <HighlightCard
                icon={TrendingUp}
                iconClass="text-emerald-600"
                title="Mejor promedio por subtorneo"
                participant={stats.bestAverageLeader.participant}
                primary={stats.bestAverageLeader.participant.name}
                secondary={`${stats.bestAverageLeader.avgPointsPerSub} pts por participación`}
              />
            )}

            {stats.bestMatchdayOverall && (
              <HighlightCard
                icon={Flame}
                iconClass="text-orange-600"
                title="Mejor Jornada individual"
                participant={stats.bestMatchdayOverall.participant}
                primary={`${stats.bestMatchdayOverall.participant.name} (+${stats.bestMatchdayOverall.points} pts)`}
                secondary={`Conseguido en ${stats.bestMatchdayOverall.matchdayName}`}
              />
            )}

            {stats.biggestInternalMatch && (
              <HighlightCard
                icon={Zap}
                iconClass="text-sky-600"
                title="Mayor goleada interna"
                primary={`${stats.biggestInternalMatch.winnerName} ${stats.biggestInternalMatch.winnerScore} - ${stats.biggestInternalMatch.loserScore} ${stats.biggestInternalMatch.loserName}`}
                secondary={`En "${stats.biggestInternalMatch.subName}" (+${stats.biggestInternalMatch.margin})`}
              />
            )}

            {stats.highestScoringInternalMatch && (
              <HighlightCard
                icon={Star}
                iconClass="text-rose-600"
                title="Cruce con más goles/puntos"
                primary={`${stats.highestScoringInternalMatch.nameA} ${stats.highestScoringInternalMatch.scoreA} - ${stats.highestScoringInternalMatch.scoreB} ${stats.highestScoringInternalMatch.nameB}`}
                secondary={`${stats.highestScoringInternalMatch.total} totales en "${stats.highestScoringInternalMatch.subName}"`}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
          Crea y finaliza subtorneos en <strong>Cruces / Jornadas</strong> para
          comenzar a ver récords, promedios y evolución por jornada.
        </div>
      )}

      {stats.completedSubtournamentsCount > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/70">
          <h3 className="mb-1 text-sm font-bold text-slate-900 dark:text-white">
            Comparativa de puntaje acumulado
          </h3>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Puntaje total sumado por cada participante en la Tabla General.
          </p>

          <div className="space-y-3">
            {stats.orderedPlayerStats.map((st) => {
              const isMine = st.participant.user_id === currentUserId;
              const widthPct = Math.round((st.totalPoints / topPoints) * 100);
              return (
                <div key={st.participant.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={st.participant.name}
                        url={resolveParticipantAvatar(st.participant)}
                        size="xs"
                        highlight={isMine}
                      />
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {st.participant.name}
                      </span>
                      {isMine && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Tú
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-300">
                      <span className="hidden text-[11px] sm:inline">
                        {st.firstPlaces} títulos · {st.podiums} podios
                      </span>
                      <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                        {st.totalPoints} pts
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        isMine ? 'bg-emerald-600' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedStats && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <Avatar
                name={selectedStats.participant.name}
                url={resolveParticipantAvatar(selectedStats.participant)}
                size="sm"
              />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Rendimiento individual
              </h3>
            </div>

            <select
              value={selectedStats.participant.id}
              onChange={(e) => onSelectPlayer(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-bold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none sm:text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Puntos totales
              </p>
              <p className="mt-1 text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                {selectedStats.totalPoints}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Prom: {selectedStats.avgPointsPerSub} / subtorneo
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Títulos / Podios
              </p>
              <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                {selectedStats.firstPlaces} / {selectedStats.podiums}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {selectedStats.bestRank
                  ? `Mejor puesto: ${selectedStats.bestRank}.º`
                  : 'Sin puestos aún'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Subtorneos jugados
              </p>
              <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                {selectedStats.completedSubtournamentsPlayed}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                De {selectedStats.totalSubtournamentsJoined} anotados
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Cruces internos
              </p>
              <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                {selectedStats.internalWins}G-{selectedStats.internalDraws}E-
                {selectedStats.internalLosses}P
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {selectedStats.internalMatchesPlayed} partidos jugados
              </p>
            </div>
          </div>

          {selectedStats.timeline.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Evolución por Jornada
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {selectedStats.timeline.map((tl) => (
                  <div
                    key={tl.matchdayId}
                    className="rounded-xl border border-slate-200 bg-white p-2.5 text-center dark:border-slate-800 dark:bg-slate-900/70"
                  >
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {tl.name}
                    </p>
                    <p className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white">
                      {tl.participated ? `+${tl.points}` : '—'}
                    </p>
                    <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                      Acum: {tl.cumulativePoints} pts
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedStats.history.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Historial de subtorneos ({selectedStats.history.length})
              </p>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {selectedStats.history.map((h) => {
                  const fmtMeta = getSubtournamentFormatMeta(h.format);
                  return (
                    <div
                      key={h.subId}
                      className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {h.subName}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${fmtMeta.badgeClass}`}
                          >
                            {fmtMeta.label}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            · {h.matchdayName}
                          </span>
                        </div>
                        {h.isTeamBased && (
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            Equipo: <strong>{h.entryName}</strong>
                            {h.teammates.length > 0
                              ? ` (con ${h.teammates.join(', ')})`
                              : ''}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0">
                        {h.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-800">
                            <span>{h.finalRank}.º puesto</span>
                            <span>· +{h.pointsAwarded} pts</span>
                          </span>
                        ) : (
                          <span className="rounded-full bg-sky-100 px-2.5 py-1 font-semibold text-sky-800">
                            En juego
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {participants.length >= 2 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Cara a Cara &amp; Socios de Equipo
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={h2hPlayerAId}
                onChange={(e) => onSelectH2HA(e.target.value)}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-bold text-slate-800 focus:border-emerald-500 focus:outline-none sm:text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <span className="text-xs font-bold text-slate-400">vs</span>

              <select
                value={h2hPlayerBId}
                onChange={(e) => onSelectH2HB(e.target.value)}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-bold text-slate-800 focus:border-emerald-500 focus:outline-none sm:text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {h2hPlayerAId === h2hPlayerBId ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
              Selecciona dos jugadores distintos para comparar su historial.
            </p>
          ) : !pairStats ? null : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-center dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Cruces directos
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                    {pairStats.matchWinsA} - {pairStats.matchDraws} -{' '}
                    {pairStats.matchWinsB}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {pairStats.playerA?.name} / Empates / {pairStats.playerB?.name}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-center dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Tabla compartida
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                    {pairStats.aheadCountA} - {pairStats.aheadCountB}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Veces mejor ubicado ({pairStats.timesOpponentsInCompletedSubs}{' '}
                    subtorneos)
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-center dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Como compañeros
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-indigo-700 dark:text-indigo-400">
                    {pairStats.timesTeammates}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {pairStats.teammateWins}{' '}
                    {pairStats.teammateWins === 1
                      ? 'subtorneo ganado juntos'
                      : 'subtorneos ganados juntos'}
                  </p>
                </div>
              </div>

              {pairStats.directMatches.length > 0 && (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {pairStats.directMatches.map((dm) => (
                    <div
                      key={dm.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
                    >
                      <span className="text-slate-500 dark:text-slate-400">
                        <strong className="text-slate-700 dark:text-slate-200">
                          {dm.subName}
                        </strong>{' '}
                        · {dm.roundName}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {dm.hasScores
                          ? `${pairStats.playerA?.name} ${dm.scoreForA} - ${dm.scoreForB} ${pairStats.playerB?.name}`
                          : dm.winnerSide === 'draw'
                          ? 'Empate'
                          : `Ganó ${
                              dm.winnerSide === 'A'
                                ? pairStats.playerA?.name
                                : pairStats.playerB?.name
                            }`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}