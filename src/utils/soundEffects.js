const SOUND_STORAGE_KEY = 'torneoclub-sound-settings';

let audioCtx = null;
let globalListenerAttached = false;

function loadSettings() {
  if (typeof window === 'undefined') {
    return { muted: false, volume: 0.65 };
  }
  try {
    const raw = window.localStorage.getItem(SOUND_STORAGE_KEY);
    if (!raw) return { muted: false, volume: 0.65 };
    const parsed = JSON.parse(raw);
    return {
      muted: Boolean(parsed.muted),
      volume:
        typeof parsed.volume === 'number'
          ? Math.max(0, Math.min(1, parsed.volume))
          : 0.65,
    };
  } catch {
    return { muted: false, volume: 0.65 };
  }
}

let currentSettings = loadSettings();
const subscribers = new Set();

function notifySubscribers() {
  subscribers.forEach((fn) => fn({ ...currentSettings }));
}

export function getSoundSettings() {
  return { ...currentSettings };
}

export function updateSoundSettings(patch) {
  currentSettings = {
    ...currentSettings,
    ...patch,
    volume:
      typeof patch.volume === 'number'
        ? Math.max(0, Math.min(1, patch.volume))
        : currentSettings.volume,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        SOUND_STORAGE_KEY,
        JSON.stringify(currentSettings)
      );
    } catch {
      // ignore storage errors
    }
  }
  notifySubscribers();
  return { ...currentSettings };
}

export function subscribeSoundSettings(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function getContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function getEffectiveGain(baseMultiplier = 1) {
  if (currentSettings.muted || currentSettings.volume <= 0) return 0;
  return Math.max(0.001, currentSettings.volume * baseMultiplier);
}

// Sonido sutil al tocar botones, tabs o desplazarse por el menú
export function playUiClickSound(pitch = 520) {
  const gainVal = getEffectiveGain(0.14);
  if (!gainVal) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(pitch, now);
  osc.frequency.exponentialRampToValueAtTime(pitch * 1.35, now + 0.045);

  gain.gain.setValueAtTime(gainVal, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.055);
}

// Tick mecánico para la ruleta del sorteo en vivo
export function playRouletteTickSound(isLocked = false) {
  const gainVal = getEffectiveGain(isLocked ? 0.28 : 0.16);
  if (!gainVal) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  const freq = isLocked ? 880 : 640;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(
    isLocked ? 1180 : 420,
    now + (isLocked ? 0.12 : 0.035)
  );

  gain.gain.setValueAtTime(gainVal, now);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + (isLocked ? 0.14 : 0.04)
  );

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + (isLocked ? 0.15 : 0.045));
}

// Acorde corto cuando se revela el equipo de un jugador o se suma un gol (+1)
export function playScoreSound() {
  const gainVal = getEffectiveGain(0.24);
  if (!gainVal) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [587.33, 880]; // D5 -> A5
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + idx * 0.065;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(gainVal, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + 0.19);
  });
}

// Silbato / chicharra de tiempo cumplido en el marcador en vivo
export function playWhistleSound() {
  const gainVal = getEffectiveGain(0.3);
  if (!gainVal) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [0, 0.22].forEach((offset, idx) => {
    const dur = idx === 0 ? 0.16 : 0.38;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + offset;

    osc.type = 'square';
    osc.frequency.setValueAtTime(2650, start);
    osc.frequency.setValueAtTime(2780, start + dur * 0.5);

    gain.gain.setValueAtTime(gainVal * 0.5, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + dur + 0.02);
  });
}

// Listener global automático para todos los botones y menús de la app
export function initGlobalUiSounds() {
  if (typeof window === 'undefined' || globalListenerAttached) return;
  globalListenerAttached = true;

  window.addEventListener(
    'pointerdown',
    (e) => {
      if (currentSettings.muted || currentSettings.volume <= 0) return;
      const target = e.target?.closest?.('button, [role="button"], a');
      if (!target || target.disabled) return;
      const isNavTab = Boolean(target.closest('nav, header'));
      playUiClickSound(isNavTab ? 610 : 500);
    },
    { passive: true }
  );
}