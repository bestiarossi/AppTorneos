import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles, TrendingUp } from 'lucide-react';
import { resolveParticipantAvatar } from '../utils/avatarUpload';
import Avatar from './Avatar';

export default function EloRankingWidget({
  eloRows = [],
  currentUserId = null,
  onOpenCard = null,
}) {
  if (!eloRows || eloRows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Ranking Elo del Torneo
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Pondera victorias según la dificultad del rival (base 1200 pts)
            </p>
          </div>
        </div>

        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Algoritmo FIFA / Ajedrez
        </span>
      </div>

      <div className="divide-y divide-slate-100 tabular-nums dark:divide-slate-800">
        {eloRows.map((row) => {
          const isMine =
            Boolean(currentUserId) && row.participant.user_id === currentUserId;

          return (
            <motion.div
              key={row.participant.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center justify-between gap-3 py-2.5 transition ${
                isMine ? 'bg-emerald-50/50 px-2 rounded-xl dark:bg-emerald-500/10' : ''
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="w-5 text-center text-xs font-black text-slate-400 dark:text-slate-500">
                  {row.rank}
                </span>

                <Avatar
                  name={row.participant.name}
                  url={resolveParticipantAvatar(row.participant)}
                  size="sm"
                  highlight={isMine}
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-xs font-extrabold text-slate-900 sm:text-sm dark:text-white">
                      {row.participant.name}
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold ${row.tier.badgeClass}`}
                    >
                      <span>{row.tier.emoji}</span>
                      <span className="hidden sm:inline">{row.tier.label}</span>
                    </span>
                    {isMine && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                        Tú
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    {row.wins}G · {row.draws}E · {row.losses}P ({row.matchesPlayed} PJ)
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="text-right">
                  <p className="font-mono text-sm font-black text-slate-900 dark:text-white">
                    {row.currentElo}
                  </p>
                  <p
                    className={`flex items-center justify-end text-[10px] font-bold ${
                      row.overallDelta > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : row.overallDelta < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {row.overallDelta > 0 ? (
                      <>
                        <ArrowUpRight className="h-3 w-3" />
                        <span>+{row.overallDelta}</span>
                      </>
                    ) : row.overallDelta < 0 ? (
                      <>
                        <ArrowDownRight className="h-3 w-3" />
                        <span>{row.overallDelta}</span>
                      </>
                    ) : (
                      <>
                        <Minus className="h-2.5 w-2.5" />
                        <span>0</span>
                      </>
                    )}
                  </p>
                </div>

                {onOpenCard && (
                  <button
                    type="button"
                    onClick={() => onOpenCard(row.participant)}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-extrabold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-200"
                    title={`Ver Carta EA FC de ${row.participant.name}`}
                  >
                    <Sparkles className="h-3 w-3" />
                    <span className="hidden sm:inline">Carta</span>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}