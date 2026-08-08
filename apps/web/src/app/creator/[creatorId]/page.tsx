'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Users } from 'lucide-react';
import { CoverArt } from '@/components/CoverArt';
import { SoundCard } from '@/components/SoundCard';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { createClient } from '@/lib/supabase/client';
import { moodPaletteFor } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import { usePlayer } from '@/lib/player-context';
import type { Sound } from '@/types/database';

type CreatorPublicProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  is_verified: boolean;
  country_code: string | null;
  follower_count: number;
  monthly_listeners: number;
  is_following: boolean;
};

function formatStatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.floor(n));
}

export default function CreatorPublicProfilePage() {
  const { creatorId } = useParams<{ creatorId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { playSound } = usePlayer();
  const bannerRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<CreatorPublicProfile | null>(null);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);

  const isOwnProfile = !!user && user.id === creatorId;

  const loadProfile = useCallback(async () => {
    if (!creatorId) return;
    const supabase = createClient();
    const [{ data: profileData }, { data: soundRows }] = await Promise.all([
      supabase.rpc('get_creator_public_profile', { p_creator_id: creatorId }),
      supabase
        .from('sounds')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('status', 'published')
        .order('created_at', { ascending: false }),
    ]);
    setProfile((profileData as CreatorPublicProfile | null) ?? null);
    setSounds((soundRows as Sound[]) ?? []);
    setLoading(false);
  }, [creatorId]);

  useEffect(() => {
    setLoading(true);
    void loadProfile();
  }, [loadProfile]);

  const toggleFollow = async () => {
    if (!profile || !creatorId) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.id === creatorId) return;

    setFollowBusy(true);
    const supabase = createClient();
    if (profile.is_following) {
      await supabase
        .from('creator_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('creator_id', creatorId);
    } else {
      await supabase.from('creator_follows').insert({
        follower_id: user.id,
        creator_id: creatorId,
      });
    }
    await loadProfile();
    setFollowBusy(false);
  };

  const uploadBanner = async (file: File | null) => {
    if (!file || !user || !isOwnProfile) return;
    setBannerBusy(true);
    const supabase = createClient();
    const rawExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const ext = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';
    const path = `${user.id}/banners/banner-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('covers').upload(path, file, {
      upsert: true,
      contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      cacheControl: '3600',
    });
    if (uploadError) {
      setBannerBusy(false);
      alert(uploadError.message);
      return;
    }
    const { data: pub } = supabase.storage.from('covers').getPublicUrl(path);
    const bannerUrl = `${pub.publicUrl}?v=${Date.now()}`;
    const { error: updateError } = await supabase
      .from('creator_profiles')
      .update({ banner_url: bannerUrl, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    setBannerBusy(false);
    if (updateError) {
      alert(updateError.message);
      return;
    }
    await loadProfile();
  };

  const openSound = async (sound: Sound) => {
    const index = sounds.findIndex((s) => s.id === sound.id);
    const started = await playSound(sound, {
      queue: sounds,
      queueIndex: index >= 0 ? index : 0,
      queueLabel: profile?.display_name ?? 'Creator',
    });
    if (started) router.push('/player');
  };

  if (loading) {
    return <p className="text-muted max-w-4xl mx-auto">Loading creator…</p>;
  }

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-4 py-16">
        <h1 className="text-3xl font-serif font-bold">Creator not found</h1>
        <p className="text-muted">This profile is unavailable or has no public content yet.</p>
        <Link href="/" className="btn btn-primary inline-block">
          Browse sounds
        </Link>
      </div>
    );
  }

  const displayName = profile.display_name?.trim() || 'Creator';
  const [bannerA, bannerB] = moodPaletteFor(displayName);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <Link href="/" className="text-sm text-muted underline">
        ← Home
      </Link>

      <div className="card overflow-hidden p-0">
        <div className="relative h-36 sm:h-44">
          {profile.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.banner_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: `linear-gradient(135deg, ${bannerA}, ${bannerB})` }}
            />
          )}
          {isOwnProfile ? (
            <>
              <button
                type="button"
                className="absolute top-3 right-3 btn btn-outline text-xs py-1.5 px-3 inline-flex items-center gap-1.5 bg-background/80 backdrop-blur-sm"
                disabled={bannerBusy}
                onClick={() => bannerRef.current?.click()}
              >
                <Camera size={14} />
                {bannerBusy ? 'Uploading…' : 'Edit banner'}
              </button>
              <input
                ref={bannerRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void uploadBanner(e.target.files?.[0] ?? null)}
              />
            </>
          ) : null}
        </div>

        <div className="px-4 sm:px-6 pb-5 -mt-10 relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="rounded-full border-4 border-surface bg-surface shrink-0 self-start">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover"
                />
              ) : (
                <CoverArt title={displayName} uri={null} size={96} rounded={48} />
              )}
            </div>

            <div className="flex-1 min-w-0 pt-1 sm:pt-0 sm:pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-serif font-bold">{displayName}</h1>
                {profile.is_verified ? <VerifiedBadge tone="blue" size={20} /> : null}
              </div>
              {profile.bio?.trim() ? (
                <p className="text-muted mt-2 text-sm sm:text-base max-w-2xl">{profile.bio.trim()}</p>
              ) : null}
              <div className="flex flex-wrap gap-3 mt-3 text-sm">
                <span className="chip inline-flex items-center gap-1.5">
                  <Users size={14} />
                  {formatStatCount(profile.monthly_listeners)} monthly listeners
                </span>
                <span className="chip">
                  {formatStatCount(profile.follower_count)} follower
                  {profile.follower_count === 1 ? '' : 's'}
                </span>
                {profile.country_code ? (
                  <span className="chip text-muted">{profile.country_code}</span>
                ) : null}
              </div>
            </div>

            {!isOwnProfile ? (
              <button
                type="button"
                className={`btn shrink-0 ${profile.is_following ? 'btn-outline' : 'btn-primary'}`}
                disabled={followBusy}
                onClick={() => void toggleFollow()}
              >
                {followBusy ? '…' : profile.is_following ? 'Following' : 'Follow'}
              </button>
            ) : (
              <Link href="/creator" className="btn btn-outline shrink-0">
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-serif font-bold">Published sounds</h2>
          <p className="text-sm text-muted mt-1">
            {sounds.length} track{sounds.length === 1 ? '' : 's'}
          </p>
        </div>

        {sounds.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-5">
            {sounds.map((sound) => (
              <SoundCard
                key={sound.id}
                sound={sound}
                compact
                onPlay={() => void openSound(sound)}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted card p-6 text-center">No published sounds yet.</p>
        )}
      </section>
    </div>
  );
}
