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
  'from-sky-500 to-indigo-600 text-white',
  'from-amber-500 to-orange-600 text-white',
  'from-rose-500 to-pink-600 text-white',
  'from-violet-500 to-purple-600 text-white',
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
    ? 'from-emerald-500 to-teal-600 text-white'
    : getGradientByName(name);

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold shadow-xs select-none ${sizeClass} ${
        highlight
          ? 'ring-2 ring-emerald-500/70 ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
          : ''
      } ${!showImage ? `bg-gradient-to-br ${gradientClass}` : 'bg-slate-200 dark:bg-slate-800'} ${className}`}
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