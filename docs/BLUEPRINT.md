# X-Relax Development Blueprint (Version 1.1)

## Project overview

| Field | Value |
|-------|-------|
| App name | X-Relax |
| Launch platform | Android (React Native / Expo) |
| Future | iOS, web admin dashboard |
| Backend | Supabase (Auth, Postgres, Storage, Realtime, Edge Functions, RLS) |
| Notifications | Firebase Cloud Messaging (in-app + push later) |
| Ads | None — no AdMob or in-app ads |
| Brand icon | Official circular X mark (`assets/brand/`) — app, splash, push, in-app |
| Theme | Black & white only · light mode + dark mode — see [BRANDING.md](./BRANDING.md) |

## Purpose

A relaxation audio platform where listeners enjoy calming sounds while creators upload original relaxation audio and earn from Premium subscribers.

## Auth (locked for v1)

- Email + password sign up / sign in
- Signup role choice: **Listener** or **Creator** (Admin cannot be selected)
- Super Admin email (auto-promoted): `quoreebadebayo@gmail.com` — full admin access
- **Not in v1:** Guest / Anonymous mode
- **Not in v1:** Google Sign-In, Apple Sign-In
- **Not in v1:** Play Store / App Store publishing

## Why React Native (not Capacitor)

- Better background audio
- Better audio performance
- Better notifications
- Better offline downloads
- Better media controls

## User roles

### Guest

Removed from product. All users sign up as Listener or Creator.

### Free Listener

**Can:** listen, favourite, rate, review, mix (limited), playlists

### Premium Listener

Everything Free has, plus: downloads, premium collections, unlimited mixing, higher quality audio

### Creator

Upload/edit sounds, analytics, earnings, withdrawals, creator profile

### Admin

Manage everything (scoped by admin sub-role).

**Super Admin (platform owner):** `quoreebadebayo@gmail.com` — automatically receives `admin` + `super` and has the same access as all other admin roles combined (finance, content, support, settings). Admin is never selectable at signup.

## Creator levels

New Creator → Rising Creator → Verified Creator → Elite Creator

### Verification minimums

- 20 published sounds
- 5,000 plays
- Rating above 4.5
- Complete profile
- Identity verification
- No copyright strikes  
Admin reviews applications.

## Categories

- **Nature:** Rain, Storm, Ocean, Waterfall, River, Forest, Birds, Wind, Jungle
- **Sleep:** White Noise, Brown Noise, Pink Noise, Night Rain, Fireplace, Crickets
- **Meditation:** Guided, Breathing, Zen, Tibetan Bowl
- **Focus:** Coffee Shop, Keyboard, Library, Instrumental
- **Relaxation:** Piano, Guitar, Ambient, Spa
- **ASMR**
- **Children**
- **Reading**

## Home screen

Continue Listening · Recommended · Recently Played · Trending · New Sounds · Verified Creators · Featured Collections · Daily Relaxation Pick

## Search

By category, mood, tags, creator, duration, popularity, newest, rating

## Sound player

Artwork, title, creator, waveform, play/pause, forward/backward, sleep timer, speed, loop, favourite, share, download, mix, rate, comment

## Sound mixing (Premium / limited Free)

Combine tracks (Rain, Ocean, Birds, Thunder, etc.), independent volumes, save custom mixes

## Playlists

Create, rename, delete, share, favourite

## Downloads

Premium only — offline playback

## Sleep timer

10 / 20 / 30 / 45 min · 1h · 2h · Custom

## Ratings

1–5 stars + optional review · artists see averages

## Artist dashboard

Total plays, listening time, followers, ratings, downloads, revenue, withdrawals, top sound, monthly performance

## Earnings formula

Premium revenue forms the creator pool. Weighted by:

1. Total listening time (highest weight)
2. Unique listeners
3. Average rating
4. Favourites
5. Downloads by Premium users
6. Repeat listening

Verification may add a modest multiplier; engagement remains primary.

## Payment system (manual)

User pays → uploads proof → admin notified → checks bank → approve → Premium activated  
Each payment has a conversation (images, documents, messages, status updates).

Statuses: Pending · Approved · Rejected · Need More Info · Refunded

Plans: Monthly · Quarterly · Yearly · Lifetime

See [PAYMENT_DETAILS.md](./PAYMENT_DETAILS.md).

## Withdrawals

Creator requests → Finance Admin approves → money sent manually  
Statuses: Pending · Approved · Rejected · Paid

## Creator upload flow

Title, description, audio, cover, category, tags, duration → Admin review → Published

## Content moderation

Copyright, audio quality, category, metadata, safety

## Admin roles

| Role | Scope |
|------|--------|
| Super Admin | Everything |
| Finance Admin | Payments, subscriptions, withdrawals |
| Content Admin | Sound approval, categories, featured, reports |
| Support Admin | Chats, user support, appeals |

## Revenue model

- Premium subscriptions only

Creators earn only from the Premium subscription pool. No ads.

## Recommendation engine (no AI)

Listening history, favourites, categories, recent plays, highly rated, trending, optional time-of-day, similar listeners

## Development roadmap (summary)

1. Foundation  
2. Listener experience  
3. Premium features  
4. Creator platform  
5. Administration  
6. Content seeding + internal testing (store later)

## Guiding principle

Build mobile-first with a clean Supabase backend from day one so a web admin/creator dashboard can be added later without redesigning APIs.
