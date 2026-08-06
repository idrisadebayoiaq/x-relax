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
import { PrimaryButton } from '../../ui/Screen';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    const result = await resetPassword(email);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setInfo('If an account exists for that email, a reset link was sent.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={isDark ? ['#1A1410', '#000', '#000'] : ['#EDE6DC', '#FFF', '#FFF']}
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
        >
          <Text style={[styles.title, { color: colors.text }]}>Reset password</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Enter the email on your X-Relax account
          </Text>

          <View
            style={[
              styles.field,
              {
                borderColor: colors.border,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface,
              },
            ]}
          >
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

          {error ? <Text style={[styles.message, { color: colors.text }]}>{error}</Text> : null}
          {info ? <Text style={[styles.message, { color: colors.textMuted }]}>{info}</Text> : null}

          <PrimaryButton
            label="Send reset link"
            onPress={onSubmit}
            loading={busy}
            disabled={busy}
          />

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
    lineHeight: 22,
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
});
