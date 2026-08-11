import { createClient } from '@/lib/supabase/client';
import { buildCategoryRails } from '@/lib/category-rails';
import {
  buildNewReleasesFromFollows,
  buildPersonalizedRecommended,
  categoriesWithSounds,
  followCountryBias,
} from '@/lib/recommendations';
import type { Category, Sound } from '@/types/database';

export type CatalogSection = {
  key: string;
  title: string;
  subtitle?: string;
  data: Sound[];
};

export type ContinueItem = {
  sound: Sound;
  progressSeconds: number;
};

export async function loadHomeCatalog(userId?: string | null) {
  const supabase = createClient();
  const [
    { data: published, error: soundsErr },
    { data: history },
    { data: preferenceHistory },
    { data: favourites },
    { data: recommendedSetting },
    { data: categories },
    { data: categoryLinks },
    { data: follows },
  ] = await Promise.all([
    supabase.from('sounds').select('*').eq('status', 'published').order('created_at', { ascending: false }),
    userId
      ? supabase
          .from('listening_history')
          .select('sound_id, progress_seconds, completed, sound:sounds(*)')
          .eq('user_id', userId)
          .order('played_at', { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] as unknown[] }),
    userId
      ? supabase
          .from('listening_history')
          .select('sound_id')
          .eq('user_id', userId)
          .order('played_at', { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [] as unknown[] }),
    userId
      ? supabase
          .from('favourites')
          .select('sound_id, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [] as { sound_id: string }[] }),
    supabase.from('app_settings').select('value').eq('key', 'recommended_sound_ids').maybeSingle(),
    supabase.from('categories').select('*').is('parent_id', null).order('sort_order').limit(40),
    supabase.from('sound_categories').select('sound_id, category_id'),
    userId
      ? supabase.from('creator_follows').select('creator_id').eq('follower_id', userId)
      : Promise.resolve({ data: [] as { creator_id: string }[] }),
  ]);

  if (soundsErr) throw new Error(soundsErr.message);

  const all = (published as Sound[]) ?? [];
  const cats = (categories as Category[]) ?? [];
  const links = (categoryLinks as { sound_id: string; category_id: string }[]) ?? [];
  const recommendedIds: string[] = Array.isArray(recommendedSetting?.value)
    ? (recommendedSetting.value as string[])
    : [];

  const continueListening: ContinueItem[] = ((history as { completed?: boolean; sound?: Sound; progress_seconds?: number }[]) ?? [])
    .filter((h) => !h.completed && h.sound)
    .map((h) => ({
      sound: h.sound as Sound,
      progressSeconds: Number(h.progress_seconds ?? 0),
    }));

  const recentHistorySoundIds = [
    ...new Set(
      ((preferenceHistory as { sound_id: string }[]) ?? [])
        .map((h) => h.sound_id)
        .filter(Boolean),
    ),
  ];
  const likedSoundIds = [
    ...new Set(
      ((favourites as { sound_id: string }[]) ?? []).map((f) => f.sound_id).filter(Boolean),
    ),
  ];
  const followedCreatorIds = [
    ...new Set(
      ((follows as { creator_id: string }[]) ?? []).map((f) => f.creator_id).filter(Boolean),
    ),
  ];

  const creatorIds = [
    ...new Set(
      all.map((s) => s.creator_id).filter(Boolean).concat(followedCreatorIds) as string[],
    ),
  ];
  const creatorCountries: Record<string, string | null> = {};
  if (creatorIds.length) {
    const { data: creatorProfiles } = await supabase
      .from('profiles')
      .select('id, country_code')
      .in('id', creatorIds);
    for (const row of (creatorProfiles as { id: string; country_code: string | null }[]) ?? []) {
      creatorCountries[row.id] = row.country_code;
    }
  }
  const bias = followCountryBias(followedCreatorIds.map((id) => creatorCountries[id]));

  const trending = [...all].sort((a, b) => b.play_count - a.play_count).slice(0, 12);
  const featured = all.filter((s) => s.is_featured);
  const recommended = buildPersonalizedRecommended({
    all,
    categoryLinks: links,
    recentHistorySoundIds,
    likedSoundIds,
    adminRecommendedIds: recommendedIds,
    creatorCountries,
    followBias: bias,
    limit: 12,
  });
  const newReleases = buildNewReleasesFromFollows({
    all,
    followedCreatorIds,
    limit: 12,
  });

  const publishedIds = new Set(all.map((s) => s.id));
  const visibleCategories = categoriesWithSounds(cats, links, publishedIds);
  const categoryRails = buildCategoryRails({
    categories: visibleCategories,
    categoryLinks: links,
    sounds: all,
    limitPerCategory: 12,
    onlySlugs: ['mixes'],
  });

  const recommendedSubtitle = bias
    ? bias === 'NG'
      ? 'Weighted toward creators you follow in Nigeria'
      : 'Weighted toward creators you follow internationally'
    : likedSoundIds.length
      ? recentHistorySoundIds.length
        ? 'Based on likes and listening'
        : 'Based on sounds you like'
      : recentHistorySoundIds.length
        ? 'Based on what you listen to most'
        : 'Picks to start your calm library';

  const sections: CatalogSection[] = [
    {
      key: 'new_releases',
      title: 'New Release',
      subtitle: 'From creators you follow',
      data: newReleases,
    },
    {
      key: 'continue',
      title: 'Continue listening',
      subtitle: 'Pick up where you left off',
      data: continueListening.map((c) => c.sound),
    },
    { key: 'featured', title: 'Featured for you', subtitle: 'Curated calm', data: featured.slice(0, 12) },
    {
      key: 'recommended',
      title: 'Recommended',
      subtitle: recommendedSubtitle,
      data: recommended,
    },
    { key: 'trending', title: 'Trending now', data: trending },
    ...categoryRails,
  ].filter((s) => s.data.length > 0);

  return { all, sections, categories: visibleCategories, continueListening };
}
