import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../lib/useAppTheme';
import { ScreenScaffold } from '../../ui/Screen';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Legal'>;

const PRIVACY = `Privacy Policy
Last updated: 2026-08-08

X-Relax (“we”, “us”) respects your privacy. This policy explains what we collect and how we use it.

1. What we collect
• Account: email, password (hashed by our auth provider), display name, role, and country
• Profile: optional bio, avatar, banner, and creator verification documents
• Usage: play history, favourites/likes, playlists, ratings, follows, mix preferences, and Sleep Time settings stored on your device
• Payments: manual payment requests, proof images, subscription or pass status
• Device: push tokens for notifications; basic diagnostics when enabled

2. How we use data
• Provide playback, library, Premium, Sleep Time, Mix Studio, and creator features
• Enforce free daily listening limits and Premium entitlements
• Review payments, content moderation, verifications, withdrawals, and support
• Calculate creator earnings and analytics (including approximate listening locations from country)
• Send in-app and push notifications (welcome, new releases from creators you follow, account updates)

3. Sharing
• We do not sell personal data
• Service providers (for example Supabase hosting and Firebase Cloud Messaging) process data to run the app
• Test or production ad units on free accounts may use device advertising IDs where enabled

4. Retention & your choices
• Account data is retained while your account is active
• Payment proofs and verification documents are retained for fraud and compliance review
• You may update profile details in-app and request account deletion by contacting support

5. Contact
Privacy questions: support@x-relax.app`;

const TERMS = `Terms of Use
Last updated: 2026-08-08

Welcome to X-Relax. By creating an account or using the app or website, you agree to these terms.

1. Accounts
• Provide accurate information and keep your credentials secure
• You must select your country at signup (used for payments and analytics)
• Roles: Listener or Creator at signup; Admin is assigned only by operators
• We may suspend accounts that abuse the service or upload infringing content

2. Listening & Premium
• Free accounts may unlock a limited number of unique sounds per day
• Premium features (unlimited listening, loop, offline downloads, Mix Studio, full Sleep Time, sleep timer) follow the plan rules shown in-app
• Loop and continuous Sleep Time looping are Premium-only
• Manual payments are verified by staff and may be refused with a reason

3. Content license
• Streaming and downloads are for personal, non-commercial use unless otherwise agreed
• Do not redistribute X-Relax audio outside the service

4. Creators
• You warrant you own or have rights to audio and artwork you upload
• Published sounds may appear in X-Relax listening experiences and recommendation systems
• Apply to Earn requires meeting published thresholds (including likes), identity verification, and admin approval
• Earnings and withdrawals follow in-app rules and may change

5. Disclaimers
• The service is provided “as is”
• Relaxation content is not medical advice and is not a substitute for professional care

6. Contact
Terms questions: support@x-relax.app`;

export function LegalScreen({ route }: Props) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const doc = route.params.doc;
  const text = doc === 'privacy' ? PRIVACY : TERMS;
  const title = doc === 'privacy' ? 'Privacy Policy' : 'Terms of Use';

  return (
    <ScreenScaffold
      title={title}
      subtitle="Please read carefully"
      onBack={() => navigation.goBack()}
    >
      <View style={[styles.bodyWrap, { borderColor: colors.border }]}>
        <Text style={[styles.body, { color: colors.textMuted }]}>{text}</Text>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  bodyWrap: {
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
});
