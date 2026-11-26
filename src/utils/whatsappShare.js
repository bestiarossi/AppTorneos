import {
  adaptEntriesToParticipants,
  adaptSubEliminationsToEliminations,
  adaptSubMatchesToMatches,
  computeCustomGeneralStandings,
  computeCustomMatchdayStandings,
  getSubtournamentFormatMeta,
} from './customTournamentEngine';
import {
  computeKnockoutSummary,
  computeLastStandingStandings,
  computeLeagueStandings,
} from './tournamentEngine';

function getRankMedal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}.`;
}

export function openWhatsAppShare(text) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  }
}

export function buildLeagueStandingsWhatsAppText(
  tournament,
  participants,
  matches
) {
  const rows = computeLeagueStandings(participants, matches);
  const lines = [`🏆 *${tournament.name}* — Tabla de Posiciones`, ''];

  rows.forEach((row, index) => {
    const pos = index + 1;
    const dgText = row.dg > 0 ? `+${row.dg}` : `${row.dg}`;
    lines.push(
      `${getRankMedal(pos)} *${row.participant.name}* — *${row.pts} pts* (${row.pj}PJ · ${row.pg}G ${row.pe}E ${row.pp}P · DG ${dgText})`
    );
  });

  return lines.join('\n');
}

export function buildKnockoutStandingsWhatsAppText(
  tournament,
  participants,
  matches
) {
  const summary = computeKnockoutSummary(participants, matches);
  const lines = [`🏆 *${tournament.name}* — Eliminatoria`, ''];

  if (summary.champion) {
    lines.push(`👑 *Campeón:* ${summary.champion.name}`);
  }
  if (summary.runnerUp) {
    lines.push(`🥈 *Subcampeón:* ${summary.runnerUp.name}`);
  }

  const thirdPlaceText = summary.thirdPlace
    ? summary.thirdPlace.name
    : !summary.hasThirdPlaceMatch && summary.semifinalLosers.length === 2
    ? summary.semifinalLosers.map((p) => p.name).join(' / ')
    : null;

  if (thirdPlaceText) {
    lines.push(`🥉 *3.º puesto:* ${thirdPlaceText}`);
  }

  if (!summary.champion) {
    lines.push(
      `📊 _Progreso: ${summary.completedTies}/${summary.totalTies} llaves completadas_`
    );
    if (summary.activeRounds.length > 0) {
      lines.push(`⚔️ _En juego: ${summary.activeRounds.join(', ')}_`);
    }
  }

  return lines.join('\n');
}

export function buildLastStandingWhatsAppText(
  tournament,
  participants,
  eliminations
) {
  const ls = computeLastStandingStandings(participants, eliminations);
  const lines = [`🔥 *${tournament.name}* — Último en pie`, ''];

  if (ls.champion) {
    lines.push(`👑 *Campeón:* ${ls.champion.name}`);
    lines.push('');
  } else if (ls.stillStanding.length > 0) {
    lines.push(
      `🟢 *En pie (${ls.stillStanding.length}):* ${ls.stillStanding
        .map((p) => p.name)
        .join(', ')}`
    );
  }

  if (ls.eliminated.length > 0) {
    const eliminatedText = ls.eliminated
      .map((p) => `${p.name} (#${ls.eliminationMap.get(p.id)?.elimination_order})`)
      .join(', ');
    lines.push(`💀 *Eliminados:* ${eliminatedText}`);
  }

  return lines.join('\n');
}

export function buildCustomGeneralWhatsAppText(
  tournament,
  participants,
  matchdays,
  subtournaments,
  subEntries,
  subEntryMembers
) {
  const rows = computeCustomGeneralStandings(
    participants,
    matchdays,
    subtournaments,
    subEntries,
    subEntryMembers
  );
  const completedCount = subtournaments.filter(
    (s) => s.status === 'completed'
  ).length;

  const lines = [
    `🏆 *${tournament.name}* — Tabla General`,
    `📊 _${completedCount} de ${subtournaments.length} subtorneos finalizados_`,
    '',
  ];

  rows.forEach((row, index) => {
    const pos = index + 1;
    const breakdown = matchdays
      .map((md) => {
        const mdInfo = row.matchdayPoints.get(md.id);
        return mdInfo?.participated ? `J${md.matchday_number}: ${mdInfo.points}` : null;
      })
      .filter(Boolean)
      .join(' | ');

    lines.push(
      `${getRankMedal(pos)} *${row.participant.name}* — *${row.totalPoints} pts*${
        breakdown ? ` (${breakdown})` : ''
      }`
    );
  });

  return lines.join('\n');
}

