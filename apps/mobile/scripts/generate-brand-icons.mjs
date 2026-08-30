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

function brandSvg({ size, variant }) {
  const pad = size * 0.12;
  const cx = size / 2;
  const cy = size / 2;
  const showBg = variant !== 'foreground' && variant !== 'notification';

  const bg =
    showBg && variant !== 'splash'
      ? `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${NAVY}"/>
         <circle cx="${cx}" cy="${cy}" r="${size * 0.36}" fill="${BLUE}" opacity="0.55"/>`
      : '';

  const splashBg =
    variant === 'splash' ? `<rect width="${size}" height="${size}" fill="${NAVY}"/>` : '';

  const stroke = variant === 'notification' ? '#FFFFFF' : GOLD;
  const waveStroke = variant === 'notification' ? '#FFFFFF' : GOLD_LIGHT;
  const xSize = size * 0.28;

  const xPaths = `
    <g transform="translate(${cx}, ${cy - size * 0.04})">
      <path d="M ${-xSize} ${-xSize * 0.9} L ${xSize * 0.15} 0 L ${-xSize} ${xSize * 0.9}"
            fill="none" stroke="${stroke}" stroke-width="${size * 0.055}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M ${xSize} ${-xSize * 0.9} L ${-xSize * 0.15} 0 L ${xSize} ${xSize * 0.9}"
            fill="none" stroke="${stroke}" stroke-width="${size * 0.055}" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <path d="M ${pad + size * 0.08} ${size * 0.72}
             Q ${cx} ${size * 0.62} ${cx + size * 0.12} ${size * 0.72}
             T ${size - pad - size * 0.08} ${size * 0.72}"
          fill="none" stroke="${waveStroke}" stroke-width="${size * 0.028}" stroke-linecap="round" opacity="0.9"/>
    <path d="M ${pad + size * 0.14} ${size * 0.8}
             Q ${cx} ${size * 0.7} ${cx + size * 0.1} ${size * 0.8}
             T ${size - pad - size * 0.14} ${size * 0.8}"
          fill="none" stroke="${waveStroke}" stroke-width="${size * 0.02}" stroke-linecap="round" opacity="0.65"/>
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
for (const f of fs.readdirSync(outDir).filter((n) => n.endsWith('.png'))) {
  console.log(f, fs.statSync(path.join(outDir, f)).size);
}
