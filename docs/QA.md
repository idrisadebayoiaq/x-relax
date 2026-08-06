# Internal QA checklist (Phase 6)

Run on Android emulator or physical device. Use a Free listener, Premium listener, Creator, and Super Admin accounts.

## Auth

- [ ] Sign up as Listener
- [ ] Sign up as Creator
- [ ] Welcome modal appears on Home after signup
- [ ] Welcome row visible under Profile → Notifications
- [ ] Sign up as `quoreebadebayo@gmail.com` → Super Admin (`profiles.role = admin`, `admin_profiles.role = super`)
- [ ] Sign in / sign out
- [ ] Password reset email flow
- [ ] Cannot browse as guest / anonymous

## Player & library

- [ ] Home sections load published sounds
- [ ] Category chips filter correctly
- [ ] Search + sort (newest / popular / rating)
- [ ] Play, pause, seek, speed, loop, sleep timer
- [ ] Favourite / unfavourite
- [ ] Rate 1–5
- [ ] Add to playlist; open playlist detail
- [ ] Listening history updates
- [ ] Share sheet opens

## Premium

- [ ] Free user sees plans + payment instructions
- [ ] Upload payment proof → pending request
- [ ] Admin approves → Premium active
- [ ] Admin rejects / needs more info paths
- [ ] Premium Pass: 5 test ads → 24h access (1/day)
- [ ] Downloads appear offline in Library (Premium)
- [ ] Mix studio: Free limited; Premium can save
- [ ] Test ad banner only for Free listeners
- [ ] No ads for Premium / Creator / Admin

## Creator

- [ ] Become creator (if Listener)
- [ ] Upload sound → pending
- [ ] Admin publish / reject with reason
- [ ] Creator notifications for outcomes
- [ ] Analytics dashboard numbers update
- [ ] Verification apply + document upload
- [ ] Withdrawal request after earnings

## Admin web (`admin-web`)

- [ ] Non-admin redirected / blocked
- [ ] Super Admin signs in at `http://localhost:3000`
- [ ] Overview counts look sane
- [ ] Payments queue + detail + chat + proof
- [ ] Moderation publish/reject
- [ ] Verifications queue
- [ ] Withdrawals + run earnings
- [ ] Reports resolve
- [ ] Support reply / close
- [ ] Featured + Daily Pick
- [ ] Announcements broadcast (in-app + FCM)
- [ ] Settings / plans edit
- [ ] Audit log entries appear after actions

## Push (FCM)

- [ ] Preview/dev APK installed (not Expo Go)
- [ ] Sign-in registers device token (`device_push_tokens`)
- [ ] Admin announcement appears as system notification
- [ ] Profile → Notifications shows in-app copy

## Security smoke

- [ ] User A cannot read User B payment proofs
- [ ] Non-admin cannot call admin RPCs successfully
- [ ] Storage buckets respect RLS (proofs, artist docs private)

## Content quality (after real library)

- [ ] Titles/covers consistent
- [ ] Audio levels acceptable
- [ ] Search finds expected titles/tags
- [ ] Featured / Daily Pick reflect intent

## Build / distribute

- [ ] `eas build` (or local) produces installable APK
- [ ] Testers can sideload and sign in
- [ ] Feedback logged and prioritized
