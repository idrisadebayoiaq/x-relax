# X-Relax — Step-by-Step Implementation Plan

Follow this document in order. Tick matching items in [CHECKLIST.md](./CHECKLIST.md) before advancing.

## Constraints (locked)

| Topic | Decision |
|-------|----------|
| Auth | Email + password only — signup role: Listener or Creator |
| OAuth | No Google / Apple Sign-In in v1 |
| Guest | Removed — no anonymous browsing |
| Super Admin | `quoreebadebayo@gmail.com` (auto full admin access) |
| Stores | No Play Store / App Store publish yet |
| Content | Full sound library seeded **after** app features work |
| Backend | Supabase MCP project `bfilhkxyjiofkfqwqyep` |
| Payments | Manual — see [PAYMENT_DETAILS.md](./PAYMENT_DETAILS.md) |
| Ads | AdMob test IDs until store-ready |
| Icon | Official mark in `assets/brand/` — app, splash, push, in-app |
| Theme | Black & white only — light + dark modes — see [BRANDING.md](./BRANDING.md) |

## Target stack

```text
apps/mobile          Expo (React Native) + TypeScript
supabase/migrations  SQL + RLS
supabase/functions   Edge Functions
admin-web            Next.js (Phase 5 — recommended over mobile-only admin)
docs/                This plan
```

Suggested mobile libraries:

- `@supabase/supabase-js` — API / auth
- `expo-av` or `expo-audio` — playback
- `expo-file-system` + secure storage — downloads
- `@react-native-async-storage/async-storage` — session cache
- `react-native-track-player` (if needed) — background / lock screen
- `react-native-google-mobile-ads` — AdMob (Phase 3, test IDs)

---

## Phase 0 — Prep (½–1 day)

**Goal:** Repo and env ready; Supabase reachable from the app.

### Steps

1. Create Expo app in repo root or `apps/mobile`:
   ```bash
   npx create-expo-app@latest apps/mobile -t expo-template-blank-typescript
   ```
2. Add folder layout:
   ```text
   src/
     app/ or navigation/
     features/   auth | home | player | library | premium | creator | admin
     lib/        supabase.ts | audio | theme
     components/
     types/
   assets/brand/   ← copy from repo root assets/brand/
   ```
3. Wire Expo `icon`, `splash`, Android `adaptiveIcon`, and `notification.icon` to `assets/brand/` (see [BRANDING.md](./BRANDING.md)). Splash background `#000000` with white logo.
4. Add theme module stubs: light/dark black–white tokens; follow system color scheme.
5. Create `.env` (gitignored):
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://bfilhkxyjiofkfqwqyep.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```
6. Fetch anon key from Supabase Dashboard (or MCP `get_publishable_keys`).
7. Confirm Auth settings in Supabase: **Email** enabled; confirm email optional for early dev.
8. Keep `PAYMENT_DETAILS.md` private; do not paste service role key into the app.

### Exit

- App runs on Android emulator/device.
- Supabase client initializes without errors.

