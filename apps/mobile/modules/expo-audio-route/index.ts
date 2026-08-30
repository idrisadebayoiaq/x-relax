import { EventEmitter, requireNativeModule } from 'expo-modules-core';

export type AudioOutputKind = 'speaker' | 'earpiece' | 'wired' | 'bluetooth' | 'unknown';

export type AudioOutputRoute = {
  kind: AudioOutputKind;
  name: string;
};

type NativeModule = {
  getCurrentRouteAsync: () => Promise<AudioOutputRoute>;
};

let nativeModule: NativeModule | null | undefined;

function getNativeModule(): NativeModule | null {
  if (nativeModule !== undefined) return nativeModule;
  try {
    nativeModule = requireNativeModule<NativeModule>('ExpoAudioRoute');
  } catch {
    nativeModule = null;
  }
  return nativeModule;
}

function getEmitter(): EventEmitter | null {
  const native = getNativeModule();
  if (!native) return null;
  return new EventEmitter(native);
}

export async function getCurrentAudioRoute(): Promise<AudioOutputRoute> {
  const native = getNativeModule();
  if (!native) return { kind: 'unknown', name: '' };
  try {
    return await native.getCurrentRouteAsync();
  } catch {
    return { kind: 'unknown', name: '' };
  }
}

export function addAudioRouteListener(listener: (route: AudioOutputRoute) => void) {
  const emitter = getEmitter();
  if (!emitter) {
    return { remove: () => undefined };
  }
  return emitter.addListener<AudioOutputRoute>('onAudioRouteChanged', listener);
}

export function isPrivateListeningRoute(route: AudioOutputRoute): boolean {
  return route.kind === 'wired' || route.kind === 'bluetooth' || route.kind === 'earpiece';
}
