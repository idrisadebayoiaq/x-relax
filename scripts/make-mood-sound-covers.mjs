/**
 * Create unique cover variants for the 30 new mood-category sounds from category art.
 * Run: node scripts/make-mood-sound-covers.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(
  process.env.USERPROFILE || '',
  '.cursor',
  'projects',
  'c-Users-DELL-Desktop-x-relax',
  'assets',
  'mood-sound-covers',
);

const SUPABASE_URL = 'https://bfilhkxyjiofkfqwqyep.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmaWxoa3h5amlvZmtmcXdxeWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNTYwMDMsImV4cCI6MjEwMDkzMjAwM30.vWAkF1yHcQKK5I-cae2Vfnj9-Ax3mx3oRZKKULr-ibI';

/** @type {{ id: string, cat: string }[]} */
const sounds = [
  // nature
  { id: '190f23a7-c1fc-4d20-83e0-925a047ed7f5', cat: 'nature' },
  { id: 'edcdee9c-4764-4b55-80dd-972d8d1636cc', cat: 'nature' },
  { id: 'f55a2326-c449-407d-8467-ee58287fdb31', cat: 'nature' },
  { id: '40d0b3a0-aa5d-441a-a807-658717af9af9', cat: 'nature' },
  { id: '92882334-6457-4462-bc46-68e69e02b2fb', cat: 'nature' },
  // relaxation
  { id: '4d71b815-1971-4496-8a1d-7d28ac546fff', cat: 'relaxation' },
  { id: 'fe460462-f4e1-4bc1-be6f-87c8ba23e7e4', cat: 'relaxation' },
  { id: 'd90edb86-9439-4dda-875a-9215f8da7e22', cat: 'relaxation' },
  { id: 'ba63a074-ce13-4a85-9600-5af9220c5d20', cat: 'relaxation' },
  { id: 'd3cec567-1734-49e0-9fcb-f84952a1283d', cat: 'relaxation' },
  // asmr
  { id: 'd9c8c543-50fe-410f-ad6e-1de84007ebc1', cat: 'asmr' },
  { id: '1ea0b691-c8b3-47c5-aefe-56612ff0d3c5', cat: 'asmr' },
  { id: 'dca9d652-6a85-4eea-8d63-fa106c7842fe', cat: 'asmr' },
  { id: '06a3c6c8-bb3b-458d-aa52-d1a47cb3e632', cat: 'asmr' },
  { id: '2bad381f-cf4d-49ca-9d48-29c194652606', cat: 'asmr' },
  // children
  { id: '2111890b-58d3-4c9b-8333-d5c8d9547ef8', cat: 'children' },
  { id: '4fbe39b5-ced4-40d2-8e32-bacb53a324e6', cat: 'children' },
  { id: '192cb01d-8b96-452c-90b5-f3803e87adcf', cat: 'children' },
  { id: '76d15d2c-4ace-405c-8cd8-35d334380847', cat: 'children' },
  { id: '14e8f045-861b-40c7-af09-636705813e94', cat: 'children' },
  // reading
  { id: '488b8c87-f05d-49ef-8974-8f03e000eef3', cat: 'reading' },
  { id: 'cf7f9bcb-d542-4c60-a76e-294fa410894a', cat: 'reading' },
  { id: 'dc380114-1138-43bd-8d13-122a3ffd5e25', cat: 'reading' },
  { id: '61c93923-7410-4445-91ca-9af5ac412eb4', cat: 'reading' },
  { id: 'cece4abc-d717-4484-b0a1-513d6f9e9e4d', cat: 'reading' },
  // mixes
  { id: 'a33b85ee-9d56-4c90-9474-cc9c294c38da', cat: 'mixes' },
  { id: 'b97e6f93-e728-478d-83b7-ababafa11efd', cat: 'mixes' },
  { id: 'b5d4442d-677d-4c6f-8508-e0965a7ca678', cat: 'mixes' },
  { id: '9491efe3-744d-4ee3-853e-88565e845224', cat: 'mixes' },
  { id: 'ffc67612-d55c-4949-a9f1-a6853f7826f9', cat: 'mixes' },
];

const categoryCoverUrls = {
  nature: `${SUPABASE_URL}/storage/v1/object/public/covers/catalog/categories/nature.jpg`,
  relaxation: `${SUPABASE_URL}/storage/v1/object/public/covers/catalog/categories/relaxation.jpg`,
  asmr: `${SUPABASE_URL}/storage/v1/object/public/covers/catalog/categories/asmr.jpg`,
  children: `${SUPABASE_URL}/storage/v1/object/public/covers/catalog/categories/children.jpg`,
  reading: `${SUPABASE_URL}/storage/v1/object/public/covers/catalog/categories/reading.jpg`,
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
  fs.mkdirSync(outDir, { recursive: true });
  const baseCache = new Map();
  const updates = [];

  for (const item of sounds) {
    const baseUrl = categoryCoverUrls[item.cat];
    if (!baseCache.has(item.cat)) {
      process.stdout.write(`fetch ${item.cat}… `);
      try {
        baseCache.set(item.cat, await download(baseUrl));
        console.log('ok');
      } catch (err) {
        // mixes.png may 404; fall back to nature
        console.log('fail, fallback nature');
        if (!baseCache.has('nature')) baseCache.set('nature', await download(categoryCoverUrls.nature));
        baseCache.set(item.cat, baseCache.get('nature'));
      }
    }

    const hue = hashHue(item.id);
    const bright = 0.92 + (hue % 20) / 100;
    const sat = 0.85 + (hue % 30) / 100;
    const local = path.join(outDir, `${item.id}.jpg`);

    await sharp(baseCache.get(item.cat))
      .resize(768, 768, { fit: 'cover' })
      .modulate({ brightness: bright, saturation: sat, hue })
      .jpeg({ quality: 84 })
      .toFile(local);

    process.stdout.write(`upload ${item.id.slice(0, 8)}… `);
    const url = await upload(local, `catalog/sounds/${item.id}.jpg`);
    updates.push({ id: item.id, url });
    console.log('ok');
  }

  const sql = updates
    .map((u) => `UPDATE sounds SET cover_url = '${u.url}' WHERE id = '${u.id}'::uuid;`)
    .join('\n');
  const sqlPath = path.join(__dirname, '..', 'assets', 'mood-sound-cover-updates.sql');
  fs.mkdirSync(path.dirname(sqlPath), { recursive: true });
  fs.writeFileSync(sqlPath, sql);
  fs.writeFileSync(path.join(outDir, 'updates.json'), JSON.stringify(updates, null, 2));
  console.log('Wrote', sqlPath, updates.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
