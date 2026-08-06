import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'assets', 'bell-and-healing');
const uploaded = JSON.parse(fs.readFileSync(path.join(dir, 'uploaded.json'), 'utf8'));
const CREATOR = 'b2295012-b600-4d22-bf62-df9dfbe3dba0';

const clean = [
  ['Temple Bell Soft Strike', 'Listen for 10-20 minutes when your mind feels scattered — soft temple bells help reset attention and ease tension.', 'bell'],
  ['Bronze Temple Bell', 'Play for 15 minutes before meditation to mark a calm start and slow your breathing.', 'bell'],
  ['Garden Wind Chime', 'Use for 20-30 minutes during light anxiety — gentle chimes give the nervous system a soft focal point.', 'bell'],
  ['Crystal Bell Clear', 'Listen for 10 minutes when you need mental clarity — bright bell tones can cut through mental fog.', 'bell'],
  ['Evening Bell Call', 'Play for 30 minutes at bedtime as a wind-down cue if you struggle to switch off after a long day.', 'bell'],
  ['Morning Temple Bell', 'Listen for 10-15 minutes after waking to gently lift mood and set a steady morning rhythm.', 'bell'],
  ['Deep Bronze Chime', 'Use for 20 minutes when shoulders and jaw feel tight — deeper chimes encourage slower exhaling.', 'bell'],
  ['Silver Hand Bell', 'Play briefly between tasks to reset focus, or loop 15 minutes during short breaks.', 'bell'],
  ['Tibetan Singing Bowl Calm', 'Listen for 30-60 minutes if you cannot sleep — singing bowls help quiet racing thoughts for insomnia.', 'healing'],
  ['Healing Bowl Resonance', 'Use for 45-60 minutes during recovery days to lower stress and support gentle rest.', 'healing'],
  ['Heart Chakra Bowl', 'Play for 20-40 minutes when you feel emotionally heavy — warm bowl tones support softer breathing.', 'healing'],
  ['Deep Sound Bath', 'Listen for 1 hour if you have insomnia or night waking — long sound baths help the body settle into sleep.', 'healing'],
  ['432Hz Healing Tone', 'Use for 30-45 minutes to ease stress headaches and invite a slower heart rate before rest.', 'healing'],
  ['Grounding Earth Bowl', 'Play for 25-40 minutes when you feel overstimulated — grounding tones help you feel present again.', 'healing'],
  ['Restorative Sound Bath', 'Listen for 1 hour after illness or burnout to support deep rest and nervous-system recovery.', 'healing'],
];

const esc = (s) => s.replace(/'/g, "''");

const lines = [];
lines.push(
  'INSERT INTO sounds (id, creator_id, title, description, audio_path, audio_url, duration_seconds, status, is_premium_only, is_featured)',
);
lines.push('VALUES');
const featuredIdx = new Set([0, 1, 8, 11]);
const values = uploaded.map((u, i) => {
  const [title, desc] = clean[i];
  const featured = featuredIdx.has(i);
  return `  ('${u.id}'::uuid, '${CREATOR}'::uuid, '${esc(title)}', '${esc(desc)}', '${esc(u.audio_path)}', '${esc(u.audio_url)}', ${u.duration_seconds}, 'published', false, ${featured})`;
});
lines.push(values.join(',\n') + '\nON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, title = EXCLUDED.title, is_featured = EXCLUDED.is_featured;');

uploaded.forEach((u, i) => {
  const cat = clean[i][2];
  lines.push(
    `INSERT INTO sound_categories (sound_id, category_id) SELECT '${u.id}'::uuid, id FROM categories WHERE slug = '${cat}' ON CONFLICT DO NOTHING;`,
  );
});

const sqlPath = path.join(dir, 'insert-sounds.sql');
fs.writeFileSync(sqlPath, lines.join('\n'), 'utf8');

// Also refresh uploaded.json descriptions
const fixed = uploaded.map((u, i) => ({
  ...u,
  title: clean[i][0],
  description: clean[i][1],
  cat: clean[i][2],
}));
fs.writeFileSync(path.join(dir, 'uploaded.json'), JSON.stringify(fixed, null, 2), 'utf8');
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(
  clean.map((c, i) => ({
    title: c[0],
    new: uploaded[i].filename,
    old: JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))[i]?.old ?? '',
    cat: c[2],
    desc: c[1],
  })),
  null,
  2,
), 'utf8');

console.log('Wrote', sqlPath);
