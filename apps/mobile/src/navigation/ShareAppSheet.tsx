import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../lib/useAppTheme';
import {
  copyAppLink,
  fetchAppDownloadUrl,
  shareAppFacebook,
  shareAppNative,
  shareAppWhatsApp,
  shareAppWhatsAppStatus,
} from '../lib/shareApp';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ShareAppSheet({ visible, onClose }: Props) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    fetchAppDownloadUrl()
      .then((next) => {
        if (!cancelled) setUrl(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const run = async (fn: (link: string) => Promise<void>) => {
    if (!url) return;
    try {
      await fn(url);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.elevated,
              paddingBottom: insets.bottom + 16,
              borderColor: colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.text }]}>Share X-Relax</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            Send the direct APK download link to friends, or post it to WhatsApp Status.
          </Text>

          {loading || !url ? (
            <ActivityIndicator color={colors.icon} style={{ marginVertical: 24 }} />
          ) : (
            <>
              <Text style={[styles.link, { color: colors.textMuted }]} numberOfLines={2}>
                {url}
              </Text>
              <View style={styles.grid}>
                <ShareAction
                  icon="copy-outline"
                  label="Copy link"
                  colors={colors}
                  onPress={() => void run(copyAppLink)}
                />
                <ShareAction
                  icon="share-social-outline"
                  label="Share…"
                  colors={colors}
                  onPress={() => void run(shareAppNative)}
                />
                <ShareAction
                  icon="logo-whatsapp"
                  label="WhatsApp"
                  colors={colors}
                  onPress={() => void run(shareAppWhatsApp)}
                />
                <ShareAction
                  icon="radio-outline"
                  label="WA Status"
                  colors={colors}
                  onPress={() => void run(shareAppWhatsAppStatus)}
                />
                <ShareAction
                  icon="logo-facebook"
                  label="Facebook"
                  colors={colors}
                  onPress={() => void run(shareAppFacebook)}
                />
              </View>
            </>
          )}

          <Pressable onPress={onClose} style={[styles.closeBtn, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontFamily: 'DMSans_500Medium' }}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ShareAction({
  icon,
  label,
  colors,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  colors: { text: string; textMuted: string; border: string; surface: string };
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.action, { borderColor: colors.border }]}>
      <Ionicons name={icon} size={22} color={colors.text} />
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 24 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, marginTop: 6, marginBottom: 14 },
  link: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: {
    width: '30%',
    minWidth: 96,
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
  },
  actionLabel: { fontFamily: 'DMSans_500Medium', fontSize: 12 },
  closeBtn: {
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
