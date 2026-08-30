import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../lib/useAppTheme';
import { ScreenScaffold } from '../../ui/Screen';
import type { AuthStackParamList, RootStackParamList } from '../../navigation/types';
import { PRIVACY_POLICY, TERMS_OF_USE } from '../../lib/legalContent';

type Props =
  | NativeStackScreenProps<RootStackParamList, 'Legal'>
  | NativeStackScreenProps<AuthStackParamList, 'Legal'>;

export function LegalScreen({ route }: Props) {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const doc = route.params.doc;
  const text = doc === 'privacy' ? PRIVACY_POLICY : TERMS_OF_USE;
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
