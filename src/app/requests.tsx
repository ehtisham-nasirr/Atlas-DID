import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useClaimActions } from '@/components/claim-actions';
import { ClaimsView } from '@/components/claims-view';
import { LoadingState } from '@/components/loading-state';
import { useRedemptionDecisions } from '@/components/pay-redemption';
import { RedemptionCard } from '@/components/redemption-card';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useClaims, useRedemptions } from '@/hooks/use-requests';

/**
 * Redeem requests sent to the user (`?tab=redeem`, retailers and distributors), or the claims the
 * RM approved for the distributor to settle (`?tab=claims`). Each has its own button on Home.
 */
export default function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const { tab } = useLocalSearchParams<{ tab?: 'redeem' | 'claims' }>();
  const { user } = useAuth();
  const { claims } = useClaims(user?.phone);
  const { redemptions } = useRedemptions(user?.phone);
  const decisions = useRedemptionDecisions(user?.phone);
  const received = (redemptions ?? [])
    .filter((r) => r.to === user?.phone)
    .map(decisions.apply);
  const claimActions = useClaimActions(user?.phone);
  const toSettle = (claims ?? [])
    .filter((c) => c.distributor === user?.phone)
    .map(claimActions.apply);

  return (
    <View style={styles.screen}>
      <ScreenHeader title={tab === 'claims' ? 'Approved Claims' : 'Redeem Requests'} />
      {tab === 'claims' ? (
        <ClaimsView
          claims={toSettle}
          loading={claims === null}
          showSender
          viewer={user?.phone}
          onAction={claimActions.onAction}
          emptyText="Claims approved by the Regional Manager will appear here for you to settle."
          bottomPadding={insets.bottom + 32}
        />
      ) : (
        <FlatList
          data={received}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          ListEmptyComponent={
            redemptions === null ? (
              <LoadingState />
            ) : (
              <View style={styles.empty}>
                <MaterialIcons name="redeem" size={52} color={Colors.surfaceDivider} />
                <Text style={styles.emptyText}>
                  Points redemption requests sent to you will appear here. Pay them to add the
                  points to your own balance.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <RedemptionCard request={item} viewer={user?.phone} onDecide={decisions.onDecide} />
          )}
        />
      )}
      {decisions.modal}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingTop: 16,
    paddingHorizontal: PagePadding + 0.5,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
  },
});
