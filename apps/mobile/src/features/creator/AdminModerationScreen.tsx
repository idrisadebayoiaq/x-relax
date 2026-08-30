import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../lib/useAppTheme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { CoverArt } from '../home/CoverArt';
import { EmptyBlock } from '../../ui/Screen';
import { IconButton } from '../../ui/Icon';
import { Ionicons } from '@expo/vector-icons';
import type { Sound } from '../../types/database';

export function AdminModerationScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const navigation = useNavigation();
  const [rows, setRows] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('sounds')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setRows((data as Sound[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const review = async (id: string, status: 'published' | 'rejected') => {
    const { error } = await supabase.rpc('moderate_sound', {
      p_sound_id: id,
      p_status: status,
      p_reason: status === 'rejected' ? 'Did not meet quality or policy guidelines' : null,
    });
    if (error) Alert.alert('Failed', error.message);
    else load();
  };

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>Admin only</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.gradientTop, colors.background]}
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
        <Text style={[styles.title, { color: colors.text }]}>Moderation</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Pending creator uploads
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.icon} style={{ marginTop: 28 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListEmptyComponent={
            <EmptyBlock title="All clear" body="No sounds waiting for review." />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <CoverArt title={item.title} uri={item.cover_url} size={56} rounded={12} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.rowBody, { color: colors.textMuted }]} numberOfLines={2}>
                    {item.description ?? 'No description'}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => review(item.id, 'published')}
                  style={styles.actionBtn}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.text} />
                  <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>Publish</Text>
                </Pressable>
                <Pressable
                  onPress={() => review(item.id, 'rejected')}
                  style={styles.actionBtn}
                >
                  <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_500Medium' }}>
                    Reject
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 34, letterSpacing: -0.8 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, marginTop: 6, marginBottom: 8 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  rowTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16, marginBottom: 4 },
  rowBody: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 18 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
