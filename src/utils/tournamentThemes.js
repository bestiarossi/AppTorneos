export const TOURNAMENT_SPORTS = {
  general: {
    id: 'general',
    label: 'Clásico / Mixto',
    emoji: '🏆',
    scoreLabel: 'Goles / Puntos',
    heroGradient: 'from-emerald-500/20 via-teal-500/8 to-transparent',
    accentBorder: 'hover:border-emerald-400/70',
    badgeClass:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-300',
    cardRibbon: 'from-emerald-500 to-teal-500',
  },
  football: {
    id: 'football',
    label: 'Fútbol / EA FC',
    emoji: '⚽',
    scoreLabel: 'Goles',
    heroGradient: 'from-emerald-500/24 via-green-500/10 to-transparent',
    accentBorder: 'hover:border-emerald-400/80',
    badgeClass:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/15 dark:text-emerald-300',
    cardRibbon: 'from-emerald-500 to-green-600',
  },
  padel: {
    id: 'padel',
    label: 'Pádel / Tenis',
    emoji: '🎾',
    scoreLabel: 'Games / Sets',
    heroGradient: 'from-lime-500/22 via-cyan-500/10 to-transparent',
    accentBorder: 'hover:border-lime-400/80',
    badgeClass:
      'border-lime-300 bg-lime-50 text-lime-800 dark:border-lime-500/35 dark:bg-lime-500/15 dark:text-lime-300',
    cardRibbon: 'from-lime-500 to-teal-500',
  },
  basket: {
    id: 'basket',
    label: 'Básquet / NBA',
    emoji: '🏀',
    scoreLabel: 'Puntos',
    heroGradient: 'from-orange-500/24 via-amber-500/10 to-transparent',
    accentBorder: 'hover:border-orange-400/80',
    badgeClass:
      'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/35 dark:bg-orange-500/15 dark:text-orange-300',
    cardRibbon: 'from-orange-500 to-amber-500',
  },
  cards: {
    id: 'cards',
    label: 'Truco / Cartas',
    emoji: '🃏',
    scoreLabel: 'Puntos',
    heroGradient: 'from-rose-500/22 via-amber-500/8 to-transparent',
    accentBorder: 'hover:border-rose-400/80',
    badgeClass:
      'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/15 dark:text-rose-300',
    cardRibbon: 'from-rose-500 to-amber-500',
  },
  racing: {
    id: 'racing',
    label: 'F1 / Carreras',
    emoji: '🏎️',
    scoreLabel: 'Puntos',
    heroGradient: 'from-red-500/24 via-orange-500/8 to-transparent',
    accentBorder: 'hover:border-red-400/80',
    badgeClass:
      'border-red-200 bg-red-50 text-red-800 dark:border-red-500/35 dark:bg-red-500/15 dark:text-red-300',
    cardRibbon: 'from-red-500 to-orange-600',
  },
  gaming: {
    id: 'gaming',
    label: 'Gaming / Esports',
    emoji: '🎮',
    scoreLabel: 'Puntos',
    heroGradient: 'from-indigo-500/24 via-violet-500/10 to-transparent',
    accentBorder: 'hover:border-violet-400/80',
    badgeClass:
      'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/35 dark:bg-violet-500/15 dark:text-violet-300',
    cardRibbon: 'from-indigo-500 to-violet-600',
  },
};

export const TOURNAMENT_SPORT_LIST = Object.values(TOURNAMENT_SPORTS);

export function getTournamentTheme(config = {}) {
  const key = config?.sport;
  return TOURNAMENT_SPORTS[key] || TOURNAMENT_SPORTS.general;
}