# Auth settings for development

In Supabase Dashboard → **Authentication** → **Providers**:

1. Enable **Email** (required).
2. For faster testing, turn **off** “Confirm email” under Email provider (re-enable before public launch).
3. Do **not** enable Anonymous / Guest.
4. Do **not** enable Google or Apple for v1.

## Signup roles

Users choose **Listener** or **Creator** at signup.  
**Admin cannot be chosen** in the app.

## Super Admin (locked)

| Email | Role |
|-------|------|
| `quoreebadebayo@gmail.com` | Super Admin — full access to all admin capabilities (finance, content, support, settings) |

When this email signs up (or already exists), the auth trigger sets:

- `profiles.role = admin`
- `admin_profiles.role = super`

## Project

- URL: `https://bfilhkxyjiofkfqwqyep.supabase.co`
- Phase 1 tables: `profiles`, `creator_profiles`, `admin_profiles`, `categories`, `app_settings`
- Phase 2 tables: `sounds`, playlists, favourites, ratings, reviews, listening_history, play_events, featured collections
- Storage buckets: `avatars`, `covers`, `sounds`, `payment-proofs`, `artist-documents`, `reports`
