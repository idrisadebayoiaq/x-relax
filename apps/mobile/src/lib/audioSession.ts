import { setAudioModeAsync } from 'expo-audio';

/**
 * Exclusive playback: take audio focus from other apps (Spotify, etc.).
 * Re-assert on play AND after pause so Android does not hand focus back
 * and auto-resume the previous app.
 */
export async function claimExclusiveAudioFocus() {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
      shouldRouteThroughEarpiece: false,
      allowsRecording: false,
    });
  } catch {
    /* ignore */
  }
}
