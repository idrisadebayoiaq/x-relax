import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { AudioOutputRoute } from './audioOutputTypes';
import { UNKNOWN_AUDIO_ROUTE, isPrivateListening, shouldShowHeadsetTip } from './audioOutputTypes';

export { isPrivateListening, shouldShowHeadsetTip };

/**
 * Audio output route detection — safe fallback until a stable native module ships.
 * Avoids loading expo-audio-route at startup (was causing splash hangs on some builds).
 */
export function useAudioOutputRoute(): AudioOutputRoute {
  const [route, setRoute] = useState<AudioOutputRoute>(UNKNOWN_AUDIO_ROUTE);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Future: plug in native headset detection here without blocking app boot.
    setRoute(UNKNOWN_AUDIO_ROUTE);
  }, []);

  return route;
}
