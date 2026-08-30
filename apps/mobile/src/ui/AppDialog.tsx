import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { useAppTheme } from '../lib/useAppTheme';
import { bindAppAlert, type AppAlertButton, type AppAlertPayload } from './appAlert';

export function AppDialogHost() {
  const { colors } = useAppTheme();
  const [payload, setPayload] = useState<AppAlertPayload | null>(null);

  useEffect(() => {
    bindAppAlert(setPayload);
    return () => bindAppAlert(null);
  }, []);

  const close = (button?: AppAlertButton) => {
    setPayload(null);
    button?.onPress?.();
  };

  if (!payload) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => close()}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
          <LinearGradient colors={['#0B3D91', '#F5C400']} style={styles.orb} />
          <Text style={[styles.brand, { color: colors.textMuted }]}>X-Relax</Text>
          <Text style={[styles.title, { color: colors.text }]}>{payload.title}</Text>
          {payload.message ? (
            <Text style={[styles.body, { color: colors.textMuted }]}>{payload.message}</Text>
          ) : null}
          <View style={styles.actions}>
            {payload.buttons.map((button, index) => {
              const primary =
                button.style !== 'cancel' &&
                (index === payload.buttons.length - 1 || button.style === 'destructive');
              const isCancel = button.style === 'cancel';
              const isDanger = button.style === 'destructive';
              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  onPress={() => close(button)}
                  style={[
                    styles.btn,
                    primary
                      ? { backgroundColor: isDanger ? colors.danger : colors.accent }
                      : {
                          backgroundColor: 'transparent',
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: colors.border,
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.btnText,
                      {
                        color: primary
                          ? isDanger
                            ? '#FFFFFF'
                            : colors.onAccent
                          : isCancel
                            ? colors.textMuted
                            : colors.text,
                      },
                    ]}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 20, 40, 0.62)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
  },
  orb: { width: 52, height: 52, borderRadius: 26, marginBottom: 14 },
  brand: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 24,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 6,
  },
  actions: {
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 18,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
  },
});
