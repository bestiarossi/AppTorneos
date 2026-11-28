import { motion } from 'framer-motion';

const SIZE_MAP = {
  sm: { box: 'h-9 w-9 rounded-xl', svg: 'h-6 w-6' },
  md: { box: 'h-10 w-10 rounded-xl', svg: 'h-6 w-6' },
  lg: { box: 'h-14 w-14 rounded-2xl', svg: 'h-9 w-9' },
  xl: { box: 'h-16 w-16 rounded-2xl', svg: 'h-10 w-10' },
};

export default function BrandLogo({
  size = 'md',
  animateKey = 'init',
  className = '',
}) {
  const dim = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <motion.div
      key={`brand-logo-${animateKey}`}
      initial={{ scale: 0.72, rotate: -14 }}
      animate={{
        scale: [0.72, 1.12, 0.96, 1],
        rotate: [-14, 8, -3, 0],
      }}
      transition={{
        duration: 0.62,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ scale: 1.07, rotate: -4 }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-visible select-none ${dim.box} bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/30 dark:from-[#CCFF00] dark:via-[#b8e600] dark:to-lime-500 dark:text-[#0B0E14] dark:shadow-[0_0_24px_-4px_rgba(204,255,0,0.5)] classic:border-2 classic:border-[#FBF5E8] classic:from-[#D46F4D] classic:via-[#C8603E] classic:to-[#A94B2D] classic:text-[#FBF5E8] classic:shadow-[2px_2px_0_#D9A441] ${className}`}
    >
      {/* Onda expansiva al entrar/salir de un torneo */}
      <motion.span
        key={`ring-${animateKey}`}
        initial={{ opacity: 0.75, scale: 0.85 }}
        animate={{ opacity: 0, scale: 1.65 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-emerald-400 dark:border-[#CCFF00] classic:border-[#D9A441]"
      />

      {/* Emblema SVG personalizado AppTorneos (Escudo + Llaves + Copa + Estrella) */}
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
          initial={{ pathLength: 0.3, opacity: 0.5 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        />

        {/* Líneas laterales tipo llaves de torneo (Brackets) */}
        <path
          d="M10.5 14H13.5V21H10.5M29.5 14H26.5V21H29.5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.72"
        />

        {/* Copa central */}
        <motion.path
          d="M14.5 11.5H25.5V16.8C25.5 19.8 23.1 22.2 20 22.2C16.9 22.2 14.5 19.8 14.5 16.8V11.5Z"
          fill="currentColor"
          initial={{ y: 2, scale: 0.9 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 20, delay: 0.08 }}
        />

        {/* Pedestal y base de la copa */}
        <path
          d="M20 22.2V26.8M16 27H24"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Estrella / Destello superior de campeón */}
        <motion.path
          d="M20 6.8L21.1 9.1L23.5 9.4L21.7 11L22.2 13.3L20 12.1L17.8 13.3L18.3 11L16.5 9.4L18.9 9.1L20 6.8Z"
          className="fill-amber-300 dark:fill-[#0B0E14] classic:fill-[#D9A441]"
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: [0, 1.25, 1], rotate: 0 }}
          transition={{ duration: 0.5, delay: 0.14, ease: 'backOut' }}
        />
      </svg>
    </motion.div>
  );
}