import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../lib/useAppTheme';
import { useDownloads } from './DownloadProvider';

export function DownloadBanner() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { jobs, activeJob, dismissJob } = useDownloads();

  if (!jobs.length) return null;

  const job = activeJob ?? jobs[jobs.length - 1];
  const pct = Math.round(job.progress * 100);
  const isDone = job.status === 'completed';
  const isError = job.status === 'error';

  return (
    <View
      style={[
        styles.wrap,
        {
          top: insets.top + 8,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.row}>
        {isDone ? (
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        ) : isError ? (
          <Ionicons name="alert-circle" size={22} color={colors.danger} />
        ) : (
          <ActivityIndicator size="small" color={colors.accent} />
        )}
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {isDone ? 'Downloaded' : isError ? 'Download failed' : 'Downloading…'}
          </Text>
          <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
            {job.title}
            {!isDone && !isError ? ` · ${pct}%` : ''}
          </Text>
        </View>
        <Pressable onPress={() => dismissJob(job.soundId)} hitSlop={10}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      {!isDone && !isError ? (
        <View style={[styles.track, { backgroundColor: colors.elevated }]}>
          <View
            style={[
              styles.fill,
              { width: `${pct}%`, backgroundColor: colors.accent },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 2 },
  track: {
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2 },
});
