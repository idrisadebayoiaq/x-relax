import { createClient } from '@/lib/supabase/client';
import { buildCategoryRails } from '@/lib/category-rails';
import { buildPersonalizedRecommended, categoriesWithSounds } from '@/lib/recommendations';
import type { Category, Sound } from '@/types/database';

export type CatalogSection = {
  key: string;
  title: string;
  subtitle?: string;
  data: Sound[];
};

export async function loadHomeCatalog(userId?: string | null) {
  const supabase = createClient();
  const [
    { data: published, error: soundsErr },
    { data: history },
    { data: preferenceHistory },
    { data: dailySetting },
    { data: recommendedSetting },
    { data: categories },
    { data: categoryLinks },
  ] = await Promise.all([
    supabase.from('sounds').select('*').eq('status', 'published').order('created_at', { ascending: false }),
    userId
      ? supabase
          .from('listening_history')
          .select('sound_id, completed, sound:sounds(*)')
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
    supabase.from('app_settings').select('value').eq('key', 'daily_pick_sound_id').maybeSingle(),
    supabase.from('app_settings').select('value').eq('key', 'recommended_sound_ids').maybeSingle(),
    supabase.from('categories').select('*').is('parent_id', null).order('sort_order').limit(40),
    supabase.from('sound_categories').select('sound_id, category_id'),
  ]);

  if (soundsErr) throw new Error(soundsErr.message);

  const all = (published as Sound[]) ?? [];
  const cats = (categories as Category[]) ?? [];
  const links = (categoryLinks as { sound_id: string; category_id: string }[]) ?? [];
  const dailyPickId = String(dailySetting?.value ?? '').replace(/^"|"$/g, '');
  const recommendedIds: string[] = Array.isArray(recommendedSetting?.value)
    ? (recommendedSetting.value as string[])
    : [];

  const continueListening = ((history as { completed?: boolean; sound?: Sound }[]) ?? [])
    .filter((h) => !h.completed && h.sound)
    .map((h) => h.sound as Sound);

  const recentHistorySoundIds = [
    ...new Set(
      ((preferenceHistory as { sound_id: string }[]) ?? [])
        .map((h) => h.sound_id)
        .filter(Boolean),
    ),
  ];

  const trending = [...all].sort((a, b) => b.play_count - a.play_count).slice(0, 12);
  const featured = all.filter((s) => s.is_featured);
  const recommended = buildPersonalizedRecommended({
    all,
    categoryLinks: links,
    recentHistorySoundIds,
    adminRecommendedIds: recommendedIds,
    limit: 12,
  });

  const publishedIds = new Set(all.map((s) => s.id));
  const visibleCategories = categoriesWithSounds(cats, links, publishedIds);
  const categoryRails = buildCategoryRails({
    categories: visibleCategories,
    categoryLinks: links,
    sounds: all,
    limitPerCategory: 12,
  });

  const daily =
    (dailyPickId ? all.find((s) => s.id === dailyPickId) : undefined) ??
    featured[0] ??
    trending[0] ??
    all[0] ??
    null;

  const sections: CatalogSection[] = [
    {
      key: 'continue',
      title: 'Continue listening',
      subtitle: 'Pick up where you left off',
      data: continueListening,
    },
    { key: 'featured', title: 'Featured for you', subtitle: 'Curated calm', data: featured.slice(0, 12) },
    {
      key: 'recommended',
      title: 'Recommended',
      subtitle: recentHistorySoundIds.length
        ? 'Based on what you listen to most'
        : 'Picks to start your calm library',
      data: recommended,
    },
    { key: 'trending', title: 'Trending now', data: trending },
    ...categoryRails,
  ].filter((s) => s.data.length > 0);

  return { all, daily, sections, categories: visibleCategories };
}
