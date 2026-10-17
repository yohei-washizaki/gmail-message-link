// Draws the extension icon and writes icons/icon{16,32,48,128}.png.
// Uses only Node's standard library: shapes are signed distance functions,
// sampled 4x4 per pixel for anti-aliasing, then encoded as PNG by hand.
//
//   node tools/make-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

const SIZES = [16, 32, 48, 128];
const SAMPLES = 4;

const BLUE = [37, 99, 235];
const WHITE = [255, 255, 255];
const ORANGE = [245, 158, 11];

// Signed distances in a 0..1 square: negative inside, positive outside.
function roundedBox(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - hw + r;
  const qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function segment(x, y, ax, ay, bx, by) {
  const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - dx * t, py - dy * t);
}

function circle(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) - r;
}

// One chain link: the outline of a capsule from (ax, ay) to (bx, by).
function linkRing(x, y, ax, ay, bx, by, r, w) {
  return Math.abs(segment(x, y, ax, ay, bx, by) - r) - w;
}

// Layers are painted in order; each returns a color or null for the sample.
const layers = [
  (x, y) => (roundedBox(x, y, 0.5, 0.5, 0.46, 0.46, 0.2) < 0 ? BLUE : null),
  // Envelope body and its V-shaped flap.
  (x, y) => (roundedBox(x, y, 0.44, 0.44, 0.3, 0.21, 0.04) < 0 ? WHITE : null),
  (x, y) => (Math.min(segment(x, y, 0.14, 0.23, 0.44, 0.47), segment(x, y, 0.44, 0.47, 0.74, 0.23)) < 0.035 ? BLUE : null),
  // Badge with two interlocking chain links.
  (x, y) => (circle(x, y, 0.72, 0.72, 0.24) < 0 ? WHITE : null),
  (x, y) => (circle(x, y, 0.72, 0.72, 0.2) < 0 ? ORANGE : null),
  (x, y) => (Math.min(
    linkRing(x, y, 0.62, 0.82, 0.70, 0.74, 0.055, 0.02),
    linkRing(x, y, 0.74, 0.70, 0.82, 0.62, 0.055, 0.02),
  ) < 0 ? WHITE : null),
];

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) / size;
          const y = (py + (sy + 0.5) / SAMPLES) / size;
          let color = null;
          for (const layer of layers) color = layer(x, y) ?? color;
          if (color) {
            r += color[0]; g += color[1]; b += color[2]; a += 1;
          }
        }
      }
      const i = (py * size + px) * 4;
      // Average color over covered samples; coverage becomes alpha.
      if (a > 0) {
        rgba[i] = Math.round(r / a);
        rgba[i + 1] = Math.round(g / a);
        rgba[i + 2] = Math.round(b / a);
      }
      rgba[i + 3] = Math.round((a / (SAMPLES * SAMPLES)) * 255);
    }
  }
  return rgba;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits per channel
  header[9] = 6; // color type: RGBA
  // Each row starts with filter type 0 (none).
  const rows = [];
  for (let y = 0; y < size; y++) {
    rows.push(Buffer.from([0]), rgba.subarray(y * size * 4, (y + 1) * size * 4));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = new URL("../icons/", import.meta.url);
mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  writeFileSync(new URL(`icon${size}.png`, outDir), encodePng(size, render(size)));
}
console.log(`wrote ${SIZES.map((s) => `icon${s}.png`).join(", ")} to icons/`);
