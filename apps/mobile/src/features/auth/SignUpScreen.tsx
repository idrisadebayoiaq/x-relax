import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme } from '../../lib/useAppTheme';
import { useAuth } from './AuthProvider';
import { COUNTRIES } from '../../lib/countries';
import { PrimaryButton } from '../../ui/Screen';
import type { AuthStackParamList } from '../../navigation/types';
import type { SignupRole } from '../../types/database';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SignupRole>('listener');
  const [countryCode, setCountryCode] = useState('');
  const [showCountries, setShowCountries] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setInfo(null);
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }
    if (!countryCode) {
      setError('Please select your country');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setBusy(true);
    const result = await signUp({ email, password, displayName, role, countryCode });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setInfo('Welcome! You’re in — check Home for your welcome message.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? ['#1A1410', '#000', '#000'] : ['#EDE6DC', '#FFF', '#FFF']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: colors.text }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Join as a Listener or Creator
          </Text>

          <Text style={[styles.label, { color: colors.textMuted }]}>I am joining as</Text>
          <View style={styles.roleRow}>
            {(['listener', 'creator'] as SignupRole[]).map((option) => {
              const selected = role === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setRole(option)}
                  style={[
                    styles.roleChip,
                    {
                      borderColor: colors.border,
                      backgroundColor: selected ? colors.inverse : 'transparent',
                    },
                  ]}
                >
                  <Ionicons
                    name={option === 'creator' ? 'mic-outline' : 'headset-outline'}
                    size={18}
                    color={selected ? colors.inverseText : colors.text}
                  />
                  <Text
                    style={{
                      color: selected ? colors.inverseText : colors.text,
                      fontFamily: 'DMSans_700Bold',
                      textTransform: 'capitalize',
                      fontSize: 14,
                    }}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.field, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface }]}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.fieldInput, { color: colors.text }]}
              placeholder="Display name"
              placeholderTextColor={colors.textMuted}
              value={displayName}
              onChangeText={setDisplayName}
            />
          </View>
          <View style={[styles.field, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface }]}>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.fieldInput, { color: colors.text }]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={[styles.field, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface }]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.fieldInput, { color: colors.text }]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <Text style={[styles.label, { color: colors.textMuted }]}>Country</Text>
          <Pressable
            onPress={() => setShowCountries((v) => !v)}
            style={[
              styles.field,
              {
                borderColor: colors.border,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface,
              },
            ]}
          >
            <Ionicons name="globe-outline" size={18} color={colors.textMuted} />
            <Text
              style={[
                styles.fieldInput,
                { color: countryCode ? colors.text : colors.textMuted, paddingVertical: 12 },
              ]}
            >
              {COUNTRIES.find((c) => c.code === countryCode)?.name ?? 'Select your country'}
            </Text>
            <Ionicons
              name={showCountries ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textMuted}
            />
          </Pressable>
          {showCountries ? (
            <ScrollView
              nestedScrollEnabled
              style={[
                styles.countryList,
                {
                  borderColor: colors.border,
                  backgroundColor: isDark ? '#1A1410' : colors.surface,
                },
              ]}
            >
              {COUNTRIES.map((c) => (
                <Pressable
                  key={c.code}
                  onPress={() => {
                    setCountryCode(c.code);
                    setShowCountries(false);
                  }}
                  style={styles.countryRow}
                >
                  <Text style={{ color: colors.text, fontFamily: 'DMSans_400Regular', fontSize: 14 }}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {error ? <Text style={[styles.message, { color: colors.text }]}>{error}</Text> : null}
          {info ? <Text style={[styles.message, { color: colors.textMuted }]}>{info}</Text> : null}

          <PrimaryButton label="Sign up" onPress={onSubmit} loading={busy} disabled={busy} />

          <Pressable onPress={() => navigation.goBack()} disabled={busy} style={styles.linkRow}>
            <Ionicons name="arrow-back-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.link, { color: colors.textMuted }]}>Back to sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, flexGrow: 1, justifyContent: 'center' },
  title: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 32,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
    fontSize: 15,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  roleChip: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  field: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
  message: {
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 13,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  link: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
  },
  countryList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    marginBottom: 12,
    maxHeight: 180,
    overflow: 'hidden',
  },
  countryRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
});
