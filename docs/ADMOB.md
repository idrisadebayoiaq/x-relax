# AdMob setup (X-Relax)

Android app **not on Play Store yet** — created as unlisted in AdMob.

## Your IDs (wired in app)

| Item | ID |
|------|-----|
| **App ID** | `ca-app-pub-1666109889865464~3847414070` |
| **Banner** (Free listeners) | `ca-app-pub-1666109889865464/1959617330` |
| **Rewarded** (Premium Pass) | `ca-app-pub-1666109889865464/9454963976` |

Configured in:
- `apps/mobile/app.json` → `react-native-google-mobile-ads` plugin (App ID)
- `apps/mobile/src/lib/ads.ts` → unit IDs

## Test vs production ad units

By default **dev builds use Google test ad units** (avoids invalid traffic before store review).

| Env | Behavior |
|-----|----------|
| `__DEV__` or unset | Google **test** banner + rewarded IDs |
| `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false` | Your real AdMob unit IDs |

Add to `apps/mobile/.env` when ready for real fill on sideload builds:

```env
EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false
```

## Where ads show

| Surface | Who sees it |
|---------|-------------|
| Premium tab banner | Free **listeners** only |
| Rewarded (Premium Pass) | Free **listeners** only |

Premium, Creator, and Admin accounts see **no ads**.

## Build requirement

AdMob does **not** work in Expo Go. Use a dev/preview APK:

```bash
cd apps/mobile
npm run build:apk
```

Rebuild after changing `app.json` AdMob plugin config.

## AdMob console — next steps (later)

1. Finish testing with preview APK
2. Publish to Play Store (internal track is fine)
3. In AdMob → app settings → **Add store** (Play Store listing)
4. Wait for AdMob app review (usually a few days)
5. Set `EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false` for production fill

## Policies

- No ads on Premium / Creator / Admin (enforced in app)
- Review [AdMob policies](https://support.google.com/admob/answer/6128543) before wide distribution
