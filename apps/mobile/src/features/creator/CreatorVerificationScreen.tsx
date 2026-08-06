import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '../../lib/useAppTheme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { PrimaryButton, ScreenScaffold, SectionLabel } from '../../ui/Screen';
import type { RootStackParamList } from '../../navigation/types';

type Requirement = {
  key: string;
  label: string;
  required: number;
  current: number;
  met: boolean;
};

type EarnStatus = {
  eligible: boolean;
  can_earn: boolean;
  is_verified: boolean;
  has_blue_badge: boolean;
  latest_status: string | null;
  requirements: Requirement[];
};

const DOC_TYPES = [
  { id: 'national_id', label: 'National ID' },
  { id: 'voters_id', label: "Voter's ID" },
  { id: 'drivers_license', label: "Driver's license" },
  { id: 'passport', label: 'Passport' },
  { id: 'other', label: 'Other government ID' },
] as const;

export function CreatorVerificationScreen() {
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<EarnStatus | null>(null);
  const [docUri, setDocUri] = useState<string | null>(null);
  const [docType, setDocType] = useState<(typeof DOC_TYPES)[number]['id']>('national_id');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_creator_earn_requirements');
    setStatus((data as EarnStatus) ?? null);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const checklist = useMemo(
    () => (status?.requirements ?? []).filter((r) => r.key !== 'identity'),
    [status],
  );
  const eligible = !!status?.eligible;
  const canEarn = !!status?.can_earn;
  const pending = status?.latest_status === 'pending';
  const blockedSubmit = !eligible || pending || canEarn;

  const pickDoc = async () => {
    if (!eligible) {
      Alert.alert(
        'Requirements not met',
        'Meet all earning requirements before you can verify your identity.',
      );
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setDocUri(result.assets[0].uri);
    }
  };

  const submit = async () => {
    if (!user) return;
    if (!eligible) {
      Alert.alert(
        'Requirements not met',
        'You cannot verify identity or submit an earning request until requirements are complete.',
      );
      return;
    }
    if (!docUri) {
      Alert.alert('Document required', 'Upload a government ID document.');
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
      p_document_type: docType,
    });
    setBusy(false);
    if (error) {
      Alert.alert('Cannot submit', error.message);
      return;
    }
    Alert.alert('Submitted', 'Admins will review your earning application and identity.');
    load();
  };

  return (
    <ScreenScaffold
      title="Apply to earn"
      subtitle="Meet the requirements, verify your identity, then wait for admin approval"
      onBack={() => navigation.goBack()}
    >
      <View style={[styles.statusCard, { borderColor: colors.border }]}>
        <Text style={[styles.statusLabel, { color: colors.textMuted }]}>Application status</Text>
        <Text style={[styles.statusValue, { color: colors.text }]}>
          {loading
            ? '…'
            : canEarn
              ? 'approved to earn'
              : status?.latest_status ?? 'not applied'}
        </Text>
      </View>

      <SectionLabel>Requirements</SectionLabel>
      <View style={{ gap: 8, marginHorizontal: 20, marginBottom: 8 }}>
        {checklist.map((item) => (
          <View
            key={item.key}
            style={[styles.reqRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={{ color: item.met ? '#15803D' : colors.text, fontSize: 16, width: 22 }}>
              {item.met ? '✓' : '○'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.reqLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={[styles.reqMeta, { color: colors.textMuted }]}>
                Progress: {String(item.current)} / {String(item.required)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {!eligible && !canEarn ? (
        <View style={[styles.warn, { borderColor: colors.border, marginHorizontal: 20 }]}>
          <Text style={[styles.warnTitle, { color: colors.text }]}>Requirements not met</Text>
          <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19 }}>
            You can keep uploading, publishing, and growing your catalog. Identity verification and
            earning requests stay locked until every requirement above is complete.
          </Text>
        </View>
      ) : null}

      {canEarn ? (
        <View style={[styles.warn, { borderColor: colors.border, marginHorizontal: 20 }]}>
          <Text style={[styles.warnTitle, { color: colors.text }]}>You can earn</Text>
          <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', fontSize: 13 }}>
            Identity approved. Request withdrawals from Earnings when you have a balance.
          </Text>
        </View>
      ) : (
        <>
          <SectionLabel>Identity verification</SectionLabel>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Choose ID type, upload a clear photo/PDF, then submit for admin review.
          </Text>
          <View style={styles.docRow}>
            {DOC_TYPES.map((d) => {
              const selected = docType === d.id;
              return (
                <Pressable
                  key={d.id}
                  disabled={!eligible || pending}
                  onPress={() => setDocType(d.id)}
                  style={[
                    styles.docChip,
                    {
                      borderColor: colors.border,
                      opacity: !eligible || pending ? 0.45 : 1,
                      backgroundColor: selected ? colors.inverse : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? colors.inverseText : colors.text,
                      fontFamily: 'DMSans_500Medium',
                      fontSize: 12,
                    }}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[
              styles.btnOutline,
              { borderColor: colors.border, opacity: !eligible || pending ? 0.45 : 1 },
            ]}
            onPress={pickDoc}
            disabled={!eligible || pending}
          >
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
                opacity: !eligible || pending ? 0.45 : 1,
              },
            ]}
            editable={eligible && !pending}
            placeholder="Optional note for admins"
            placeholderTextColor={colors.textMuted}
            value={note}
            onChangeText={setNote}
          />
          <PrimaryButton
            label={pending ? 'Pending review' : 'Submit earning request'}
            onPress={submit}
            loading={busy}
            disabled={busy || blockedSubmit}
          />
        </>
      )}

      <SectionLabel>Blue verified badge</SectionLabel>
      <View style={[styles.warn, { borderColor: colors.border, marginHorizontal: 20 }]}>
        <Text style={[styles.warnTitle, { color: colors.text }]}>Included with Apply to Earn</Text>
        <Text style={{ color: colors.textMuted, fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19 }}>
          After admins approve your identity, you get the blue verified creator badge. Premium
          listeners get a separate white badge. Admins need a super admin to grant their blue badge.
        </Text>
        {canEarn || status?.is_verified ? (
          <Text style={{ color: colors.text, fontFamily: 'DMSans_700Bold', marginTop: 10 }}>
            Blue creator badge active
          </Text>
        ) : null}
      </View>
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
  reqRow: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    alignItems: 'flex-start',
  },
  reqLabel: { fontFamily: 'DMSans_500Medium', fontSize: 14 },
  reqMeta: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginTop: 2 },
  warn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  warnTitle: { fontFamily: 'DMSans_700Bold', fontSize: 15, marginBottom: 6 },
  hint: {
    marginHorizontal: 20,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  docRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 20, marginBottom: 12 },
  docChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
