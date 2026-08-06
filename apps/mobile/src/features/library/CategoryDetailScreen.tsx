import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../lib/useAppTheme';
import { supabase } from '../../lib/supabase';
import { usePlayer } from '../player/PlayerProvider';
import { EmptyBlock } from '../../ui/Screen';
import { SoundCard } from '../../ui/Cards';
import { IconButton } from '../../ui/Icon';
import type { Sound } from '../../types/database';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryDetail'>;

export function CategoryDetailScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { playSound } = usePlayer();
  const [title, setTitle] = useState(route.params.name || 'Category');
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const categoryId = route.params.categoryId;
    const [{ data: cat }, { data: items }] = await Promise.all([
      supabase.from('categories').select('name').eq('id', categoryId).maybeSingle(),
      supabase
        .from('sound_categories')
        .select('sound:sounds(*)')
        .eq('category_id', categoryId),
    ]);
    setTitle(cat?.name ?? route.params.name ?? 'Category');
    const list = ((items as { sound: Sound | Sound[] | null }[]) ?? [])
      .map((i) => (Array.isArray(i.sound) ? i.sound[0] : i.sound))
      .filter((s): s is Sound => !!s && s.status === 'published');
    setSounds(list);
    setLoading(false);
  }, [route.params.categoryId, route.params.name]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? ['#121212', '#000'] : ['#F3F0EA', '#FFF']}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
        <IconButton
          name="chevron-back"
          onPress={() => navigation.goBack()}
          color={colors.textMuted}
          size={22}
          style={{ alignSelf: 'flex-start', marginLeft: -8, marginBottom: 4 }}
        />
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {loading
            ? 'Loading…'
            : `${sounds.length} sound${sounds.length === 1 ? '' : 's'} · plays only this category until finished`}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 28 }} />
      ) : (
        <FlatList
          data={sounds}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListEmptyComponent={
            <EmptyBlock title="Empty category" body="No published sounds here yet." />
          }
          renderItem={({ item }) => (
            <SoundCard
              sound={item}
              onPress={async () => {
                const index = sounds.findIndex((s) => s.id === item.id);
                const started = await playSound(item, {
                  queue: sounds,
                  queueIndex: index,
                  queueLabel: title,
                });
                if (started) navigation.navigate('Player', { soundId: item.id });
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 34, letterSpacing: -0.8 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, marginTop: 6, marginBottom: 8 },
});
