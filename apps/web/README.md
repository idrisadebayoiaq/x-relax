# X-Relax Web

Browser version of the X-Relax app — same Supabase backend as mobile.

## Setup

```bash
cd apps/web
cp .env.example .env.local
# Add your NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Features

- **Auth:** sign up (listener/creator), sign in, forgot password
- **Listen:** home catalog, search, player with queue next/prev, sleep timer (Premium)
- **Library:** playlists, favourites, downloads list
- **Premium:** plans, checkout with proof upload, payment tracking
- **Mix Studio:** layer sounds, volume, save/load mixes
- **Creator:** dashboard, upload, sounds, verification, withdrawals
- **Admin:** payments, moderation, verifications, withdrawals (in-app)
- **Profile & notifications**

Admin ops dashboard remains in `admin-web/` (port 3000). This web app mirrors the mobile listener/creator experience.
