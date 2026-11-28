import { motion } from 'framer-motion';

const SIZE_MAP = {
  sm: { box: 'h-9 w-9 rounded-xl', svg: 'h-6 w-6' },
  md: { box: 'h-10 w-10 rounded-xl', svg: 'h-6 w-6' },
  lg: { box: 'h-14 w-14 rounded-2xl', svg: 'h-9 w-9' },
  xl: { box: 'h-16 w-16 rounded-2xl', svg: 'h-10 w-10' },
};

// Coreografías distintas por tema para entrar/salir de torneos y cambiar de tema
const THEME_BURST_VARIANTS = {
  light: {
    initial: { scale: 0.78, y: 10, rotate: -6 },
    animate: {
      scale: [0.78, 1.09, 0.97, 1],
      y: [10, -5, 1, 0],
      rotate: [-6, 4, -1, 0],
    },
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  },
  dark: {
    initial: { scale: 0.6, rotate: 22 },
    animate: {
      scale: [0.6, 1.2, 0.9, 1.05, 1],
      rotate: [22, -12, 5, -2, 0],
    },
    transition: { duration: 0.58, ease: [0.16, 1, 0.3, 1] },
  },
  classic: {
    initial: { scale: 1.3, y: -16, rotate: -14 },
    animate: {
      scale: [1.3, 0.86, 1.08, 0.97, 1],
      y: [-16, 4, -2, 0],
      rotate: [-14, 10, -6, 3, 0],
    },
    transition: { duration: 0.68, ease: 'easeOut' },
  },
};

const SPARK_OFFSETS = [
  { x: -26, y: -24 },
  { x: 26, y: -24 },
  { x: -28, y: 22 },
  { x: 28, y: 22 },
];

