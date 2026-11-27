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
  group_stage: {
    value: 'group_stage',
    label: 'Grupos + Eliminación',
    description:
      'Fase de grupos configurable (directos, playoff y mejores terceros) hacia llaves finales.',
    badgeClass:
      'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/35',
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
  if (role === 'owner') {
    return {
      label: 'Owner',
      fullLabel: 'Creador (Owner)',
      badgeClass:
        'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/35',
    };
  }

  if (role === 'admin') {
    return {
      label: 'Admin',
      fullLabel: 'Administrador',
      badgeClass:
        'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/35',
    };
  }

  return {
    label: 'Miembro',
    fullLabel: 'Miembro',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  };
}

export function getMeetingsLabel(config = {}) {
  const meetings = Number.parseInt(config?.meetings_per_pair, 10);
  if (!Number.isNaN(meetings) && meetings >= 1) {
    if (meetings === 1) return 'Solo ida';
    if (meetings === 2) return 'Ida y vuelta';
    return `${meetings} vueltas`;
  }
  return config?.home_and_away ? 'Ida y vuelta' : 'Solo ida';
}

export function getConfigSummaryItems(format, config = {}) {
  const items = [];
  if (!config || typeof config !== 'object') return items;

  if (format === 'league') {
    items.push(getMeetingsLabel(config));
    if (config.league_tiebreaker) {
      items.push('Desempate 3/2/1');
    }
    if (config.rounds) {
      items.push(`${config.rounds} ${config.rounds === 1 ? 'jornada' : 'jornadas'}`);
    }
  } else if (format === 'knockout') {
    items.push(config.home_and_away ? 'Cruces ida y vuelta' : 'Partido único');
    if (config.third_place) {
      items.push('Con 3.º puesto');
    }
  } else if (format === 'group_stage') {
    const gc = Number.parseInt(config.group_count || 2, 10);
    const direct = Number.parseInt(config.direct_per_group ?? 2, 10);
    const playoff = Number.parseInt(config.playoff_per_group ?? 0, 10);
    const thirds = Number.parseInt(config.best_thirds_count ?? 0, 10);

    items.push(`${gc} ${gc === 1 ? 'grupo' : 'grupos'}`);
    if (direct > 0 && playoff > 0) {
      items.push(`${direct} dir. + ${playoff} playoff / grupo`);
    } else if (direct > 0) {
      items.push(`${direct} directo${direct === 1 ? '' : 's'} / grupo`);
    } else if (playoff > 0) {
      items.push(`${playoff} a playoff / grupo`);
    }
    if (thirds > 0) {
      items.push(
        `+${thirds} mejor${thirds === 1 ? '' : 'es'} ${direct + playoff + 1}.º`
      );
    }
    const groupMeetings = Number.parseInt(config.group_meetings_per_pair, 10);
    if (!Number.isNaN(groupMeetings) && groupMeetings > 2) {
      items.push(`Grupos ${groupMeetings} vueltas`);
    } else {
      items.push(config.group_home_and_away ? 'Grupos ida/vuelta' : 'Grupos solo ida');
    }
    if (config.league_tiebreaker) {
      items.push('Desempate 3/2/1');
    }
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