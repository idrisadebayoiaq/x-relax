# Branding & Theme

Locked brand decisions for X-Relax.

## Logo (source of truth)

Master artwork lives in `assets/brand/`:

| File | Use |
|------|-----|
| `icon-master.png` | Original mark (white mark on black circle) — **canonical** |
| `app-icon.png` | App / launcher icon (Android adaptive + Expo `icon`) |
| `splash-icon.png` | Splash screen centered logo |
| `notification-icon.png` | Push notification small icon source |
| `icon-light.png` | Light-theme / light-splash variant (black mark on white) |

### Where the icon must appear

1. **App icon** — home screen / launcher  
2. **Splash screen** — launch splash  
3. **Push notifications** — FCM / local notification icon  
4. **In-app chrome** — auth header, empty states, about screen, loading brand mark  
5. **Admin web favicon** (Phase 5)  
6. **Future store listing** icon (when publishing)

Do not introduce a second logo. Simplified crop (circle “X” only) is allowed for tiny sizes if readability fails; prefer the full mark.

### Android notification note

Android status-bar icons should be a **white silhouette on transparent**. During Phase 3/5 FCM setup, derive a monochrome white notification glyph from `icon-master.png` (circle border optional). Until then, use `notification-icon.png` as the branded asset source.

---

## Theme: black & white only

No brand purple, cream, terracotta, or accent color systems. UI is **monochrome** with light and dark modes.

### Color tokens

```text
/* Shared */
--color-pure-black: #000000
--color-pure-white: #FFFFFF
--color-transparent: transparent

/* Neutrals (allowed grays for hierarchy — still B/W family) */
--gray-100: #F5F5F5
--gray-200: #E5E5E5
--gray-400: #A3A3A3
--gray-600: #525252
--gray-800: #262626
--gray-900: #171717
```

### Dark mode (default recommended for relaxation)

| Token | Value | Role |
|-------|--------|------|
| `background` | `#000000` | Screen background |
| `surface` | `#171717` | Sheets, player chrome |
| `border` | `#262626` | Dividers |
| `text` | `#FFFFFF` | Primary text |
| `textMuted` | `#A3A3A3` | Secondary text |
| `icon` | `#FFFFFF` | Icons |
| `inverse` | `#FFFFFF` | Buttons filled |
| `inverseText` | `#000000` | Text on filled buttons |
| `splashBackground` | `#000000` | Splash |
| `brandMark` | `icon-master.png` / `splash-icon.png` | Logo |

### Light mode

| Token | Value | Role |
|-------|--------|------|
| `background` | `#FFFFFF` | Screen background |
| `surface` | `#F5F5F5` | Sheets, player chrome |
| `border` | `#E5E5E5` | Dividers |
| `text` | `#000000` | Primary text |
| `textMuted` | `#525252` | Secondary text |
| `icon` | `#000000` | Icons |
| `inverse` | `#000000` | Buttons filled |
| `inverseText` | `#FFFFFF` | Text on filled buttons |
| `splashBackground` | `#FFFFFF` | Splash |
| `brandMark` | `icon-light.png` | Logo |

### Mode behavior

- Follow **system** appearance by default (`useColorScheme`).
- Allow in-app override: System / Light / Dark (store in profile or AsyncStorage).
- Splash should match the resolved mode when possible (Expo splash is usually one static config; prefer **dark splash** with white logo as primary brand moment, or dual splash if Expo config supports it).

---

## Typography (implementation guidance)

Keep type calm and high-contrast B/W. Avoid Inter/Roboto/Arial as the only brand face when scaffolding UI — pick one expressive display + one readable body (e.g. from Expo Google Fonts). Exact font pair is chosen in Phase 0/1; colors stay black/white.

---

## Expo wiring (Phase 0)

When scaffolding the app, point `app.json` / `app.config.ts` at these assets:

```json
{
  "expo": {
    "name": "X-Relax",
    "icon": "./assets/brand/app-icon.png",
    "splash": {
      "image": "./assets/brand/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#000000"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/brand/app-icon.png",
        "backgroundColor": "#000000"
      }
    },
    "notification": {
      "icon": "./assets/brand/notification-icon.png",
      "color": "#FFFFFF"
    }
  }
}
```

Copy or symlink `assets/brand/*` into `apps/mobile/assets/brand/` when the Expo app is created (or set paths relative to the mobile app root).

---

## Theme module (Phase 1)

Create `src/lib/theme.ts` (or similar) exporting:

- `lightColors` / `darkColors` from the tables above  
- `useAppTheme()` reading system + user preference  
- No colored gradients as brand accents — atmosphere via subtle gray surfaces and motion only  

Cover art and sound imagery may use full color (content). **Chrome, buttons, tabs, text, and icons stay B/W.**
