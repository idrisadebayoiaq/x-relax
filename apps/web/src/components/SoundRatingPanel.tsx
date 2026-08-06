'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { Sound } from '@/types/database';

type ReviewRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profile?: { display_name: string | null } | null;
  score?: number | null;
};

export function SoundRatingPanel({
  sound,
  onSoundUpdated,
}: {
  sound: Sound;
  onSoundUpdated?: (next: Pick<Sound, 'average_rating' | 'rating_count'>) => void;
}) {
  const { user } = useAuth();
  const [myScore, setMyScore] = useState(0);
  const [comment, setComment] = useState('');
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [avg, setAvg] = useState(Number(sound.average_rating ?? 0));
  const [count, setCount] = useState(Number(sound.rating_count ?? 0));

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: rating }, { data: myReview }, { data: reviewRows }, { data: fresh }] =
      await Promise.all([
        user
          ? supabase
              .from('ratings')
              .select('score')
              .eq('user_id', user.id)
              .eq('sound_id', sound.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        user
          ? supabase
              .from('reviews')
              .select('body')
              .eq('user_id', user.id)
              .eq('sound_id', sound.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('reviews')
          .select('id, body, created_at, user_id, profile:profiles(display_name)')
          .eq('sound_id', sound.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('sounds')
          .select('average_rating, rating_count')
          .eq('id', sound.id)
          .maybeSingle(),
      ]);

    setMyScore(Number((rating as { score?: number } | null)?.score ?? 0));
    setComment((myReview as { body?: string } | null)?.body ?? '');

    if (fresh) {
      const nextAvg = Number(fresh.average_rating ?? 0);
      const nextCount = Number(fresh.rating_count ?? 0);
      setAvg(nextAvg);
      setCount(nextCount);
      onSoundUpdated?.({ average_rating: nextAvg, rating_count: nextCount });
    }

    const normalized = ((reviewRows ?? []) as unknown as ReviewRow[]).map((row) => ({
      ...row,
      profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
    }));

    if (normalized.length) {
      const { data: scores } = await supabase
        .from('ratings')
        .select('user_id, score')
        .eq('sound_id', sound.id)
        .in(
          'user_id',
          normalized.map((r) => r.user_id),
        );
      const scoreMap = new Map(
        ((scores as { user_id: string; score: number }[]) ?? []).map((s) => [s.user_id, s.score]),
      );
      setReviews(normalized.map((r) => ({ ...r, score: scoreMap.get(r.user_id) ?? null })));
    } else {
      setReviews([]);
    }
  }, [sound.id, user?.id, onSoundUpdated]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!user) return alert('Sign in to rate sounds.');
    if (myScore < 1) return alert('Choose a star rating first.');
    setBusy(true);
    const supabase = createClient();
    const { error: ratingError } = await supabase.from('ratings').upsert({
      user_id: user.id,
      sound_id: sound.id,
      score: myScore,
      updated_at: new Date().toISOString(),
    });
    if (ratingError) {
      setBusy(false);
      return alert(ratingError.message);
    }

    const trimmed = comment.trim();
    if (trimmed) {
      const { error: reviewError } = await supabase.from('reviews').upsert(
        {
          user_id: user.id,
          sound_id: sound.id,
          body: trimmed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,sound_id' },
      );
      if (reviewError) {
        setBusy(false);
        return alert(reviewError.message);
      }
    }

    setBusy(false);
    await load();
    alert('Thanks for your review!');
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center gap-4">
        <div>
          <p className="text-3xl font-bold">{count ? avg.toFixed(1) : '—'}</p>
          <p className="text-sm text-muted">
            {count ? `${count} rating${count === 1 ? '' : 's'}` : 'No ratings yet'}
          </p>
        </div>
        <div className="flex gap-1 text-xl" aria-hidden>
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} className={avg >= s - 0.25 ? '' : 'opacity-25'}>
              ★
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted">Your rating & review</p>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${myScore === s ? 'chip-active' : ''}`}
              onClick={() => setMyScore(s)}
            >
              {'★'.repeat(s)}
            </button>
          ))}
        </div>
        <textarea
          className="input min-h-[90px]"
          placeholder="Write a review (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Saving…' : 'Submit review'}
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wider text-muted">Reviews</p>
        {reviews.map((row) => (
          <div key={row.id} className="card p-3 space-y-1">
            <div className="flex justify-between gap-2 text-sm">
              <p className="font-semibold">{row.profile?.display_name ?? 'Listener'}</p>
              <p className="text-muted">{row.score ? '★'.repeat(row.score) : ''}</p>
            </div>
            <p className="text-sm">{row.body}</p>
            <p className="text-xs text-muted">{new Date(row.created_at).toLocaleDateString()}</p>
          </div>
        ))}
        {!reviews.length ? <p className="text-sm text-muted">Be the first to leave a review.</p> : null}
      </div>
    </div>
  );
}
