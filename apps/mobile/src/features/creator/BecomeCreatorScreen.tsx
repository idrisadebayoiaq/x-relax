import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../lib/useAppTheme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { PrimaryButton, ScreenScaffold } from '../../ui/Screen';
import { appAlert } from '../../ui/appAlert';

export function BecomeCreatorScreen() {
  const { colors, isDark } = useAppTheme();
  const { refreshProfile } = useAuth();
  const navigation = useNavigation();
  const [bio, setBio] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('become_creator', {
      p_bio: bio.trim() || null,
      p_payout_method: payoutMethod.trim() || null,
    });
    setBusy(false);
    if (error) {
      appAlert('Could not continue', error.message);
      return;
    }
    await refreshProfile();
    appAlert('Welcome', 'Your creator profile is ready.');
    navigation.goBack();
  };

  const inputStyle = [
    styles.input,
    {
      color: colors.text,
      borderColor: colors.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface,
    },
  ];

  return (
    <ScreenScaffold
      title="Become a Creator"
      subtitle="Upload original relaxation audio and earn from the Premium pool."
      onBack={() => navigation.goBack()}
    >
      <TextInput
        style={[inputStyle, styles.area]}
        placeholder="Short bio"
        placeholderTextColor={colors.textMuted}
        value={bio}
        onChangeText={setBio}
        multiline
      />
      <TextInput
        style={inputStyle}
        placeholder="Preferred payout method (Opay / USD bank)"
        placeholderTextColor={colors.textMuted}
        value={payoutMethod}
        onChangeText={setPayoutMethod}
      />
      <View style={{ height: 8 }} />
      <PrimaryButton
        label="Create creator profile"
        onPress={submit}
        loading={busy}
        disabled={busy}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  input: {
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    minHeight: 48,
  },
  area: { minHeight: 100, textAlignVertical: 'top' },
});
