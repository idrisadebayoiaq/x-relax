# X-Relax Documentation

This folder is the source of truth for building **X-Relax**.

Follow docs in this order:

| Order | Doc | Purpose |
|------:|-----|---------|
| 1 | [BLUEPRINT.md](./BLUEPRINT.md) | Product vision, roles, features |
| 2 | [BRANDING.md](./BRANDING.md) | Logo usage + black/white light & dark theme |
| 3 | [REQUIREMENTS.md](./REQUIREMENTS.md) | Accounts, assets, and decisions you must provide |
| 4 | [PAYMENT_DETAILS.md](./PAYMENT_DETAILS.md) | Manual Premium bank / transfer details |
| 5 | [SCHEMA.md](./SCHEMA.md) | Database + storage design |
| 6 | [ROLES.md](./ROLES.md) | Permissions matrix |
| 7 | [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Step-by-step build plan |
| 8 | [CHECKLIST.md](./CHECKLIST.md) | Phase exit gates (tick as you go) |
| 9 | [FIREBASE.md](./FIREBASE.md) | Android package name + FCM registration |
| 10 | [ADMIN_WEB.md](./ADMIN_WEB.md) | Next.js admin dashboard |
| 11 | [CONTENT_LIBRARY.md](./CONTENT_LIBRARY.md) | Phase 6 sound catalog prep |
| 12 | [QA.md](./QA.md) | Internal QA checklist |
| 13 | [LEGAL.md](./LEGAL.md) | Privacy + Terms drafts |
| 14 | [INTERNAL_BUILD.md](./INTERNAL_BUILD.md) | Sideload APK via EAS |

## Current project status

- **Phase:** v1 implementation complete (pre-store) — device QA + licensed catalog swap remaining
- **Platform:** Android-first React Native (Expo)
- **Backend:** Supabase (MCP connected)
- **Project URL:** `https://bfilhkxyjiofkfqwqyep.supabase.co`
- **Auth:** Email + password only (no Google / Apple Sign-In)
- **Admin:** `admin-web/` Next.js dashboard
- **Store release:** Deferred — build and test locally / internal APK first
- **Sound library:** 10 published demo tracks live; replace via `content/` + Creator upload when licensed
- **Payments:** Manual verification (USD Lead Bank + Nigeria Opay)
- **Brand:** Official circular X mark in `assets/brand/`
- **Theme:** Black & white only — light mode + dark mode
- **Push:** FCM wired; welcome notification on signup

## How to use this plan

1. Read the blueprint once for product context.
2. Confirm items in `REQUIREMENTS.md`.
3. Execute `IMPLEMENTATION.md` phase by phase.
4. Tick boxes in `CHECKLIST.md` before moving to the next phase.
5. Do **not** skip Phase 1 schema + RLS — everything else depends on it.
