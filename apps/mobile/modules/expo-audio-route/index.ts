import { EventEmitter, requireNativeModule } from 'expo-modules-core';

export type AudioOutputKind = 'speaker' | 'earpiece' | 'wired' | 'bluetooth' | 'unknown';

export type AudioOutputRoute = {
  kind: AudioOutputKind;
  name: string;
};

type NativeModule = {
  getCurrentRouteAsync: () => Promise<AudioOutputRoute>;
};

const Native = requireNativeModule<NativeModule>('ExpoAudioRoute');
const emitter = new EventEmitter(Native);

export async function getCurrentAudioRoute(): Promise<AudioOutputRoute> {
  return Native.getCurrentRouteAsync();
}

export function addAudioRouteListener(listener: (route: AudioOutputRoute) => void) {
  return emitter.addListener<AudioOutputRoute>('onAudioRouteChanged', listener);
}

export function isPrivateListeningRoute(route: AudioOutputRoute): boolean {
  return route.kind === 'wired' || route.kind === 'bluetooth' || route.kind === 'earpiece';
}
