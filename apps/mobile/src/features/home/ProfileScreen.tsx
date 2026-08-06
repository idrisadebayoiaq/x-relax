import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '../../lib/useAppTheme';
import { moodPaletteFor } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import type { RootStackParamList } from '../../navigation/types';
import {
  OutlineRow,
  PrimaryButton,
  ScreenScaffold,
  SectionLabel,
} from '../../ui/Screen';
import { VerifiedBadge } from '../../ui/VerifiedBadge';

export function ProfileScreen() {
  const { colors, isDark } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    profile,
    adminProfile,
    user,
    isPremium,
    isCreator,
    isAdmin,
    signOut,
    updateProfile,
  } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isVerifiedCreator, setIsVerifiedCreator] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.display_name ?? '');
    setAvatarUri(null);
  }, [profile?.display_name, profile?.avatar_url]);

  const loadCreator = useCallback(async () => {
    if (!user || !isCreator) return;
    const { data } = await supabase
      .from('creator_profiles')
      .select('is_verified')
      .eq('user_id', user.id)
      .maybeSingle();
    setIsVerifiedCreator(!!data?.is_verified);
  }, [user, isCreator]);

  useEffect(() => {
    loadCreator();
  }, [loadCreator]);

  const showVerifiedBadge = isPremium || isAdmin || isVerifiedCreator;

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const onSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert('Name required', 'Enter at least 2 characters.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await updateProfile({
      displayName: trimmed,
      avatarUri: avatarUri ?? undefined,
    });
    setBusy(false);
    if (result.error) {
      setMessage(result.error);
    } else {
      setAvatarUri(null);
      setMessage('Profile saved');
    }
  };

  const initial = (profile?.display_name?.trim()?.[0] ?? user?.email?.[0] ?? 'X').toUpperCase();
  const avatarSource = avatarUri ?? profile?.avatar_url ?? null;

  return (
    <ScreenScaffold
      title="Profile"
      subtitle="Account, preferences, and legal"
    >
      <View style={styles.heroWrap}>
        <Pressable onPress={pickAvatar} style={styles.avatarPress}>
          {avatarSource ? (
            <Image source={{ uri: avatarSource }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <LinearGradient colors={moodPaletteFor(user?.email ?? 'profile')} style={styles.avatar}>
              <Text style={styles.avatarMark}>{initial}</Text>
            </LinearGradient>
          )}
          <View style={[styles.cameraBtn, { backgroundColor: colors.inverse }]}>
            <Ionicons name="camera" size={14} color={colors.inverseText} />
          </View>
        </Pressable>

        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]}>
            {profile?.display_name ?? 'Listener'}
          </Text>
          {showVerifiedBadge ? <VerifiedBadge size={18} /> : null}
        </View>
        <Text style={[styles.email, { color: colors.textMuted }]}>{user?.email ?? '—'}</Text>
        <View style={styles.badgeRow}>
          <Badge label={profile?.role ?? 'listener'} colors={colors} />
          <Badge label={isPremium ? 'premium' : 'free'} colors={colors} />
          {adminProfile ? <Badge label={`admin · ${adminProfile.role}`} colors={colors} /> : null}
          {isVerifiedCreator ? <Badge label="verified creator" colors={colors} /> : null}
        </View>
      </View>

      <SectionLabel>Edit profile</SectionLabel>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface,
          },
        ]}
        value={name}
        onChangeText={setName}
        placeholder="How should we greet you?"
        placeholderTextColor={colors.textMuted}
      />
      <PrimaryButton label="Save profile" onPress={onSave} loading={busy} disabled={busy} />
      {message ? (
        <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
      ) : null}

      <SectionLabel>Account</SectionLabel>
      {!isCreator ? (
        <OutlineRow
          label="Become a Creator"
          hint="Upload sounds and earn from Premium"
          icon="mic-outline"
          onPress={() => navigation.navigate('BecomeCreator')}
        />
      ) : null}
      <OutlineRow
        label="Notifications"
        hint="Welcome notes and announcements"
        icon="notifications-outline"
        onPress={() => navigation.navigate('Notifications')}
      />

      <SectionLabel>Legal</SectionLabel>
      <OutlineRow
        label="Privacy Policy"
        icon="document-text-outline"
        onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}
      />
      <OutlineRow
        label="Terms of Use"
        icon="reader-outline"
        onPress={() => navigation.navigate('Legal', { doc: 'terms' })}
      />

      <Pressable
        style={[styles.signOut, { borderColor: colors.border }]}
        onPress={() => signOut()}
      >
        <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>Sign out</Text>
      </Pressable>
    </ScreenScaffold>
  );
}

function Badge({
  label,
  colors,
}: {
  label: string;
  colors: { text: string; border: string };
}) {
  return (
    <View style={[styles.badge, { borderColor: colors.border }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: { alignItems: 'center', paddingHorizontal: 20, marginBottom: 12, marginTop: 4 },
  avatarPress: { marginBottom: 14 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  cameraBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMark: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 36,
    color: 'rgba(255,255,255,0.92)',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: 'Fraunces_600SemiBold', fontSize: 24 },
  email: { fontFamily: 'DMSans_400Regular', fontSize: 13, marginTop: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'center' },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    textTransform: 'capitalize',
  },
  input: {
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    marginBottom: 12,
  },
  message: {
    textAlign: 'center',
    marginTop: 10,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
  },
  signOut: {
    marginHorizontal: 20,
    marginTop: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
});
