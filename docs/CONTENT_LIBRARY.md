# Content library (Phase 6)

Prepare and publish the real sound catalog after features are stable. Sample SoundHelix tracks stay until you replace them.

## Audio specs

| Spec | Recommendation |
|------|----------------|
| Format | MP3 or AAC |
| Sample rate | 44.1 kHz |
| Channels | Stereo (or mono for nature beds) |
| Loudness | Aim for consistent perceived level across tracks |
| Duration | Prefer 5–20 min loops for sleep/focus |

## Cover art

| Spec | Recommendation |
|------|----------------|
| Aspect | 1:1 square |
| Min size | 1000×1000 px |
| Format | JPEG or PNG |
| Style | Calm, on-brand black/white or soft photography — avoid cluttered text |

## Metadata CSV

Use `content/catalog.template.csv`. Columns:

| Column | Required | Notes |
|--------|----------|-------|
| `title` | yes | Display title |
| `description` | no | Short listener-facing blurb |
| `category_slug` | yes | One of: `nature`, `sleep`, `meditation`, `focus`, `relaxation`, `asmr`, `children`, `reading` |
| `tags` | no | Comma-separated tags |
| `duration_seconds` | yes | Integer length |
| `is_premium_only` | no | `true` / `false` (default false) |
| `audio_filename` | yes | File under `content/audio/` |
| `cover_filename` | no | File under `content/covers/` |

## Folder layout

```text
content/
  catalog.template.csv   ← copy to catalog.csv and fill
  catalog.csv            ← your working sheet (gitignored if you prefer)
  audio/                 ← source audio files
  covers/                ← cover images
```

## Publish flow

1. Fill `catalog.csv` and drop files into `audio/` + `covers/`.
2. Sign in as Creator (or Super Admin) on mobile **or** use admin Moderation after upload.
3. Upload each track (Creator → Upload) → status `pending`.
4. Approve in **admin-web** → `/moderation` (or mobile admin moderation).
5. Optionally mark Featured / Daily Pick in admin-web → `/featured`.
6. Spot-check Home, Search, and Player with the new catalog.

## Replacing sample sounds

Current published samples (`Soft Rain`, `Evening Drift`, `Quiet Focus`, `Night Breeze`, `Deep Rest`) use external demo URLs. After real uploads are live:

1. Publish replacements in the same categories.
2. Unfeature / soft-retire samples (set status or remove from featured).
3. Do not delete rows that already have history/favourites unless you accept broken links.

## Rights

Only upload audio and artwork you own or have license to distribute on X-Relax. Creators accept copyright terms at upload (see [LEGAL.md](./LEGAL.md)).
