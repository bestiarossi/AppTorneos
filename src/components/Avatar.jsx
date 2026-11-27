import { useEffect, useState } from 'react';

const SIZE_CLASSES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-20 w-20 text-xl',
};

const FALLBACK_GRADIENTS = [
  'from-emerald-500 to-teal-600 text-white',
  'from-[#2563EB] to-indigo-700 text-white',
  'from-amber-400 to-orange-600 text-slate-950',
  'from-rose-500 to-pink-700 text-white',
  'from-violet-500 to-purple-700 text-white',
  'from-cyan-500 to-blue-600 text-white',
  'from-fuchsia-500 to-rose-600 text-white',
  'from-teal-500 to-emerald-700 text-white',
];

function getInitials(name = '') {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getGradientByName(name = '') {
  const str = String(name || 'jugador').toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_GRADIENTS[hash % FALLBACK_GRADIENTS.length];
}

export default function Avatar({
  name = '',
  url = null,
  size = 'md',
  highlight = false,
  className = '',
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [url]);

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const showImage = Boolean(url) && !imgError;
  const gradientClass = highlight
    ? 'from-emerald-500 to-teal-600 text-white dark:from-[#CCFF00] dark:to-lime-400 dark:text-[#0B0E14] classic:from-[#C86D51] classic:to-[#A44E35] classic:text-[#FFFBF4]'
    : getGradientByName(name);

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold tracking-tight select-none ${sizeClass} ${
        highlight
          ? 'ring-2 ring-emerald-500/80 ring-offset-2 ring-offset-[var(--app-bg)] dark:ring-[#CCFF00] classic:ring-[#C86D51]'
          : 'ring-1 ring-black/10 dark:ring-white/15 classic:ring-[#1B4332]/20'
      } ${!showImage ? `bg-gradient-to-br ${gradientClass}` : 'bg-slate-200 dark:bg-[#141923] classic:bg-[#EFE6D5]'} ${className}`}
      title={name || undefined}
    >
      {showImage ? (
        <img
          src={url}
          alt={name || 'Avatar'}
          loading="lazy"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </div>
  );
}