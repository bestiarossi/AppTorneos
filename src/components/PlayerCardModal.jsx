import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Download,
  Flame,
  Loader2,
  Share2,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import {
  calculatePlayerCardAttributes,
  generatePlayerCardPng,
} from '../utils/playerCardGenerator';
import { useToast } from './ToastProvider';

export default function PlayerCardModal({
  isOpen,
  participant,
  tournament,
  matches = [],
  customMatchdays = [],
  subtournaments = [],
  subEntries = [],
  subEntryMembers = [],
  subMatches = [],
  prodePolls = [],
  prodeVotes = [],
  onClose,
}) {
  const toast = useToast();
  const [cardStyle, setCardStyle] = useState('gold'); // 'gold' | 'black' | 'emerald'
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [pngBlob, setPngBlob] = useState(null);

  const attributes = useMemo(() => {
    if (!participant) return null;
    return calculatePlayerCardAttributes({
      participant,
      matches,
      customMatchdays,
      subtournaments,
      subEntries,
      subEntryMembers,
      subMatches,
      prodePolls,
      prodeVotes,
    });
  }, [
    participant,
    matches,
    customMatchdays,
    subtournaments,
    subEntries,
    subEntryMembers,
    subMatches,
    prodePolls,
    prodeVotes,
  ]);

  useEffect(() => {
    if (!isOpen || !participant || !attributes) return;
    let active = true;
    setGenerating(true);

    generatePlayerCardPng({
      participant,
      tournament,
      attributes,
      style: cardStyle,
    })
      .then((blob) => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        setPngBlob(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      })
      .catch((err) => {
        if (!active) return;
        toast.error('Error al generar la carta.');
      })
      .finally(() => {
        if (active) setGenerating(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, participant, tournament, attributes, cardStyle]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleDownloadSticker() {
    if (!previewUrl) return;
    const slug = participant?.name
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 24);
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `carta-${slug || 'jugador'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('¡Sticker PNG transparente descargado!');
  }

  async function handleShare() {
    if (!pngBlob) return;
    const file = new File(
      [pngBlob],
      `carta-${participant?.name || 'jugador'}.png`,
      { type: 'image/png' }
    );

    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      navigator.canShare?.({ files: [file] })
    ) {
      try {
        await navigator.share({
          title: `Carta EA FC: ${participant?.name}`,
          text: `Mirá mi carta oficial en ${tournament?.name || 'AppTorneos'} 🎴`,
          files: [file],
        });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }

    handleDownloadSticker();
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/75 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget && !generating) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="glass-card flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Carta EA FC / Ultimate Team
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    PNG transparente listo para WhatsApp
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Selector de Edición / Color de carta */}
            <div className="mb-3 grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-950/70">
              <button
                type="button"
                onClick={() => setCardStyle('gold')}
                className={`min-h-[44px] rounded-xl text-xs font-bold transition ${
                  cardStyle === 'gold'
                    ? 'podium-gold text-amber-900 shadow-xs dark:text-amber-200'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                🥇 Oro
              </button>
              <button
                type="button"
                onClick={() => setCardStyle('black')}
                className={`min-h-[44px] rounded-xl text-xs font-bold transition ${
                  cardStyle === 'black'
                    ? 'bg-slate-900 text-white shadow-xs dark:bg-slate-800'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                🖤 TOTW
              </button>
              <button
                type="button"
                onClick={() => setCardStyle('emerald')}
                className={`min-h-[44px] rounded-xl text-xs font-bold transition ${
                  cardStyle === 'emerald'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                🟢 Arena
              </button>
            </div>

            {/* Vista previa de la carta */}
            <div className="flex flex-1 items-center justify-center overflow-y-auto rounded-2xl border border-slate-200/70 bg-radial from-slate-200/40 to-transparent p-3 dark:border-slate-800 dark:from-slate-900/60">
              {generating ? (
                <div className="flex flex-col items-center gap-2 py-24 text-xs font-semibold text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                  <span>Renderizando atributos...</span>
                </div>
              ) : previewUrl ? (
                <motion.img
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  src={previewUrl}
                  alt={`Carta de ${participant?.name}`}
                  className="max-h-[50vh] w-auto drop-shadow-2xl"
                />
              ) : null}
            </div>

            {/* Botones de acción móvil-friendly */}
            <div className="mt-3.5 grid grid-cols-2 gap-2">
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                disabled={generating || !previewUrl}
                onClick={handleDownloadSticker}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Download className="h-4 w-4" />
                <span>Bajar Sticker</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                disabled={generating || !pngBlob}
                onClick={handleShare}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-3 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/20 disabled:opacity-50"
              >
                <Share2 className="h-4 w-4" />
                <span>Compartir</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}