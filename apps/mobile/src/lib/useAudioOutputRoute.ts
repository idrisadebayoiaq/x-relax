import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { AudioOutputRoute } from 'expo-audio-route';

const FALLBACK: AudioOutputRoute = { kind: 'unknown', name: '' };

async function loadRoute(): Promise<AudioOutputRoute> {
  if (Platform.OS === 'web') return FALLBACK;
  try {
    const mod = await import('expo-audio-route');
    return await mod.getCurrentAudioRoute();
  } catch {
    return FALLBACK;
  }
}

export function useAudioOutputRoute(): AudioOutputRoute {
  const [route, setRoute] = useState<AudioOutputRoute>(FALLBACK);

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
        const next = await loadRoute();
        if (active) setRoute(next);
      }
    })();

    return () => {
      active = false;
      sub?.remove();
    };
  }, []);

  return route;
}

export function isPrivateListening(route: AudioOutputRoute): boolean {
  return route.kind === 'wired' || route.kind === 'bluetooth' || route.kind === 'earpiece';
}

export function shouldShowHeadsetTip(route: AudioOutputRoute): boolean {
  return route.kind === 'speaker' || route.kind === 'unknown';
}
