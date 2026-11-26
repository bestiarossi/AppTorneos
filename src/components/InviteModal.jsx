import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Eye,
  Loader2,
  Sparkles,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getFormatMeta } from '../utils/tournamentFormats';
import Avatar from './Avatar';

export default function InviteModal({
  isOpen,
  inviteCode,
  user,
  profile,
  onClose,
  onJoined,
}) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [mode, setMode] = useState('claim'); // 'claim' | 'new_participant' | 'spectator'
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);
  const [newParticipantName, setNewParticipantName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isOpen || !inviteCode || !user) return;

    let active = true;
    setLoading(true);
    setLoadError('');
    setSubmitError('');
    setSelectedParticipantId(null);

    const fallbackName =
      profile?.display_name || user.email?.split('@')[0] || '';
    setNewParticipantName(fallbackName);

    supabase
      .rpc('get_tournament_invite_preview', { p_invite_code: inviteCode })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;

        setPreview(data);

        if (data?.found) {
          const unclaimed = data.unclaimed_participants || [];
          const canSelfJoin = Boolean(data.tournament?.allow_self_join);

          if (unclaimed.length > 0) {
            setMode('claim');
          } else if (canSelfJoin && !data.my_participant) {
            setMode('new_participant');
          } else {
            setMode('spectator');
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(
          err?.message || 'No se pudo cargar la invitación al torneo.'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, inviteCode, user, profile]);

  async function handleConfirmJoin(e) {
    e.preventDefault();
    if (!preview?.found) return;

    setSubmitError('');

    if (mode === 'claim' && !selectedParticipantId) {
      setSubmitError('Selecciona tu nombre de la lista para reclamar tu lugar.');
      return;
    }

    if (mode === 'new_participant' && !newParticipantName.trim()) {
      setSubmitError('Ingresa el nombre con el que quieres participar.');
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.rpc('join_tournament_with_invite', {
        p_invite_code: inviteCode,
        p_mode: mode,
        p_participant_id: mode === 'claim' ? selectedParticipantId : null,
        p_new_participant_name:
          mode === 'new_participant' ? newParticipantName.trim() : null,
      });

      if (error) throw error;

      if (onJoined) {
        onJoined(data.tournament_id);
      }
    } catch (err) {
      setSubmitError(
        err?.message || 'No fue posible completar el ingreso al torneo.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (typeof document === 'undefined') return null;

  const tournament = preview?.tournament;
  const unclaimed = preview?.unclaimed_participants || [];
  const formatMeta = tournament ? getFormatMeta(tournament.format) : null;
  const alreadyLinked = Boolean(preview?.already_member && preview?.my_participant);
  const canSelfJoin = Boolean(tournament?.allow_self_join) && !preview?.my_participant;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/65 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="glass-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/20">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Invitación a torneo
                  </h2>
                  <p className="font-mono text-xs font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                    Código #{inviteCode}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Cerrar invitación"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm font-semibold text-slate-500 dark:text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                <span>Buscando torneo...</span>
              </div>
            ) : loadError || !preview?.found ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-300">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-bold">Invitación no válida</p>
                    <p className="mt-1 text-xs">
                      {loadError ||
                        'No encontramos ningún torneo con ese código. Es posible que haya sido regenerado por un administrador.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white dark:bg-slate-800"
                >
                  Cerrar
                </button>
              </div>
            ) : alreadyLinked ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/35 dark:bg-emerald-500/12">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${formatMeta.badgeClass}`}
                    >
                      {formatMeta.label}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {tournament.name}
                  </h3>
                  <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/80 p-3 dark:bg-slate-900/70">
                    <Avatar
                      name={preview.my_participant.name}
                      url={preview.my_participant.avatar_url}
                      size="md"
                      highlight
                    />
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        ¡Ya estás vinculado en este torneo!
                      </p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {preview.my_participant.name}
                      </p>
                    </div>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => onJoined(tournament.id)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20"
                >
                  <span>Entrar al torneo</span>
                  <ChevronRight className="h-4 w-4" />
                </motion.button>
              </div>
            ) : (
              <form onSubmit={handleConfirmJoin} className="space-y-4">
                {/* Tarjeta resumen del torneo */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${formatMeta.badgeClass}`}
                    >
                      {formatMeta.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <Users className="h-3.5 w-3.5" />
                      {tournament.participant_count}{' '}
                      {tournament.participant_count === 1
                        ? 'participante'
                        : 'participantes'}
                    </span>
                  </div>
                  <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
                    <Trophy className="h-4 w-4 shrink-0 text-emerald-500" />
                    <span className="truncate">{tournament.name}</span>
                  </h3>
                  {preview.already_member && (
                    <p className="mt-1.5 text-xs font-medium text-sky-700 dark:text-sky-300">
                      Ya sos miembro del torneo, pero todavía no reclamaste un jugador.
                    </p>
                  )}
                </div>

                {/* Selector de modo */}
                <div className="space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    ¿Cómo querés ingresar?
                  </p>

                  {unclaimed.length > 0 && (
                    <div
                      className={`rounded-2xl border p-3.5 transition ${
                        mode === 'claim'
                          ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-500/50 dark:bg-emerald-500/10'
                          : 'border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMode('claim');
                          setSubmitError('');
                        }}
                        className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Reclamar mi lugar ({unclaimed.length} disponibles)
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Si el organizador ya cargó tu nombre, seleccionalo abajo
                            </p>
                          </div>
                        </div>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            mode === 'claim'
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {mode === 'claim' && <Check className="h-3 w-3" />}
                        </span>
                      </button>

                      {mode === 'claim' && (
                        <div className="mt-3 max-h-44 space-y-1.5 overflow-y-auto pr-1">
                          {unclaimed.map((p) => {
                            const selected = selectedParticipantId === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setSelectedParticipantId(p.id)}
                                className={`flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-left transition ${
                                  selected
                                    ? 'border-emerald-500 bg-white shadow-xs dark:border-emerald-400 dark:bg-slate-800'
                                    : 'border-slate-200/80 bg-white/70 hover:border-slate-300 dark:border-slate-700/70 dark:bg-slate-900/60'
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <Avatar
                                    name={p.name}
                                    url={p.avatar_url}
                                    size="sm"
                                    highlight={selected}
                                  />
                                  <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {p.name}
                                  </span>
                                </div>
                                {selected && (
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                                    Elegido
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {canSelfJoin && (
                    <div
                      className={`rounded-2xl border p-3.5 transition ${
                        mode === 'new_participant'
                          ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-500/50 dark:bg-emerald-500/10'
                          : 'border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMode('new_participant');
                          setSubmitError('');
                        }}
                        className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <UserPlus className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Unirme como participante nuevo
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Agrega tu nombre y tu avatar a la lista del torneo
                            </p>
                          </div>
                        </div>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            mode === 'new_participant'
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {mode === 'new_participant' && <Check className="h-3 w-3" />}
                        </span>
                      </button>

                      {mode === 'new_participant' && (
                        <div className="mt-3">
                          <label
                            htmlFor="invite-new-participant-name"
                            className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
                          >
                            Tu nombre en el torneo
                          </label>
                          <input
                            id="invite-new-participant-name"
                            type="text"
                            maxLength={50}
                            value={newParticipantName}
                            onChange={(e) => setNewParticipantName(e.target.value)}
                            placeholder="Ej: Santi"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base font-medium text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {!preview.already_member && (
                    <div
                      className={`rounded-2xl border p-3.5 transition ${
                        mode === 'spectator'
                          ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-500/50 dark:bg-emerald-500/10'
                          : 'border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-slate-900/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMode('spectator');
                          setSubmitError('');
                        }}
                        className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <Eye className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Entrar como espectador
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Mira tablas, cruces y estadísticas sin anotarte como jugador
                            </p>
                          </div>
                        </div>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            mode === 'spectator'
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {mode === 'spectator' && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {submitError && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    Cancelar
                  </button>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>
                      {submitting
                        ? 'Ingresando...'
                        : mode === 'claim'
                        ? 'Reclamar lugar y entrar'
                        : mode === 'new_participant'
                        ? 'Unirme y jugar'
                        : 'Entrar como espectador'}
                    </span>
                  </motion.button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}