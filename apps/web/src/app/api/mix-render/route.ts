import { NextResponse } from 'next/server';
import { renderMixToArrayBuffer, type MixRenderTrack } from '@/lib/mix-render';

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      tracks?: MixRenderTrack[];
      durationSeconds?: number;
    };
    const tracks = Array.isArray(body.tracks) ? body.tracks : [];
    const durationSeconds = Number(body.durationSeconds ?? 0);
    if (!tracks.length || durationSeconds <= 0 || durationSeconds > 600) {
      return NextResponse.json({ error: 'Invalid mix render request' }, { status: 400 });
    }
    const wav = await renderMixToArrayBuffer(tracks, durationSeconds);
    return new NextResponse(wav, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Mix render failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
