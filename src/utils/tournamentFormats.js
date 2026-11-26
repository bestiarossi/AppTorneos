export const TOURNAMENT_FORMATS = {
  league: {
    value: 'league',
    label: 'Liga',
    description: 'Todos contra todos acumulando puntos en la tabla.',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  knockout: {
    value: 'knockout',
    label: 'Eliminatoria',
    description: 'Cruces directos de eliminación hasta la final.',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  last_standing: {
    value: 'last_standing',
    label: 'Último en pie',
    description: 'Supervivencia ronda a ronda hasta quedar un ganador.',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  custom: {
    value: 'custom',
    label: 'Personalizado',
    description: 'Reglas libres diseñadas a medida para tu grupo.',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
};

export const TOURNAMENT_FORMAT_LIST = Object.values(TOURNAMENT_FORMATS);

export function getFormatMeta(format) {
  return (
    TOURNAMENT_FORMATS[format] || {
      value: format,
      label: 'Personalizado',
      description: 'Formato personalizado.',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    }
  );
}

export function getRoleMeta(role) {
  if (role === 'admin') {
    return {
      label: 'Admin',
      fullLabel: 'Administrador',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    };
  }

  return {
    label: 'Participante',
    fullLabel: 'Participante',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  };
}

export function getConfigSummaryItems(format, config = {}) {
  const items = [];
  if (!config || typeof config !== 'object') return items;

  if (format === 'league') {
    items.push(config.home_and_away ? 'Ida y vuelta' : 'Solo ida');
    if (config.rounds) {
      items.push(`${config.rounds} ${config.rounds === 1 ? 'jornada' : 'jornadas'}`);
    }
  } else if (format === 'knockout') {
    items.push(config.home_and_away ? 'Cruces ida y vuelta' : 'Partido único');
    if (config.third_place) {
      items.push('Con 3.º puesto');
    }
  } else if (format === 'last_standing') {
    if (config.initial_lives) {
      items.push(
        `${config.initial_lives} ${config.initial_lives === 1 ? 'vida inicial' : 'vidas iniciales'}`
      );
    }
    if (config.rounds) {
      items.push(`${config.rounds} ${config.rounds === 1 ? 'jornada' : 'jornadas'}`);
    }
  } else if (format === 'custom') {
    if (config.rounds) {
      items.push(`${config.rounds} ${config.rounds === 1 ? 'jornada' : 'jornadas'}`);
    }
    if (config.notes) {
      items.push(config.notes);
    }
  }

  return items;
}

export function formatShortDate(dateString) {
  if (!dateString) return '';
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateString));
  } catch {
    return '';
  }
}