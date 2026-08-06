/**
 * Generate brand-new ambient MP3s for Nature, ASMR, Children, Mixes (5 each).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'assets', 'generated-category-sounds');
const ffmpeg =
  process.env.FFMPEG_PATH ||
  'C:\\Users\\DELL\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';

const SUPABASE_URL = 'https://bfilhkxyjiofkfqwqyep.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmaWxoa3h5amlvZmtmcXdxeWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNTYwMDMsImV4cCI6MjEwMDkzMjAwM30.vWAkF1yHcQKK5I-cae2Vfnj9-Ax3mx3oRZKKULr-ibI';

const specs = [
  { cat: 'nature', slug: 'nature-pine-breeze', title: 'Pine Breeze Field', tip: 'Listen for 20 to 40 minutes to calm an overactive mind with soft open air.', src: 'anoisesrc=color=pink:duration=32:sample_rate=44100', af: 'highpass=f=200,lowpass=f=2200,volume=0.28', dur: 32 },
  { cat: 'nature', slug: 'nature-creek-hush', title: 'Creek Stone Hush', tip: 'Listen for 30 to 45 minutes when anxious. Soft water motion helps attention rest.', src: 'anoisesrc=color=brown:duration=34:sample_rate=44100', af: 'bandpass=f=700:width_type=h:w=900,volume=0.32', dur: 34 },
  { cat: 'nature', slug: 'nature-canopy-drift', title: 'Canopy Soft Drift', tip: 'Play for 25 to 40 minutes for gentle forest focus and soft recovery.', src: 'anoisesrc=color=pink:duration=33:sample_rate=44100', af: 'lowpass=f=1200,treble=g=-8,volume=0.26', dur: 33 },
  { cat: 'nature', slug: 'nature-meadow-air', title: 'Meadow Air Glow', tip: 'Listen for 15 to 30 minutes in the morning to lift mood softly.', src: 'anoisesrc=color=pink:duration=31:sample_rate=44100', af: 'highpass=f=300,lowpass=f=1800,aecho=0.6:0.5:40:0.2,volume=0.27', dur: 31 },
  { cat: 'nature', slug: 'nature-dusk-woods', title: 'Dusk Woods Whisper', tip: 'Use for 40 to 60 minutes to lower stress with quiet woodland texture.', src: 'anoisesrc=color=brown:duration=35:sample_rate=44100', af: 'lowpass=f=600,volume=0.3', dur: 35 },

  { cat: 'asmr', slug: 'asmr-soft-crackle', title: 'Soft Texture Crackle', tip: 'Use for 20 to 40 minutes for close textured calm and soft attention.', src: 'anoisesrc=color=pink:duration=30:sample_rate=44100', af: 'highpass=f=1500,lowpass=f=6000,volume=0.18,aecho=0.6:0.4:12:0.15', dur: 30 },
  { cat: 'asmr', slug: 'asmr-velvet-hiss', title: 'Velvet Soft Hiss', tip: 'Listen for 25 to 40 minutes for intimate soft noise and gentle nerves.', src: 'anoisesrc=color=white:duration=32:sample_rate=44100', af: 'lowpass=f=3500,volume=0.12', dur: 32 },
  { cat: 'asmr', slug: 'asmr-glass-tone', title: 'Glass Soft Tone', tip: 'Play for 15 to 30 minutes during light anxiety for a soft focal point.', src: 'sine=frequency=880:duration=30', af: 'volume=0.06,aecho=0.8:0.7:40:0.25', dur: 30 },
  { cat: 'asmr', slug: 'asmr-page-brush', title: 'Page Brush Soft', tip: 'Use for 20 to 35 minutes for close page like texture and calm focus.', src: 'anoisesrc=color=pink:duration=33:sample_rate=44100', af: 'bandpass=f=2500:width_type=h:w=1800,volume=0.16', dur: 33 },
  { cat: 'asmr', slug: 'asmr-ember-tick', title: 'Ember Tick Soft', tip: 'Play for 30 to 50 minutes for intimate evening texture and rest.', src: 'anoisesrc=color=brown:duration=34:sample_rate=44100', af: 'highpass=f=400,lowpass=f=2800,volume=0.2,aecho=0.5:0.3:8:0.2', dur: 34 },

  { cat: 'children', slug: 'children-soft-lull-chime', title: 'Soft Lull Chime', tip: 'Listen for 10 to 20 minutes after waking for a gentle start.', src: 'sine=frequency=523.25:duration=28', af: 'volume=0.07,aecho=0.8:0.6:60:0.3', dur: 28 },
  { cat: 'children', slug: 'children-cloud-hum', title: 'Cloud Soft Hum', tip: 'Play for 20 to 35 minutes for soft open air calm for little listeners.', src: 'sine=frequency=196:duration=32', af: 'volume=0.08,lowpass=f=800,aecho=0.7:0.5:80:0.25', dur: 32 },
  { cat: 'children', slug: 'children-rain-patter', title: 'Tiny Rain Patter', tip: 'Listen for 30 to 45 minutes for soft sleep wind down.', src: 'anoisesrc=color=pink:duration=33:sample_rate=44100', af: 'highpass=f=1000,lowpass=f=4500,volume=0.15', dur: 33 },
  { cat: 'children', slug: 'children-bird-sparkle', title: 'Bird Soft Sparkle', tip: 'Listen for 15 to 25 minutes to lift mood softly without stress.', src: 'sine=frequency=784:duration=28', af: 'volume=0.05,aecho=0.9:0.7:25:0.35', dur: 28 },
  { cat: 'children', slug: 'children-warm-nest', title: 'Warm Nest Glow', tip: 'Use for 25 to 40 minutes for cozy evening calm.', src: 'anoisesrc=color=brown:duration=31:sample_rate=44100', af: 'lowpass=f=900,volume=0.22,aecho=0.5:0.4:30:0.2', dur: 31 },

  { cat: 'mixes', slug: 'mix-rain-wind', title: 'Rain Wind Soft Blend', tip: 'Use for 45 to 60 minutes for layered rain and air wind down.', src: 'anoisesrc=color=pink:duration=35:sample_rate=44100', af: 'highpass=f=150,lowpass=f=2500,aecho=0.5:0.4:20:0.2,volume=0.28', dur: 35 },
  { cat: 'mixes', slug: 'mix-fire-rain', title: 'Fire Rain Night Blend', tip: 'Listen for 40 to 60 minutes for fire and rain calm layering.', src: 'anoisesrc=color=brown:duration=36:sample_rate=44100', af: 'bandpass=f=900:width_type=h:w=2000,aecho=0.4:0.3:15:0.25,volume=0.26', dur: 36 },
  { cat: 'mixes', slug: 'mix-ocean-forest', title: 'Ocean Forest Soft Mix', tip: 'Listen for 40 to 60 minutes for shore and woodland air blending.', src: 'anoisesrc=color=pink:duration=34:sample_rate=44100', af: 'lowpass=f=1400,aecho=0.6:0.5:55:0.2,volume=0.27', dur: 34 },
  { cat: 'mixes', slug: 'mix-storm-soft', title: 'Soft Storm Drift Mix', tip: 'Play for 30 to 60 minutes for soft storm texture and release.', src: 'anoisesrc=color=brown:duration=37:sample_rate=44100', af: 'lowpass=f=500,volume=0.3,aecho=0.7:0.5:120:0.15', dur: 37 },
  { cat: 'mixes', slug: 'mix-bird-river', title: 'Bird River Day Blend', tip: 'Listen for 25 to 40 minutes for bright air and flowing water together.', src: 'anoisesrc=color=pink:duration=33:sample_rate=44100', af: 'highpass=f=180,lowpass=f=3200,aecho=0.5:0.4:35:0.2,volume=0.25', dur: 33 },
];

function runFfmpeg(args) {
  const r = spawnSync(ffmpeg, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr?.slice(-1000) || 'ffmpeg failed');
}

async function upload(localPath, objectPath, attempt = 1) {
  const bytes = fs.readFileSync(localPath);
  try {
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
    if (!res.ok) throw new Error(`Upload ${objectPath}: ${res.status} ${await res.text()}`);
    return `${SUPABASE_URL}/storage/v1/object/public/sounds/${objectPath}`;
  } catch (err) {
    if (attempt >= 4) throw err;
    await new Promise((r) => setTimeout(r, 800 * attempt));
    return upload(localPath, objectPath, attempt + 1);
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const rows = [];
  for (const spec of specs) {
    const id = randomUUID();
    const local = path.join(outDir, `${spec.slug}.mp3`);
    process.stdout.write(`gen ${spec.title}… `);
    runFfmpeg([
      '-y',
      '-f',
      'lavfi',
      '-i',
      spec.src,
      '-af',
      spec.af,
      '-t',
      String(spec.dur),
      '-c:a',
      'libmp3lame',
      '-b:a',
      '96k',
      local,
    ]);
    console.log('ok');
    const objectPath = `generated/${id}.mp3`;
    process.stdout.write(`upload ${spec.slug}… `);
    const audioUrl = await upload(local, objectPath);
    console.log('ok');
    rows.push({
      id,
      cat: spec.cat,
      title: spec.title,
      tip: spec.tip,
      audio_path: objectPath,
      audio_url: audioUrl,
      duration_seconds: spec.dur,
    });
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(rows, null, 2));
  console.log('Wrote manifest', rows.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
