import type { Sound } from '../types/database';

/** Build Recommended from what the user listens to most (by category), with admin fallback. */
export function buildPersonalizedRecommended(opts: {
  all: Sound[];
  categoryLinks: { sound_id: string; category_id: string }[];
  recentHistorySoundIds: string[];
  adminRecommendedIds: string[];
  limit?: number;
}): Sound[] {
  const { all, categoryLinks, recentHistorySoundIds, adminRecommendedIds, limit = 12 } = opts;
  const byId = new Map(all.map((s) => [s.id, s]));
  const catsBySound = new Map<string, string[]>();
  const soundsByCat = new Map<string, string[]>();

  for (const row of categoryLinks) {
    const list = catsBySound.get(row.sound_id) ?? [];
    list.push(row.category_id);
    catsBySound.set(row.sound_id, list);
    const sounds = soundsByCat.get(row.category_id) ?? [];
    sounds.push(row.sound_id);
    soundsByCat.set(row.category_id, sounds);
  }

  const catScore = new Map<string, number>();
  recentHistorySoundIds.forEach((soundId, index) => {
    const weight = recentHistorySoundIds.length - index;
    for (const catId of catsBySound.get(soundId) ?? []) {
      catScore.set(catId, (catScore.get(catId) ?? 0) + weight);
    }
  });

  const heard = new Set(recentHistorySoundIds);
  const picked: Sound[] = [];
  const pickedIds = new Set<string>();

  const push = (id: string) => {
    if (pickedIds.has(id) || heard.has(id)) return;
    const sound = byId.get(id);
    if (!sound) return;
    pickedIds.add(id);
    picked.push(sound);
  };

  const rankedCats = [...catScore.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

  for (const catId of rankedCats) {
    if (picked.length >= limit) break;
    const candidates = [...(soundsByCat.get(catId) ?? [])]
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => (b!.play_count ?? 0) - (a!.play_count ?? 0)) as Sound[];
    for (const sound of candidates) {
      if (picked.length >= limit) break;
      push(sound.id);
    }
  }

  for (const id of adminRecommendedIds) {
    if (picked.length >= limit) break;
    push(id);
  }

  if (picked.length < limit) {
    const trending = [...all].sort((a, b) => b.play_count - a.play_count);
    for (const sound of trending) {
      if (picked.length >= limit) break;
      push(sound.id);
    }
  }

  if (recentHistorySoundIds.length < 3 && adminRecommendedIds.length) {
    const adminFirst = adminRecommendedIds.map((id) => byId.get(id)).filter(Boolean) as Sound[];
    const rest = picked.filter((s) => !adminRecommendedIds.includes(s.id));
    return [...adminFirst, ...rest].slice(0, limit);
  }

  return picked.slice(0, limit);
}

export function categoriesWithSounds<T extends { id: string }>(
  categories: T[],
  categoryLinks: { sound_id: string; category_id: string }[],
  publishedIds: Set<string>,
): T[] {
  const counts = new Map<string, number>();
  for (const row of categoryLinks) {
    if (!publishedIds.has(row.sound_id)) continue;
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  return categories.filter((c) => (counts.get(c.id) ?? 0) > 0);
}
