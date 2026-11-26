import { resolveParticipantAvatar } from './avatarUpload';
import { getTournamentTheme } from './tournamentThemes';

function clamp(val, min = 50, max = 99) {
  return Math.min(max, Math.max(min, Math.round(val)));
}

async function loadSafeImage(url) {
  if (!url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(url, { mode: 'cors', signal: controller.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);

    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        resolve(null);
      };
      img.src = objUrl;
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Calcula los atributos y el Overall (50-99) de un jugador a partir de sus estadísticas reales.
 */
export function calculatePlayerCardAttributes({
  participant,
  matches = [],
  customMatchdays = [],
  subtournaments = [],
  subEntries = [],
  subEntryMembers = [],
  subMatches = [],
  prodePolls = [],
  prodeVotes = [],
}) {
  const pId = participant?.id;
  let pj = 0;
  let pg = 0;
  let pe = 0;
  let pp = 0;
  let gf = 0;
  let gc = 0;
  let cleanSheets = 0;
  let bestStreak = 0;
  let currentStreak = 0;

  // Si hay partidos estándar
  matches.forEach((m) => {
    if (m.status !== 'completed' || m.is_bye) return;
    const isA = m.participant_a_id === pId;
    const isB = m.participant_b_id === pId;
    if (!isA && !isB) return;

    pj += 1;
    const myScore = isA ? m.score_a : m.score_b;
    const opScore = isA ? m.score_b : m.score_a;

    if (myScore !== null && opScore !== null) {
      gf += myScore;
      gc += opScore;
      if (opScore === 0) cleanSheets += 1;
    }

    if (m.is_draw || (myScore !== null && myScore === opScore)) {
      pe += 1;
      currentStreak += 1;
    } else if (
      m.winner_id === pId ||
      (myScore !== null && opScore !== null && myScore > opScore)
    ) {
      pg += 1;
      currentStreak += 1;
    } else {
      pp += 1;
      currentStreak = 0;
    }
    if (currentStreak > bestStreak) bestStreak = currentStreak;
  });

  // Si hay subtorneos personalizados
  let subTitles = 0;
  const myEntryIds = new Set();
  subEntryMembers.forEach((em) => {
    if (em.participant_id === pId) myEntryIds.add(em.entry_id);
  });

  subEntries.forEach((e) => {
    if (e.participant_id === pId || myEntryIds.has(e.id)) {
      if (e.final_rank === 1) subTitles += 1;
    }
  });

  // Prode del jugador
  let prodeHits = 0;
  let prodeTotal = 0;
  if (participant?.user_id) {
    const userVotes = prodeVotes.filter((v) => v.user_id === participant.user_id);
    prodeTotal = userVotes.length;
    userVotes.forEach((v) => {
      if (v.predicted_outcome || v.predicted_entry_id) prodeHits += 1;
    });
  }

  // Métricas base normalizadas (50 a 99)
  const winRate = pj > 0 ? (pg / pj) * 100 : 50;
  const avgGf = pj > 0 ? gf / pj : 1.2;
  const avgGc = pj > 0 ? gc / pj : 1.5;

  // ATA: Goles y efectividad ofensiva
  const ata = clamp(55 + avgGf * 14 + (winRate - 50) * 0.25);

  // DEF: Goles en contra bajos y vallas invictas
  const def = clamp(75 - avgGc * 12 + cleanSheets * 5);

  // RCH (Racha & Temple): Capacidad de no perder partidos seguidos
  const rch = clamp(58 + bestStreak * 7 + (pe / Math.max(1, pj)) * 20);

  // PRD (Intuición / Prode): Porcentaje de aciertos en predicciones
  const prd = clamp(
    prodeTotal > 0 ? 55 + (prodeHits / prodeTotal) * 38 : 70
  );

  // CLR (Clutch / Títulos / Definición): Podios y partidos ganados decisivos
  const clr = clamp(60 + subTitles * 8 + (winRate > 60 ? 12 : 0));

  // VIC (% Victoria pura)
  const vic = clamp(winRate);

  // Overall ponderado estilo FIFA/EA FC
  const overall = clamp(
    ata * 0.28 + def * 0.22 + vic * 0.25 + rch * 0.12 + clr * 0.13
  );

  let position = 'DEL';
  if (def > ata + 6) position = 'DEF';
  else if (Math.abs(ata - def) <= 6) position = 'MED';
  if (overall >= 90) position = 'EST'; // Estrella

  return {
    overall,
    position,
    stats: {
      ATA: ata,
      DEF: def,
      RCH: rch,
      PRD: prd,
      CLR: clr,
      VIC: vic,
    },
    meta: {
      pj,
      pg,
      pe,
      pp,
      gf,
      gc,
      cleanSheets,
      subTitles,
    },
  };
}

/**
 * Traza la forma del escudo clásico de Ultimate Team en un contexto de Canvas
 */
function traceCardShieldPath(ctx, x, y, w, h, r = 36) {
  const topRadius = r;
  const bottomCornerY = y + h * 0.82;
  const bottomTipY = y + h;
  const centerX = x + w / 2;

  ctx.beginPath();
  // Arriba a la izquierda redondeado
  ctx.moveTo(x + topRadius, y);
  // Línea superior
  ctx.lineTo(x + w - topRadius, y);
  ctx.arcTo(x + w, y, x + w, y + topRadius, topRadius);
  // Lado derecho
  ctx.lineTo(x + w, bottomCornerY);
  // Curva hacia la punta inferior
  ctx.quadraticCurveTo(x + w * 0.82, bottomTipY - h * 0.04, centerX, bottomTipY);
  // Curva desde la punta hacia el lado izquierdo
  ctx.quadraticCurveTo(x + w * 0.18, bottomTipY - h * 0.04, x, bottomCornerY);
  // Lado izquierdo
  ctx.lineTo(x, y + topRadius);
  ctx.arcTo(x, y, x + topRadius, y, topRadius);
  ctx.closePath();
}

/**
 * Genera la Carta en PNG transparente (600x840 px) lista para sticker de WhatsApp.
 */
export async function generatePlayerCardPng({
  participant,
  tournament,
  attributes,
  style = 'gold', // 'gold' | 'black' | 'emerald'
}) {
  if (typeof document === 'undefined' || !participant) {
    throw new Error('Datos insuficientes para generar la carta.');
  }

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignorar fallback si fonts.ready no está disponible
    }
  }

  const W = 600;
  const H = 840;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Limpiar lienzo transparente (crucial para stickers de WhatsApp)
  ctx.clearRect(0, 0, W, H);

  const cardX = 24;
  const cardY = 24;
  const cardW = W - 48;
  const cardH = H - 48;

  // 1. DIBUJAR SILUETA DEL ESCUDO
  ctx.save();
  traceCardShieldPath(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.clip();

  // Fondo con gradiente metálico según el estilo
  const bgGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  if (style === 'black') {
    bgGrad.addColorStop(0, '#1e293b');
    bgGrad.addColorStop(0.35, '#0f172a');
    bgGrad.addColorStop(0.7, '#020617');
    bgGrad.addColorStop(1, '#0f172a');
  } else if (style === 'emerald') {
    bgGrad.addColorStop(0, '#065f46');
    bgGrad.addColorStop(0.4, '#047857');
    bgGrad.addColorStop(0.8, '#064e3b');
    bgGrad.addColorStop(1, '#022c22');
  } else {
    // Gold Clásico FUT
    bgGrad.addColorStop(0, '#fef08a');
    bgGrad.addColorStop(0.25, '#f59e0b');
    bgGrad.addColorStop(0.65, '#b45309');
    bgGrad.addColorStop(1, '#78350f');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  // Tramas geométricas internas FUT
  ctx.strokeStyle = style === 'gold' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 9; i += 1) {
    ctx.beginPath();
    ctx.moveTo(cardX + 40 + i * 55, cardY);
    ctx.lineTo(cardX + cardW - 40 - i * 55, cardY + cardH);
    ctx.stroke();
  }

  // Reflejo luminoso superior
  const sheen = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + 280);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
  sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(cardX, cardY, cardW, 280);
  ctx.restore();

  // 2. BORDE METÁLICO DEL ESCUDO
  ctx.save();
  traceCardShieldPath(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.lineWidth = 8;
  const borderGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  if (style === 'gold') {
    borderGrad.addColorStop(0, '#fef9c3');
    borderGrad.addColorStop(0.4, '#f59e0b');
    borderGrad.addColorStop(0.8, '#d97706');
    borderGrad.addColorStop(1, '#78350f');
  } else if (style === 'emerald') {
    borderGrad.addColorStop(0, '#a7f3d0');
    borderGrad.addColorStop(0.5, '#34d399');
    borderGrad.addColorStop(1, '#065f46');
  } else {
    borderGrad.addColorStop(0, '#94a3b8');
    borderGrad.addColorStop(0.5, '#475569');
    borderGrad.addColorStop(1, '#1e293b');
  }
  ctx.strokeStyle = borderGrad;
  ctx.stroke();
  ctx.restore();

  // 3. DATOS DE CABECERA (Rating + Posición + Deporte)
  const textGold = style === 'gold' ? '#3e1f00' : '#ffffff';
  const textGoldSub = style === 'gold' ? '#5c3206' : '#cbd5e1';
  const sportTheme = getTournamentTheme(tournament?.config);

  // Overall Number
  ctx.save();
  ctx.fillStyle = textGold;
  ctx.font = '900 68px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(String(attributes.overall), cardX + 92, cardY + 68);

  // Posición (DEL, DEF, MED, EST)
  ctx.font = '800 24px "Outfit", sans-serif';
  ctx.fillText(attributes.position, cardX + 92, cardY + 142);

  // Separador sutil
  ctx.strokeStyle = style === 'gold' ? 'rgba(62, 31, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 68, cardY + 180);
  ctx.lineTo(cardX + 116, cardY + 180);
  ctx.stroke();

  // Emoji del Deporte
  ctx.font = '32px sans-serif';
  ctx.fillText(sportTheme.emoji || '🏆', cardX + 92, cardY + 196);
  ctx.restore();

  // 4. AVATAR CENTRAL DEL JUGADOR
  const avatarUrl = resolveParticipantAvatar(participant);
  const avatarImg = await loadSafeImage(avatarUrl);
  const avCenterX = cardX + cardW * 0.62;
  const avCenterY = cardY + 172;
  const avRadius = 105;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avCenterX, avCenterY, avRadius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (avatarImg) {
    const aspect = avatarImg.width / Math.max(1, avatarImg.height);
    let dw = avRadius * 2;
    let dh = avRadius * 2;
    if (aspect > 1) dw = dh * aspect;
    else dh = dw / aspect;
    ctx.drawImage(avatarImg, avCenterX - dw / 2, avCenterY - dh / 2, dw, dh);
  } else {
    // Fallback con iniciales
    const initials = participant.name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    ctx.fillStyle = style === 'gold' ? '#b45309' : '#0f172a';
    ctx.fillRect(avCenterX - avRadius, avCenterY - avRadius, avRadius * 2, avRadius * 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 84px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials || '?', avCenterX, avCenterY + 4);
  }
  ctx.restore();

  // Aro exterior del avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(avCenterX, avCenterY, avRadius + 3, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = style === 'gold' ? '#fef08a' : '#34d399';
  ctx.stroke();
  ctx.restore();

  // 5. CINTA CON EL NOMBRE DEL JUGADOR
  const ribbonY = cardY + 310;
  ctx.save();
  ctx.fillStyle = textGold;
  ctx.font = '900 42px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let rawName = participant.name.toUpperCase();
  if (ctx.measureText(rawName).width > cardW - 80) {
    while (rawName.length > 3 && ctx.measureText(`${rawName}…`).width > cardW - 80) {
      rawName = rawName.slice(0, -1);
    }
    rawName = `${rawName}…`;
  }
  ctx.fillText(rawName, cardX + cardW / 2, ribbonY);

  // Línea decorativa bajo el nombre
  ctx.strokeStyle = style === 'gold' ? 'rgba(62, 31, 0, 0.4)' : 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cardX + 60, ribbonY + 28);
  ctx.lineTo(cardX + cardW - 60, ribbonY + 28);
  ctx.stroke();
  ctx.restore();

  // 6. GRILLA DE ATRIBUTOS (2 Columnas x 3 Filas)
  const statsKeys = [
    ['ATA', attributes.stats.ATA],
    ['DEF', attributes.stats.DEF],
    ['RCH', attributes.stats.RCH],
    ['PRD', attributes.stats.PRD],
    ['CLR', attributes.stats.CLR],
    ['VIC', attributes.stats.VIC],
  ];

  const col1X = cardX + 115;
  const col2X = cardX + cardW - 200;
  const startStatY = ribbonY + 68;
  const rowHeight = 62;

  ctx.save();
  statsKeys.forEach(([label, val], idx) => {
    const isCol2 = idx >= 3;
    const colX = isCol2 ? col2X : col1X;
    const rowIdx = idx % 3;
    const currentY = startStatY + rowIdx * rowHeight;

    // Número
    ctx.fillStyle = textGold;
    ctx.font = '900 36px "Outfit", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(val), colX, currentY);

    // Etiqueta
    ctx.fillStyle = textGoldSub;
    ctx.font = '700 24px "Outfit", sans-serif';
    ctx.fillText(label, colX + 54, currentY);
  });
  ctx.restore();

  // 7. PIE / SELLO DEL TORNEO
  ctx.save();
  ctx.fillStyle = textGoldSub;
  ctx.font = '800 16px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(
    `APPTORNEOS · ${tournament?.name?.toUpperCase() || 'COMPETICIÓN'}`,
    cardX + cardW / 2,
    cardY + cardH - 32
  );
  ctx.restore();

  const blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) throw new Error('No se pudo generar el PNG de la carta.');
  return blob;
}