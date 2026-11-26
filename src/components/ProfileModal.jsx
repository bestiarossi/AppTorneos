import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Award,
  Camera,
  CheckCircle2,
  Crown,
  Flame,
  Loader2,
  Medal,
  Swords,
  Target,
  Trash2,
  Trophy,
  User,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { compressAvatarImage, uploadUserAvatar } from '../utils/avatarUpload';
import { fetchUserCareer } from '../utils/careerEngine';
import Avatar from './Avatar';

export default function ProfileModal({
  isOpen,
  user,
  profile,
  onClose,
  onSaved,
}) {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'career'

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [compressionInfo, setCompressionInfo] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [career, setCareer] = useState(null);
  const [careerLoading, setCareerLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('profile');
    const defaultName =
      profile?.display_name || user?.email?.split('@')[0] || '';
    setDisplayName(defaultName);
    setAvatarUrl(profile?.avatar_url || null);
    setPendingFile(null);
    setCompressionInfo('');
    setError('');
    setSuccess('');

    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    if (user?.id) {
      setCareerLoading(true);
      fetchUserCareer(user.id)
        .then((res) => setCareer(res))
        .catch(() => setCareer(null))
        .finally(() => setCareerLoading(false));
    }
  }, [isOpen, profile, user]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    setSuccess('');

    try {
      const compressed = await compressAvatarImage(file);
      const nextPreview = URL.createObjectURL(compressed.blob);

      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextPreview;
      });
      setPendingFile(file);
      const kb = Math.max(1, Math.round(compressed.sizeBytes / 1024));
      setCompressionInfo(
        `Optimizada (${compressed.width}×${compressed.height}px · ${kb} KB)`
      );
    } catch (err) {
      setError(err?.message || 'No se pudo procesar la imagen.');
    }
  }

  function handleRemoveAvatar() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPendingFile(null);
    setAvatarUrl(null);
    setCompressionInfo('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user?.id) return;

    const cleanName = displayName.trim();
    if (!cleanName) {
      setError('Ingresa un nombre o apodo para tu perfil.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      let finalAvatarUrl = avatarUrl;
      if (pendingFile) {
        const uploaded = await uploadUserAvatar(user.id, pendingFile);
        finalAvatarUrl = uploaded.publicUrl;
      }

      const { data, error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            display_name: cleanName,
            avatar_url: finalAvatarUrl,
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (upsertError) throw upsertError;

      setSuccess('¡Perfil actualizado!');
      if (onSaved) onSaved(data);

      setTimeout(() => {
        onClose();
      }, 450);
    } catch (err) {
      setError(err?.message || 'No se pudo guardar tu perfil.');
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === 'undefined') return null;

  const shownAvatarUrl = previewUrl || avatarUrl;

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
            if (e.target === e.currentTarget && !saving) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="glass-card flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl p-5 shadow-2xl sm:p-6"
          >
            {/* Header del Modal */}
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200/70 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Avatar
                  name={displayName || user?.email}
                  url={shownAvatarUrl}
                  size="md"
                  highlight
                />
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    {displayName || 'Mi Perfil'}
                  </h2>
                  <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                    {user?.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Pestañas: Mi Perfil / Mi Carrera */}
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-950/70">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`relative inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'profile'
                    ? 'text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {activeTab === 'profile' && (
                  <motion.div
                    layoutId="profile-tab-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 shadow-xs"
                  />
                )}
                <User className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">Datos &amp; Foto</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('career')}
                className={`relative inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'career'
                    ? 'text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {activeTab === 'career' && (
                  <motion.div
                    layoutId="profile-tab-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 shadow-xs"
                  />
                )}
                <Trophy className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">Mi Carrera 🏆</span>
              </button>
            </div>

            {/* Pestaña: Mi Perfil */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto pr-1">
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                  <Avatar
                    name={displayName || user?.email}
                    url={shownAvatarUrl}
                    size="xl"
                    highlight
                  />

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      disabled={saving}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Camera className="h-4 w-4 text-emerald-500" />
                      <span>{shownAvatarUrl ? 'Cambiar foto' : 'Subir foto'}</span>
                    </motion.button>

                    {shownAvatarUrl && (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        disabled={saving}
                        onClick={handleRemoveAvatar}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-300"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Quitar</span>
                      </motion.button>
                    )}
                  </div>

                  {compressionInfo && (
                    <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      {compressionInfo}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="profile-display-name"
                    className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                  >
                    Nombre / Apodo visible
                  </label>
                  <input
                    id="profile-display-name"
                    type="text"
                    required
                    maxLength={50}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ej: Santi"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none sm:text-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{success}</span>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>{saving ? 'Guardando...' : 'Guardar perfil'}</span>
                  </motion.button>
                </div>
              </form>
            )}

            {/* Pestaña: Mi Carrera 🏆 (Vitrina histórica) */}
            {activeTab === 'career' && (
              <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                {careerLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <Loader2 className="mb-2 h-6 w-6 animate-spin text-emerald-500" />
                    <span>Calculando palmarés histórico...</span>
                  </div>
                ) : !career || career.totalTournaments === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                    <Trophy className="mx-auto mb-2.5 h-8 w-8 text-slate-400" />
                    <p className="font-bold text-slate-700 dark:text-slate-200">
                      ¡Todavía no tienes torneos registrados!
                    </p>
                    <p className="mt-1">
                      Únete a un torneo o vincula tu cuenta a un jugador para empezar a llenar tu vitrina de trofeos.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Tarjetas de Palmarés Global */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="podium-gold rounded-2xl border p-3 text-center">
                        <Crown className="mx-auto h-5 w-5 text-amber-500" />
                        <p className="mt-1 text-2xl font-black text-amber-900 tabular-nums dark:text-amber-200">
                          {career.championships}
                        </p>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                          Copas 🥇
                        </p>
                      </div>

                      <div className="podium-silver rounded-2xl border p-3 text-center">
                        <Medal className="mx-auto h-5 w-5 text-slate-500" />
                        <p className="mt-1 text-2xl font-black text-slate-900 tabular-nums dark:text-slate-100">
                          {career.podiums}
                        </p>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Podios
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-center dark:border-emerald-500/35 dark:bg-emerald-500/15">
                        <Flame className="mx-auto h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <p className="mt-1 text-2xl font-black text-emerald-800 tabular-nums dark:text-emerald-200">
                          {career.winRatePct}%
                        </p>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          Victorias
                        </p>
                      </div>

                      <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3 text-center dark:border-violet-500/35 dark:bg-violet-500/15">
                        <Target className="mx-auto h-5 w-5 text-violet-600 dark:text-violet-400" />
                        <p className="mt-1 text-2xl font-black text-violet-800 tabular-nums dark:text-violet-200">
                          {career.prodePoints}
                        </p>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                          Pts Prode
                        </p>
                      </div>
                    </div>

                    {/* Vitrina de Trofeos */}
                    <div>
                      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <Award className="h-4 w-4 text-amber-500" />
                        <span>Vitrina de Trofeos ({career.trophies.length})</span>
                      </h3>

                      {career.trophies.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                          ¡Todavía no subiste al podio! Continúa compitiendo para colocar tu primera copa aquí.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {career.trophies.map((t) => (
                            <div
                              key={t.id}
                              className={`flex items-center gap-3 rounded-2xl border p-3 backdrop-blur-sm ${
                                t.place === 1
                                  ? 'podium-gold'
                                  : t.place === 2
                                  ? 'podium-silver'
                                  : 'podium-bronze'
                              }`}
                            >
                              <span className="text-2xl leading-none">
                                {t.place === 1 ? '🏆' : t.place === 2 ? '🥈' : '🥉'}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-black text-slate-900 dark:text-white">
                                  {t.title}
                                </p>
                                <p className="truncate text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                  {t.sportEmoji} {t.label} · {t.year}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Desglose de partidos */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        <Swords className="h-3.5 w-3.5 text-slate-500" />
                        <span>Récord de partidos jugados</span>
                      </p>
                      <div className="flex items-center justify-between text-xs font-bold tabular-nums">
                        <span className="text-slate-600 dark:text-slate-400">
                          {career.matchesPlayed} jugados en total
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {career.matchesWon}G · {career.matchesDrawn}E · {career.matchesLost}P
                        </span>
                      </div>
                      {career.subtournamentsWon > 0 && (
                        <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          + {career.subtournamentsWon} {career.subtournamentsWon === 1 ? 'subtorneo ganado' : 'subtorneos ganados'} en competencias por jornadas.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}