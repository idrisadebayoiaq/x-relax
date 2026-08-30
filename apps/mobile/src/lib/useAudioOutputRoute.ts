import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { AudioOutputRoute } from './audioOutputTypes';
import { UNKNOWN_AUDIO_ROUTE, isPrivateListening, shouldShowHeadsetTip } from './audioOutputTypes';

export { isPrivateListening, shouldShowHeadsetTip };

export function useAudioOutputRoute(): AudioOutputRoute {
  const [route, setRoute] = useState<AudioOutputRoute>(UNKNOWN_AUDIO_ROUTE);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let active = true;
    let sub: { remove: () => void } | null = null;

    (async () => {
      try {
        const mod = await import('expo-audio-route');
        const next = await mod.getCurrentAudioRoute();
        if (active) setRoute(next);
        sub = mod.addAudioRouteListener((updated) => {
          if (active) setRoute(updated);
        });
      } catch {
        if (active) setRoute(UNKNOWN_AUDIO_ROUTE);
      }
    })();

    return () => {
      active = false;
      sub?.remove();
    };
  }, []);

  return route;
}
