# Firebase setup (FCM)

| Field | Value |
|-------|--------|
| **Android package name** | `com.xrelax.app` |
| Firebase project | `x-relax` |
| iOS bundle ID (later) | `com.xrelax.app` |
| App display name | X-Relax |
| Expo slug | `x-relax` |

## Files (keep private — gitignored)

| File | Place |
|------|--------|
| `google-services.json` | Repo root **and** `apps/mobile/google-services.json` |
| `*-firebase-adminsdk-*.json` | Repo root only (never ship in the app). Stored in Supabase Vault as `firebase_service_account` for the `send-push` Edge Function |

## Mobile wiring

- `apps/mobile/app.json` → `android.googleServicesFile` + `expo-notifications` plugin
- On sign-in, the app calls `registerForPushNotifications()` → native FCM token → `upsert_push_token`
- Profile → **Notifications** lists in-app rows and can re-enable push

**Important:** FCM with your `google-services.json` requires a **development / preview / production build** (`eas build`). Expo Go will not use your Firebase Android app config.

```bash
cd apps/mobile
npm run build:apk   # or: eas build -p android --profile preview
```

## Backend

| Piece | Role |
|-------|------|
| `device_push_tokens` | Per-user FCM/APNs tokens |
| `notifications` insert trigger | Calls Edge Function `send-push` via `pg_net` |
| Vault `push_dispatch_secret` | Shared secret header `x-push-secret` |
| Vault `firebase_service_account` | Admin SDK JSON for FCM HTTP v1 |
| Edge Function `send-push` | Sends FCM; also accepts admin JWT for direct sends |
| RPC `admin_broadcast_announcement` | Admin web announcements (in-app + auto push) |

## Admin

Open **Announcements** in `admin-web` (`/announcements`) to broadcast.

## Console checklist

1. Firebase Console → project `x-relax` → Android app `com.xrelax.app`
2. Cloud Messaging API (V1) enabled
3. Service account JSON kept private (Vault + gitignore)
