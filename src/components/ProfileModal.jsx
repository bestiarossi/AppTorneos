import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { compressAvatarImage, uploadUserAvatar } from '../utils/avatarUpload';
import Avatar from './Avatar';

export default function ProfileModal({
  isOpen,
  user,
  profile,
  onClose,
  onSaved,
}) {
  const fileInputRef = useRef(null);

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [compressionInfo, setCompressionInfo] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isOpen) return;
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
      setCompressionInfo(`Optimizada (${compressed.width}×${compressed.height}px · ${kb} KB)`);
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
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="glass-card w-full max-w-md rounded-3xl p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Mi perfil y avatar
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tu foto se hereda automáticamente en tus torneos
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

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Selector de Avatar */}
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

              {user?.email && (
                <div>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Cuenta vinculada
                  </span>
                  <p className="truncate rounded-xl border border-slate-200/70 bg-slate-100/70 px-3.5 py-2.5 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                    {user.email}
                  </p>
                </div>
              )}

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

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}