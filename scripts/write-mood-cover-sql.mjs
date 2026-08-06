import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const updatesPath = path.join(
  process.env.USERPROFILE || '',
  '.cursor',
  'projects',
  'c-Users-DELL-Desktop-x-relax',
  'assets',
  'mood-sound-covers',
  'updates.json',
);
const updates = JSON.parse(fs.readFileSync(updatesPath, 'utf8'));
const lines = updates.map(
  (u) => `UPDATE sounds SET cover_url = '${u.url}' WHERE id = '${u.id}'::uuid;`,
);
lines.push(
  `UPDATE categories SET cover_url = 'https://bfilhkxyjiofkfqwqyep.supabase.co/storage/v1/object/public/covers/catalog/categories/mixes.jpg' WHERE slug = 'mixes';`,
);
const sqlPath = path.join(__dirname, '..', 'assets', 'mood-sound-cover-updates.sql');
fs.writeFileSync(sqlPath, lines.join('\n'));
console.log(sqlPath, lines.length);
