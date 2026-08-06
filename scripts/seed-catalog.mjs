/**
 * Seed local assets mp3 files into Supabase Storage + DB via catalog-seed-upload edge fn.
 * Env: scripts/.env.seed (gitignored)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const GEN_CAT = path.join(ROOT, 'content', 'generated', 'categories');
const GEN_SND = path.join(ROOT, 'content', 'generated', 'sounds');

function loadEnv() {
  const envPath = path.join(__dirname, '.env.seed');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bfilhkxyjiofkfqwqyep.supabase.co';
const PUSH_SECRET = process.env.PUSH_DISPATCH_SECRET;
const CREATOR_ID = process.env.CATALOG_CREATOR_ID || 'b2295012-b600-4d22-bf62-df9dfbe3dba0';

if (!PUSH_SECRET) {
  console.error('Missing PUSH_DISPATCH_SECRET');
  process.exit(1);
}

const FOLDER_MAP = {
  'birds sounds': { name: 'Birds', slug: 'birds', cover: 'cat-birds.png', sort: 10 },
  'fireplace sounds': { name: 'Fireplace', slug: 'fireplace', cover: 'cat-fireplace.png', sort: 20 },
  'forest sounds': { name: 'Forest', slug: 'forest', cover: 'cat-forest.png', sort: 30 },
  meditation: { name: 'Meditation', slug: 'meditation', cover: 'cat-meditation.png', sort: 40 },
  'mix sounds': { name: 'Mixes', slug: 'mixes', cover: 'cat-mixes.png', sort: 50 },
  'ocean sounds': { name: 'Ocean', slug: 'ocean', cover: 'cat-ocean.png', sort: 60 },
  'rain sounds': { name: 'Rain', slug: 'rain', cover: 'cat-rain.png', sort: 70 },
  'rivers sounds': { name: 'Rivers', slug: 'rivers', cover: 'cat-rivers.png', sort: 80 },
  'thunders sounds': { name: 'Thunder', slug: 'thunder', cover: 'cat-thunder.png', sort: 90 },
  'wind sounds': { name: 'Wind', slug: 'wind', cover: 'cat-wind.png', sort: 100 },
};

const TITLE_OVERRIDES = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'catalog-titles.json'), 'utf8'),
);

function titleFor(file) {
  return (
    TITLE_OVERRIDES[file] ||
    file
      .replace(/\.mp3$/i, '')
      .replace(/^bbc_/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function api(body, attempt = 1) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/catalog-seed-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-push-secret': PUSH_SECRET,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      if (attempt < 6 && (res.status === 502 || res.status === 546 || res.status === 500 || res.status === 524)) {
        console.warn(`retry ${attempt} after ${res.status}…`);
        await new Promise((r) => setTimeout(r, attempt * 2000));
        return api(body, attempt + 1);
      }
      throw new Error(`Non-JSON response ${res.status}: ${text.slice(0, 200)}`);
    }
    if (!res.ok || json.error) {
      if (attempt < 6) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
        return api(body, attempt + 1);
      }
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    return json;
  } catch (e) {
    if (attempt < 6) {
      console.warn(`retry ${attempt} after`, e.message || e);
      await new Promise((r) => setTimeout(r, attempt * 2000));
      return api(body, attempt + 1);
    }
    throw e;
  }
}

async function upload(bucket, objectPath, filePath, contentType) {
  const buf = fs.readFileSync(filePath);
  const signed = await api({
    action: 'signed_upload',
    bucket,
    path: objectPath,
  });

  const tryPut = async (headers) => {
    const put = await fetch(signed.signedUrl, {
      method: 'PUT',
      headers,
      body: buf,
    });
    return put;
  };

  let put = await tryPut({
    'Content-Type': contentType,
    'x-upsert': 'true',
  });
  if (!put.ok) {
    put = await tryPut({
      'Content-Type': contentType,
      Authorization: `Bearer ${signed.token}`,
      'x-upsert': 'true',
    });
  }
  if (!put.ok) {
    throw new Error(`Signed upload failed ${put.status}: ${await put.text()}`);
  }
  return { ok: true, url: signed.publicUrl, path: objectPath };
}

async function uniqueCover(src, out, seed) {
  const hash = createHash('md5').update(seed).digest();
  const meta = await sharp(src).metadata();
  const w = meta.width || 800;
  const h = meta.height || 800;
  const size = Math.min(w, h, 700);
  const left = Math.min(hash[0] % Math.max(1, w - size), Math.max(0, w - size));
  const top = Math.min(hash[1] % Math.max(1, h - size), Math.max(0, h - size));
  const tint = {
    r: 20 + (hash[2] % 60),
    g: 20 + (hash[3] % 60),
    b: 20 + (hash[4] % 60),
    alpha: 0.15 + (hash[5] % 25) / 100,
  };
  await sharp(src)
    .extract({ left, top, width: size, height: size })
    .resize(800, 800)
    .composite([
      {
        input: Buffer.from(
          `<svg width="800" height="800"><rect width="800" height="800" fill="rgba(${tint.r},${tint.g},${tint.b},${tint.alpha})"/></svg>`,
        ),
      },
    ])
    .png()
    .toFile(out);
}

function collectTracks() {
  const tracks = [];
  const skipDupInMix = new Set([
    'dragon-studio-meditation-music-sound-bite-339735.mp3',
    'gigidelaromusic-pure-meditation-tone-450975.mp3',
  ]);
  for (const [folder, meta] of Object.entries(FOLDER_MAP)) {
    const dir = path.join(ASSETS, folder);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mp3'))) {
      if (folder === 'mix sounds' && skipDupInMix.has(file)) {
        console.log('skip dup', file);
        continue;
      }
      tracks.push({
        folder,
        file,
        abs: path.join(dir, file),
        title: titleFor(file),
        meta,
      });
    }
  }
  return tracks;
}

async function main() {
  fs.mkdirSync(GEN_SND, { recursive: true });
  const tracks = collectTracks();
  console.log('tracks', tracks.length);

  try {
    await api({ action: 'archive_demo' });
  } catch (e) {
    console.warn('archive_demo', e.message);
  }

  // Resume-friendly: do not wipe existing catalog mid-run
  // (delete only when SEED_RESET=1)
  if (process.env.SEED_RESET === '1') {
    try {
      await api({ action: 'delete_catalog_sounds', creator_id: CREATOR_ID });
      console.log('cleared previous catalog for creator');
    } catch (e) {
      console.warn('delete_catalog_sounds', e.message);
    }
  }

  const existingTitles = new Set();
  {
    try {
      await api({ action: 'dedupe_titles', creator_id: CREATOR_ID });
      const listed = await api({ action: 'list_titles', creator_id: CREATOR_ID });
      for (const r of listed.rows || []) existingTitles.add(r.title);
      console.log('already published', existingTitles.size);
    } catch (e) {
      console.warn('list_titles', e.message);
    }
  }

  const catMap = {};
  for (const meta of Object.values(FOLDER_MAP)) {
    const coverLocal = path.join(GEN_CAT, meta.cover);
    let coverUrl = null;
    if (fs.existsSync(coverLocal)) {
      const up = await upload(
        'covers',
        `catalog/categories/${meta.slug}.png`,
        coverLocal,
        'image/png',
      );
      coverUrl = up.url;
    }
    const { row } = await api({
      action: 'upsert_category',
      row: {
        name: meta.name,
        slug: meta.slug,
        sort_order: meta.sort,
        parent_id: null,
        cover_url: coverUrl,
      },
    });
    catMap[meta.slug] = row;
    console.log('category', meta.slug);
  }

  const recommended = [];
  const bySlugOne = {};

  for (const t of tracks) {
    if (existingTitles.has(t.title)) {
      console.log('skip existing', t.title);
      if (!bySlugOne[t.meta.slug]) {
        // still need id for recommended — fetch later
        bySlugOne[t.meta.slug] = true;
      }
      continue;
    }

    const id = randomUUID();
    const audioPath = `${CREATOR_ID}/${id}.mp3`;
    const coverFile = `${slugify(t.title)}-${id.slice(0, 8)}.png`;
    const coverLocal = path.join(GEN_SND, coverFile);
    const catCover = path.join(GEN_CAT, t.meta.cover);

    let variantSrc = catCover;
    if (t.meta.slug === 'birds') {
      const n = (createHash('md5').update(t.file).digest()[0] % 5) + 1;
      const p = path.join(GEN_SND, `snd-birds-0${n}.png`);
      if (fs.existsSync(p)) variantSrc = p;
    }

    if (!fs.existsSync(coverLocal)) {
      try {
        await uniqueCover(variantSrc, coverLocal, t.file + t.title);
      } catch (e) {
        console.warn('cover gen fallback', e.message);
        fs.copyFileSync(variantSrc, coverLocal);
      }
    }

    console.log('→', t.title);
    await new Promise((r) => setTimeout(r, 400));
    const audioUp = await upload('sounds', audioPath, t.abs, 'audio/mpeg');
    await new Promise((r) => setTimeout(r, 200));
    const coverUp = await upload(
      'covers',
      `catalog/sounds/${coverFile}`,
      coverLocal,
      'image/png',
    );

    const { row: sound } = await api({
      action: 'insert_sound',
      sound: {
        id,
        creator_id: CREATOR_ID,
        title: t.title,
        description: `${t.meta.name} ambience from the X-Relax catalog.`,
        cover_url: coverUp.url,
        audio_path: audioPath,
        audio_url: audioUp.url,
        duration_seconds: 0,
        status: 'published',
        play_count: 5 + Math.floor(Math.random() * 50),
      },
      category_id: catMap[t.meta.slug]?.id,
    });

    if (!bySlugOne[t.meta.slug]) {
      bySlugOne[t.meta.slug] = sound.id;
      recommended.push(sound.id);
    }
  }

  // Build recommended from one sound per folder category (fresh query)
  const rec = [];
  for (const meta of Object.values(FOLDER_MAP)) {
    const cat = catMap[meta.slug];
    if (!cat?.id) continue;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sound_categories?select=sound_id,sounds!inner(id,status)&category_id=eq.${cat.id}&sounds.status=eq.published&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY || '',
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY || ''}`,
        },
      },
    );
    if (res.ok) {
      const rows = await res.json();
      if (rows[0]?.sound_id) rec.push(rows[0].sound_id);
    }
  }

  await api({ action: 'upsert_setting', key: 'recommended_sound_ids', value: rec.length ? rec : recommended });
  if (rec[0] || recommended[0]) {
    await api({
      action: 'upsert_setting',
      key: 'daily_pick_sound_id',
      value: rec[0] || recommended[0],
    });
  }

  console.log('Done', tracks.length, 'tracks processed; recommended', (rec.length ? rec : recommended).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
