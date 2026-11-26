/**
 * Lanza una explosión de confetti dorado/esmeralda en <canvas> sin dependencias externas.
 * Respeta prefers-reduced-motion y se auto-limpia al terminar.
 */
export function triggerChampionConfetti() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const prefersReduced = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)'
  )?.matches;
  if (prefersReduced) return;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '120';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.scale(dpr, dpr);

  const colors = [
    '#fbbf24', // gold
    '#f59e0b', // amber
    '#10b981', // emerald
    '#34d399', // light emerald
    '#fde68a', // champagne
    '#ffffff', // highlight
  ];

  const particleCount = width < 640 ? 65 : 105;
  const particles = [];

  for (let i = 0; i < particleCount; i += 1) {
    const fromLeft = i % 2 === 0;
    const originX = fromLeft ? width * 0.12 : width * 0.88;
    const originY = height * 0.78;
    const angleBase = fromLeft ? -Math.PI / 3 : (-2 * Math.PI) / 3;
    const angle = angleBase + (Math.random() - 0.5) * 0.7;
    const speed = 9 + Math.random() * 10;

    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 6 + Math.random() * 6,
      color: colors[i % colors.length],
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.24,
      drag: 0.985,
      gravity: 0.34,
      opacity: 1,
      shape: i % 3 === 0 ? 'circle' : 'rect',
    });
  }

  let rafId = null;
  const startTime = performance.now();
  const maxDuration = 3200;

  function tick(now) {
    const elapsed = now - startTime;
    ctx.clearRect(0, 0, width, height);

    let alive = 0;
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vRot;

      if (elapsed > 2000) {
        p.opacity = Math.max(0, p.opacity - 0.03);
      }

      if (p.opacity <= 0 || p.y > height + 40) continue;
      alive += 1;

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.42, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
      }
      ctx.restore();
    }

    if (alive > 0 && elapsed < maxDuration) {
      rafId = window.requestAnimationFrame(tick);
    } else {
      if (rafId) window.cancelAnimationFrame(rafId);
      canvas.remove();
    }
  }

  rafId = window.requestAnimationFrame(tick);
}