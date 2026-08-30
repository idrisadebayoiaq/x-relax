export type AudioOutputKind = 'speaker' | 'earpiece' | 'wired' | 'bluetooth' | 'unknown';

export type AudioOutputRoute = {
  kind: AudioOutputKind;
  name: string;
};

export const UNKNOWN_AUDIO_ROUTE: AudioOutputRoute = { kind: 'unknown', name: '' };

export function isPrivateListening(route: AudioOutputRoute): boolean {
  return route.kind === 'wired' || route.kind === 'bluetooth' || route.kind === 'earpiece';
}

export function shouldShowHeadsetTip(route: AudioOutputRoute): boolean {
  return route.kind === 'speaker' || route.kind === 'unknown';
}
