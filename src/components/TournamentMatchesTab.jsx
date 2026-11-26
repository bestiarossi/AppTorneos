import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Crown,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Swords,
  UserX,
  Users,
} from 'lucide-react';
import { resolveParticipantAvatar } from '../utils/avatarUpload';
import {
  computeLastStandingStandings,
  getKnockoutSeriesStatus,
  getSingleMatchWinner,
} from '../utils/tournamentEngine';
import Avatar from './Avatar';

export default function TournamentMatchesTab({
  tournament,
  participants,
  matches,
  eliminations,
  isAdmin,
  currentUserId,
  participantMap,
  generating,
  mutatingElimination,
  onGenerateMatches,
  onOpenMatchModal,
  onEliminateParticipant,
  onRevertElimination,
  onResetAllEliminations,
}) {
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmResetEliminations, setConfirmResetEliminations] =
    useState(false);
  const [leagueFilter, setLeagueFilter] = useState('all');

  async function handleConfirmGenerate() {
    setConfirmRegenerate(false);
    await onGenerateMatches();
  }

  if (tournament.format === 'last_standing') {
    const ls = computeLastStandingStandings(participants, eliminations);
    const canEliminateMore =
      participants.length >= 2 && ls.stillStanding.length > 1;

    return (
      <div className="space-y-6">
        {participants.length < 2 && (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-200">
            Agrega al menos 2 participantes para iniciar la dinámica de Último
            en pie.
          </div>
        )}

        <AnimatePresence>
          {ls.champion && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 360, damping: 26 }}
              className="podium-gold flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5"
            >
              <div className="flex items-center gap-3.5">
                <Avatar
                  name={ls.champion.name}
                  url={resolveParticipantAvatar(ls.champion)}
                  size="lg"
                  highlight
                />
                <div>
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    <Crown className="h-3.5 w-3.5" />
                    <span>¡Tenemos Campeón!</span>
                  </span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    {ls.champion.name}
                  </h3>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Es el único jugador que permanece en pie.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isAdmin && eliminations.length > 0 && (
          <div className="flex justify-end">
            <AnimatePresence mode="wait">
              {!confirmResetEliminations ? (
                <motion.button
                  key="reset-elim-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  type="button"
                  disabled={mutatingElimination}
                  onClick={() => setConfirmResetEliminations(true)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/80 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-rose-600 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-rose-400"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reiniciar eliminaciones</span>
                </motion.button>
              ) : (
                <motion.div
                  key="reset-elim-confirm"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs dark:border-rose-500/30 dark:bg-rose-500/15"
                >
                  <span className="font-semibold text-rose-700 dark:text-rose-200">
                    ¿Volver todos a En pie?
                  </span>
                  <button
                    type="button"
                    disabled={mutatingElimination}
                    onClick={async () => {
                      setConfirmResetEliminations(false);
                      await onResetAllEliminations();
                    }}
                    className="min-h-[44px] rounded-lg bg-rose-600 px-3 py-1 font-semibold text-white hover:bg-rose-700"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    disabled={mutatingElimination}
                    onClick={() => setConfirmResetEliminations(false)}
                    className="min-h-[44px] rounded-lg bg-white px-3 py-1 font-semibold text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Jugadores en pie */}
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/35 p-4 backdrop-blur-xs dark:border-emerald-500/25 dark:bg-emerald-500/8">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-emerald-200">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>En pie ({ls.stillStanding.length})</span>
              </h3>
            </div>

            {ls.stillStanding.length === 0 ? (
              <p className="rounded-xl border border-dashed border-emerald-200 bg-white/70 px-3 py-6 text-center text-xs text-slate-500 dark:border-emerald-500/25 dark:bg-slate-900/50 dark:text-slate-400">
                No quedan jugadores en pie.
              </p>
            ) : (
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {ls.stillStanding.map((player) => {
                    const isMine = player.user_id === currentUserId;
                    const isChamp = ls.champion?.id === player.id;
                    return (
                      <motion.li
                        layout
                        key={player.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94 }}
                        transition={{
                          type: 'spring',
                          stiffness: 380,
                          damping: 28,
                        }}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${
                          isChamp
                            ? 'podium-gold'
                            : 'border-emerald-200/80 bg-white/90 dark:border-emerald-500/25 dark:bg-slate-900/85'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar
                            name={player.name}
                            url={resolveParticipantAvatar(player)}
                            size="sm"
                            highlight={isChamp}
                          />
                          <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {player.name}
                          </span>
                          {isMine && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Tú
                            </span>
                          )}
                        </div>

                        {isAdmin && canEliminateMore && (
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            disabled={mutatingElimination}
                            onClick={() => onEliminateParticipant(player.id)}
                            className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            <span>Eliminar</span>
                          </motion.button>
                        )}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>

          {/* Jugadores eliminados */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-4 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/55">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                <UserX className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span>Eliminados ({ls.eliminated.length})</span>
              </h3>
            </div>

            {ls.eliminated.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-white/80 px-3 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                Todavía no hay jugadores eliminados.
              </p>
            ) : (
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {ls.eliminated.map((player) => {
                    const elim = ls.eliminationMap.get(player.id);
                    return (
                      <motion.li
                        layout
                        key={player.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94 }}
                        transition={{
                          type: 'spring',
                          stiffness: 380,
                          damping: 28,
                        }}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/85"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-extrabold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            #{elim?.elimination_order}
                          </span>
                          <Avatar
                            name={player.name}
                            url={resolveParticipantAvatar(player)}
                            size="xs"
                            className="opacity-70 grayscale"
                          />
                          <span className="truncate text-sm font-medium text-slate-500 line-through dark:text-slate-400">
                            {player.name}
                          </span>
                        </div>

                        {isAdmin && elim && (
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            disabled={mutatingElimination}
                            onClick={() => onRevertElimination(elim)}
                            className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Revertir</span>
                          </motion.button>
                        )}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (tournament.format !== 'league' && tournament.format !== 'knockout') {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900/40">
        <Swords className="mx-auto mb-3 h-8 w-8 text-slate-400" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Formato personalizado
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
          La generación automática de cruces está disponible para Liga,
          Eliminatoria y Último en pie.
        </p>
      </div>
    );
  }

  if (matches.length === 0) {
    const canGenerate = participants.length >= 2;
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900/40"
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-xs dark:bg-slate-800 dark:text-emerald-400">
          <Swords className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {tournament.format === 'league'
            ? 'Fixture de Liga sin generar'
            : 'Llaves de Eliminatoria sin generar'}
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
          {!canGenerate
            ? 'Necesitas al menos 2 participantes en la lista para poder sortear los cruces.'
            : isAdmin
            ? `Hay ${participants.length} participantes listos. Genera el fixture automáticamente para comenzar.`
            : 'El administrador todavía no generó los cruces del torneo.'}
        </p>

        {isAdmin && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            disabled={!canGenerate || generating}
            onClick={onGenerateMatches}
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>{generating ? 'Generando cruces...' : 'Generar cruces'}</span>
          </motion.button>
        )}
      </motion.div>
    );
  }

  const regularMatches = matches.filter((m) => !m.is_bye);
  const completedRegularMatches = regularMatches.filter(
    (m) => m.status === 'completed'
  );
  const progressPct =
    regularMatches.length > 0
      ? Math.round(
          (completedRegularMatches.length / regularMatches.length) * 100
        )
      : 0;

  const headerControls = (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/75 px-4 py-3 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-1 flex-col gap-1.5 sm:max-w-xs">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              {completedRegularMatches.length} de {regularMatches.length}{' '}
              partidos completados
            </span>
          </span>
          <span className="font-bold text-emerald-700 dark:text-emerald-300">
            {progressPct}%
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
          />
        </div>
      </div>

      {isAdmin && (
        <div>
          <AnimatePresence mode="wait">
            {!confirmRegenerate ? (
              <motion.button
                key="regen-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                type="button"
                disabled={generating || participants.length < 2}
                onClick={() => setConfirmRegenerate(true)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Regenerar cruces</span>
              </motion.button>
            ) : (
              <motion.div
                key="regen-confirm"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs dark:border-amber-500/30 dark:bg-amber-500/15"
              >
                <span className="font-semibold text-amber-900 dark:text-amber-200">
                  Se borrarán resultados actuales. ¿Regenerar?
                </span>
                <button
                  type="button"
                  disabled={generating}
                  onClick={handleConfirmGenerate}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {generating && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Sí, regenerar</span>
                </button>
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => setConfirmRegenerate(false)}
                  className="min-h-[44px] rounded-lg bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  // Vista de LIGA
  if (tournament.format === 'league') {
    const roundsMap = new Map();
    matches.forEach((m) => {
      if (!roundsMap.has(m.round_number)) {
        roundsMap.set(m.round_number, {
          roundNumber: m.round_number,
          roundName: m.round_name,
          regular: [],
          byeMatch: null,
        });
      }
      const bucket = roundsMap.get(m.round_number);
      if (m.is_bye) {
        bucket.byeMatch = m;
      } else {
        bucket.regular.push(m);
      }
    });

    const roundGroups = Array.from(roundsMap.values()).sort(
      (a, b) => a.roundNumber - b.roundNumber
    );

    const visibleGroups = roundGroups
      .map((group) => ({
        ...group,
        regular: group.regular.filter((m) => {
          if (leagueFilter === 'pending') return m.status === 'pending';
          if (leagueFilter === 'completed') return m.status === 'completed';
          return true;
        }),
      }))
      .filter((group) => group.regular.length > 0 || leagueFilter === 'all');

    return (
      <div>
        {headerControls}

        <div className="mb-4 inline-flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-950/70">
          {[
            { id: 'all', label: 'Todas las fechas' },
            { id: 'pending', label: 'Pendientes' },
            { id: 'completed', label: 'Jugados' },
          ].map((filterItem) => {
            const active = leagueFilter === filterItem.id;
            return (
              <button
                key={filterItem.id}
                type="button"
                onClick={() => setLeagueFilter(filterItem.id)}
                className={`relative min-h-[44px] rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                  active
                    ? 'text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="league-filter-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 shadow-xs"
                  />
                )}
                <span className="relative z-10">{filterItem.label}</span>
              </button>
            );
          })}
        </div>

        {visibleGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 py-10 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
            No hay partidos para el filtro seleccionado.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleGroups.map((group, groupIdx) => {
              const byePlayer = group.byeMatch
                ? participantMap.get(group.byeMatch.participant_a_id)
                : null;

              return (
                <motion.div
                  key={group.roundNumber}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.22,
                    delay: Math.min(groupIdx * 0.04, 0.3),
                  }}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-2xs backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/90 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/90">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {group.roundName}
                    </h3>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {
                        group.regular.filter((m) => m.status === 'completed')
                          .length
                      }
                      /{group.regular.length} jugados
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {group.regular.map((m) => {
                      const pA = participantMap.get(m.participant_a_id);
                      const pB = participantMap.get(m.participant_b_id);
                      const isCompleted = m.status === 'completed';
                      const hasScores = m.score_a !== null && m.score_b !== null;
                      const winnerId = getSingleMatchWinner(m);
                      const isDraw =
                        isCompleted &&
                        (m.is_draw || (hasScores && m.score_a === m.score_b));
                      const canEdit = isAdmin && pA && pB;

                      const RowTag = canEdit ? motion.button : motion.div;

                      return (
                        <RowTag
                          key={m.id}
                          {...(canEdit
                            ? {
                                type: 'button',
                                whileTap: { scale: 0.995 },
                                onClick: () => onOpenMatchModal(m, null),
                              }
                            : {})}
                          className={`flex min-h-[52px] w-full items-center justify-between gap-2 px-3 py-3 text-left transition-colors sm:gap-3 sm:px-4 ${
                            canEdit
                              ? 'cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-500/10'
                              : ''
                          }`}
                        >
                          <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
                            <div className="flex min-w-0 items-center justify-end gap-2">
                              <span
                                className={`truncate text-right text-xs sm:text-sm ${
                                  winnerId === m.participant_a_id
                                    ? 'font-extrabold text-emerald-700 dark:text-emerald-400'
                                    : isDraw
                                    ? 'font-semibold text-slate-700 dark:text-slate-300'
                                    : 'font-medium text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {pA?.name || 'Por definir'}
                              </span>
                              <Avatar
                                name={pA?.name || '?'}
                                url={resolveParticipantAvatar(pA)}
                                size="xs"
                                className="hidden sm:inline-flex"
                              />
                            </div>

                            <div className="flex min-w-[68px] justify-center sm:min-w-[78px]">
                              {!isCompleted ? (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                  <Clock className="h-3 w-3" />
                                  <span>vs</span>
                                </span>
                              ) : hasScores ? (
                                <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white shadow-2xs dark:border dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-200">
                                  {m.score_a} - {m.score_b}
                                </span>
                              ) : isDraw ? (
                                <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                                  Empate
                                </span>
                              ) : (
                                <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                  {winnerId === m.participant_a_id
                                    ? 'G - P'
                                    : 'P - G'}
                                </span>
                              )}
                            </div>

                            <div className="flex min-w-0 items-center justify-start gap-2">
                              <Avatar
                                name={pB?.name || '?'}
                                url={resolveParticipantAvatar(pB)}
                                size="xs"
                                className="hidden sm:inline-flex"
                              />
                              <span
                                className={`truncate text-left text-xs sm:text-sm ${
                                  winnerId === m.participant_b_id
                                    ? 'font-extrabold text-emerald-700 dark:text-emerald-400'
                                    : isDraw
                                    ? 'font-semibold text-slate-700 dark:text-slate-300'
                                    : 'font-medium text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {pB?.name || 'Por definir'}
                              </span>
                            </div>
                          </div>

                          {canEdit && (
                            <span className="shrink-0 rounded-lg p-1 text-slate-400">
                              <Pencil className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </RowTag>
                      );
                    })}
                  </div>

                  {byePlayer && (
                    <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Fecha libre:
                      </span>
                      <Avatar
                        name={byePlayer.name}
                        url={resolveParticipantAvatar(byePlayer)}
                        size="xs"
                      />
                      <span>{byePlayer.name}</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Vista de ELIMINATORIA
  const roundsMap = new Map();
  let thirdPlaceMatch = null;

  matches.forEach((m) => {
    if (m.round_name === 'Tercer puesto') {
      thirdPlaceMatch = m;
      return;
    }
    if (!roundsMap.has(m.round_number)) {
      roundsMap.set(m.round_number, {
        roundNumber: m.round_number,
        roundName: m.round_name,
        tiesMap: new Map(),
      });
    }
    const roundBucket = roundsMap.get(m.round_number);
    if (!roundBucket.tiesMap.has(m.match_order)) {
      roundBucket.tiesMap.set(m.match_order, []);
    }
    roundBucket.tiesMap.get(m.match_order).push(m);
  });

  const knockoutRounds = Array.from(roundsMap.values())
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .map((round) => ({
      roundNumber: round.roundNumber,
      roundName: round.roundName,
      ties: Array.from(round.tiesMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([matchOrder, tieMatches]) => ({
          matchOrder,
          tieMatches: [...tieMatches].sort((a, b) => a.leg - b.leg),
        })),
    }));

  return (
    <div>
      {headerControls}

      <div className="flex gap-4 overflow-x-auto pb-3">
        {knockoutRounds.map((round, roundIdx) => (
          <motion.div
            key={round.roundNumber}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.25,
              delay: Math.min(roundIdx * 0.06, 0.3),
            }}
            className="flex min-w-[275px] flex-1 flex-col gap-3"
          >
            <div className="rounded-xl border border-slate-200/80 bg-slate-100/85 px-3.5 py-2 text-center backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/90">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                {round.roundName}
              </h3>
            </div>

            <div className="flex flex-1 flex-col justify-around gap-3">
              {round.ties.map(({ matchOrder, tieMatches }) => {
                const series = getKnockoutSeriesStatus(tieMatches);
                const leg1 = tieMatches[0];
                const leg2 = tieMatches[1] || null;
                const player1 = participantMap.get(series.player1Id);
                const player2 = participantMap.get(series.player2Id);

                if (series.isBye) {
                  return (
                    <div
                      key={matchOrder}
                      className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/45"
                    >
                      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                        <span>Llave {matchOrder}</span>
                        <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Pase libre (BYE)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={player1?.name || 'Jugador'}
                          url={resolveParticipantAvatar(player1)}
                          size="xs"
                        />
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {player1?.name || 'Jugador'}
                        </p>
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        Avanza automáticamente
                      </p>
                    </div>
                  );
                }

                const isSingleLeg = !leg2;

                if (isSingleLeg) {
                  const canEdit =
                    isAdmin &&
                    Boolean(leg1.participant_a_id && leg1.participant_b_id);
                  const hasScores =
                    leg1.score_a !== null && leg1.score_b !== null;
                  const CardTag = canEdit ? motion.button : motion.div;

                  return (
                    <CardTag
                      key={matchOrder}
                      {...(canEdit
                        ? {
                            type: 'button',
                            whileTap: { scale: 0.985 },
                            onClick: () => onOpenMatchModal(leg1, null),
                          }
                        : {})}
                      className={`min-h-[44px] w-full rounded-2xl border bg-white/85 p-3 text-left backdrop-blur-sm transition-colors dark:bg-slate-900/75 ${
                        series.isCompleted
                          ? 'border-emerald-300/80 dark:border-emerald-500/35'
                          : 'border-slate-200/80 dark:border-slate-800'
                      } ${
                        canEdit
                          ? 'cursor-pointer hover:border-emerald-400 hover:shadow-xs dark:hover:border-emerald-400/60'
                          : ''
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold">Llave {matchOrder}</span>
                        {canEdit && <Pencil className="h-3 w-3" />}
                      </div>

                      <div className="space-y-1.5">
                        <div
                          className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-sm ${
                            series.winnerId === leg1.participant_a_id
                              ? 'bg-emerald-500/15 font-extrabold text-emerald-900 dark:text-emerald-200'
                              : 'bg-slate-50/90 font-medium text-slate-700 dark:bg-slate-950/60 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar
                              name={player1?.name || '?'}
                              url={resolveParticipantAvatar(player1)}
                              size="xs"
                            />
                            <span className="truncate">
                              {player1?.name || 'Por definir'}
                            </span>
                          </div>
                          <span className="ml-2 font-mono text-xs font-bold">
                            {hasScores
                              ? leg1.score_a
                              : series.winnerId === leg1.participant_a_id
                              ? 'G'
                              : ''}
                          </span>
                        </div>

                        <div
                          className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-sm ${
                            series.winnerId === leg1.participant_b_id
                              ? 'bg-emerald-500/15 font-extrabold text-emerald-900 dark:text-emerald-200'
                              : 'bg-slate-50/90 font-medium text-slate-700 dark:bg-slate-950/60 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar
                              name={player2?.name || '?'}
                              url={resolveParticipantAvatar(player2)}
                              size="xs"
                            />
                            <span className="truncate">
                              {player2?.name || 'Por definir'}
                            </span>
                          </div>
                          <span className="ml-2 font-mono text-xs font-bold">
                            {hasScores
                              ? leg1.score_b
                              : series.winnerId === leg1.participant_b_id
                              ? 'G'
                              : ''}
                          </span>
                        </div>
                      </div>

                      {series.resolvedByTiebreak && (
                        <p className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                          Avanza por desempate:{' '}
                          {participantMap.get(series.winnerId)?.name}
                        </p>
                      )}
                    </CardTag>
                  );
                }

                // Llave ida y vuelta
                const bothPlayersReady = Boolean(
                  leg1.participant_a_id && leg1.participant_b_id
                );

                return (
                  <div
                    key={matchOrder}
                    className={`rounded-2xl border bg-white/85 p-3 backdrop-blur-sm dark:bg-slate-900/75 ${
                      series.isCompleted
                        ? 'border-emerald-300/80 dark:border-emerald-500/35'
                        : 'border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold">Llave {matchOrder}</span>
                      {series.hasAggregate && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          Global: {series.agg1} - {series.agg2}
                        </span>
                      )}
                    </div>

                    <div className="mb-2.5 space-y-1">
                      <div
                        className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-1 text-xs ${
                          series.winnerId === series.player1Id
                            ? 'bg-emerald-500/15 font-extrabold text-emerald-900 dark:text-emerald-200'
                            : 'bg-slate-50/90 font-medium text-slate-700 dark:bg-slate-950/60 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Avatar
                            name={player1?.name || '?'}
                            url={resolveParticipantAvatar(player1)}
                            size="xs"
                          />
                          <span className="truncate">
                            {player1?.name || 'Por definir'}
                          </span>
                        </div>
                        {series.winnerId === series.player1Id && (
                          <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                            Avanza
                          </span>
                        )}
                      </div>

                      <div
                        className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-1 text-xs ${
                          series.winnerId === series.player2Id
                            ? 'bg-emerald-500/15 font-extrabold text-emerald-900 dark:text-emerald-200'
                            : 'bg-slate-50/90 font-medium text-slate-700 dark:bg-slate-950/60 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Avatar
                            name={player2?.name || '?'}
                            url={resolveParticipantAvatar(player2)}
                            size="xs"
                          />
                          <span className="truncate">
                            {player2?.name || 'Por definir'}
                          </span>
                        </div>
                        {series.winnerId === series.player2Id && (
                          <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                            Avanza
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t border-slate-100 pt-2 dark:border-slate-800">
                      {[leg1, leg2].map((legMatch) => {
                        const sibling = legMatch.leg === 1 ? leg2 : leg1;
                        const canEditLeg = isAdmin && bothPlayersReady;
                        const LegTag = canEditLeg ? motion.button : motion.div;
                        const legHasScores =
                          legMatch.score_a !== null && legMatch.score_b !== null;
                        const legWinner = getSingleMatchWinner(legMatch);

                        return (
                          <LegTag
                            key={legMatch.id}
                            {...(canEditLeg
                              ? {
                                  type: 'button',
                                  whileTap: { scale: 0.985 },
                                  onClick: () =>
                                    onOpenMatchModal(legMatch, sibling),
                                }
                              : {})}
                            className={`flex min-h-[44px] w-full items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/70 px-2.5 py-1.5 text-[11px] transition-colors dark:border-slate-800 dark:bg-slate-950/50 ${
                              canEditLeg
                                ? 'cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10'
                                : ''
                            }`}
                          >
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {legMatch.leg === 1 ? 'Ida' : 'Vuelta'}
                            </span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                              {legMatch.status === 'pending'
                                ? 'Pendiente'
                                : legHasScores
                                ? `${legMatch.score_a} - ${legMatch.score_b}`
                                : legWinner
                                ? `Ganó ${
                                    participantMap.get(legWinner)?.name || ''
                                  }`
                                : 'Cargado'}
                            </span>
                          </LegTag>
                        );
                      })}
                    </div>

                    {series.resolvedByTiebreak && (
                      <p className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        Desempate: {participantMap.get(series.winnerId)?.name}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {thirdPlaceMatch && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
          className="podium-bronze mt-5 rounded-2xl border p-4"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-orange-800 dark:text-orange-200">
              Partido por el 3.º puesto
            </h4>
            {isAdmin &&
              thirdPlaceMatch.participant_a_id &&
              thirdPlaceMatch.participant_b_id && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onOpenMatchModal(thirdPlaceMatch, null)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-orange-300/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-orange-800 transition hover:bg-orange-100/70 dark:border-orange-500/35 dark:bg-slate-900/90 dark:text-orange-200 dark:hover:bg-orange-500/20"
                >
                  <Pencil className="h-3 w-3" />
                  <span>
                    {thirdPlaceMatch.status === 'completed'
                      ? 'Editar'
                      : 'Cargar resultado'}
                  </span>
                </motion.button>
              )}
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-orange-200/80 bg-white/90 px-4 py-3 text-sm dark:border-orange-500/25 dark:bg-slate-900/85">
            <div className="flex min-w-0 items-center justify-end gap-2">
              <span
                className={`truncate text-right ${
                  getSingleMatchWinner(thirdPlaceMatch) ===
                  thirdPlaceMatch.participant_a_id
                    ? 'font-extrabold text-emerald-700 dark:text-emerald-400'
                    : 'font-semibold text-slate-800 dark:text-slate-200'
                }`}
              >
                {participantMap.get(thirdPlaceMatch.participant_a_id)?.name ||
                  'Perdedor Semifinal 1'}
              </span>
              <Avatar
                name={
                  participantMap.get(thirdPlaceMatch.participant_a_id)?.name ||
                  '?'
                }
                url={resolveParticipantAvatar(
                  participantMap.get(thirdPlaceMatch.participant_a_id)
                )}
                size="xs"
              />
            </div>

            <span className="rounded-lg bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-100">
              {thirdPlaceMatch.status === 'completed'
                ? thirdPlaceMatch.score_a !== null &&
                  thirdPlaceMatch.score_b !== null
                  ? `${thirdPlaceMatch.score_a} - ${thirdPlaceMatch.score_b}`
                  : 'Definido'
                : 'vs'}
            </span>

            <div className="flex min-w-0 items-center justify-start gap-2">
              <Avatar
                name={
                  participantMap.get(thirdPlaceMatch.participant_b_id)?.name ||
                  '?'
                }
                url={resolveParticipantAvatar(
                  participantMap.get(thirdPlaceMatch.participant_b_id)
                )}
                size="xs"
              />
              <span
                className={`truncate text-left ${
                  getSingleMatchWinner(thirdPlaceMatch) ===
                  thirdPlaceMatch.participant_b_id
                    ? 'font-extrabold text-emerald-700 dark:text-emerald-400'
                    : 'font-semibold text-slate-800 dark:text-slate-200'
                }`}
              >
                {participantMap.get(thirdPlaceMatch.participant_b_id)?.name ||
                  'Perdedor Semifinal 2'}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}