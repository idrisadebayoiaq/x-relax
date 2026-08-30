import type { AudioPlayer } from 'expo-audio';

/** Fully stop and detach an expo-audio player instance. */
export function releaseAudioPlayer(
  player: AudioPlayer | null | undefined,
  statusSub?: { remove: () => void } | null,
) {
  if (!player) return;
  try {
    statusSub?.remove();
  } catch {
    /* ignore */
  }
  try {
    player.clearLockScreenControls();
  } catch {
    /* ignore */
  }
  try {
    if (player.playing) player.pause();
  } catch {
    /* ignore */
  }
  try {
    player.remove();
  } catch {
    /* ignore */
  }
}