export function buildCustomMatchdayWhatsAppText(
  tournament,
  matchday,
  participants,
  matchdaySubtournaments,
  subEntries,
  subEntryMembers
) {
  const rows = computeCustomMatchdayStandings(
    participants,
    matchdaySubtournaments,
    subEntries,
    subEntryMembers
  );

  const lines = [
    `📅 *${tournament.name}* — *${matchday.name}*`,
    '',
  ];

  rows.forEach((row, index) => {
    const pos = index + 1;
    const subParts = matchdaySubtournaments
      .map((sub) => {
        const res = row.subResults.get(sub.id);
        if (!res?.participated) return null;
        if (!res.completed) return `${sub.name}: en juego`;
        return `${sub.name}: ${res.finalRank}.º (+${res.points})`;
      })
      .filter(Boolean);

    lines.push(
      `${getRankMedal(pos)} *${row.participant.name}* — *${row.totalPoints} pts*`
    );
    if (subParts.length > 0) {
      lines.push(`   └ ${subParts.join(' · ')}`);
    }
  });

  return lines.join('\n');
}

export function buildSubtournamentWhatsAppText(
  tournamentName,
  matchday,
  subtournament,
  entries,
  entryMembers,
  subMatches,
  subEliminations,
  participantMap
) {
  const isTeamBased = Boolean(subtournament.config?.is_team_based);
  const formatMeta = getSubtournamentFormatMeta(subtournament.format);
  const headerTitle = tournamentName
    ? `${subtournament.name} (${matchday?.name || 'Jornada'} · ${tournamentName})`
    : subtournament.name;

  const lines = [
    `🏅 *${headerTitle}*`,
    `📌 _Formato: ${formatMeta.label} · ${
      subtournament.status === 'completed' ? 'Finalizado' : 'En juego'
    }_`,
    '',
  ];

  const membersByEntry = new Map();
  entryMembers.forEach((em) => {
    if (!membersByEntry.has(em.entry_id)) {
      membersByEntry.set(em.entry_id, []);
    }
    const pName = participantMap.get(em.participant_id)?.name;
    if (pName) membersByEntry.get(em.entry_id).push(pName);
  });

  if (subtournament.status === 'completed') {
    const sorted = [...entries].sort(
      (a, b) => (a.final_rank ?? 999) - (b.final_rank ?? 999)
    );
    sorted.forEach((entry) => {
      const rank = entry.final_rank ?? '-';
      lines.push(
        `${getRankMedal(rank)} *${entry.entry_name}* (+${entry.points_awarded} pts)`
      );
      if (isTeamBased) {
        const members = membersByEntry.get(entry.id) || [];
        if (members.length > 0) {
          lines.push(`   👥 ${members.join(', ')}`);
        }
      }
    });
    return lines.join('\n');
  }

  const adaptedEntries = adaptEntriesToParticipants(
    entries,
    entryMembers,
    null,
    participantMap
  );
  const adaptedMatches = adaptSubMatchesToMatches(subMatches);
  const adaptedElims = adaptSubEliminationsToEliminations(subEliminations);

  if (subtournament.format === 'league') {
    const rows = computeLeagueStandings(adaptedEntries, adaptedMatches);
    rows.forEach((row, idx) => {
      lines.push(
        `${getRankMedal(idx + 1)} *${row.participant.name}* — ${row.pts} pts (${row.pj}PJ)`
      );
    });
  } else if (subtournament.format === 'knockout') {
    const summary = computeKnockoutSummary(adaptedEntries, adaptedMatches);
    if (summary.champion) {
      lines.push(`👑 *Campeón:* ${summary.champion.name}`);
    }
    if (summary.runnerUp) {
      lines.push(`🥈 *Subcampeón:* ${summary.runnerUp.name}`);
    }
    if (!summary.champion) {
      lines.push(
        `⚔️ Llaves completadas: ${summary.completedTies}/${summary.totalTies}`
      );
    }
  } else if (subtournament.format === 'last_standing') {
    const ls = computeLastStandingStandings(adaptedEntries, adaptedElims);
    if (ls.champion) {
      lines.push(`👑 *Campeón:* ${ls.champion.name}`);
    } else {
      lines.push(
        `🟢 *En pie (${ls.stillStanding.length}):* ${ls.stillStanding
          .map((e) => e.name)
          .join(', ')}`
      );
      if (ls.eliminated.length > 0) {
        lines.push(
          `💀 *Eliminados:* ${ls.eliminated.map((e) => e.name).join(', ')}`
        );
      }
    }
  } else {
    entries.forEach((entry, idx) => {
      lines.push(`${idx + 1}. ${entry.entry_name}`);
    });
  }

  return lines.join('\n');
}