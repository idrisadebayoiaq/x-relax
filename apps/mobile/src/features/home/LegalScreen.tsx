import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../lib/useAppTheme';
import { ScreenScaffold } from '../../ui/Screen';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Legal'>;

const PRIVACY = `Privacy Policy (draft)
Last updated: 2026-07-30

What we collect
• Account: email, password (hashed by auth provider), display name, role
• Profile: optional bio, avatar, creator verification documents
• Usage: play history, favourites, playlists, ratings, mix preferences
• Payments: manual payment requests, proof images, subscription status
• Device: push tokens for notifications; basic diagnostics when enabled

How we use data
• Provide playback, library, Premium, and creator features
• Review payments, content, verifications, withdrawals, and support
• Calculate creator earnings from eligible play activity
• Send in-app and push notifications about your account

Sharing
• We do not sell personal data
• Hosting providers (e.g. Supabase, Firebase Cloud Messaging) process data to run the app
• Test ad units on Free accounts may use device advertising IDs

Contact
Replace with your address before public release: support@x-relax.app`;

const TERMS = `Terms of Use (draft)
Last updated: 2026-07-30

Accounts
• Provide accurate information and keep credentials secure
• Signup roles: Listener or Creator; Admin is assigned only by operators

Content
• Streaming and downloads are for personal, non-commercial use unless otherwise agreed
• Premium and Premium Pass follow the plan / pass rules shown in-app
• Manual payments are verified by staff and may be refused with reason

Creators
• You warrant you own or have rights to audio and artwork you upload
• Approved content may appear in X-Relax listening experiences
• Earnings and withdrawals follow in-app rules and may require verification

Disclaimers
• The app is provided “as is” during internal testing
• Relaxation content is not medical advice

Contact
Replace before public release: support@x-relax.app`;

export function LegalScreen({ route }: Props) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const doc = route.params.doc;
  const text = doc === 'privacy' ? PRIVACY : TERMS;
  const title = doc === 'privacy' ? 'Privacy Policy' : 'Terms of Use';

  return (
    <ScreenScaffold
      title={title}
      subtitle="Draft for internal testing — update before public release"
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
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 18,
  },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 22 },
});
