import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthProvider';
import type { RootStackParamList } from '../../navigation/types';
import { EmptyBlock, OutlineRow, ScreenScaffold, SectionLabel } from '../../ui/Screen';

export function AdminHubScreen() {
  const { isAdmin } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (!isAdmin) {
    return (
      <ScreenScaffold title="Admin" onBack={() => navigation.goBack()}>
        <EmptyBlock title="Admin only" body="You do not have access to admin tools." />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      title="Admin"
      subtitle="In-app operations · admin accounts only"
      onBack={() => navigation.goBack()}
      contentStyle={{ paddingBottom: 48 }}
    >
      <SectionLabel>Queues</SectionLabel>
      <OutlineRow
        label="Payments"
        hint="Approve or reject Premium proofs"
        icon="card-outline"
        onPress={() => navigation.navigate('AdminPayments')}
      />
      <OutlineRow
        label="Sound moderation"
        hint="Publish or reject uploads"
        icon="checkmark-done-outline"
        onPress={() => navigation.navigate('AdminModeration')}
      />
      <OutlineRow
        label="Creator verifications"
        hint="Review verification requests"
        icon="people-outline"
        onPress={() => navigation.navigate('AdminVerifications')}
      />
      <OutlineRow
        label="Withdrawals"
        hint="Approve payouts and mark paid"
        icon="cash-outline"
        onPress={() => navigation.navigate('AdminWithdrawals')}
      />
    </ScreenScaffold>
  );
}