export default function BrandLogo({
  size = 'md',
  theme = 'light',
  mode = 'burst', // 'burst' | 'auth-loop' | 'auth-success'
  isLoading = false,
  animateKey = 'init',
  className = '',
}) {
  const dim = SIZE_MAP[size] || SIZE_MAP.md;
  const activeTheme =
    theme === 'dark' || theme === 'classic' ? theme : 'light';
  const themeBurst =
    THEME_BURST_VARIANTS[activeTheme] || THEME_BURST_VARIANTS.light;

  const isLoop = mode === 'auth-loop';
  const isSuccess = mode === 'auth-success';

  const containerAnimation = isSuccess
    ? {
        initial: { scale: 0.9, rotate: 0 },
        animate: {
          scale: [0.9, 1.32, 0.94, 1.08, 1],
          rotate: [0, -18, 360],
          y: [0, -10, 2, 0],
        },
        transition: { duration: 0.78, ease: [0.22, 1, 0.36, 1] },
      }
    : isLoop
    ? {
        initial: { scale: 0.92, opacity: 0 },
        animate: {
          scale: isLoading ? [1, 1.09, 0.96, 1] : [1, 1.045, 1],
          y: isLoading ? [0, -4, 0] : [0, -3, 0],
          rotate: isLoading ? [0, 5, -5, 0] : [0, 2, -2, 0],
          opacity: 1,
        },
        transition: {
          duration: isLoading ? 0.75 : 2.6,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }
    : themeBurst;

  return (
    <motion.div
      key={`brand-logo-${mode}-${activeTheme}-${animateKey}`}
      initial={containerAnimation.initial}
      animate={containerAnimation.animate}
      transition={containerAnimation.transition}
      whileHover={{ scale: 1.07, rotate: -4 }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-visible select-none ${dim.box} bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/30 dark:from-[#CCFF00] dark:via-[#b8e600] dark:to-lime-500 dark:text-[#0B0E14] dark:shadow-[0_0_26px_-4px_rgba(204,255,0,0.55)] classic:border-2 classic:border-[#FBF5E8] classic:from-[#D46F4D] classic:via-[#C8603E] classic:to-[#A94B2D] classic:text-[#FBF5E8] classic:shadow-[2px_2px_0_#D9A441] ${className}`}
    >
      {/* Onda expansiva 1 (en loop o en burst/success) */}
      <motion.span
        key={`ring-1-${mode}-${activeTheme}-${animateKey}-${isLoading}`}
        initial={{ opacity: 0.8, scale: 0.85 }}
        animate={
          isLoop
            ? {
                opacity: [0.65, 0],
                scale: isLoading ? [0.9, 1.65] : [0.9, 1.48],
              }
            : {
                opacity: [0.85, 0],
                scale: isSuccess ? [0.85, 1.95] : [0.85, 1.68],
              }
        }
        transition={
          isLoop
            ? {
                duration: isLoading ? 0.8 : 2.2,
                repeat: Infinity,
                ease: 'easeOut',
              }
            : { duration: 0.65, ease: 'easeOut' }
        }
        className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-emerald-400 dark:border-[#CCFF00] classic:border-[#D9A441]"
      />

      {/* Onda expansiva 2 (exclusiva de Victoria o Modo Oscuro/Claro al cambiar) */}
      {(isSuccess || !isLoop) && (
        <motion.span
          key={`ring-2-${mode}-${activeTheme}-${animateKey}`}
          initial={{ opacity: 0.6, scale: 0.8 }}
          animate={{ opacity: 0, scale: isSuccess ? 2.25 : 1.42 }}
          transition={{ duration: 0.72, delay: 0.1, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-0 rounded-[inherit] border border-teal-300 dark:border-[#2563EB] classic:border-[#1E4638]"
        />
      )}

      {/* Partículas de celebración cuando se concreta Login / Registro o en Modo Oscuro */}
      {(isSuccess || (!isLoop && activeTheme === 'dark')) &&
        SPARK_OFFSETS.map((pos, idx) => (
          <motion.span
            key={`spark-${idx}-${animateKey}-${mode}`}
            initial={{ opacity: 1, x: 0, y: 0, scale: 0.4 }}
            animate={{
              opacity: [1, 1, 0],
              x: isSuccess ? pos.x * 1.15 : pos.x * 0.75,
              y: isSuccess ? pos.y * 1.15 : pos.y * 0.75,
              scale: [0.4, 1.15, 0],
            }}
            transition={{ duration: 0.62, delay: idx * 0.03, ease: 'easeOut' }}
            className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-amber-300 dark:bg-[#CCFF00] classic:bg-[#D9A441]"
          />
        ))}

      {/* Emblema SVG personalizado AppTorneos */}
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`relative z-10 ${dim.svg}`}
      >
        {/* Escudo / Hexágono de estadio exterior */}
        <motion.path
          d="M20 3.5L33.5 8.5V19.5C33.5 27.8 27.7 34.4 20 36.8C12.3 34.4 6.5 27.8 6.5 19.5V8.5L20 3.5Z"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.12"
          initial={isLoop ? { pathLength: 0.65 } : { pathLength: 0.25, opacity: 0.5 }}
          animate={
            isLoop
              ? {
                  pathLength: [0.65, 1, 0.65],
                  opacity: [0.8, 1, 0.8],
                }
              : { pathLength: 1, opacity: 1 }
          }
          transition={
            isLoop
              ? {
                  duration: isLoading ? 0.9 : 2.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
              : { duration: 0.55, ease: 'easeOut' }
          }
        />

        {/* Líneas laterales tipo llaves de torneo (Brackets) */}
        <motion.path
          d="M10.5 14H13.5V21H10.5M29.5 14H26.5V21H29.5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={
            isLoop
              ? { opacity: [0.45, 0.9, 0.45] }
              : { opacity: [0.3, 1, 0.75] }
          }
          transition={
            isLoop
              ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.5 }
          }
        />

        {/* Copa central */}
        <motion.path
          d="M14.5 11.5H25.5V16.8C25.5 19.8 23.1 22.2 20 22.2C16.9 22.2 14.5 19.8 14.5 16.8V11.5Z"
          fill="currentColor"
          initial={{ y: 2, scale: 0.9 }}
          animate={
            isLoop
              ? { y: [0, -1.6, 0], scale: [1, 1.04, 1] }
              : isSuccess
              ? { scale: [0.9, 1.2, 1], y: [2, -2, 0] }
              : { y: 0, scale: 1 }
          }
          transition={
            isLoop
              ? {
                  duration: isLoading ? 0.7 : 2.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
              : { type: 'spring', stiffness: 420, damping: 18, delay: 0.06 }
          }
        />

        {/* Pedestal y base de la copa */}
        <path
          d="M20 22.2V26.8M16 27H24"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Estrella superior de campeón */}
        <motion.path
          d="M20 6.8L21.1 9.1L23.5 9.4L21.7 11L22.2 13.3L20 12.1L17.8 13.3L18.3 11L16.5 9.4L18.9 9.1L20 6.8Z"
          className="fill-amber-300 dark:fill-[#0B0E14] classic:fill-[#D9A441]"
          style={{ transformOrigin: '20px 10px' }}
          initial={{ scale: 0, rotate: -120 }}
          animate={
            isLoop
              ? {
                  scale: isLoading ? [0.9, 1.3, 0.9] : [0.95, 1.2, 0.95],
                  rotate: isLoading ? [0, 180, 360] : [0, 15, -15, 0],
                }
              : isSuccess
              ? { scale: [0.5, 1.45, 1], rotate: [0, 360] }
              : activeTheme === 'dark'
              ? { scale: [0, 1.35, 1], rotate: [-180, 15, 0] }
              : { scale: [0, 1.25, 1], rotate: 0 }
          }
          transition={
            isLoop
              ? {
                  duration: isLoading ? 0.85 : 2.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
              : { duration: 0.55, delay: 0.1, ease: 'backOut' }
          }
        />
      </svg>
    </motion.div>
  );
}