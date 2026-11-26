import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'icons');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function isInsideTrophy(u, v) {
  const inCup = (() => {
    if (v < 0.21 || v > 0.54) return false;
    const t = (v - 0.21) / (0.54 - 0.21);
    const halfWidth = 0.055 + 0.165 * Math.pow(1 - t, 0.58);
    return Math.abs(u - 0.5) <= halfWidth;
  })();

  if (inCup) return true;

  const inLeftHandle = (() => {
    if (u > 0.36) return false;
    const dx = (u - 0.26) / 0.095;
    const dy = (v - 0.34) / 0.11;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= 1.0 && dist >= 0.56;
  })();

  if (inLeftHandle) return true;

  const inRightHandle = (() => {
    if (u < 0.64) return false;
    const dx = (u - 0.74) / 0.095;
    const dy = (v - 0.34) / 0.11;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= 1.0 && dist >= 0.56;
  })();

  if (inRightHandle) return true;

  if (v >= 0.53 && v <= 0.68 && Math.abs(u - 0.5) <= 0.042) {
    return true;
  }

  if (v >= 0.68 && v <= 0.735 && Math.abs(u - 0.5) <= 0.125) {
    return true;
  }

  if (v >= 0.735 && v <= 0.80 && Math.abs(u - 0.5) <= 0.19) {
    return true;
  }

  return false;
}

function renderIconPng(size, { maskable = false } = {}) {
  const scale = maskable ? 0.72 : 0.88;
  const raw = Buffer.alloc(size * (1 + size * 4));
  const samples = [0.25, 0.75];

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0;

    for (let x = 0; x < size; x += 1) {
      const gradT = (x + y) / (2 * size);
      const bgR = Math.round(16 + (4 - 16) * gradT);
      const bgG = Math.round(185 + (120 - 185) * gradT);
      const bgB = Math.round(129 + (87 - 129) * gradT);

      let hits = 0;
      for (const sy of samples) {
        for (const sx of samples) {
          const u = ((x + sx) / size - 0.5) / scale + 0.5;
          const v = ((y + sy) / size - 0.5) / scale + 0.5;
          if (isInsideTrophy(u, v)) {
            hits += 1;
          }
        }
      }

      const alphaFg = hits / 4;
      const r = Math.round(bgR * (1 - alphaFg) + 255 * alphaFg);
      const g = Math.round(bgG * (1 - alphaFg) + 255 * alphaFg);
      const b = Math.round(bgB * (1 - alphaFg) + 255 * alphaFg);

      const px = rowStart + 1 + x * 4;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const targets = [
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
];

for (const target of targets) {
  const fullPath = path.join(OUTPUT_DIR, target.file);
  const pngBuffer = renderIconPng(target.size, { maskable: target.maskable });
  fs.writeFileSync(fullPath, pngBuffer);
}

console.log('Iconos PWA generados en public/icons/');