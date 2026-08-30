import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/features/auth/AuthProvider';
import { PlayerProvider } from './src/features/player/PlayerProvider';
import { MixProvider } from './src/features/mix/MixProvider';
import { ThemeProvider } from './src/lib/ThemeProvider';
import { AppSettingsProvider } from './src/lib/AppSettingsProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SleepTimeScheduler } from './src/features/premium/SleepTimeScheduler';
import { useAuth } from './src/features/auth/AuthProvider';
import { useAppTheme } from './src/lib/useAppTheme';
import { isSupabaseConfigured } from './src/lib/supabase';
import { recordAppOpen } from './src/lib/analytics';
import { DownloadProvider } from './src/features/downloads/DownloadProvider';
import { DownloadBanner } from './src/features/downloads/DownloadBanner';
import { AppDialogHost } from './src/ui/AppDialog';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function hideSplash() {
  SplashScreen.hideAsync().catch(() => undefined);
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crash', error, info.componentStack);
    hideSplash();
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.center}>
          <Text style={styles.crashTitle}>Something went wrong</Text>
          <Text style={styles.crashBody}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function ConfigGate({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured) {
    return (
      <View style={styles.center}>
        <Text style={styles.crashTitle}>Missing configuration</Text>
        <Text style={styles.crashBody}>
          Supabase env vars were not included in this build. Rebuild with EAS preview env
          (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).
        </Text>
      </View>
    );
  }
  return <>{children}</>;
}

function AppShell() {
  const { isDark } = useAppTheme();
  const { session } = useAuth();

  useEffect(() => {
    hideSplash();
  }, []);

  useEffect(() => {
    if (!session) return;
    void recordAppOpen();
  }, [session]);

  return (
    <>
      <RootNavigator />
      {session ? <SleepTimeScheduler /> : null}
      {session ? <DownloadBanner /> : null}
      <AppDialogHost />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  const [bootReady, setBootReady] = useState(false);

  useEffect(() => {
    hideSplash();
    const timer = setTimeout(hideSplash, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      setBootReady(true);
      hideSplash();
      return;
    }
    const timer = setTimeout(() => {
      setBootReady(true);
      hideSplash();
    }, 3500);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  if (!bootReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#F5C400" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ConfigGate>
          <AuthProvider>
            <ThemeProvider>
              <AppSettingsProvider>
                <PlayerProvider>
                  <MixProvider>
                    <DownloadProvider>
                      <AppShell />
                    </DownloadProvider>
                  </MixProvider>
                </PlayerProvider>
              </AppSettingsProvider>
            </ThemeProvider>
          </AuthProvider>
        </ConfigGate>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#061428',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  crashTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  crashBody: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
