import type { Sound } from '../types/database';

export type FollowCountryBias = 'NG' | 'OTHER' | null;

/** Dominant follow region: Nigeria vs rest of world. */
export function followCountryBias(
  creatorCountries: (string | null | undefined)[],
): FollowCountryBias {
  let ng = 0;
  let other = 0;
  for (const code of creatorCountries) {
    if (!code) continue;
    if (code.toUpperCase() === 'NG') ng += 1;
    else other += 1;
  }
  if (ng === 0 && other === 0) return null;
  return ng >= other ? 'NG' : 'OTHER';
}

function regionOf(code?: string | null): FollowCountryBias {
  if (!code) return null;
  return code.toUpperCase() === 'NG' ? 'NG' : 'OTHER';
}

/** Build Recommended from listening history + likes + followed-creator country bias. */
export function buildPersonalizedRecommended(opts: {
  all: Sound[];
  categoryLinks: { sound_id: string; category_id: string }[];
  recentHistorySoundIds: string[];
  likedSoundIds?: string[];
  adminRecommendedIds: string[];
  /** creator_id → country_code */
  creatorCountries?: Record<string, string | null | undefined>;
  followBias?: FollowCountryBias;
  limit?: number;
}): Sound[] {
  const {
    all,
    categoryLinks,
    recentHistorySoundIds,
    likedSoundIds = [],
    adminRecommendedIds,
    creatorCountries = {},
    followBias = null,
    limit = 12,
  } = opts;
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

  likedSoundIds.forEach((soundId, index) => {
    const weight = (likedSoundIds.length - index) * 3;
    for (const catId of catsBySound.get(soundId) ?? []) {
      catScore.set(catId, (catScore.get(catId) ?? 0) + weight);
    }
  });

  recentHistorySoundIds.forEach((soundId, index) => {
    const weight = recentHistorySoundIds.length - index;
    for (const catId of catsBySound.get(soundId) ?? []) {
      catScore.set(catId, (catScore.get(catId) ?? 0) + weight);
    }
  });

  const heard = new Set([...recentHistorySoundIds, ...likedSoundIds]);
  const picked: Sound[] = [];
  const pickedIds = new Set<string>();

  const regionBoost = (sound: Sound) => {
    if (!followBias || !sound.creator_id) return 0;
    const region = regionOf(creatorCountries[sound.creator_id]);
    if (region === followBias) return 1_000_000;
    if (region && region !== followBias) return 0;
    return 100;
  };

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
      .sort(
        (a, b) =>
          regionBoost(b!) - regionBoost(a!) || (b!.play_count ?? 0) - (a!.play_count ?? 0),
      ) as Sound[];
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
    const trending = [...all].sort(
      (a, b) => regionBoost(b) - regionBoost(a) || b.play_count - a.play_count,
    );
    for (const sound of trending) {
      if (picked.length >= limit) break;
      push(sound.id);
    }
  }

  // Prefer ~70% preferred-region when we have a follow bias, fill rest with others
  if (followBias) {
    const preferred = picked.filter(
      (s) => s.creator_id && regionOf(creatorCountries[s.creator_id]) === followBias,
    );
    const rest = picked.filter((s) => !preferred.includes(s));
    const preferredSlots = Math.ceil(limit * 0.7);
    const mixed = [
      ...preferred.slice(0, preferredSlots),
      ...rest,
      ...preferred.slice(preferredSlots),
    ];
    const unique: Sound[] = [];
    const seen = new Set<string>();
    for (const s of mixed) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      unique.push(s);
      if (unique.length >= limit) break;
    }
    if (unique.length) return unique;
  }

  const hasSignals = recentHistorySoundIds.length >= 3 || likedSoundIds.length >= 1;
  if (!hasSignals && adminRecommendedIds.length) {
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

/** Newest published sounds from creators the listener follows. */
export function buildNewReleasesFromFollows(opts: {
  all: Sound[];
  followedCreatorIds: string[];
  limit?: number;
  maxAgeDays?: number;
}): Sound[] {
  const { all, followedCreatorIds, limit = 12, maxAgeDays = 60 } = opts;
  if (!followedCreatorIds.length) return [];
  const followSet = new Set(followedCreatorIds);
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  return all
    .filter(
      (s) =>
        s.creator_id &&
        followSet.has(s.creator_id) &&
        (!s.created_at || new Date(s.created_at).getTime() >= cutoff),
    )
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, limit);
}
