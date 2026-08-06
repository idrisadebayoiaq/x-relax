# Roles & Permissions Matrix

Enforce in **RLS** and mirror in the UI (hide buttons that will fail).

## Listener / creator matrix

| Capability | Guest | Free Listener | Premium | Creator | Admin |
|------------|:-----:|:-------------:|:-------:|:-------:|:-----:|
| Browse catalog | ✓ | ✓ | ✓ | ✓ | ✓ |
| Preview audio | ✓ | ✓ | ✓ | ✓ | ✓ |
| Full stream | ✗ | ✓ | ✓ | ✓ | ✓ |
| Favourite | ✗ | ✓ | ✓ | ✓ | ✓ |
| Rate / review | ✗ | ✓ | ✓ | ✓ | ✓ |
| Playlists | ✗ | ✓ | ✓ | ✓ | ✓ |
| Mix (limited) | ✗ | ✓ | — | ✓ | ✓ |
| Mix (unlimited) | ✗ | ✗ | ✓ | ✓ | ✓ |
| Download / offline | ✗ | ✗ | ✓ | ✓* | ✓ |
| Ads shown | ✗** | ✓ | ✗ | ✗ | ✗ |
| Premium Pass | ✗ | ✓ | N/A | N/A | N/A |
| Upload sounds | ✗ | ✗ | ✗ | ✓ | — |
| Earnings / withdraw | ✗ | ✗ | ✗ | ✓ | — |
| Admin tools | ✗ | ✗ | ✗ | ✗ | ✓ |

\*Creators may download their own uploads for QC; not the whole catalog unless also Premium.  
\*\*Guests see no AdMob inventory in v1 (preview-only UX).

## Admin sub-roles

| Action | Super | Finance | Content | Support |
|--------|:-----:|:-------:|:-------:|:-------:|
| Manage admins | ✓ | ✗ | ✗ | ✗ |
| Approve payments | ✓ | ✓ | ✗ | ✗ |
| Manage subscriptions | ✓ | ✓ | ✗ | ✗ |
| Approve withdrawals | ✓ | ✓ | ✗ | ✗ |
| Approve / reject sounds | ✓ | ✗ | ✓ | ✗ |
| Categories / featured | ✓ | ✗ | ✓ | ✗ |
| Handle reports | ✓ | ✗ | ✓ | ✓ |
| Payment / support chat | ✓ | ✓ | ✗ | ✓ |
| User bans / appeals | ✓ | ✗ | ✗ | ✓ |
| App settings / flags | ✓ | ✗ | ✗ | ✗ |
| View audit logs | ✓ | ✓ | ✓ | ✓ |

## Premium resolution order

A user is treated as Premium if **any** is true:

1. Active row in `subscriptions` with `ends_at > now()` (or lifetime)
2. Active `premium_passes` with `ends_at > now()`
3. Role is `admin` (no ads; full listener features for testing)

## Role transitions

```text
anonymous guest  →  email signup  →  listener (free)
listener         →  payment approved / pass  →  premium (temporary or subscribed)
listener         →  become creator (apply or admin flag)
any              →  admin_profiles row  →  admin capabilities
```

When upgrading guest → email account, migrate local/anonymous favourites and history where possible (Phase 1 stretch goal; Phase 2 hard requirement if guest mode ships).
