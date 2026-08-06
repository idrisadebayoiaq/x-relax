# Admin Web Dashboard

Next.js admin app for X-Relax day-to-day operations.

## Run

```bash
cd admin-web
cp .env.example .env.local   # if needed
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Access

- Email/password only
- Must have a row in `admin_profiles`
- Super Admin email auto-promoted on signup: `quoreebadebayo@gmail.com`

## Modules

| Route | Purpose |
|-------|---------|
| `/` | Overview counts |
| `/payments` | Manual Premium payment queue + detail/chat/proof |
| `/moderation` | Pending sound publish/reject |
| `/verifications` | Creator verification queue |
| `/withdrawals` | Payout queue + run earnings |
| `/reports` | User reports |
| `/support` | Support threads |
| `/featured` | Featured collections + Daily Pick |
| `/announcements` | Broadcast in-app + FCM push |
| `/settings` | Feature flags, payment methods JSON, plan prices |
| `/audit` | Admin action log |

## Theme

Black & white, follows system light/dark.

## FCM

Push uses Firebase project `x-relax` (`com.xrelax.app`). See [FIREBASE.md](./FIREBASE.md).

- Devices register tokens on sign-in (dev/preview build)
- Inserts into `notifications` auto-dispatch via Edge Function `send-push`
- Use **Announcements** for operator broadcasts
