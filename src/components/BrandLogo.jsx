import { motion } from 'framer-motion';

const SIZE_MAP = {
  sm: { box: 'h-9 w-9 rounded-xl', svg: 'h-6 w-6' },
  md: { box: 'h-10 w-10 rounded-xl', svg: 'h-6 w-6' },
  lg: { box: 'h-14 w-14 rounded-2xl', svg: 'h-9 w-9' },
  xl: { box: 'h-20 w-20 rounded-[22px]', svg: 'h-12 w-12' },
};

const THEME_BURST_VARIANTS = {
  light: {
    scale: [1, 1.12, 0.97, 1],
    y: [0, -6, 1, 0],
    rotate: [0, -6, 4, 0],
    transition: { duration: 0.62, ease: [0.22, 1, 0.36, 1] },
  },
  dark: {
    scale: [1, 1.2, 0.92, 1.04, 1],
    rotate: [0, 16, -10, 4, 0],
    transition: { duration: 0.56, ease: [0.16, 1, 0.3, 1] },
  },
  classic: {
    scale: [1, 1.18, 0.9, 1.06, 1],
    y: [0, -8, 3, -1, 0],
    rotate: [0, -10, 8, -4, 0],
    transition: { duration: 0.65, ease: 'easeOut' },
  },
};

const SPARK_OFFSETS = [
  { x: -34, y: -30 },
  { x: 34, y: -30 },
  { x: -36, y: 28 },
  { x: 36, y: 28 },
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

  // En modo loop el logo NUNCA se desmonta ni cambia su opacidad: solo respira suavemente en ida y vuelta
  const containerAnimate = isSuccess
    ? {
        scale: [1, 1.3, 0.95, 1.08, 1],
        rotate: [0, -14, 360],
        y: [0, -10, 2, 0],
      }
    : isLoop
    ? {
        scale: isLoading ? [1, 1.09, 1] : [1, 1.055, 1],
        y: isLoading ? [0, -5, 0] : [0, -3.5, 0],
        rotate: isLoading ? [0, 4, -4, 0] : [0, 2, -2, 0],
      }
    : {
        scale: themeBurst.scale,
        y: themeBurst.y || 0,
        rotate: themeBurst.rotate,
      };

  const containerTransition = isSuccess
    ? { duration: 0.66, ease: [0.22, 1, 0.36, 1] }
    : isLoop
    ? {
        duration: isLoading ? 0.85 : 2.8,
        repeat: Infinity,
        ease: 'easeInOut',
      }
    : themeBurst.transition;

  return (
    <motion.div
      key={isLoop || isSuccess ? 'brand-logo-persistent-auth' : `brand-logo-burst-${activeTheme}-${animateKey}`}
      initial={false}
      animate={containerAnimate}
      transition={containerTransition}
      whileHover={{ scale: 1.07, rotate: -4 }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-visible select-none ${dim.box} bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/30 dark:from-[#CCFF00] dark:via-[#b8e600] dark:to-lime-500 dark:text-[#0B0E14] dark:shadow-[0_0_28px_-4px_rgba(204,255,0,0.55)] classic:border-2 classic:border-[#FBF5E8] classic:from-[#D46F4D] classic:via-[#C8603E] classic:to-[#A94B2D] classic:text-[#FBF5E8] classic:shadow-[3px_3px_0_#D9A441] ${className}`}
    >
      {/* Halo exterior que respira suavemente en loop sin desaparecer nunca */}
      {isLoop && (
        <motion.span
          initial={false}
          animate={{
            scale: isLoading ? [1, 1.18, 1] : [1, 1.12, 1],
            opacity: isLoading ? [0.35, 0.75, 0.35] : [0.25, 0.55, 0.25],
          }}
          transition={{
            duration: isLoading ? 0.85 : 2.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="pointer-events-none absolute -inset-1.5 rounded-[inherit] border-2 border-emerald-400/70 dark:border-[#CCFF00]/70 classic:border-[#D9A441]/80"
        />
      )}

      {/* Onda expansiva única solo para momentos puntuales (éxito o cambio de pantalla en Navbar) */}
      {!isLoop && (
        <motion.span
          key={`burst-ring-${mode}-${activeTheme}-${animateKey}`}
          initial={{ opacity: 0.8, scale: 0.9 }}
          animate={{ opacity: 0, scale: isSuccess ? 1.95 : 1.6 }}
          transition={{ duration: 0.62, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-emerald-400 dark:border-[#CCFF00] classic:border-[#D9A441]"
        />
      )}

      {/* Partículas de celebración al concretar Login / Registro */}
      {isSuccess &&
        SPARK_OFFSETS.map((pos, idx) => (
          <motion.span
            key={`spark-${idx}`}
            initial={{ opacity: 1, x: 0, y: 0, scale: 0.5 }}
            animate={{
              opacity: [1, 1, 0],
              x: pos.x * 1.15,
              y: pos.y * 1.15,
              scale: [0.5, 1.35, 0],
            }}
            transition={{ duration: 0.6, delay: idx * 0.025, ease: 'easeOut' }}
            className="pointer-events-none absolute h-2 w-2 rounded-full bg-amber-300 dark:bg-[#CCFF00] classic:bg-[#D9A441]"
          />
        ))}

      {/* Emblema SVG 100% sólido siempre */}
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`relative z-10 ${dim.svg}`}
      >
        {/* Escudo exterior */}
        <path
          d="M20 3.5L33.5 8.5V19.5C33.5 27.8 27.7 34.4 20 36.8C12.3 34.4 6.5 27.8 6.5 19.5V8.5L20 3.5Z"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.14"
        />

        {/* Llaves laterales (Brackets) */}
        <path
          d="M10.5 14H13.5V21H10.5M29.5 14H26.5V21H29.5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />

        {/* Copa central con respiración suave */}
        <motion.path
          d="M14.5 11.5H25.5V16.8C25.5 19.8 23.1 22.2 20 22.2C16.9 22.2 14.5 19.8 14.5 16.8V11.5Z"
          fill="currentColor"
          initial={false}
          animate={
            isLoop
              ? { y: [0, -1.2, 0], scale: [1, 1.04, 1] }
              : isSuccess
              ? { scale: [1, 1.22, 1], y: [0, -2, 0] }
              : { y: 0, scale: 1 }
          }
          transition={
            isLoop
              ? {
                  duration: isLoading ? 0.85 : 2.8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
              : { duration: 0.45 }
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
          initial={false}
          animate={
            isLoop
              ? {
                  scale: isLoading ? [1, 1.28, 1] : [1, 1.18, 1],
                  rotate: isLoading ? [0, 180, 360] : [0, 12, -12, 0],
                }
              : isSuccess
              ? { scale: [1, 1.45, 1], rotate: [0, 360] }
              : { scale: [0.85, 1.2, 1], rotate: 0 }
          }
          transition={
            isLoop
              ? {
                  duration: isLoading ? 0.85 : 2.8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
              : { duration: 0.5, ease: 'backOut' }
          }
        />
      </svg>
    </motion.div>
  );
}