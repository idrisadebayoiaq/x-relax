import { ActivityIndicator, View } from 'react-native';
import { useState } from 'react';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../features/auth/AuthProvider';
import { useAppTheme } from '../lib/useAppTheme';
import { AuthNavigator } from './AuthNavigator';
import { MainTabs } from './MainTabs';
import { MiniPlayer } from './MiniPlayer';
import { navigationRef } from './navigationRef';
import { getActiveRouteName } from './getActiveRouteName';
import { useHardwareBackHandler } from './useHardwareBackHandler';
import { PlayerScreen } from '../features/player/PlayerScreen';
import { PlaylistDetailScreen } from '../features/library/PlaylistDetailScreen';
import { PlaylistsListScreen } from '../features/library/PlaylistsListScreen';
import {
  FavouritesListScreen,
  DownloadsListScreen,
  LibraryMixesScreen,
} from '../features/library/LibrarySectionScreens';
import { CategoryDetailScreen } from '../features/library/CategoryDetailScreen';
import { PaymentCheckoutScreen } from '../features/premium/PaymentCheckoutScreen';
import { MyPaymentsScreen } from '../features/premium/MyPaymentsScreen';
import { AdminPaymentsScreen } from '../features/premium/AdminPaymentsScreen';
import { MixStudioScreen } from '../features/premium/MixStudioScreen';
import { SleepTimeScreen } from '../features/premium/SleepTimeScreen';
import { BecomeCreatorScreen } from '../features/creator/BecomeCreatorScreen';
import { CreatorUploadScreen } from '../features/creator/CreatorUploadScreen';
import { CreatorSoundsScreen } from '../features/creator/CreatorSoundsScreen';
import { CreatorVerificationScreen } from '../features/creator/CreatorVerificationScreen';
import { CreatorWithdrawalsScreen } from '../features/creator/CreatorWithdrawalsScreen';
import { AdminHubScreen } from '../features/creator/AdminHubScreen';
import { AdminModerationScreen } from '../features/creator/AdminModerationScreen';
import { AdminVerificationsScreen } from '../features/creator/AdminVerificationsScreen';
import { AdminWithdrawalsScreen } from '../features/creator/AdminWithdrawalsScreen';
import { NotificationsScreen } from '../features/home/NotificationsScreen';
import { LegalScreen } from '../features/home/LegalScreen';
import { CategoriesAllScreen } from '../features/library/CategoriesAllScreen';
import { TrendingAllScreen } from '../features/library/TrendingAllScreen';
import { PremiumScreen } from '../features/premium/PremiumScreen';
import { CreatorScreen } from '../features/creator/CreatorScreen';
import { CreatorProfileScreen } from '../features/creator/CreatorProfileScreen';
import { SettingsScreen } from '../features/home/SettingsScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_SCREEN_NAMES = new Set(['Home', 'Search', 'Library', 'Profile']);

function AppStack({ stackRoute }: { stackRoute: string | undefined }) {
  const { colors } = useAppTheme();
  const onTabRoot =
    stackRoute === 'Tabs' || (stackRoute != null && TAB_SCREEN_NAMES.has(stackRoute));
  const showFloating = !!stackRoute && !onTabRoot && stackRoute !== 'Player';

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Tabs" component={MainTabs} />
        <Stack.Screen name="Player" component={PlayerScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
        <Stack.Screen name="PlaylistsList" component={PlaylistsListScreen} />
        <Stack.Screen name="FavouritesList" component={FavouritesListScreen} />
        <Stack.Screen name="DownloadsList" component={DownloadsListScreen} />
        <Stack.Screen name="LibraryMixes" component={LibraryMixesScreen} />
        <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
        <Stack.Screen name="CategoriesAll" component={CategoriesAllScreen} />
        <Stack.Screen name="TrendingAll" component={TrendingAllScreen} />
        <Stack.Screen name="Premium" component={PremiumScreen} />
        <Stack.Screen name="Creator" component={CreatorScreen} />
        <Stack.Screen name="CreatorProfile" component={CreatorProfileScreen} />
        <Stack.Screen name="PaymentCheckout" component={PaymentCheckoutScreen} />
        <Stack.Screen name="MyPayments" component={MyPaymentsScreen} />
        <Stack.Screen name="AdminPayments" component={AdminPaymentsScreen} />
        <Stack.Screen name="AdminHub" component={AdminHubScreen} />
        <Stack.Screen name="MixStudio" component={MixStudioScreen} />
        <Stack.Screen name="SleepTime" component={SleepTimeScreen} />
        <Stack.Screen name="BecomeCreator" component={BecomeCreatorScreen} />
        <Stack.Screen name="CreatorUpload" component={CreatorUploadScreen} />
        <Stack.Screen name="CreatorSounds" component={CreatorSoundsScreen} />
        <Stack.Screen name="CreatorVerification" component={CreatorVerificationScreen} />
        <Stack.Screen name="CreatorWithdrawals" component={CreatorWithdrawalsScreen} />
        <Stack.Screen name="AdminModeration" component={AdminModerationScreen} />
        <Stack.Screen name="AdminVerifications" component={AdminVerificationsScreen} />
        <Stack.Screen name="AdminWithdrawals" component={AdminWithdrawalsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Legal" component={LegalScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
      {showFloating ? <MiniPlayer floating /> : null}
    </View>
  );
}

export function RootNavigator() {
  const { session, loading } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [stackRoute, setStackRoute] = useState<string | undefined>('Tabs');

  useHardwareBackHandler();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.icon} size="large" />
      </View>
    );
  }

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      primary: colors.text,
    },
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onStateChange={(state) => {
        setStackRoute(getActiveRouteName(state));
      }}
    >
      {session ? <AppStack stackRoute={stackRoute} /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
