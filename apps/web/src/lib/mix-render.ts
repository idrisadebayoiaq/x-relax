export type MixRenderTrack = {
  url: string;
  volume: number;
};

function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const numChannels = channels.length;
  const length = channels[0].length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + length * blockAlign);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + length * blockAlign, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, length * blockAlign, true);

  let offset = 44;
  for (let i = 0; i < length; i += 1) {
    for (let ch = 0; ch < numChannels; ch += 1) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

type DecodedAudio = {
  sampleRate: number;
  channels: Float32Array[];
  length: number;
};

async function decodeWithWebAudio(url: string): Promise<DecodedAudio> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const channels: Float32Array[] = [];
    for (let i = 0; i < audio.numberOfChannels; i += 1) {
      channels.push(audio.getChannelData(i));
    }
    return { sampleRate: audio.sampleRate, channels, length: audio.length };
  } finally {
    await ctx.close();
  }
}

function resampleMix(
  decoded: DecodedAudio,
  targetRate: number,
  frameCount: number,
  volume: number,
  left: Float32Array,
  right: Float32Array,
) {
  const ch0 = decoded.channels[0];
  const ch1 = decoded.channels.length > 1 ? decoded.channels[1] : ch0;
  const ratio = decoded.sampleRate / targetRate;
  for (let i = 0; i < frameCount; i += 1) {
    const srcIdx = Math.floor(i * ratio) % decoded.length;
    left[i] += ch0[srcIdx] * volume;
    right[i] += ch1[srcIdx] * volume;
  }
}

/** Render layered tracks into one WAV file (browser). */
export async function renderMixToWav(
  tracks: MixRenderTrack[],
  durationSeconds: number,
): Promise<Blob> {
  const sampleRate = 44100;
  const frameCount = Math.max(1, Math.ceil(durationSeconds * sampleRate));
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);

  for (const track of tracks) {
    if (!track.url) continue;
    const decoded = await decodeWithWebAudio(track.url);
    const vol = Math.min(1, Math.max(0, track.volume));
    resampleMix(decoded, sampleRate, frameCount, vol, left, right);
  }

  for (let i = 0; i < frameCount; i += 1) {
    left[i] = Math.max(-1, Math.min(1, left[i]));
    right[i] = Math.max(-1, Math.min(1, right[i]));
  }

  const wav = encodeWav([left, right], sampleRate);
  return new Blob([wav], { type: 'audio/wav' });
}

export async function renderMixToArrayBuffer(
  tracks: MixRenderTrack[],
  durationSeconds: number,
): Promise<ArrayBuffer> {
  const blob = await renderMixToWav(tracks, durationSeconds);
  return blob.arrayBuffer();
}
