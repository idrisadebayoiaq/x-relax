'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Heart, Plus, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { usePlayer } from '@/lib/player-context';
import type { Sound } from '@/types/database';
import { appAlert } from '@/components/AppDialog';

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
  const { toggleFavourite, isFavourite } = usePlayer();
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
    if (!user) return appAlert('Sign in to rate sounds.');
    if (myScore < 1) return appAlert('Choose a star rating first.');
    setBusy(true);
    const supabase = createClient();
    const { error: ratingError } = await supabase.from('ratings').upsert(
      {
        user_id: user.id,
        sound_id: sound.id,
        score: myScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,sound_id' },
    );
    if (ratingError) {
      setBusy(false);
      return appAlert(ratingError.message);
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
        return appAlert(reviewError.message);
      }
    }

    setBusy(false);
    await load();
    appAlert('Your rating was saved.');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => void toggleFavourite()}
          className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${
            isFavourite ? 'bg-foreground/5' : ''
          }`}
        >
          <Heart
            size={20}
            className={isFavourite ? 'fill-red-500 text-red-500' : 'text-foreground'}
          />
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-sm">
              {isFavourite ? 'Liked' : 'Like this sound'}
            </span>
            <span className="block text-xs text-muted">
              Saves to Favourites and shapes Recommended
            </span>
          </span>
          {isFavourite ? (
            <Check size={18} className="text-red-500" />
          ) : (
            <Plus size={18} className="text-muted" />
          )}
        </button>

        <div className="border-t border-border px-4 py-4 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted mb-1">Community rating</p>
            <div className="flex items-center gap-3">
              <p className="text-4xl font-serif font-bold">{count ? avg.toFixed(1) : '—'}</p>
              <div className="flex gap-0.5 text-amber-400" aria-hidden>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={14}
                    className={count && avg >= s - 0.25 ? 'fill-amber-400' : 'opacity-25'}
                  />
                ))}
              </div>
            </div>
            <p className="text-sm text-muted mt-1">
              {count
                ? `${count} rating${count === 1 ? '' : 's'}`
                : 'No ratings yet — be the first'}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted mb-2">Your rating</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="text-amber-400 p-0.5"
                  onClick={() => setMyScore(s)}
                  aria-label={`${s} stars`}
                >
                  <Star
                    size={28}
                    className={myScore >= s ? 'fill-amber-400' : 'opacity-35'}
                  />
                </button>
              ))}
            </div>
          </div>

          <textarea
            className="input min-h-[80px]"
            placeholder="Add a short review (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={busy || myScore < 1}
            onClick={() => void submit()}
          >
            {busy ? 'Saving…' : comment.trim() ? 'Save rating & review' : 'Save rating'}
          </button>
        </div>
      </div>

      {reviews.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted">Reviews</p>
          {reviews.map((row) => (
            <div key={row.id} className="rounded-xl border border-border p-3 space-y-1">
              <div className="flex justify-between gap-2 text-sm">
                <p className="font-semibold">{row.profile?.display_name ?? 'Listener'}</p>
                <p className="text-amber-400 text-xs">
                  {row.score ? '★'.repeat(row.score) : ''}
                </p>
              </div>
              <p className="text-sm">{row.body}</p>
              <p className="text-xs text-muted">{new Date(row.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
