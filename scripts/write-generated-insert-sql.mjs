import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const published = JSON.parse(
  fs.readFileSync(path.join(root, 'assets', 'generated-category-sounds', 'published.json'), 'utf8'),
);
const CREATOR = 'b2295012-b600-4d22-bf62-df9dfbe3dba0';
const esc = (s) => `'${String(s).replace(/'/g, "''")}'`;

const values = published
  .map(
    (u) =>
      `  (${esc(u.id)}::uuid, ${esc(CREATOR)}::uuid, ${esc(u.title)}, ${esc(u.tip)}, ${esc(u.audio_path)}, ${esc(u.audio_url)}, ${esc(u.cover_url)}, ${u.duration_seconds}, 'published', false, false)`,
  )
  .join(',\n');

const links = published
  .map(
    (u) =>
      `INSERT INTO sound_categories (sound_id, category_id)\nSELECT ${esc(u.id)}::uuid, id FROM categories WHERE slug = ${esc(u.cat)}\nON CONFLICT DO NOTHING;`,
  )
  .join('\n');

const sql = `DELETE FROM sound_categories sc
USING categories c
WHERE sc.category_id = c.id
  AND c.slug IN ('nature','asmr','children','mixes');

INSERT INTO sounds (id, creator_id, title, description, audio_path, audio_url, cover_url, duration_seconds, status, is_premium_only, is_featured)
VALUES
${values}
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  audio_path = EXCLUDED.audio_path,
  audio_url = EXCLUDED.audio_url,
  cover_url = EXCLUDED.cover_url,
  duration_seconds = EXCLUDED.duration_seconds,
  status = 'published',
  updated_at = now();

${links}
`;

fs.writeFileSync(path.join(root, 'assets', 'generated-category-sounds', 'insert.sql'), sql);
console.log('wrote insert.sql', published.length);
