import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyTextToClipboard, openWhatsAppShare } from '../utils/whatsappShare';

export default function WhatsAppShareButton({
  getText,
  label = 'Compartir en WhatsApp',
  compact = false,
}) {
  const [copied, setCopied] = useState(false);

  function handleWhatsApp() {
    const text = getText();
    if (!text) return;
    openWhatsAppShare(text);
  }

  async function handleCopy() {
    const text = getText();
    if (!text) return;
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleWhatsApp}
        className={`inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] font-bold text-white shadow-2xs transition hover:bg-[#1ebe5a] ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 shrink-0 fill-current"
          aria-hidden="true"
        >
          <path d="M12.03 2a9.96 9.96 0 0 0-8.46 15.25L2 22l4.9-1.53A9.96 9.96 0 1 0 12.03 2zm5.82 14.07c-.24.68-1.42 1.3-1.97 1.38-.52.08-1.18.11-1.91-.12-.44-.14-1-.32-1.72-.63-3.03-1.31-5.01-4.38-5.16-4.58-.15-.2-1.23-1.64-1.23-3.13 0-1.49.78-2.22 1.06-2.52.27-.3.6-.38.8-.38h.58c.19 0 .44-.07.69.52.25.6.86 2.1.94 2.25.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.18-.32.4-.45.53-.15.15-.3.31-.13.61.18.3.78 1.29 1.67 2.08 1.15 1.02 2.12 1.34 2.42 1.49.3.15.48.12.66-.07.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.75.83 2.05.98.3.15.5.22.58.35.07.13.07.75-.17 1.43z" />
        </svg>
        <span>{label}</span>
      </button>

      <button
        type="button"
        onClick={handleCopy}
        title="Copiar resumen para pegar"
        aria-label="Copiar resumen para pegar"
        className={`inline-flex items-center justify-center rounded-xl border transition ${
          copied
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        } ${compact ? 'p-1.5' : 'p-2'}`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}