**Phase 0 status (2026-07-30):** Scaffolded `apps/mobile`, wired brand assets, theme stubs, Supabase client + `.env`, Android package `com.xrelax.app`. See [FIREBASE.md](./FIREBASE.md) and [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

---

## Phase 1 — Foundation

**Goal:** Auth, profiles, schema skeleton, navigation shells.

### 1.1 Database migrations

Apply via Supabase MCP `apply_migration` (or CLI), in order:

1. Extensions if needed (`uuid-ossp` / `pgcrypto` usually available)
2. Enums (`user_role`, `sound_status`, …)
3. `profiles` + trigger on `auth.users` insert
4. `admin_profiles`, `creator_profiles`
5. `categories` + seed parent categories
6. `app_settings` (empty JSON + feature flags)
7. Enable RLS on all tables; policies for “own profile read/update”

### 1.2 Auth screens

- Sign up (email, password, display name)
- Sign in
- Sign out
- Forgot password (Supabase reset email)
- Continue as Guest (anonymous sign-in)

**Do not** add Google/Apple buttons.

### 1.3 Profile

- Auto-create `profiles` row on signup / guest session
- Avatar upload to `avatars` bucket (optional in 1.x)
- Role defaults: guest → after email signup → `listener`

### 1.4 Navigation

Role-aware root navigator:

- Guest stack: Browse (read-only), Auth prompt on gated actions
- Listener tabs: Home, Search, Library, Profile
- Creator tab/section: stub “Creator” (unlock Phase 4)
- Admin entry: stub or deep link (full UI Phase 5)

### 1.5 Storage buckets

Create: `avatars`, `covers`, `sounds`, `payment-proofs`, `artist-documents`, `reports` with RLS.

### Exit

- Email signup/signin works.
- Guest session works.
- Profile row exists for every auth user.
- Empty Home shell renders.

**Phase 1 status:** Guest removed. Signup chooses Listener/Creator. Super Admin auto for `quoreebadebayo@gmail.com`.

**Phase 2 status (2026-07-30):** Catalog schema + 5 sample sounds. Home sections, search, player (play/seek/speed/loop/sleep/favourite/rate/playlist), library playlists & favourites, listening history.

---

## Phase 3 — Premium features

**Goal:** Manual Premium, Premium Pass, downloads, mixing, test ads.

### 3.1 Plans

Table `subscription_plans` + prices (fill when you decide amounts):

- Monthly
- Quarterly
- Yearly
- Lifetime

Store payment method JSON from [PAYMENT_DETAILS.md](./PAYMENT_DETAILS.md) in `app_settings`.

### 3.2 Payment request flow

1. User picks plan + method (USD Lead Bank / NGN Opay).
2. App shows transfer instructions.
3. User uploads proof → `payment_requests` + file in `payment-proofs`.
4. `payment_messages` thread created.
5. Notify admins (in-app notification; FCM if Firebase ready).
6. Admin: Approved / Rejected / Need More Info / Refunded.
7. On Approved: create/extend `subscriptions`; set premium entitlements.

Implement approve logic in Edge Function `approve-payment` (service role) so clients cannot self-approve.

### 3.3 Premium Pass

- Track rewarded ad completions in `ad_reward_events`
- After 5 valid rewards in a rolling window → insert `premium_passes` (24h)
- Enforce **max one pass per calendar day** per user
- Use AdMob **test** rewarded unit IDs

### 3.4 Downloads

- Premium-only
- Signed URL fetch → local file
- Offline playback list in Library
- Respect sound unpublish (hide or block offline item)

### 3.5 Sound mixing

- Select multiple published ambient tracks
- Per-track volume
- Free: limited tracks (decide in REQUIREMENTS — suggest 2)
- Premium: unlimited + save `mixes` / `mix_tracks`

### 3.6 AdMob rules

Show ads only if user is Free Listener (not Guest preview-only, not Premium, not Creator, not Admin).  
Until store release: test ads only.

### 3.7 Subscription expiry

Cron Edge Function `expire-subscriptions` daily: downgrade expired non-lifetime subs; end expired passes.

### Exit

- You can pay yourself (test), upload proof, approve as admin, and see Premium unlocks.
- Pass grants 24h Premium once per day.
- Mix + download gated correctly.

**Phase 3 status (2026-07-30):** Plans + payment methods seeded. Manual payment + proof upload. Admin review RPC + Edge Functions (`approve-payment`, `expire-subscriptions`). Premium Pass via 5 test ads. Downloads, mix studio, Free-only test ad banner. Premium tab in app.

---

## Phase 4 — Creator platform

**Goal:** Upload pipeline, moderation, verification, earnings ledger, withdrawals.

### 4.1 Creator onboarding

- “Become a Creator” → `creator_profiles` row, level `new`
- Profile fields: bio, links, payout method preference

### 4.2 Upload

Form: title, description, audio, cover, category, tags  
Status: `pending`  
Storage: `sounds/`, `covers/`

### 4.3 Moderation hooks

Content Admin lists pending sounds → publish / reject with reason → notify creator.

### 4.4 Analytics (creator dashboard)

Aggregate from `play_events` / history:

- Total plays, listening time, ratings, favourites, downloads, top sound, monthly chart

### 4.5 Verification

Application when thresholds met (20 sounds, 5k plays, ≥4.5 rating, complete profile, ID upload to `artist-documents`).  
Admin reviews `creator_verifications`.

### 4.6 Earnings

Monthly job `calculate-earnings`:

1. Sum Premium revenue for period (from approved payments / plan value)
2. Allocate pool by weighted engagement
3. Insert immutable `creator_earnings` rows

### 4.7 Withdrawals

Creator requests payout → Finance Admin flow → statuses Pending / Approved / Rejected / Paid  
Manual send via your USD or NGN accounts; mark Paid when done.

### Exit

- Creator uploads → admin publishes → plays count → earnings row → withdrawal request.

**Phase 4 status (2026-07-30):** Become creator, upload→pending, admin moderation, analytics, verification, earnings calculation Edge Function + RPC, withdrawals. Creator tab always visible.

---

## Phase 5 — Administration

**Goal:** Operate without Supabase Studio for daily work.

### Recommendation

Build **`admin-web`** (Next.js + Supabase Auth email login restricted to `admin_profiles`). Faster than packing all admin UX into the mobile app.

### Modules

1. Payment queue + chat + proof viewer  
2. Sound moderation queue  
3. Verification queue  
4. Withdrawal queue  
5. Reports  
6. Support chat / appeals  
7. Featured / Daily Pick / categories  
8. App settings (plans, payment JSON, feature flags)  
9. Audit log viewer  

### Notifications

- Table `notifications` for in-app
- FCM for: payment approved, artist/verification approved, messages, withdrawal updates, admin announcements

### Exit

- Super Admin can run the marketplace from the web dashboard.

**Phase 5 status (2026-07-30):** `admin-web` Next.js dashboard with payments, moderation, verifications, withdrawals, reports, support, featured/daily pick, settings, audit log. Admin-only auth gate via `admin_profiles`. See [ADMIN_WEB.md](./ADMIN_WEB.md).

---

## Phase 6 — Content seeding & internal testing

**Goal:** Real library + APK testing. Still **no** store publish.

**Phase 6 status (2026-07-30):** Content pipeline + QA/legal/EAS/FCM done. Welcome notification on signup. Launch catalog = 10 published demo tracks (SoundHelix placeholders) with featured + Daily Pick. Product decisions locked in `app_settings`. Remaining human work: device QA, licensed audio swap, APK share.

### 6.1 Populate sounds

After features are stable (see [CONTENT_LIBRARY.md](./CONTENT_LIBRARY.md)):

1. Prepare audio (consistent loudness, format AAC/MP3) into `content/audio/`
2. Covers (1:1) into `content/covers/`
3. Fill `content/catalog.csv` from `catalog.template.csv`
4. Upload via Creator flow → publish in admin Moderation
5. Featured / Daily Pick in admin-web
6. Verify home sections and search quality

### 6.2 Internal QA

Follow [QA.md](./QA.md):

- Auth (email only — no guest)
- Player background audio / sleep timer
- Premium payment happy path + rejection path
- Downloads offline
- Mix save/load
- Creator upload + reject/publish
- Ads test units on Free account only
- RLS: user A cannot read user B payment proofs
- Admin web queues

### 6.3 Distribution (pre-store)

- See [INTERNAL_BUILD.md](./INTERNAL_BUILD.md) — `eas build -p android --profile preview`
- Collect feedback → iterate
- Legal drafts in [LEGAL.md](./LEGAL.md) before wider distribution

### Explicitly later

- Play Store listing
- App Store / Apple Sign-In
- Google Sign-In
- Production AdMob
- Payment automation

---

## Suggested build sequence (solo)

| Week | Focus |
|------|--------|
| 1 | Phase 0–1: Expo, auth, schema, RLS, nav |
| 2 | Phase 2: catalog, player, home, history |
| 3 | Phase 2: search, playlists, favourites, ratings |
| 4 | Phase 3: plans, payment proof flow, admin approve |
| 5 | Phase 3: downloads, mixing, Premium Pass, test ads |
| 6 | Phase 4: creator upload + moderation |
| 7 | Phase 4: analytics, earnings, withdrawals |
| 8 | Phase 5: admin web + notifications |
| 9+ | Phase 6: seed real sounds, harden, internal APK |

---

## Feature improvements to bake in early

1. Signed URLs for audio (private `sounds` bucket)  
2. Append-only `play_events` for fair earnings  
3. Payment status machine enforced in DB/Edge Function  
4. Immutable `creator_earnings` ledger  
5. Feature flags in `app_settings`  
6. `audit_logs` for admin actions  
7. Guest → email account merge for history  
8. Report reasons + auto-flag threshold  
9. Preview duration constant (e.g. 45s) in settings  
10. Idempotent payment: one open request per user/plan  

---

## Definition of “app built” (before full sound library)

You may start Phase 6 content work when:

- [ ] Email auth + guest work  
- [ ] Player + library features work on sample audio  
- [ ] Manual Premium path works with your USD/Opay details  
- [ ] Creator upload + publish works  
- [ ] Admin can approve payments and sounds  
- [ ] Free vs Premium entitlements are correct  

Then add the real sound catalog and polish.

---

## Next action

**Implementation complete for v1 (pre-store).**  
Your checklist: run [QA.md](./QA.md) on device, swap demo audio for licensed masters when ready, `eas build` preview APK, fill legal contact emails.  
Welcome messages fire automatically on signup (Home modal + Notifications; push after first FCM token).
