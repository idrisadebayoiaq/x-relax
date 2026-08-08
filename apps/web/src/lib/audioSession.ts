/**
 * Best-effort exclusive playback on the web:
 * - Pause every other media element in this document
 * - Claim Media Session so the browser treats X-Relax as the active player
 * Browsers cannot force-stop Spotify/desktop apps; that requires native audio focus.
 */

let exclusiveAudio: HTMLAudioElement | null = null;

export function registerExclusiveAudio(audio: HTMLAudioElement | null) {
  exclusiveAudio = audio;
}

export function claimExclusiveWebPlayback(primary?: HTMLAudioElement | null) {
  const mine = primary ?? exclusiveAudio;
  if (typeof document === 'undefined') return;

  document.querySelectorAll('audio, video').forEach((el) => {
    const media = el as HTMLMediaElement;
    if (mine && media === mine) return;
    try {
      media.pause();
    } catch {
      /* ignore */
    }
  });

  if (navigator.mediaSession) {
    try {
      navigator.mediaSession.playbackState = 'playing';
    } catch {
      /* ignore */
    }
  }
}

/** After pause: mark session paused without releasing in a way that resumes others in-tab. */
export function releaseWebPlaybackToPaused() {
  if (navigator.mediaSession) {
    try {
      navigator.mediaSession.playbackState = 'paused';
    } catch {
      /* ignore */
    }
  }
}
