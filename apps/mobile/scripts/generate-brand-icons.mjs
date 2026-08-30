/**
 * Generates X-Relax brand icons from theme colors (no external source image).
 * Run from repo root: node apps/mobile/scripts/generate-brand-icons.mjs
 */
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'assets', 'brand');

const NAVY = '#061428';
const BLUE = '#0B3D91';
const GOLD = '#F5C400';
const GOLD_LIGHT = '#FFD54A';

/** Logo scale relative to canvas — smaller = more padding (better adaptive icon fit). */
const SCALES = {
  app: 0.2,
  foreground: 0.17,
  splash: 0.22,
  notification: 0.24,
};

function brandSvg({ size, variant }) {
  const cx = size / 2;
  const cy = size / 2;
  const scale = SCALES[variant] ?? SCALES.app;
  const showBg = variant !== 'foreground' && variant !== 'notification';

  const bg =
    showBg && variant !== 'splash'
      ? `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${NAVY}"/>
         <circle cx="${cx}" cy="${cy}" r="${size * 0.34}" fill="${BLUE}" opacity="0.5"/>`
      : '';

  const splashBg =
    variant === 'splash' ? `<rect width="${size}" height="${size}" fill="${NAVY}"/>` : '';

  const stroke = variant === 'notification' ? '#FFFFFF' : GOLD;
  const waveStroke = variant === 'notification' ? '#FFFFFF' : GOLD_LIGHT;
  const xSize = size * scale;

  const xPaths = `
    <g transform="translate(${cx}, ${cy - size * 0.02})">
      <path d="M ${-xSize} ${-xSize * 0.9} L ${xSize * 0.15} 0 L ${-xSize} ${xSize * 0.9}"
            fill="none" stroke="${stroke}" stroke-width="${size * 0.045}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M ${xSize} ${-xSize * 0.9} L ${-xSize * 0.15} 0 L ${xSize} ${xSize * 0.9}"
            fill="none" stroke="${stroke}" stroke-width="${size * 0.045}" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <path d="M ${cx - xSize * 1.1} ${cy + xSize * 0.55}
             Q ${cx} ${cy + xSize * 0.45} ${cx + xSize * 0.25} ${cy + xSize * 0.55}
             T ${cx + xSize * 1.1} ${cy + xSize * 0.55}"
          fill="none" stroke="${waveStroke}" stroke-width="${size * 0.022}" stroke-linecap="round" opacity="0.85"/>
  `;

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${splashBg}${bg}
      ${xPaths}
    </svg>`,
  );
}

async function writePng(name, size, variant) {
  const svg = brandSvg({ size, variant });
  await sharp(svg).png().toFile(path.join(outDir, name));
}

fs.mkdirSync(outDir, { recursive: true });

await writePng('app-icon.png', 1024, 'app');
await writePng('adaptive-foreground.png', 1024, 'foreground');
await writePng('splash-icon.png', 1024, 'splash');
await writePng('favicon.png', 512, 'app');
await writePng('notification-icon.png', 96, 'notification');
await writePng('icon-master.png', 1024, 'app');

console.log('Wrote themed brand icons to', outDir);
