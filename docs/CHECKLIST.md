# Implementation Checklist

Tick items as you complete them. Do not start the next phase until the current **Exit gate** is checked.

---

## Phase 0 — Prep

- [x] Expo TypeScript app created (`apps/mobile`)
- [x] Folder structure (`features`, `lib`, `components`, `types`)
- [x] Brand assets copied from `assets/brand/` (app, splash, notification icons)
- [x] Expo `icon` / `splash` / adaptiveIcon / notification icon wired
- [x] Light + dark black/white theme tokens stubbed
- [x] `.env` with Supabase URL + anon key (gitignored)
- [x] Android package name locked: `com.xrelax.app` (see [FIREBASE.md](./FIREBASE.md))
- [x] Supabase client wired + connection check on launch
- [ ] App runs on Android emulator or device (start with `npm start` in `apps/mobile`)

**Exit gate:** [ ] Phase 0 complete (run app once on device/emulator)

---

## Phase 1 — Foundation

- [x] Enums + `profiles` migration + auth trigger
- [x] `creator_profiles` / `admin_profiles` tables
- [x] `categories` seeded (8 parents + subcategories)
- [x] `app_settings` table
- [x] RLS enabled on all new tables
- [x] Storage buckets created with policies
- [x] Email sign up (with Listener / Creator role choice)
- [x] Email sign in
- [x] Password reset
- [x] Guest mode removed (not used)
- [x] Profile screen (display name)
- [x] Role-aware navigation shells
- [x] Super Admin reserved: `quoreebadebayo@gmail.com` (auto-promoted on signup — full admin access)
- [x] Welcome notification + Home welcome modal after signup

**Exit gate:** [ ] Auth + profile + home work (test on device)

---

## Phase 2 — Listener experience

- [x] Sounds / tags / categories tables + RLS
- [x] Playlists, favourites, ratings, reviews, history, play_events
- [x] Launch catalog seeded (10 published demo tracks; replace with licensed audio when ready)
- [x] Home sections wired (incl. Daily Pick from settings)
- [x] Category browse (home chips)
- [x] Search + sort (newest / popular / rating)
- [x] Audio player (play, seek, speed, loop, sleep timer, favourite, share, rate, add to playlist)
- [ ] Full lock-screen media controls (basic background audio via expo-av; enhance later)
- [x] Favourites for signed-in users
- [x] Playlists create + detail + add from player
- [x] Listening history updates
- [x] Ratings (1–5)
- [x] Guest prompts removed (no guest mode)

**Exit gate:** [ ] Sample track plays; library features work on device

---

## Phase 3 — Premium

- [x] `subscription_plans` with prices (USD/NGN placeholders)
- [x] Payment methods seeded from PAYMENT_DETAILS.md
- [x] Payment request + proof upload
- [x] Payment chat messages (initial proof message)
- [x] Admin approve / reject / need more info
- [x] `admin_review_payment` RPC + `approve-payment` Edge Function
- [x] `expire-subscriptions` Edge Function
- [x] Downloads + offline list in Library
- [x] Sound mixing (Free limited, Premium save)
- [x] Ads and Premium Pass removed (2026-08-30)

**Exit gate:** [ ] Manual Premium unlock verified end-to-end on device

---

## Phase 4 — Creator platform

- [x] Become creator / creator profile
- [x] Sound upload form → pending
- [x] Content moderation publish/reject
- [x] Creator analytics dashboard
- [x] Verification application + document upload
- [x] Earnings calculation job + ledger (`calculate-earnings` + RPC)
- [x] Withdrawal requests + finance statuses
- [x] Creator notifications for upload/verify/payout

**Exit gate:** [ ] Upload → publish → earn → withdraw request works on device

---

## Phase 5 — Administration

- [x] Admin web app (`admin-web` Next.js)
- [x] Payment management UI
- [x] Content moderation UI
- [x] Verification queue
- [x] Withdrawal queue
- [x] Reports handling
- [x] Support chat (admin side)
- [x] Featured / Daily Pick management
- [x] Feature flags / app settings UI
- [x] Audit logs
- [x] FCM push for admin announcements (`send-push` + device tokens + Announcements page)
- [x] `admin-web` dependencies install + production build succeeds

**Exit gate:** [ ] Sign in as Super Admin on localhost and operate queues (`cd admin-web && npm run dev`)

---

## Phase 6 — Content & internal test (pre-store)

- [x] Content prep guide + catalog CSV template (`docs/CONTENT_LIBRARY.md`, `content/`)
- [x] Internal QA checklist (`docs/QA.md`)
- [x] Privacy Policy + Terms drafts (`docs/LEGAL.md`) + in-app Legal screens
- [x] Internal APK build profile (`apps/mobile/eas.json`, `docs/INTERNAL_BUILD.md`)
- [x] Firebase / FCM wired (`docs/FIREBASE.md`, mobile registration, `send-push`)
- [x] Welcome notification on signup (in-app + push when first device token registers)
- [x] Product decisions locked in `app_settings.feature_flags` / `creator_settings`
- [x] Launch catalog published (10 demo tracks + featured + Daily Pick) — **swap for licensed masters when ready**
- [ ] Licensed / final sound library replaces demo URLs
- [ ] Full QA pass on device (auth, player, premium, creator, RLS) — see [QA.md](./QA.md)
- [ ] Push verified on physical device (preview/dev APK — not Expo Go)
- [ ] Internal APK distributed to testers
- [ ] Feedback collected and prioritized
- [ ] Legal contact emails filled before public distribution

**Code exit:** Phases 0–6 **implementation** complete for v1 (pre-store).  
**Human exit gates:** device QA, licensed audio swap, APK share, legal contact polish.

---

## Deferred (do not block)

- [ ] Google Sign-In
- [ ] Apple Sign-In
- [ ] Play Store release
- [ ] App Store release
- [ ] Automated payment gateway
- [ ] iOS production build
- [ ] Full lock-screen media controls

---

## Decisions (locked 2026-07-30)

| Item | Value |
|------|--------|
| Guest preview length | 45s (flag; guest mode removed) |
| Free mix track limit | 2 |
| Plan prices USD / NGN | Placeholders in `subscription_plans` — set final in admin Settings |
| Lifetime at launch? | No (`lifetime_plan_enabled: false`) |
| Min withdrawal | USD 20 (`creator_settings`) |
| Payout cycle | Monthly |
| Default language | English |
