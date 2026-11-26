import { resolveParticipantAvatar } from './avatarUpload';
import { getTournamentTheme } from './tournamentThemes';

const GRADIENTS = [
  ['#10b981', '#0d9488'],
  ['#0ea5e9', '#4f46e5'],
  ['#f59e0b', '#ea580c'],
  ['#f43f5e', '#db2777'],
  ['#8b5cf6', '#7c3aed'],
  ['#06b6d4', '#2563eb'],
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

function getGradientColors(name = '') {
  const str = String(name || 'jugador').toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function truncateText(ctx, text, maxWidth) {
  const str = String(text || '');
  if (ctx.measureText(str).width <= maxWidth) return str;
  let trimmed = str;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

function wrapTextLines(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || '').trim().split(/\s+/);
  const lines = [];
  let current = '';

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) {
        const rest = [current, ...words.slice(i + 1)].join(' ');
        lines.push(truncateText(ctx, rest, maxWidth));
        return lines;
      }
    }
  }
  if (current) lines.push(truncateText(ctx, current, maxWidth));
  return lines;
}

async function loadSafeCorsImage(url) {
  if (!url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(url, {
      mode: 'cors',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function drawAvatarCircle(ctx, { x, y, radius, name, image, borderColor }) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (image) {
    const aspect = image.width / Math.max(1, image.height);
    let drawW = radius * 2;
    let drawH = radius * 2;
    if (aspect > 1) {
      drawW = drawH * aspect;
    } else {
      drawH = drawW / aspect;
    }
    ctx.drawImage(image, x - drawW / 2, y - drawH / 2, drawW, drawH);
  } else {
    const [c1, c2] = getGradientColors(name);
    const grad = ctx.createLinearGradient(
      x - radius,
      y - radius,
      x + radius,
      y + radius
    );
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(radius * 0.78)}px "Outfit", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getInitials(name), x, y + 2);
  }
  ctx.restore();

  if (borderColor) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = borderColor;
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Genera una Placa PNG (1080x1350) lista para WhatsApp e Instagram Stories.
 */
export async function generateTournamentShareCard({
  tournament,
  summary,
  prodeLeader = null,
  theme = 'dark',
}) {
  if (typeof document === 'undefined' || !tournament || !summary) {
    throw new Error('No hay datos suficientes para generar la placa.');
  }

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // continuar si el navegador no soporta fonts.ready
    }
  }

  const isDark = theme === 'dark';
  const sportTheme = getTournamentTheme(tournament.config);

  // Precargar avatares relevantes en paralelo
  const awardEntries = [];
  if (summary.mvp) {
    awardEntries.push({
      badge: '⭐ MVP DEL TORNEO',
      accent: '#f59e0b',
      participant: summary.mvp.participant,
      title: summary.mvp.participant.name,
      sub: summary.mvp.headline,
    });
  }
  if (summary.biggestDaddy) {
    awardEntries.push({
      badge: '🕶️ MAYOR PATERNIDAD',
      accent: '#8b5cf6',
      participant: summary.biggestDaddy.parent,
      title: summary.biggestDaddy.headline,
      sub: summary.biggestDaddy.detail,
    });
  }
  if (summary.goalMachine) {
    awardEntries.push({
      badge: '🔥 MÁQUINA DE GOLES',
      accent: '#10b981',
      participant: summary.goalMachine.participant,
      title: summary.goalMachine.participant.name,
      sub: summary.goalMachine.headline,
    });
  } else if (summary.unbeatenStreak) {
    awardEntries.push({
      badge: '🛡️ RACHA IMBATIBLE',
      accent: '#14b8a6',
      participant: summary.unbeatenStreak.participant,
      title: summary.unbeatenStreak.participant.name,
      sub: summary.unbeatenStreak.headline,
    });
  }
  if (summary.woodenSpoon) {
    awardEntries.push({
      badge: '🥄 CUCHARA DE MADERA',
      accent: '#f43f5e',
      participant: summary.woodenSpoon.participant,
      title: summary.woodenSpoon.participant.name,
      sub: summary.woodenSpoon.headline,
    });
  }
  if (prodeLeader && awardEntries.length < 4) {
    awardEntries.push({
      badge: '🎯 LÍDER DEL PRODE',
      accent: '#6366f1',
      participant: prodeLeader.participant,
      title: prodeLeader.participant.name,
      sub: `${prodeLeader.points} pts · ${prodeLeader.effectivenessPct}% efect.`,
    });
  }

  const shownAwards = awardEntries.slice(0, 4);
  const podium = (summary.podium || []).slice(0, 3);

  const avatarUrls = new Set();
  podium.forEach((p) => {
    const url = resolveParticipantAvatar(p.participant);
    if (url) avatarUrls.add(url);
  });
  shownAwards.forEach((a) => {
    const url = resolveParticipantAvatar(a.participant);
    if (url) avatarUrls.add(url);
  });

  const loadedImages = new Map();
  await Promise.all(
    Array.from(avatarUrls).map(async (url) => {
      const img = await loadSafeCorsImage(url);
      if (img) loadedImages.set(url, img);
    })
  );

  // Configurar canvas HD 1080x1350
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Fondo base
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  if (isDark) {
    bgGrad.addColorStop(0, '#050814');
    bgGrad.addColorStop(0.5, '#0b1224');
    bgGrad.addColorStop(1, '#060a16');
  } else {
    bgGrad.addColorStop(0, '#f8fafc');
    bgGrad.addColorStop(0.5, '#eef6f3');
    bgGrad.addColorStop(1, '#f1f5f9');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Halos ambientales
  const glow1 = ctx.createRadialGradient(W * 0.5, 160, 20, W * 0.5, 160, 560);
  glow1.addColorStop(0, isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.18)');
  glow1.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(W * 0.85, H * 0.82, 20, W * 0.85, H * 0.82, 480);
  glow2.addColorStop(0, isDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(99, 102, 241, 0.12)');
  glow2.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // Grilla sutil
  ctx.save();
  ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.05)' : 'rgba(15, 23, 42, 0.035)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 54) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, H);
    ctx.stroke();
  }
  for (let gy = 0; gy < H; gy += 54) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
    ctx.stroke();
  }
  ctx.restore();

  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#475569';
  const cardBg = isDark ? 'rgba(15, 23, 42, 0.78)' : 'rgba(255, 255, 255, 0.88)';
  const cardBorder = isDark ? 'rgba(51, 65, 85, 0.75)' : 'rgba(203, 213, 225, 0.9)';

  // Pill superior
  ctx.save();
  drawRoundedRect(ctx, 72, 68, 420, 46, 23);
  ctx.fillStyle = isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.14)';
  ctx.fill();
  ctx.strokeStyle = isDark ? 'rgba(52, 211, 153, 0.45)' : 'rgba(16, 185, 129, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = isDark ? '#6ee7b7' : '#047857';
  ctx.font = '800 20px "Outfit", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${sportTheme.emoji}  RESUMEN · ${sportTheme.label.toUpperCase()}`,
    96,
    92
  );
  ctx.restore();

  // Título del torneo
  ctx.fillStyle = textPrimary;
  ctx.font = '900 58px "Outfit", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const titleLines = wrapTextLines(ctx, tournament.name, W - 144, 2);
  let cursorY = 140;
  titleLines.forEach((line) => {
    ctx.fillText(line, 72, cursorY);
    cursorY += 68;
  });

  if (summary.progressLabel) {
    ctx.fillStyle = textSecondary;
    ctx.font = '600 24px "Outfit", sans-serif';
    ctx.fillText(summary.progressLabel, 72, cursorY + 6);
    cursorY += 54;
  } else {
    cursorY += 20;
  }

  // PODIO PRINCIPAL
  if (podium.length > 0) {
    const podiumTop = cursorY + 12;
    const podiumCols = podium.length;
    const gap = 20;
    const cardW = (W - 144 - gap * (podiumCols - 1)) / podiumCols;

    const orderedPodium =
      podium.length === 3
        ? [
            podium.find((p) => p.place === 2),
            podium.find((p) => p.place === 1),
            podium.find((p) => p.place === 3),
          ].filter(Boolean)
        : podium;

    orderedPodium.forEach((item, idx) => {
      const px = 72 + idx * (cardW + gap);
      const isFirst = item.place === 1;
      const py = isFirst && podium.length === 3 ? podiumTop : podiumTop + 26;
      const cardH = isFirst && podium.length === 3 ? 330 : 304;

      const borderCol =
        item.place === 1
          ? 'rgba(245, 158, 11, 0.7)'
          : item.place === 2
          ? 'rgba(148, 163, 184, 0.65)'
          : 'rgba(249, 115, 22, 0.6)';

      const fillTop =
        item.place === 1
          ? isDark
            ? 'rgba(245, 158, 11, 0.2)'
            : 'rgba(254, 243, 199, 0.9)'
          : item.place === 2
          ? isDark
            ? 'rgba(148, 163, 184, 0.16)'
            : 'rgba(241, 245, 249, 0.95)'
          : isDark
          ? 'rgba(249, 115, 22, 0.16)'
          : 'rgba(255, 237, 213, 0.9)';

      ctx.save();
      drawRoundedRect(ctx, px, py, cardW, cardH, 28);
      ctx.fillStyle = fillTop;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = borderCol;
      ctx.stroke();
      ctx.restore();

      const medalText =
        item.place === 1 ? '🥇 1.º PUESTO' : item.place === 2 ? '🥈 2.º' : '🥉 3.º';
      ctx.fillStyle =
        item.place === 1
          ? isDark
            ? '#fcd34d'
            : '#b45309'
          : textSecondary;
      ctx.font = '800 20px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(medalText, px + cardW / 2, py + 22);

      const avUrl = resolveParticipantAvatar(item.participant);
      drawAvatarCircle(ctx, {
        x: px + cardW / 2,
        y: py + 124,
        radius: isFirst ? 56 : 48,
        name: item.participant.name,
        image: avUrl ? loadedImages.get(avUrl) : null,
        borderColor: borderCol,
      });

      ctx.fillStyle = textPrimary;
      ctx.font = '900 28px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        truncateText(ctx, item.participant.name, cardW - 28),
        px + cardW / 2,
        py + (isFirst ? 198 : 190)
      );

      ctx.fillStyle = isDark ? '#6ee7b7' : '#047857';
      ctx.font = '800 24px "JetBrains Mono", monospace';
      ctx.fillText(
        truncateText(ctx, item.metric, cardW - 24),
        px + cardW / 2,
        py + (isFirst ? 242 : 230)
      );

      ctx.fillStyle = textSecondary;
      ctx.font = '600 18px "Outfit", sans-serif';
      ctx.fillText(
        truncateText(ctx, item.subtext, cardW - 24),
        px + cardW / 2,
        py + (isFirst ? 280 : 266)
      );
    });

    cursorY = podiumTop + 372;
  } else {
    cursorY += 20;
  }

  // PREMIOS Y CURIOSIDADES
  if (shownAwards.length > 0) {
    ctx.fillStyle = textSecondary;
    ctx.font = '800 20px "Outfit", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('PREMIOS & CURIOSIDADES', 72, cursorY);
    cursorY += 38;

    const awardH = 132;
    const awardGap = 18;

    shownAwards.forEach((award, idx) => {
      const ay = cursorY + idx * (awardH + awardGap);
      if (ay + awardH > H - 105) return;

      ctx.save();
      drawRoundedRect(ctx, 72, ay, W - 144, awardH, 24);
      ctx.fillStyle = cardBg;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = cardBorder;
      ctx.stroke();

      // Barra lateral de acento
      drawRoundedRect(ctx, 72, ay + 20, 8, awardH - 40, 4);
      ctx.fillStyle = award.accent;
      ctx.fill();
      ctx.restore();

      const avUrl = resolveParticipantAvatar(award.participant);
      drawAvatarCircle(ctx, {
        x: 142,
        y: ay + awardH / 2,
        radius: 38,
        name: award.participant?.name || '?',
        image: avUrl ? loadedImages.get(avUrl) : null,
        borderColor: award.accent,
      });

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = award.accent;
      ctx.font = '800 17px "Outfit", sans-serif';
      ctx.fillText(award.badge, 200, ay + 20);

      ctx.fillStyle = textPrimary;
      ctx.font = '900 27px "Outfit", sans-serif';
      ctx.fillText(truncateText(ctx, award.title, W - 295), 200, ay + 48);

      ctx.fillStyle = textSecondary;
      ctx.font = '600 20px "Outfit", sans-serif';
      ctx.fillText(truncateText(ctx, award.sub, W - 295), 200, ay + 86);
    });
  }

  // Footer marca
  ctx.save();
  ctx.fillStyle = textSecondary;
  ctx.font = '700 20px "Outfit", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('🏆 AppTorneos · Torneos entre amigos', 72, H - 46);

  ctx.font = '800 20px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = isDark ? '#6ee7b7' : '#059669';
  ctx.fillText(`#${tournament.invite_code || 'ARENA'}`, W - 72, H - 46);
  ctx.restore();

  const blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) {
    throw new Error('No se pudo exportar la imagen PNG.');
  }
  return blob;
}