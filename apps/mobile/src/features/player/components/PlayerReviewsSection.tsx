import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../../../lib/theme';

export type ReviewRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profile?: { display_name: string | null } | null;
  score?: number | null;
};

type Props = {
  colors: ThemeColors;
  isDark: boolean;
  avg: number;
  ratingCount: number;
  playCount: number;
  myScore: number;
  comment: string;
  reviews: ReviewRow[];
  ratingBusy: boolean;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  onSetScore: (score: number) => void;
  onChangeComment: (text: string) => void;
  onSubmit: () => void;
};

function initials(name: string | null | undefined) {
  const parts = (name ?? 'Listener').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'L';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function PlayerReviewsSection({
  colors,
  isDark,
  avg,
  ratingCount,
  playCount,
  myScore,
  comment,
  reviews,
  ratingBusy,
  isFavourite,
  onToggleFavourite,
  onSetScore,
  onChangeComment,
  onSubmit,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.statsCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.statsLeft}>
          <Text style={[styles.statsValue, { color: colors.text }]}>
            {ratingCount ? avg.toFixed(1) : '—'}
          </Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={ratingCount && avg >= s - 0.25 ? 'star' : 'star-outline'}
                size={14}
                color="#F5C542"
              />
            ))}
          </View>
          <Text style={[styles.statsMeta, { color: colors.textMuted }]}>
            {ratingCount
              ? `${ratingCount} rating${ratingCount === 1 ? '' : 's'}`
              : 'No ratings yet'}
            {' · '}
            {playCount.toLocaleString()} plays
          </Text>
        </View>
        <Pressable
          onPress={onToggleFavourite}
          style={[
            styles.likePill,
            {
              backgroundColor: isFavourite
                ? isDark
                  ? 'rgba(239,68,68,0.16)'
                  : 'rgba(239,68,68,0.1)'
                : colors.elevated,
            },
          ]}
        >
          <Ionicons
            name={isFavourite ? 'heart' : 'heart-outline'}
            size={18}
            color={isFavourite ? '#EF4444' : colors.textMuted}
          />
          <Text style={[styles.likeText, { color: isFavourite ? '#EF4444' : colors.text }]}>
            {isFavourite ? 'Liked' : 'Like'}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.rateCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Rate this sound</Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          Your rating helps shape recommendations for you.
        </Text>
        <View style={styles.myStars}>
          {[1, 2, 3, 4, 5].map((score) => (
            <Pressable key={score} onPress={() => onSetScore(score)} hitSlop={6} style={styles.starHit}>
              <Ionicons
                name={myScore >= score ? 'star' : 'star-outline'}
                size={34}
                color={myScore >= score ? '#F5C542' : colors.textMuted}
              />
            </Pressable>
          ))}
        </View>
        <TextInput
          value={comment}
          onChangeText={onChangeComment}
          placeholder="Share a short review (optional)"
          placeholderTextColor={colors.textMuted}
          multiline
          style={[
            styles.input,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
          ]}
        />
        <Pressable
          onPress={onSubmit}
          disabled={ratingBusy || myScore < 1}
          style={[
            styles.submit,
            { backgroundColor: colors.inverse, opacity: ratingBusy || myScore < 1 ? 0.45 : 1 },
          ]}
        >
          <Text style={[styles.submitText, { color: colors.inverseText }]}>
            {ratingBusy ? 'Saving…' : comment.trim() ? 'Post rating & review' : 'Post rating'}
          </Text>
        </Pressable>
      </View>

      {reviews.length > 0 ? (
        <View style={styles.list}>
          <Text style={[styles.listTitle, { color: colors.text }]}>Community reviews</Text>
          {reviews.map((row) => (
            <View
              key={row.id}
              style={[styles.reviewCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <View style={styles.reviewHead}>
                <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.avatarText, { color: colors.accent }]}>
                    {initials(row.profile?.display_name)}
                  </Text>
                </View>
                <View style={styles.reviewMeta}>
                  <Text style={[styles.reviewName, { color: colors.text }]}>
                    {row.profile?.display_name ?? 'Listener'}
                  </Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={(row.score ?? 0) >= s ? 'star' : 'star-outline'}
                        size={11}
                        color="#F5C542"
                      />
                    ))}
                    <Text style={[styles.reviewDate, { color: colors.textMuted }]}>
                      · {relativeDate(row.created_at)}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.reviewBody, { color: colors.text }]}>{row.body}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.emptyReviews, { color: colors.textMuted }]}>
          No written reviews yet. Be the first to share your experience.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  statsLeft: { flex: 1 },
  statsValue: { fontFamily: 'Fraunces_700Bold', fontSize: 36, lineHeight: 40 },
  starRow: { flexDirection: 'row', gap: 2, marginTop: 4 },
  statsMeta: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 6 },
  likePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  likeText: { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  rateCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 18 },
  sectionHint: { fontFamily: 'DMSans_400Regular', fontSize: 13, marginTop: 4, marginBottom: 12 },
  myStars: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 12 },
  starHit: { padding: 2 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 84,
    textAlignVertical: 'top',
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    marginBottom: 12,
  },
  submit: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitText: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  list: { gap: 10 },
  listTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 18, marginBottom: 4 },
  reviewCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  reviewMeta: { flex: 1 },
  reviewName: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  reviewStars: { flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 2 },
  reviewDate: { fontFamily: 'DMSans_400Regular', fontSize: 11, marginLeft: 4 },
  reviewBody: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20 },
  emptyReviews: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
});
