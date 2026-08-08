import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
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
import { RootNavigator } from './src/navigation/RootNavigator';
import { SleepTimeScheduler } from './src/features/premium/SleepTimeScheduler';
import { useAuth } from './src/features/auth/AuthProvider';
import { useAppTheme } from './src/lib/useAppTheme';
import { isSupabaseConfigured } from './src/lib/supabase';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

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
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.crash}>
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
      <View style={styles.crash}>
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
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <>
      <RootNavigator />
      {session ? <SleepTimeScheduler /> : null}
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

  if (!fontsLoaded) {
    return (
      <View style={styles.crash}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ConfigGate>
          <AuthProvider>
            <PlayerProvider>
              <MixProvider>
                <AppShell />
              </MixProvider>
            </PlayerProvider>
          </AuthProvider>
        </ConfigGate>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  crash: {
    flex: 1,
    backgroundColor: '#000',
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
