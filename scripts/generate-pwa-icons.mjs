import fs from "fs";
import path from "path";
import zlib from "zlib";

const ICONS_DIR = path.resolve(process.cwd(), "public/icons");

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

function createPng(size, isMaskable = false) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crc = zlib.crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // 8 bits per channel
  ihdr[9] = 6;  // RGBA color type
  ihdr[10] = 0; // Deflate compression
  ihdr[11] = 0; // Adaptive filtering
  ihdr[12] = 0; // No interlace

  const rowSize = 1 + size * 4;
  const rawData = Buffer.alloc(size * rowSize);
  const cx = size / 2, cy = size / 2;
  const outerR = isMaskable ? size * 0.40 : size * 0.46;
  const ringR = outerR * 0.88;
  const innerR = outerR * 0.72;
  const hubR = outerR * 0.28;
  const holeR = outerR * 0.12;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      let r = 248, g = 249, b = 250, a = isMaskable ? 255 : 0; // Background

      if (dist <= outerR) {
        if (dist > ringR) {
          // 24 Gear teeth (Rotary Gold)
          const toothAngle = (angle + Math.PI) / (Math.PI / 12);
          const frac = toothAngle - Math.floor(toothAngle);
          if (frac < 0.6) {
            r = 247; g = 168; b = 27; a = 255;
          }
        } else if (dist > innerR) {
          // Outer Gold Ring
          r = 247; g = 168; b = 27; a = 255;
        } else if (dist > hubR) {
          // 6 Spokes Zone
          const spokeAngle = (angle + Math.PI) / (Math.PI / 3);
          const sFrac = spokeAngle - Math.floor(spokeAngle);
          if (sFrac < 0.22 || sFrac > 0.78) {
            r = 247; g = 168; b = 27; a = 255; // Gold Spoke
          } else {
            r = 23; g = 69; b = 143; a = 255;  // Royal Blue Field
          }
        } else if (dist > holeR) {
          // Central Gold Hub
          r = 247; g = 168; b = 27; a = 255;
        } else {
          // Central Blue Axle Hole
          r = 23; g = 69; b = 143; a = 255;
        }
      }
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const idat = makeChunk("IDAT", zlib.deflateSync(rawData));
  const iend = makeChunk("IEND", Buffer.alloc(0));
  return Buffer.concat([signature, makeChunk("IHDR", ihdr), idat, iend]);
}

// Write PNG files
fs.writeFileSync(path.join(ICONS_DIR, "icon-192x192.png"), createPng(192));
fs.writeFileSync(path.join(ICONS_DIR, "icon-512x512.png"), createPng(512));
fs.writeFileSync(path.join(ICONS_DIR, "maskable-icon-512x512.png"), createPng(512, true));
fs.writeFileSync(path.join(ICONS_DIR, "apple-touch-icon.png"), createPng(180));

// Write SVG wheel emblem
const svgEmblem = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="Rotary Wheel Emblem">
  <!-- Gear teeth (24 teeth in Rotary Gold #f7a81b) -->
  <path fill="#f7a81b" d="
    M 182.00 100.00 L 194.51 106.18 L 193.30 112.35 L 179.28 119.74 
    L 189.54 128.51 L 186.13 134.42 L 171.30 138.16 L 178.69 149.20 
    L 173.30 154.59 L 157.87 154.08 L 161.94 166.80 L 154.91 171.46 
    L 139.77 166.45 L 140.28 180.20 L 131.95 183.84 L 118.06 174.55 
    L 114.73 188.58 L 105.74 190.93 L 93.82 177.86 L 86.99 191.07 
    L 77.65 191.80 L 68.70 176.08 L 58.70 187.69 L 49.69 186.68 
    L 44.26 169.32 L 32.18 178.50 L 24.16 175.76 L 22.84 157.94 
    L 9.72 163.74 L 3.23 159.42 L 6.27 142.14 L -5.73 143.92 
    L -10.51 138.16 L -3.30 122.35 L -14.51 120.18 L -17.30 113.35 
    L -7.28 99.74 L -17.54 94.49 L -18.13 87.58 L -7.30 76.84 
    L -16.69 68.80 L -15.30 61.41 L -3.87 53.92 L -11.94 44.20 
    L -8.91 37.54 L 4.23 35.55 L -0.28 24.80 L 4.95 19.16 
    L 19.06 22.45 L 17.73 10.42 L 24.74 6.07 L 39.82 14.14 
    L 41.99 2.93 L 50.35 0.20 L 65.70 11.92 L 71.30 2.31 
    L 81.31 1.32 L 94.26 14.68 L 103.18 7.50 L 112.84 8.24 
    L 122.84 22.06 L 134.72 18.26 L 142.77 21.58 L 149.73 37.86 
    L 162.73 38.08 L 168.51 43.84 L 171.30 62.65 L 183.51 66.82 
    L 186.30 74.65 L 181.28 90.26 Z
  " />
  <!-- Outer Wheel Body -->
  <circle cx="100" cy="100" r="82" fill="#f7a81b" />
  <!-- Inner Rim Blue Disc -->
  <circle cx="100" cy="100" r="70" fill="#17458f" />
  <!-- 6 Golden Spokes -->
  <g fill="#f7a81b">
    <rect x="94" y="30" width="12" height="140" rx="4" />
    <rect x="94" y="30" width="12" height="140" rx="4" transform="rotate(60 100 100)" />
    <rect x="94" y="30" width="12" height="140" rx="4" transform="rotate(120 100 100)" />
  </g>
  <!-- Central Hub (Gold) -->
  <circle cx="100" cy="100" r="28" fill="#f7a81b" />
  <!-- Central Axle Hole (Blue) -->
  <circle cx="100" cy="100" r="14" fill="#17458f" />
  <!-- Keyway slot (Blue notch) -->
  <rect x="97" y="82" width="6" height="10" fill="#17458f" />
</svg>`;

fs.writeFileSync(path.join(ICONS_DIR, "rotary-wheel.svg"), svgEmblem);

console.log("PWA PNG & SVG icons generated successfully in public/icons/");
