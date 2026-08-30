import { useState } from 'react';
import {
  Image,
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
import { PrimaryButton } from '../../ui/Screen';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setBusy(true);
    const result = await signIn({ email, password });
    setBusy(false);
    if (result.error) setError(result.error);
  };

  const logo = require('../../../assets/brand/splash-icon.png');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.gradientTop, colors.background, colors.background]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image source={logo} style={styles.logo} />
          <Text style={[styles.brand, { color: colors.text }]}>X-Relax</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Sign in to continue your calm
          </Text>

          <View style={[styles.field, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface }]}>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.fieldInput, { color: colors.text }]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
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

          {error ? <Text style={[styles.error, { color: colors.text }]}>{error}</Text> : null}

          <PrimaryButton label="Sign in" onPress={onSubmit} loading={busy} disabled={busy} />

          <Pressable onPress={() => navigation.navigate('ForgotPassword')} disabled={busy} style={styles.linkRow}>
            <Ionicons name="key-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.link, { color: colors.textMuted }]}>Forgot password?</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('SignUp')} disabled={busy} style={styles.linkRow}>
            <Ionicons name="person-add-outline" size={16} color={colors.text} />
            <Text style={[styles.linkStrong, { color: colors.text }]}>Create an account</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, justifyContent: 'center', flexGrow: 1 },
  logo: { width: 88, height: 88, alignSelf: 'center', marginBottom: 16 },
  brand: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 36,
    letterSpacing: -1,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
    fontSize: 15,
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
  error: {
    fontFamily: 'DMSans_400Regular',
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 13,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  link: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
  },
  linkStrong: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  },
});
