import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../features/auth/AuthProvider';
import { useAppTheme } from '../lib/useAppTheme';
import { AuthNavigator } from './AuthNavigator';
import { MainTabs } from './MainTabs';
import { PlayerScreen } from '../features/player/PlayerScreen';
import { PlaylistDetailScreen } from '../features/library/PlaylistDetailScreen';
import { CategoryDetailScreen } from '../features/library/CategoryDetailScreen';
import { PaymentCheckoutScreen } from '../features/premium/PaymentCheckoutScreen';
import { MyPaymentsScreen } from '../features/premium/MyPaymentsScreen';
import { AdminPaymentsScreen } from '../features/premium/AdminPaymentsScreen';
import { MixStudioScreen } from '../features/premium/MixStudioScreen';
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
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppStack() {
  const { colors } = useAppTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Player" component={PlayerScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
      <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
      <Stack.Screen name="PaymentCheckout" component={PaymentCheckoutScreen} />
      <Stack.Screen name="MyPayments" component={MyPaymentsScreen} />
      <Stack.Screen name="AdminPayments" component={AdminPaymentsScreen} />
      <Stack.Screen name="AdminHub" component={AdminHubScreen} />
      <Stack.Screen name="MixStudio" component={MixStudioScreen} />
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
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const { session, loading } = useAuth();
  const { colors, isDark } = useAppTheme();

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
    <NavigationContainer theme={navTheme}>
      {session ? <AppStack /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
