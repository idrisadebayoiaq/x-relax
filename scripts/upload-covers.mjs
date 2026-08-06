/**
 * Upload generated category/sound covers to Supabase Storage and print SQL updates.
 * Run: node scripts/upload-covers.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const assetsDir = path.join(
  process.env.USERPROFILE || '',
  '.cursor',
  'projects',
  'c-Users-DELL-Desktop-x-relax',
  'assets',
  'covers-opt',
);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bfilhkxyjiofkfqwqyep.supabase.co';
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmaWxoa3h5amlvZmtmcXdxeWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNTYwMDMsImV4cCI6MjEwMDkzMjAwM30.vWAkF1yHcQKK5I-cae2Vfnj9-Ax3mx3oRZKKULr-ibI';

const categorySlugs = [
  'bell',
  'healing',
  'nature',
  'sleep',
  'focus',
  'relaxation',
  'asmr',
  'children',
  'reading',
];

const soundIds = [
  '5442d193-d5d6-4f44-af6b-0112ae4a443a',
  '6194d636-4570-4aa0-beba-b37639a5dc85',
  '867a41a1-60d4-468d-8749-c1f0fb3985df',
  '7d17a6d1-a819-4e86-ab7c-b87c3c46c1b7',
  '6c465be4-9fab-402c-89c9-fe28281fa800',
  '35a94a86-2b41-41e0-a983-c9e66ae07231',
  '698cfacf-e55a-49ea-8acf-f2b923d70dcb',
  'd88d27a1-27dd-435e-9061-2d5518f024d8',
  '343f54d0-62ac-47f2-8ed4-f19d05d04e47',
  'dee855fa-bb71-45db-a7b3-be6ded0bd6e2',
  '68228337-4c12-42ac-9376-0e6ba8cf6be4',
  '4a8b248e-2c0d-4426-a299-adc91c8bdd33',
  'd4003b68-0397-46af-84a6-bac0bdcc858e',
  'e4a66c1a-8cf4-43bc-a5bf-35ea6c11995b',
  'e1eccb7f-8daf-4080-a890-2b989d36cda4',
];

async function upload(localPath, objectPath) {
  const bytes = fs.readFileSync(localPath);
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
}

async function main() {
  const updates = { categories: [], sounds: [] };

  for (const slug of categorySlugs) {
    const local = path.join(assetsDir, `category-${slug}.png`);
    if (!fs.existsSync(local)) {
      console.warn('Missing category', slug);
      continue;
    }
    process.stdout.write(`category ${slug}… `);
    const url = await upload(local, `catalog/categories/${slug}.jpg`);
    updates.categories.push({ slug, url });
    console.log('ok');
  }

  for (const id of soundIds) {
    const local = path.join(assetsDir, `${id}.png`);
    if (!fs.existsSync(local)) {
      console.warn('Missing sound cover', id);
      continue;
    }
    process.stdout.write(`sound ${id.slice(0, 8)}… `);
    const url = await upload(local, `catalog/sounds/${id}.jpg`);
    updates.sounds.push({ id, url });
    console.log('ok');
  }

  const out = path.join(root, 'assets', 'cover-upload-result.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(updates, null, 2));

  const sql = [];
  for (const c of updates.categories) {
    sql.push(`UPDATE categories SET cover_url = '${c.url}' WHERE slug = '${c.slug}';`);
  }
  for (const s of updates.sounds) {
    sql.push(`UPDATE sounds SET cover_url = '${s.url}' WHERE id = '${s.id}'::uuid;`);
  }
  fs.writeFileSync(path.join(root, 'assets', 'cover-updates.sql'), sql.join('\n'));
  console.log('Wrote', out, 'and cover-updates.sql', updates.categories.length, updates.sounds.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
