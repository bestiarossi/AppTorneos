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

function getActiveTheme() {
  if (typeof document === 'undefined') return 'light';
  const root = document.documentElement;
  if (root.classList.contains('classic')) return 'classic';
  if (root.classList.contains('dark')) return 'dark';
  return 'light';
}

function getEffectiveGain(baseMultiplier = 1) {
  if (currentSettings.muted || currentSettings.volume <= 0) return 0;
  return Math.max(0.001, currentSettings.volume * baseMultiplier);
}

// Sonido de UI adaptable al tema activo (Claro / Oscuro Sport-Tech / Clásico Retro)
export function playUiClickSound(customPitch = null) {
  const gainVal = getEffectiveGain(0.15);
  if (!gainVal) return;
  const ctx = getContext();
  if (!ctx) return;

  const theme = getActiveTheme();
  const now = ctx.currentTime;

  if (theme === 'classic') {
    // MODO CLÁSICO: Golpe cálido tipo ficha / tablero mecánico retro
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const base = customPitch ? customPitch * 0.62 : 320;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 0.72, now + 0.055);

    gain.gain.setValueAtTime(gainVal * 1.15, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
    return;
  }

  if (theme === 'dark') {
    // MODO OSCURO: Pulso sintético Sport-Tech (doble oscilador corto)
    const base = customPitch || 440;
    [1, 1.5].forEach((mult, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(base * mult, now);
      osc.frequency.exponentialRampToValueAtTime(
        base * mult * 1.45,
        now + 0.042
      );

      gain.gain.setValueAtTime(gainVal * (idx === 0 ? 0.9 : 0.4), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.048);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.052);
    });
    return;
  }

  // MODO CLARO: Cristal limpio y aireado
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const base = customPitch ? customPitch * 1.15 : 640;

  osc.type = 'sine';
  osc.frequency.setValueAtTime(base, now);
  osc.frequency.exponentialRampToValueAtTime(base * 1.32, now + 0.045);

  gain.gain.setValueAtTime(gainVal * 0.9, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.055);
}

// Tick de la ruleta del sorteo adaptable al tema
export function playRouletteTickSound(isLocked = false) {
  const gainVal = getEffectiveGain(isLocked ? 0.28 : 0.16);
  if (!gainVal) return;
  const ctx = getContext();
  if (!ctx) return;

  const theme = getActiveTheme();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  if (theme === 'classic') {
    // Rueda de madera / bolillero clásico
    osc.type = isLocked ? 'square' : 'triangle';
    const freq = isLocked ? 587.33 : 260;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(
      isLocked ? 880 : 170,
      now + (isLocked ? 0.14 : 0.04)
    );
  } else if (theme === 'dark') {
    // Blip digital Sport-Tech
    osc.type = 'sawtooth';
    const freq = isLocked ? 987.77 : 720;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(
      isLocked ? 1480 : 520,
      now + (isLocked ? 0.12 : 0.032)
    );
  } else {
    // Campana suave Modo Claro
    osc.type = 'sine';
    const freq = isLocked ? 880 : 680;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(
      isLocked ? 1318.5 : 540,
      now + (isLocked ? 0.12 : 0.035)
    );
  }

  gain.gain.setValueAtTime(gainVal, now);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + (isLocked ? 0.15 : 0.042)
  );

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + (isLocked ? 0.16 : 0.048));
}

// Sonido de gol (+1) o revelación de equipo adaptable al tema
export function playScoreSound() {
  const gainVal = getEffectiveGain(0.24);
  if (!gainVal) return;
  const ctx = getContext();
  if (!ctx) return;

  const theme = getActiveTheme();
  const now = ctx.currentTime;

  const config =
    theme === 'classic'
      ? {
          // Fanfarria retro de club (Do - Mi - Sol - Do)
          notes: [523.25, 659.25, 783.99, 1046.5],
          type: 'triangle',
          step: 0.055,
          dur: 0.18,
        }
      : theme === 'dark'
      ? {
          // Arpegio eléctrico Sport-Tech (Mi - Sol# - Si)
          notes: [659.25, 830.61, 987.77],
          type: 'triangle',
          step: 0.05,
          dur: 0.19,
        }
      : {
          // Dúo cristalino Modo Claro (Re - La)
          notes: [587.33, 880],
          type: 'sine',
          step: 0.065,
          dur: 0.18,
        };

  config.notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + idx * config.step;

    osc.type = config.type;
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(gainVal, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + config.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + config.dur + 0.01);
  });
}

// Silbato / chicharra de tiempo cumplido
export function playWhistleSound() {
  const gainVal = getEffectiveGain(0.3);
  if (!gainVal) return;
  const ctx = getContext();
  if (!ctx) return;

  const theme = getActiveTheme();
  const now = ctx.currentTime;
  const baseFreq = theme === 'classic' ? 2250 : theme === 'dark' ? 2750 : 2550;

  [0, 0.22].forEach((offset, idx) => {
    const dur = idx === 0 ? 0.16 : 0.38;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + offset;

    osc.type = theme === 'classic' ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(baseFreq, start);
    osc.frequency.setValueAtTime(baseFreq + 130, start + dur * 0.5);

    gain.gain.setValueAtTime(gainVal * 0.5, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + dur + 0.02);
  });
}

// Escucha 'click' para que deslizar/scrollear en celular nunca dispare sonido
export function initGlobalUiSounds() {
  if (typeof window === 'undefined' || globalListenerAttached) return;
  globalListenerAttached = true;

  window.addEventListener(
    'click',
    (e) => {
      if (currentSettings.muted || currentSettings.volume <= 0) return;
      const target = e.target?.closest?.('button, [role="button"], a');
      if (!target || target.disabled) return;
      const isNavTab = Boolean(target.closest('nav, header'));
      // Pequeño delay de 10ms para que si el click fue cambiar de tema, ya suene con el tema nuevo
      setTimeout(() => {
        playUiClickSound(isNavTab ? 580 : 480);
      }, 10);
    },
    { passive: true }
  );
}