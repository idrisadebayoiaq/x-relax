/**
 * Generate covers for generated-category-sounds/manifest.json and emit SQL.
 * Run: node scripts/publish-generated-category-sounds.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'assets', 'generated-category-sounds', 'manifest.json');
const outDir = path.join(root, 'assets', 'generated-category-sounds', 'covers');

const SUPABASE_URL = 'https://bfilhkxyjiofkfqwqyep.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmaWxoa3h5amlvZmtmcXdxeWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNTYwMDMsImV4cCI6MjEwMDkzMjAwM30.vWAkF1yHcQKK5I-cae2Vfnj9-Ax3mx3oRZKKULr-ibI';
const CREATOR_ID = 'b2295012-b600-4d22-bf62-df9dfbe3dba0';

const categoryCoverUrls = {
  nature: `${SUPABASE_URL}/storage/v1/object/public/covers/catalog/categories/nature.jpg`,
  asmr: `${SUPABASE_URL}/storage/v1/object/public/covers/catalog/categories/asmr.jpg`,
  children: `${SUPABASE_URL}/storage/v1/object/public/covers/catalog/categories/children.jpg`,
  mixes: `${SUPABASE_URL}/storage/v1/object/public/covers/catalog/categories/mixes.png`,
};

function hashHue(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function upload(localPath, objectPath, attempt = 1) {
  const bytes = fs.readFileSync(localPath);
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/covers/${objectPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: bytes,
    });
    if (!res.ok) throw new Error(`Upload failed ${objectPath}: ${res.status} ${await res.text()}`);
    return `${SUPABASE_URL}/storage/v1/object/public/covers/${objectPath}`;
  } catch (err) {
    if (attempt >= 4) throw err;
    await new Promise((r) => setTimeout(r, 600 * attempt));
    return upload(localPath, objectPath, attempt + 1);
  }
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });
  const baseCache = new Map();
  const published = [];

  for (const item of rows) {
    if (!baseCache.has(item.cat)) {
      process.stdout.write(`fetch ${item.cat}… `);
      try {
        baseCache.set(item.cat, await download(categoryCoverUrls[item.cat]));
        console.log('ok');
      } catch {
        console.log('fail, fallback nature');
        if (!baseCache.has('nature')) {
          baseCache.set('nature', await download(categoryCoverUrls.nature));
        }
        baseCache.set(item.cat, baseCache.get('nature'));
      }
    }

    const hue = hashHue(item.id);
    const local = path.join(outDir, `${item.id}.jpg`);
    await sharp(baseCache.get(item.cat))
      .resize(800, 800, { fit: 'cover' })
      .modulate({ brightness: 0.92 + (hue % 20) / 100, saturation: 1.05, hue })
      .jpeg({ quality: 85 })
      .toFile(local);

    const objectPath = `catalog/generated/${item.id}.jpg`;
    process.stdout.write(`cover ${item.title}… `);
    const coverUrl = await upload(local, objectPath);
    console.log('ok');
    published.push({ ...item, cover_url: coverUrl });
  }

  fs.writeFileSync(
    path.join(root, 'assets', 'generated-category-sounds', 'published.json'),
    JSON.stringify(published, null, 2),
  );

  const esc = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const values = published
    .map(
      (u) =>
        `  (${esc(u.id)}::uuid, ${esc(CREATOR_ID)}::uuid, ${esc(u.title)}, ${esc(u.tip)}, ${esc(u.audio_path)}, ${esc(u.audio_url)}, ${esc(u.cover_url)}, ${u.duration_seconds}, 'published', false, false)`,
    )
    .join(',\n');

  const sql = [
    `-- Publish 20 newly generated Nature/ASMR/Children/Mixes sounds`,
    `INSERT INTO sounds (id, creator_id, title, description, audio_path, audio_url, cover_url, duration_seconds, status, is_premium_only, is_featured)`,
    `VALUES`,
    values,
    `ON CONFLICT (id) DO UPDATE SET`,
    `  title = EXCLUDED.title,`,
    `  description = EXCLUDED.description,`,
    `  audio_path = EXCLUDED.audio_path,`,
    `  audio_url = EXCLUDED.audio_url,`,
    `  cover_url = EXCLUDED.cover_url,`,
    `  duration_seconds = EXCLUDED.duration_seconds,`,
    `  status = 'published',`,
    `  updated_at = now();`,
    ``,
    ...published.map(
      (u) =>
        `INSERT INTO sound_categories (sound_id, category_id)\nSELECT ${esc(u.id)}::uuid, id FROM categories WHERE slug = ${esc(u.cat)}\nON CONFLICT DO NOTHING;`,
    ),
    ``,
    `-- Keep only generated tracks + original unique catalog (drop reused clones) from these four categories`,
    `DELETE FROM sound_categories sc`,
    `USING categories c, sounds s`,
    `WHERE sc.category_id = c.id`,
    `  AND sc.sound_id = s.id`,
    `  AND c.slug IN ('nature','asmr','children','mixes')`,
    `  AND s.audio_path NOT LIKE 'generated/%'`,
    `  AND (`,
    `    s.title ILIKE '% for nature'`,
    `    OR s.title ILIKE '% for asmr'`,
    `    OR s.title ILIKE '% for children'`,
    `    OR s.title ILIKE '% for mixes'`,
    `    OR s.title ILIKE 'Nature %'`,
    `    OR s.audio_path LIKE 'mood/%'`,
    `    OR s.id IN (`,
    `      SELECT id FROM sounds WHERE description ILIKE '%mood clone%' OR title ILIKE '%(Nature)%' OR title ILIKE '%(ASMR)%' OR title ILIKE '%(Children)%' OR title ILIKE '%(Mixes)%'`,
    `    )`,
    `  );`,
  ].join('\n');

  const sqlPath = path.join(root, 'assets', 'generated-category-sounds', 'insert.sql');
  fs.writeFileSync(sqlPath, sql);
  console.log(`Wrote ${sqlPath} (${published.length} sounds)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
