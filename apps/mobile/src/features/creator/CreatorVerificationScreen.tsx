import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../lib/useAppTheme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { PrimaryButton, ScreenScaffold, SectionLabel } from '../../ui/Screen';

export function CreatorVerificationScreen() {
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [status, setStatus] = useState<string | null>(null);
  const [docUri, setDocUri] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('creator_verifications')
      .select('status, admin_note, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setStatus(data?.status ?? null);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pickDoc = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setDocUri(result.assets[0].uri);
    }
  };

  const submit = async () => {
    if (!user || !docUri) {
      Alert.alert('Document required', 'Upload an ID document.');
      return;
    }
    setBusy(true);
    const path = `${user.id}/verification-${Date.now()}.bin`;
    const res = await fetch(docUri);
    const blob = await res.blob();
    const { error: uploadError } = await supabase.storage
      .from('artist-documents')
      .upload(path, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' });
    if (uploadError) {
      setBusy(false);
      Alert.alert('Upload failed', uploadError.message);
      return;
    }
    const { error } = await supabase.rpc('submit_creator_verification', {
      p_document_path: path,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      Alert.alert('Cannot apply', error.message);
      return;
    }
    Alert.alert('Submitted', 'Admins will review your verification.');
    load();
  };

  return (
    <ScreenScaffold
      title="Verification"
      subtitle="20 published sounds · 5,000 plays · rating ≥ 4.5 · bio · ID"
      onBack={() => navigation.goBack()}
    >
      <View style={[styles.statusCard, { borderColor: colors.border }]}>
        <Text style={[styles.statusLabel, { color: colors.textMuted }]}>Current status</Text>
        <Text style={[styles.statusValue, { color: colors.text }]}>
          {loading ? '…' : status ?? 'not applied'}
        </Text>
      </View>

      <SectionLabel>Application</SectionLabel>
      <Pressable style={[styles.btnOutline, { borderColor: colors.border }]} onPress={pickDoc}>
        <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold' }}>
          {docUri ? 'Document selected' : 'Upload ID document'}
        </Text>
      </Pressable>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface,
          },
        ]}
        placeholder="Optional note"
        placeholderTextColor={colors.textMuted}
        value={note}
        onChangeText={setNote}
      />
      <PrimaryButton
        label="Apply for verification"
        onPress={submit}
        loading={busy}
        disabled={busy || status === 'pending' || status === 'approved'}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 18,
    marginBottom: 8,
  },
  statusLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusValue: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 24,
    marginTop: 6,
    textTransform: 'capitalize',
  },
  btnOutline: {
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  input: {
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 16,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
});
