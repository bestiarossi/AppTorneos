import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Check,
  Copy,
  Crown,
  Flame,
  Handshake,
  Image as ImageIcon,
  Medal,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Trophy,
  Utensils,
} from 'lucide-react';
import { resolveParticipantAvatar } from '../utils/avatarUpload';
import {
  buildTournamentSummaryWhatsAppText,
  computeQuickH2H,
  computeTournamentSummary,
} from '../utils/statsEngine';
import { copyTextToClipboard } from '../utils/whatsappShare';
import Avatar from './Avatar';
import ShareCardModal from './ShareCardModal';
import { useToast } from './ToastProvider';
import WhatsAppShareButton from './WhatsAppShareButton';

const PODIUM_STYLES = {
  1: {
    cardClass: 'podium-gold sm:-translate-y-1.5',
    badgeClass:
      'bg-amber-400/25 text-amber-900 border-amber-400/60 dark:text-amber-200',
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

function AwardCard({
  icon: Icon,
  accentClass,
  badgeText,
  participant,
  secondaryParticipant = null,
  headline,
  detail,
  delay = 0,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay }}
      className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-2xs backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/65"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${accentClass}`}
        >
          <Icon className="h-3.5 w-3.5" />
          <span>{badgeText}</span>
        </span>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex shrink-0 items-center -space-x-2">
          <Avatar
            name={participant?.name}
            url={resolveParticipantAvatar(participant)}
            size="md"
          />
          {secondaryParticipant && (
            <Avatar
              name={secondaryParticipant?.name}
              url={resolveParticipantAvatar(secondaryParticipant)}
              size="sm"
              className="ring-2 ring-white dark:ring-slate-900"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-900 dark:text-white">
            {participant?.name}
            {secondaryParticipant ? ` vs ${secondaryParticipant.name}` : ''}
          </p>
          <p className="mt-0.5 text-xs font-bold text-slate-700 dark:text-slate-200">
            {headline}
          </p>
          {detail && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {detail}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function TournamentSummaryTab({
  tournament,
  participants = [],
  matches = [],
  eliminations = [],
  customMatchdays = [],
  subtournaments = [],
  subEntries = [],
  subEntryMembers = [],
  subMatches = [],
  currentUserId,
  prodeLeader = null,
}) {
  const toast = useToast();
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isShareCardOpen, setIsShareCardOpen] = useState(false);
  const [h2hPlayerAId, setH2hPlayerAId] = useState('');
  const [h2hPlayerBId, setH2hPlayerBId] = useState('');

  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants]
  );

  useEffect(() => {
    if (participants.length === 0) {
      setH2hPlayerAId('');
      setH2hPlayerBId('');
      return;
    }

    if (!h2hPlayerAId || !participantMap.has(h2hPlayerAId)) {
      const mine = participants.find((p) => p.user_id === currentUserId);
      setH2hPlayerAId(mine?.id || participants[0].id);
    }

    if (!h2hPlayerBId || !participantMap.has(h2hPlayerBId)) {
      const other =
        participants.find((p) => p.id !== (h2hPlayerAId || participants[0].id)) ||
        participants[0];
      setH2hPlayerBId(other.id);
    }
  }, [participants, participantMap, currentUserId, h2hPlayerAId, h2hPlayerBId]);

  const summary = useMemo(
    () =>
      computeTournamentSummary({
        tournament,
        participants,
        matches,
        eliminations,
        customMatchdays,
        subtournaments,
        subEntries,
        subEntryMembers,
        subMatches,
      }),
    [
      tournament,
      participants,
      matches,
      eliminations,
      customMatchdays,
      subtournaments,
      subEntries,
      subEntryMembers,
      subMatches,
    ]
  );

  const quickH2H = useMemo(
    () =>
      computeQuickH2H({
        tournament,
        participantMap,
        playerAId: h2hPlayerAId,
        playerBId: h2hPlayerBId,
        matches,
        customMatchdays,
        subtournaments,
        subEntries,
        subEntryMembers,
        subMatches,
      }),
    [
      tournament,
      participantMap,
      h2hPlayerAId,
      h2hPlayerBId,
      matches,
      customMatchdays,
      subtournaments,
      subEntries,
      subEntryMembers,
      subMatches,
    ]
  );

  async function handleCopySummary() {
    const text = buildTournamentSummaryWhatsAppText(tournament, summary);
    if (!text) return;
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedSummary(true);
      toast.success('¡Resumen copiado para WhatsApp!');
      setTimeout(() => setCopiedSummary(false), 2200);
    }
  }

  if (participants.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900/40">
        <Sparkles className="mx-auto mb-3 h-8 w-8 text-slate-400" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Resumen del torneo vacío
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Agrega participantes y registra resultados para desbloquear los premios y curiosidades.
        </p>
      </div>
    );
  }

  const podiumDisplayOrder =
    summary.podium.length >= 3
      ? [
          summary.podium.find((p) => p.place === 2),
          summary.podium.find((p) => p.place === 1),
          summary.podium.find((p) => p.place === 3),
        ].filter(Boolean)
      : summary.podium;

  const hasAnyAward = Boolean(
    summary.mvp ||
      summary.woodenSpoon ||
      summary.biggestDaddy ||
      summary.drawKing ||
      summary.goalMachine ||
      summary.sieveDefense ||
      summary.unbeatenStreak ||
      summary.rollerCoaster
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Resumen y Premios del Torneo</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {summary.progressLabel || 'Estadísticas reales y curiosidades entre amigos'}
          </p>
        </div>

        {summary.hasData && (
          <div className="flex flex-wrap items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={() => setIsShareCardOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-violet-500"
            >
              <ImageIcon className="h-4 w-4" />
              <span>Placa PNG</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={handleCopySummary}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                copiedSummary
                  ? 'border-emerald-300 bg-emerald-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {copiedSummary ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span className="hidden sm:inline">Copiar resumen</span>
                  <span className="sm:hidden">Texto</span>
                </>
              )}
            </motion.button>

            <WhatsAppShareButton
              compact
              label="WhatsApp"
              getText={() => buildTournamentSummaryWhatsAppText(tournament, summary)}
            />
          </div>
        )}
      </div>

      {podiumDisplayOrder.length > 0 && (
        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
          {podiumDisplayOrder.map((item, idx) => {
            const style = PODIUM_STYLES[item.place] || PODIUM_STYLES[3];
            const Icon = item.place === 1 ? Crown : Medal;
            const isMine =
              Boolean(currentUserId) && item.participant.user_id === currentUserId;

            return (
              <motion.div
                key={`${item.place}-${item.participant.id}`}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 360,
                  damping: 26,
                  delay: idx * 0.05,
                }}
                className={`flex flex-col justify-between rounded-2xl border p-4 backdrop-blur-sm ${style.cardClass}`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${style.badgeClass}`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${style.iconClass}`} />
                    <span>{style.label}</span>
                  </span>

                  {isMine && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      Tú
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Avatar
                    name={item.participant.name}
                    url={resolveParticipantAvatar(item.participant)}
                    size="lg"
                    highlight={item.place === 1}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                      {item.participant.name}
                    </p>
                    <p className="text-xs font-extrabold text-emerald-700 tabular-nums dark:text-emerald-300">
                      {item.metric}
                    </p>
                    <p className="truncate text-[11px] text-slate-600 dark:text-slate-300">
                      {item.subtext}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {!hasAnyAward ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
          Todavía no hay suficientes partidos o subtorneos finalizados para repartir los premios (MVP, Paternidad, Cuchara de Madera, etc.).
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {summary.mvp && (
            <AwardCard
              icon={Star}
              accentClass="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-300"
              badgeText="MVP / Mejor Desempeño"
              participant={summary.mvp.participant}
              headline={summary.mvp.headline}
              detail={summary.mvp.detail}
              delay={0.02}
            />
          )}

          {summary.woodenSpoon && (
            <AwardCard
              icon={Utensils}
              accentClass="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-300"
              badgeText="Cuchara de Madera"
              participant={summary.woodenSpoon.participant}
              headline={summary.woodenSpoon.headline}
              detail={summary.woodenSpoon.detail}
              delay={0.05}
            />
          )}

          {summary.biggestDaddy && (
            <AwardCard
              icon={Trophy}
              accentClass="border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/35 dark:bg-violet-500/15 dark:text-violet-300"
              badgeText="Mayor Paternidad"
              participant={summary.biggestDaddy.parent}
              secondaryParticipant={summary.biggestDaddy.child}
              headline={summary.biggestDaddy.headline}
              detail={summary.biggestDaddy.detail}
              delay={0.08}
            />
          )}

          {summary.drawKing && (
            <AwardCard
              icon={Handshake}
              accentClass="border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/35 dark:bg-sky-500/15 dark:text-sky-300"
              badgeText="El Abonado al Empate"
              participant={summary.drawKing.participant}
              headline={summary.drawKing.headline}
              detail={summary.drawKing.detail}
              delay={0.11}
            />
          )}

          {summary.goalMachine && (
            <AwardCard
              icon={Flame}
              accentClass="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-300"
              badgeText="Máquina de Goles"
              participant={summary.goalMachine.participant}
              headline={summary.goalMachine.headline}
              detail={summary.goalMachine.detail}
              delay={0.14}
            />
          )}

          {summary.sieveDefense && (
            <AwardCard
              icon={ShieldAlert}
              accentClass="border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/35 dark:bg-orange-500/15 dark:text-orange-300"
              badgeText="El Colador"
              participant={summary.sieveDefense.participant}
              headline={summary.sieveDefense.headline}
              detail={summary.sieveDefense.detail}
              delay={0.17}
            />
          )}

          {summary.unbeatenStreak && (
            <AwardCard
              icon={ShieldCheck}
              accentClass="border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-500/35 dark:bg-teal-500/15 dark:text-teal-300"
              badgeText="Racha Imbatible"
              participant={summary.unbeatenStreak.participant}
              headline={summary.unbeatenStreak.headline}
              detail={summary.unbeatenStreak.detail}
              delay={0.2}
            />
          )}

          {summary.rollerCoaster && (
            <AwardCard
              icon={Activity}
              accentClass="border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/35 dark:bg-indigo-500/15 dark:text-indigo-300"
              badgeText="El Más Irregular (Montaña Rusa)"
              participant={summary.rollerCoaster.participant}
              headline={summary.rollerCoaster.headline}
              detail={summary.rollerCoaster.detail}
              delay={0.23}
            />
          )}
        </div>
      )}

      {participants.length >= 2 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 backdrop-blur-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900/65">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4 text-amber-500" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Selector rápido Mano a Mano (H2H)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Compara el historial directo entre dos jugadores del torneo
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={h2hPlayerAId}
                onChange={(e) => setH2hPlayerAId(e.target.value)}
                aria-label="Primer jugador para comparar"
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-bold text-slate-800 focus:border-emerald-500 focus:outline-none sm:flex-none sm:text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <span className="text-xs font-extrabold text-slate-400">VS</span>

              <select
                value={h2hPlayerBId}
                onChange={(e) => setH2hPlayerBId(e.target.value)}
                aria-label="Segundo jugador para comparar"
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base font-bold text-slate-800 focus:border-emerald-500 focus:outline-none sm:flex-none sm:text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
              Selecciona dos participantes distintos para ver el historial.
            </p>
          ) : !quickH2H || quickH2H.totalPlayed === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
              {participantMap.get(h2hPlayerAId)?.name} y{' '}
              {participantMap.get(h2hPlayerBId)?.name} todavía no se enfrentaron en partidos completados.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-center tabular-nums dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex flex-col items-center gap-1.5">
                  <Avatar
                    name={quickH2H.playerA.name}
                    url={quickH2H.avatarA}
                    size="md"
                    highlight={quickH2H.winsA > quickH2H.winsB}
                  />
                  <p className="max-w-full truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                    {quickH2H.playerA.name}
                  </p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {quickH2H.winsA}
                  </p>
                </div>

                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/70 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <TrendingUp className="h-3 w-3" />
                    <span>{quickH2H.totalPlayed} cruces</span>
                  </span>
                  <p className="mt-2 text-xl font-black text-slate-700 dark:text-slate-200">
                    {quickH2H.draws}
                  </p>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Empates
                  </p>
                  {quickH2H.hasScores && (
                    <p className="mt-1 font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Goles: {quickH2H.goalsA} - {quickH2H.goalsB}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <Avatar
                    name={quickH2H.playerB.name}
                    url={quickH2H.avatarB}
                    size="md"
                    highlight={quickH2H.winsB > quickH2H.winsA}
                  />
                  <p className="max-w-full truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                    {quickH2H.playerB.name}
                  </p>
                  <p className="text-2xl font-black text-sky-600 dark:text-sky-400">
                    {quickH2H.winsB}
                  </p>
                </div>
              </div>

              {quickH2H.recentClashes.length > 0 && (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 dark:divide-slate-800 dark:border-slate-800">
                  {quickH2H.recentClashes.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-xs"
                    >
                      <span className="text-slate-500 dark:text-slate-400">
                        {c.label}
                      </span>
                      <span className="font-bold text-slate-900 tabular-nums dark:text-slate-100">
                        {c.hasScores
                          ? `${quickH2H.playerA.name} ${c.scoreA} - ${c.scoreB} ${quickH2H.playerB.name}`
                          : c.winnerSide === 'draw'
                          ? 'Empate'
                          : `Ganó ${
                              c.winnerSide === 'A'
                                ? quickH2H.playerA.name
                                : quickH2H.playerB.name
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

      <ShareCardModal
        isOpen={isShareCardOpen}
        tournament={tournament}
        summary={summary}
        prodeLeader={prodeLeader}
        onClose={() => setIsShareCardOpen(false)}
      />
    </div>
  );
}