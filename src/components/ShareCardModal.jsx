import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Download,
  Image as ImageIcon,
  Loader2,
  Moon,
  Share2,
  Sun,
  X,
} from 'lucide-react';
import { generateTournamentShareCard } from '../utils/shareCardGenerator';
import { useToast } from './ToastProvider';

export default function ShareCardModal({
  isOpen,
  tournament,
  summary,
  prodeLeader = null,
  onClose,
}) {
  const toast = useToast();
  const [cardTheme, setCardTheme] = useState('dark');
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [pngBlob, setPngBlob] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !tournament || !summary) return;
    let active = true;
    setGenerating(true);
    setError('');

    generateTournamentShareCard({
      tournament,
      summary,
      prodeLeader,
      theme: cardTheme,
    })
      .then((blob) => {
        if (!active) return;
        const nextUrl = URL.createObjectURL(blob);
        setPngBlob(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextUrl;
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || 'No se pudo generar la placa visual.');
      })
      .finally(() => {
        if (active) setGenerating(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, tournament, summary, prodeLeader, cardTheme]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleDownload() {
    if (!previewUrl) return;
    const slug = (tournament?.name || 'torneo')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 32);
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `placa-${slug || 'resumen'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('¡Placa PNG descargada!');
  }

  async function handleNativeShare() {
    if (!pngBlob) return;
    const file = new File([pngBlob], 'resumen-torneo.png', {
      type: 'image/png',
    });

    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      navigator.canShare?.({ files: [file] })
    ) {
      try {
        await navigator.share({
          title: `Resumen: ${tournament?.name || 'Torneo'}`,
          text: `Así viene ${tournament?.name || 'el torneo'} en AppTorneos 🏆`,
          files: [file],
        });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }

    handleDownload();
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
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="glass-card flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Placa para compartir
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Formato HD listo para WhatsApp o Stories
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

            {/* Selector estilo Dark / Light de la placa */}
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-950/70">
              <button
                type="button"
                onClick={() => setCardTheme('dark')}
                className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition ${
                  cardTheme === 'dark'
                    ? 'bg-slate-900 text-white shadow-xs dark:bg-slate-800'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Moon className="h-3.5 w-3.5 text-amber-300" />
                <span>Arena Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setCardTheme('light')}
                className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition ${
                  cardTheme === 'light'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Sun className="h-3.5 w-3.5 text-amber-500" />
                <span>Clean Light</span>
              </button>
            </div>

            {/* Vista previa */}
            <div className="flex flex-1 items-center justify-center overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-950/10 p-2 dark:border-slate-800 dark:bg-slate-950/50">
              {generating ? (
                <div className="flex flex-col items-center gap-2 py-20 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                  <span>Diseñando placa HD...</span>
                </div>
              ) : error ? (
                <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Vista previa placa resumen"
                  className="max-h-[48vh] w-auto rounded-xl object-contain shadow-lg"
                />
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                disabled={generating || !previewUrl}
                onClick={handleDownload}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Download className="h-4 w-4" />
                <span>Descargar PNG</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                disabled={generating || !pngBlob}
                onClick={handleNativeShare}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 disabled:opacity-50"
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