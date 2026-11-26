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
  User,
  Users,
  Zap,
} from 'lucide-react';
import { resolveParticipantAvatar } from '../utils/avatarUpload';
import { getSubtournamentFormatMeta } from '../utils/customTournamentEngine';
import { computeTournamentElo } from '../utils/eloEngine';
import {
  computeCustomPairStats,
  computeCustomStats,
  computeLastStandingStats,
  computeMatchBasedStats,
  computeMatchH2H,
} from '../utils/tournamentStatsEngine';
import Avatar from './Avatar';
import EloRankingWidget from './EloRankingWidget';

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
  participants = [],
  matches = [],
  eliminations = [],
  customMatchdays = [],
  subtournaments = [],
  subEntries = [],
  subEntryMembers = [],
  subMatches = [],
  subEliminations = [],
  currentUserId,
  onOpenPlayerCard = null,
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

  // Cálculo del Ranking Elo del torneo
  const eloRows = useMemo(() => {
    return computeTournamentElo({
      tournament,
      participants,
      matches,
      customMatchdays,
      subtournaments,
      subEntries,
      subEntryMembers,
      subMatches,
    });
  }, [
    tournament,
    participants,
    matches,
    customMatchdays,
    subtournaments,
    subEntries,
    subEntryMembers,
    subMatches,
  ]);

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
        eloRows={eloRows}
        onOpenPlayerCard={onOpenPlayerCard}
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
      eloRows={eloRows}
      onOpenPlayerCard={onOpenPlayerCard}
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
  eloRows,
  onOpenPlayerCard,
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

      {stats.completedCount > 0 && (
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
      )}

      {/* Widget Ranking Elo FIFA */}
      {eloRows && eloRows.some((r) => r.matchesPlayed > 0) && (
        <EloRankingWidget
          eloRows={eloRows}
          currentUserId={currentUserId}
          onOpenCard={onOpenPlayerCard}
        />
      )}

      {/* Ficha individual del jugador */}
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

            <div className="flex items-center gap-2">
              {onOpenPlayerCard && (
                <button
                  type="button"
                  onClick={() => onOpenPlayerCard(selectedStats.participant)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-200"
                >
                  <span>🎴</span>
                  <span>Ver Carta EA FC</span>
                </button>
              )}

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
        </div>
      )}

      {/* Cara a Cara (H2H) */}
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
            lsStats.champion ? 'Último superviviente' : 'Se define al quedar 1'
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
  eloRows,
  onOpenPlayerCard,
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

      {/* Widget Ranking Elo FIFA en Torneos Personalizados */}
      {eloRows && eloRows.some((r) => r.matchesPlayed > 0) && (
        <EloRankingWidget
          eloRows={eloRows}
          currentUserId={currentUserId}
          onOpenCard={onOpenPlayerCard}
        />
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

            <div className="flex items-center gap-2">
              {onOpenPlayerCard && (
                <button
                  type="button"
                  onClick={() => onOpenPlayerCard(selectedStats.participant)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-200"
                >
                  <span>🎴</span>
                  <span>Ver Carta EA FC</span>
                </button>
              )}

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
          </div>
        </div>
      )}
    </div>
  );
}