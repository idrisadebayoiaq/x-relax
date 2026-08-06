/**
 * Upload renamed bell/healing assets to Supabase Storage and publish catalog rows.
 * Run: node scripts/seed-bell-healing.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'assets', 'bell-and-healing');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bfilhkxyjiofkfqwqyep.supabase.co';
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmaWxoa3h5amlvZmtmcXdxeWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNTYwMDMsImV4cCI6MjEwMDkzMjAwM30.vWAkF1yHcQKK5I-cae2Vfnj9-Ax3mx3oRZKKULr-ibI';

const CREATOR_ID = 'b2295012-b600-4d22-bf62-df9dfbe3dba0';

function durationFromSize(bytes) {
  // Approximate for 320kbps MP3
  return Math.max(15, Math.round((bytes * 8) / 320000));
}

async function storageUpload(filePath, objectPath) {
  const bytes = fs.readFileSync(filePath);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sounds/${objectPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
      'Content-Type': 'audio/mpeg',
      'x-upsert': 'true',
    },
    body: bytes,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed ${objectPath}: ${res.status} ${text}`);
  }
}

async function sql(query) {
  // Prefer PostgREST for inserts via sounds table with anon may fail RLS.
  // We'll print SQL for MCP if needed; try RPC-less insert first.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  return res;
}

async function main() {
  const uploaded = [];

  for (const item of manifest) {
    const local = path.join(dir, item.new);
    if (!fs.existsSync(local)) throw new Error(`Missing ${local}`);
    const soundId = randomUUID();
    const objectPath = `seed/${item.new}`;
    process.stdout.write(`Uploading ${item.new}… `);
    await storageUpload(local, objectPath);
    const audioUrl = `${SUPABASE_URL}/storage/v1/object/public/sounds/${objectPath}`;
    const size = fs.statSync(local).size;
    uploaded.push({
      id: soundId,
      title: item.title,
      description: item.desc,
      cat: item.cat,
      audio_path: objectPath,
      audio_url: audioUrl,
      duration_seconds: durationFromSize(size),
      filename: item.new,
    });
    console.log('ok');
  }

  const out = path.join(dir, 'uploaded.json');
  fs.writeFileSync(out, JSON.stringify(uploaded, null, 2));
  console.log(`Wrote ${out}`);

  // Emit SQL for MCP apply
  const sqlPath = path.join(dir, 'insert-sounds.sql');
  const lines = [
    `-- Seed Bell & Healing sounds`,
    `WITH bell AS (SELECT id FROM categories WHERE slug = 'bell' LIMIT 1),`,
    `     healing AS (SELECT id FROM categories WHERE slug = 'healing' LIMIT 1)`,
    `INSERT INTO sounds (id, creator_id, title, description, audio_path, audio_url, duration_seconds, status, is_premium_only, is_featured)`,
    `VALUES`,
  ];
  const values = uploaded.map(
    (u) =>
      `  ('${u.id}'::uuid, '${CREATOR_ID}'::uuid, ${JSON.stringify(u.title)}, ${JSON.stringify(u.description)}, ${JSON.stringify(u.audio_path)}, ${JSON.stringify(u.audio_url)}, ${u.duration_seconds}, 'published', false, false)`,
  );
  lines.push(values.join(',\n') + '\nON CONFLICT (id) DO NOTHING;');
  for (const u of uploaded) {
    const cat = u.cat === 'bell' ? 'bell' : 'healing';
    lines.push(
      `INSERT INTO sound_categories (sound_id, category_id)\nSELECT '${u.id}'::uuid, id FROM categories WHERE slug = '${cat}'\nON CONFLICT DO NOTHING;`,
    );
  }
  fs.writeFileSync(sqlPath, lines.join('\n'));
  console.log(`Wrote ${sqlPath}`);
  void sql;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
