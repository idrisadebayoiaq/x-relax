# X-Relax

Relaxation audio platform — React Native (Expo) + Supabase.

## Docs

Start here: **[docs/README.md](./docs/README.md)**

| Doc | Purpose |
|-----|---------|
| [docs/IMPLEMENTATION.md](./docs/IMPLEMENTATION.md) | Step-by-step build plan |
| [docs/CHECKLIST.md](./docs/CHECKLIST.md) | Phase exit gates |
| [docs/BLUEPRINT.md](./docs/BLUEPRINT.md) | Product blueprint v1.1 |
| [docs/BRANDING.md](./docs/BRANDING.md) | Logo + B/W light/dark theme |
| [docs/PAYMENT_DETAILS.md](./docs/PAYMENT_DETAILS.md) | Manual Premium bank details |
| [docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md) | What you need to provide |
| [docs/SCHEMA.md](./docs/SCHEMA.md) | Database design |
| [docs/ROLES.md](./docs/ROLES.md) | Permissions |
| [docs/FIREBASE.md](./docs/FIREBASE.md) | FCM Android package name |
| [docs/ADMIN_WEB.md](./docs/ADMIN_WEB.md) | Admin dashboard |
| [docs/CONTENT_LIBRARY.md](./docs/CONTENT_LIBRARY.md) | Phase 6 sound catalog prep |
| [docs/QA.md](./docs/QA.md) | Internal QA checklist |
| [docs/LEGAL.md](./docs/LEGAL.md) | Privacy + Terms drafts |
| [docs/INTERNAL_BUILD.md](./docs/INTERNAL_BUILD.md) | Sideload APK via EAS |

## App

```bash
cd apps/mobile
npm start
```

Preview APK (after `eas login`): `npm run build:apk` in `apps/mobile`.

## Admin web

```bash
cd admin-web
npm install
npm run dev
```

Open http://localhost:3000 — Super Admin: `quoreebadebayo@gmail.com`

**Android package (Firebase):** `com.xrelax.app`

## Current decisions

- Auth: email + password only — signup role Listener or Creator (no guest, no Google/Apple)
- Phase: **v1 code complete** (pre-store) — run device QA + swap licensed audio when ready
- Welcome notification on every new signup (Home modal + push when FCM token registers)
- Supabase: `https://bfilhkxyjiofkfqwqyep.supabase.co`
- Payments: manual USD (Lead Bank) + NGN (Opay)
- Brand: circular X mark in [`assets/brand/`](./assets/brand/)
- Theme: black & white — light + dark ([docs/BRANDING.md](./docs/BRANDING.md))
- Android package: `com.xrelax.app`
- Content drop folder: [`content/`](./content/)

## Security

Keep this repository **private**. Payment account details live in `docs/PAYMENT_DETAILS.md`.
