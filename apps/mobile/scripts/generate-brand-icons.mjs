import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'assets', 'brand');

const src =
  process.argv[2] ||
  path.join(
    process.env.USERPROFILE || '',
    '.cursor',
    'projects',
    'c-Users-DELL-Desktop-x-relax',
    'assets',
    'c__Users_DELL_AppData_Roaming_Cursor_User_workspaceStorage_90b20cb2801b79fb953e9b9cd9b9bce6_images_image-f41c6e77-5753-4039-bada-cda61a6e7e90.png',
  );

async function whiteOnTransparent(input, size) {
  const { data, info } = await sharp(input)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (lum < 40 || data[i + 3] < 20) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    } else {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

async function makeIcon({ size, scale, name, monoWhite = false }) {
  const logoSize = Math.round(size * scale);
  const left = Math.round((size - logoSize) / 2);
  const top = left;

  if (monoWhite) {
    const logo = await whiteOnTransparent(src, logoSize);
    const base = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    await sharp(base)
      .composite([{ input: logo, left, top }])
      .png()
      .toFile(path.join(outDir, name));
    return;
  }

  const logo = await sharp(src)
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toBuffer();

  const base = await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();

  await sharp(base)
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(path.join(outDir, name));
}

if (!fs.existsSync(src)) {
  console.error('Source logo not found:', src);
  process.exit(1);
}

await makeIcon({ size: 1024, scale: 0.52, name: 'app-icon.png' });
await makeIcon({ size: 1024, scale: 0.42, name: 'splash-icon.png' });
await makeIcon({ size: 512, scale: 0.55, name: 'favicon.png' });
await makeIcon({ size: 96, scale: 0.7, name: 'notification-icon.png', monoWhite: true });
await makeIcon({ size: 1024, scale: 0.7, name: 'icon-master.png' });

console.log('Wrote brand icons to', outDir);
for (const f of ['app-icon.png', 'splash-icon.png', 'favicon.png', 'notification-icon.png']) {
  console.log(f, fs.statSync(path.join(outDir, f)).size);
}
