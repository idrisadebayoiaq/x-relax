# Requirements — What You Need to Provide

Use this list before and during each phase. Items marked **Done** are already available.

## Already available

| Item | Status | Notes |
|------|--------|-------|
| Supabase project | Done | MCP connected · ref `bfilhkxyjiofkfqwqyep` |
| Project URL | Done | `https://bfilhkxyjiofkfqwqyep.supabase.co` |
| Manual payment details | Done | See [PAYMENT_DETAILS.md](./PAYMENT_DETAILS.md) |
| Product blueprint | Done | See [BLUEPRINT.md](./BLUEPRINT.md) |
| App / splash / notification icon | Done | `assets/brand/` — see [BRANDING.md](./BRANDING.md) |
| Theme (B/W light + dark) | Done | Black & white only — see [BRANDING.md](./BRANDING.md) |

## Required for Phase 1 (Foundation)

| Item | Owner | Notes |
|------|--------|-------|
| Supabase anon / publishable key | You | From Supabase Dashboard → Settings → API (never commit service role key in the app) |
| App display name + short tagline | You | e.g. “X-Relax — calm sounds for rest” |
| Logo / icon | Done | Use `assets/brand/app-icon.png` (and light variant) everywhere |
| Brand colors | Done | Black & white + gray neutrals only; light + dark modes |
| Dev machine | You | Node LTS, Android Studio / emulator or physical Android device |
| First Super Admin email | You | Will be promoted manually after first signup |

## Required for Phase 2 (Listener)

| Item | Owner | Notes |
|------|--------|-------|
| Placeholder cover images | Optional | Solid-color or stock until real covers |
| 3–5 sample audio files (dev only) | Optional | Short MP3/AAC for player testing before full library |
| Category list confirmation | Done | Per blueprint |

## Required for Phase 3 (Premium)

| Item | Owner | Notes |
|------|--------|-------|
| Plan prices (USD + NGN) | You | Monthly / Quarterly / Yearly / Lifetime |
| Payment instruction copy | Derived | From PAYMENT_DETAILS.md — shown in-app |
| AdMob app + ad unit IDs | Later | Use Google **test** ad unit IDs until store-ready |
| Firebase project (FCM) | You | Android package: **`com.xrelax.app`** — see [FIREBASE.md](./FIREBASE.md) |

## Required for Phase 4 (Creator)

| Item | Owner | Notes |
|------|--------|-------|
| Min withdrawal amount | You | e.g. $20 / ₦10,000 |
| Payout currencies / method | You | USD wire and/or NGN Opay |
| Creator agreement text | You | Copyright + payout terms (can be simple v1) |
| Verification document checklist | You | ID types accepted |

## Required for Phase 5 (Admin)

| Item | Owner | Notes |
|------|--------|-------|
| Admin emails + roles | You | Super / Finance / Content / Support |
| Support response SLA (informal) | You | e.g. review payments within 24–48h |

## Required for Phase 6 (Content + internal test)

| Item | Owner | Notes |
|------|--------|-------|
| Full sound library | You / creators | Added **after** app build — titles, audio, covers, categories, tags |
| Privacy Policy + Terms of Use | You | Needed before public distribution |
| Internal testers list | You | Friends / devices for APK sideload |

## Explicitly deferred (do not block build)

- Google Sign-In
- Apple Sign-In
- Play Store listing / release
- App Store listing / release
- Automated payment gateways (Stripe / Paystack / Flutterwave)
- Production AdMob (use test ads)
- iOS build (Android first)

## Decisions to confirm early

Answer these once and stick to them in schema + UI:

1. **Guest preview length:** recommend 45 seconds  
2. **Free mix limit:** recommend max 2 tracks until Premium  
3. **Currency display:** show both USD and NGN for plans?  
4. **Lifetime plan:** available at launch or later?  
5. **Creator earnings payout cycle:** monthly?  
6. **Default language:** English only for v1 (recommended)

Record answers at the bottom of this file when decided.

### Decisions log

| Date | Decision | Choice |
|------|----------|--------|
| 2026-07-30 | Brand icon | Official X-Relax circular mark — app, splash, push, in-app |
| 2026-07-30 | Theme | Black & white only; light mode + dark mode (system default) |
| 2026-07-30 | Guest preview length | 45 seconds (guest mode removed; flag retained) |
| 2026-07-30 | Free mix track limit | 2 |
| 2026-07-30 | Plan currencies | Show both USD and NGN |
| 2026-07-30 | Lifetime plan at launch | No |
| 2026-07-30 | Payout cycle | Monthly |
| 2026-07-30 | Min withdrawal | USD 20 |
| 2026-07-30 | Default language | English |
| 2026-07-30 | Welcome on signup | In-app notification + modal; FCM when first device token registers |
