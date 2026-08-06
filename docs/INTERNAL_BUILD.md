# Internal Android builds (Phase 6)

Still **no** Play Store publish. Use EAS (or a local Gradle build) for sideload APKs.

## Prerequisites

1. Expo account + `eas-cli` (`npm i -g eas-cli`)
2. Log in: `eas login`
3. From `apps/mobile`: `eas init` (links project) if not already linked
4. Confirm `app.json` Android package: `com.xrelax.app`
5. Ensure `.env` / EAS secrets include Supabase URL + anon key for release builds

## Build preview APK

```bash
cd apps/mobile
# Ensure .env matches .env.example (Supabase keys). EAS preview env is set separately.
npm run build:apk
```

**EAS project:** [@epicbda/x-relax](https://expo.dev/accounts/epicbda/projects/x-relax)

Preview environment variables on EAS (from `.env.example`):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=true` (test ads on sideload builds)
- `GOOGLE_SERVICES_JSON` (file — `google-services.json`, not in git)

Download the APK from the Expo dashboard when the build completes.

## Development client (optional)

```bash
eas build -p android --profile development
```

## After install

1. Testers create email accounts (Listener / Creator as needed)
2. Run through [QA.md](./QA.md)
3. Collect feedback in your tracker of choice

## Notes

- Production AdMob IDs stay deferred — keep test units
- Privacy Policy / Terms drafts: [LEGAL.md](./LEGAL.md)
- Sound prep: [CONTENT_LIBRARY.md](./CONTENT_LIBRARY.md)
