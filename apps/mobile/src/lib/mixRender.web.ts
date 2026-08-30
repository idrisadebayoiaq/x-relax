/** Web-only mix render (re-exported logic for Expo web). */
export type MixRenderTrack = { url: string; volume: number };

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

export async function renderMixToArrayBuffer(
  tracks: MixRenderTrack[],
  durationSeconds: number,
): Promise<ArrayBuffer> {
  const sampleRate = 44100;
  const frameCount = Math.max(1, Math.ceil(durationSeconds * sampleRate));
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  const ctx = new AudioContext();
  try {
    for (const track of tracks) {
      const res = await fetch(track.url);
      const buf = await res.arrayBuffer();
      const audio = await ctx.decodeAudioData(buf.slice(0));
      const vol = Math.min(1, Math.max(0, track.volume));
      const ch0 = audio.getChannelData(0);
      const ch1 = audio.numberOfChannels > 1 ? audio.getChannelData(1) : ch0;
      for (let i = 0; i < frameCount; i += 1) {
        const idx = i % audio.length;
        left[i] += ch0[idx] * vol;
        right[i] += ch1[idx] * vol;
      }
    }
  } finally {
    await ctx.close();
  }
  for (let i = 0; i < frameCount; i += 1) {
    left[i] = Math.max(-1, Math.min(1, left[i]));
    right[i] = Math.max(-1, Math.min(1, right[i]));
  }
  return encodeWav([left, right], sampleRate);
}
