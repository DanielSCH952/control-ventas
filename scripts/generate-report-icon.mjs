/**
 * Genera el icono de la pestaña «Reportes» (Sprint 5) en
 * assets/images/tabIcons/, con las variantes @2x y @3x.
 *
 * El icono es un gráfico de barras blanco sobre fondo transparente: la pestaña
 * lo renderiza con renderingMode="template", que lo tiñe con el color del
 * tema (igual que home.png/explore.png de la plantilla).
 *
 * Uso: node scripts/generate-report-icon.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../assets/images/tabIcons',
);

// ===== Codificador PNG mínimo (RGBA, 8 bits) =====

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
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, getPixel) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4); // filtro 0 + RGBA por píxel
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = getPixel(x, y);
      const offset = 1 + x * 4;
      row[offset] = r;
      row[offset + 1] = g;
      row[offset + 2] = b;
      row[offset + 3] = a;
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // profundidad de bits
  header[9] = 6; // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ===== Diseño: tres barras crecientes + línea base (unidades base 30) =====

function barChartPixel(size) {
  const scale = size / 30;
  const bars = [
    { x: 3, height: 12 },
    { x: 12.5, height: 18 },
    { x: 22, height: 24 },
  ];
  const barWidth = 5;
  const baselineY = 27;
  return (x, y) => {
    if (y >= baselineY * scale && y < (baselineY + 1.5) * scale) {
      return [255, 255, 255, 255]; // línea base
    }
    for (const bar of bars) {
      const barX = bar.x * scale;
      const top = (baselineY - bar.height) * scale;
      if (x >= barX && x < barX + barWidth * scale && y >= top && y < baselineY * scale) {
        return [255, 255, 255, 255];
      }
    }
    return [0, 0, 0, 0]; // transparente
  };
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [30, 60, 90]) {
  const suffix = size === 30 ? '' : `@${size / 30}x`;
  const file = path.join(OUT_DIR, `report${suffix}.png`);
  writeFileSync(file, encodePng(size, size, barChartPixel(size)));
  console.log(`Creado ${path.relative(process.cwd(), file)} (${size}x${size})`);
}
