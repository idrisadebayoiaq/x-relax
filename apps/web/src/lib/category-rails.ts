import type { Sound } from '@/types/database';

export type CategoryRail = {
  key: string;
  title: string;
  subtitle?: string;
  data: Sound[];
};

const CATEGORY_SUBTITLES: Record<string, string> = {
  nature: 'Forest, birds, water, and open air',
  sleep: 'Soft night sounds for deeper rest',
  bell: 'Temple bells and chimes for focus and wind-down',
  focus: 'Steady tones for clear work sessions',
  relaxation: 'Unclench and slow your breathing',
  asmr: 'Close, textured sounds for calm attention',
  children: 'Gentle sounds for little listeners',
  reading: 'Quiet beds for pages and study',
  healing: 'Singing bowls and sound baths for deep rest',
  birds: 'Morning chorus and meadow song',
  fireplace: 'Crackling warmth for evening wind-down',
  forest: 'Canopy walks and woodland calm',
  meditation: 'Still tones for sitting practice',
  mixes: 'Layered nature blends',
  ocean: 'Waves and shoreline hush',
  rain: 'Rainfall for sleep and soft focus',
  rivers: 'Flowing water for gentle focus',
  thunder: 'Distant storms for deep release',
  wind: 'Air and breeze for open space',
};

/** Group published sounds into home rails. Pass onlySlugs to limit which category rails appear. */
export function buildCategoryRails(opts: {
  categories: { id: string; name: string; slug: string; sort_order?: number | null }[];
  categoryLinks: { sound_id: string; category_id: string }[];
  sounds: Sound[];
  limitPerCategory?: number;
  onlySlugs?: string[];
}): CategoryRail[] {
  const { categories, categoryLinks, sounds, limitPerCategory = 12, onlySlugs } = opts;
  const allow = onlySlugs?.length ? new Set(onlySlugs) : null;
  const byId = new Map(sounds.map((s) => [s.id, s]));
  const byCat = new Map<string, Sound[]>();

  for (const row of categoryLinks) {
    const sound = byId.get(row.sound_id);
    if (!sound) continue;
    const list = byCat.get(row.category_id) ?? [];
    if (!list.some((s) => s.id === sound.id)) list.push(sound);
    byCat.set(row.category_id, list);
  }

  return [...categories]
    .filter((cat) => !allow || allow.has(cat.slug))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((cat) => {
      const data = [...(byCat.get(cat.id) ?? [])]
        .sort((a, b) => b.play_count - a.play_count)
        .slice(0, limitPerCategory);
      return {
        key: `cat-${cat.slug}`,
        title: cat.name,
        subtitle: CATEGORY_SUBTITLES[cat.slug],
        data,
      };
    })
    .filter((rail) => rail.data.length > 0);
}
