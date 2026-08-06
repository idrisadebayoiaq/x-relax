# Database & Storage Schema (High Level)

Supabase project is empty today. Apply schema in Phase 1 via migrations (MCP `apply_migration` or Supabase CLI). Every table must have **RLS** enabled.

## Auth

Use Supabase Auth (`auth.users`). App profiles hang off `auth.users.id`.

**Auth methods in v1:** email + password, anonymous guest.

## Core tables

| Table | Purpose |
|-------|---------|
| `profiles` | Display name, avatar, role (`guest`/`listener`/`creator`/`admin`), premium flags |
| `creator_profiles` | Bio, level, verification status, payout prefs |
| `admin_profiles` | Admin sub-role (`super`/`finance`/`content`/`support`) |
| `categories` | Nature, Sleep, Meditation, Focus, Relaxation, ASMR, Children, Reading + children tags |
| `sounds` | Title, description, audio path, cover, duration, status, creator_id |
| `sound_tags` | Tag dictionary |
| `sound_categories` | Sound ↔ category M2M |
| `playlists` | User playlists |
| `playlist_items` | Ordered sounds in playlist |
| `mixes` | Saved mixes |
| `mix_tracks` | Tracks + volumes inside a mix |
| `downloads` | Premium offline grants |
| `favourites` | User ↔ sound |
| `ratings` | 1–5 score |
| `reviews` | Optional text review |
| `listening_history` | Continue listening / recommendations |
| `play_events` | Append-only play segments for earnings (recommended) |
| `subscriptions` | Active Premium period |
| `subscription_plans` | Monthly / Quarterly / Yearly / Lifetime prices |
| `premium_passes` | 24h passes from rewarded ads |
| `ad_reward_events` | Anti-abuse log for Premium Pass |
| `payment_requests` | Manual payment submissions |
| `payment_messages` | Payment chat thread |
| `creator_verifications` | Verification applications |
| `withdrawal_requests` | Creator payouts |
| `creator_earnings` | Immutable earnings ledger |
| `notifications` | In-app notifications |
| `reports` | User reports |
| `app_settings` | Plans, payment methods, feature flags |
| `audit_logs` | Admin action trail |
| `featured_collections` | Home “Featured” / Daily Pick |

## Key enums (suggested)

```text
user_role: guest | listener | creator | admin
premium_status: none | pass | subscribed
sound_status: draft | pending | published | rejected | archived
payment_status: pending | approved | rejected | need_more_info | refunded
withdrawal_status: pending | approved | rejected | paid
creator_level: new | rising | verified | elite
admin_role: super | finance | content | support
```

## Sound lifecycle

```text
draft → pending → published
              ↘ rejected
published → archived
```

## Storage buckets

| Bucket | Public? | Contents |
|--------|---------|----------|
| `sounds` | Private (signed URLs) | Audio files |
| `covers` | Public or signed | Cover art |
| `avatars` | Public | Profile photos |
| `payment-proofs` | Private | Receipts |
| `artist-documents` | Private | ID / verification docs |
| `reports` | Private | Report attachments |

## RLS principles

1. Guests (anon): read **published** catalog metadata only; stream **preview** URLs only.
2. Authenticated listeners: favourites, playlists, ratings, own history.
3. Premium check: downloads + full mix save + no-ads flag via `subscriptions` / `premium_passes`.
4. Creators: CRUD own drafts; read own analytics.
5. Admins: scoped by `admin_profiles.role`.
6. Never expose `service_role` key in the mobile app.

## Edge Functions (later phases)

| Function | Phase | Job |
|----------|-------|-----|
| `approve-payment` | 3 | Approve payment + activate Premium |
| `expire-subscriptions` | 3 | Cron: end expired Premium |
| `grant-premium-pass` | 3 | Validate 5 rewards → 24h pass |
| `calculate-earnings` | 4 | Monthly creator pool split |
| `send-push` | 5 | FCM wrapper |
| `moderate-sound` | 4 | Publish / reject helpers |

## Indexes to add early

- `sounds(status, created_at)`
- `listening_history(user_id, played_at desc)`
- `favourites(user_id, sound_id)` unique
- `payment_requests(status, created_at)`
- `play_events(sound_id, created_at)`

Detailed SQL is written when executing Phase 1 in [IMPLEMENTATION.md](./IMPLEMENTATION.md).
