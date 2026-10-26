import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingState } from '@/components/loading-state';
import { RedemptionCard } from '@/components/redemption-card';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useRedemptions } from '@/hooks/use-requests';
import { formatPKR, formatPoints } from '@/lib/format';

/**
 * Earnings ledger: the user's redemption requests and the cash paid for them
 * (by the retailer for mechanics, by the RM for retailers).
 */
export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { redemptions, offline } = useRedemptions(user?.phone);
  const mine = (redemptions ?? []).filter((r) => r.from === user?.phone);
  const paid = mine.filter((r) => r.status === 'paid');
  const earned = paid.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const pendingPoints = mine
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + r.points, 0);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Earnings" />
      <FlatList
        data={mine}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        ListHeaderComponent={
          <>
            <View style={styles.summary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{formatPKR(earned)}</Text>
                <Text style={styles.summaryLabel}>Total Earnings</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{paid.length}</Text>
                <Text style={styles.summaryLabel}>Payments</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{formatPoints(pendingPoints)}</Text>
                <Text style={styles.summaryLabel}>Pending</Text>
              </View>
            </View>
            <Text style={styles.note}>
              Redeem points from the Points screen. When your request is paid, the amount shows
              here.
            </Text>
            {offline && <Text style={styles.offline}>Can&apos;t reach the server. Retrying...</Text>}
          </>
        }
        ListEmptyComponent={
          redemptions === null ? (
            <LoadingState />
          ) : (
            <View style={styles.empty}>
              <MaterialIcons name="payments" size={56} color={Colors.surfaceDivider} />
              <Text style={styles.emptyTitle}>No earnings yet</Text>
            </View>
          )
        }
        renderItem={({ item }) => <RedemptionCard request={item} viewer={user?.phone} />}
      />
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
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 13,
    backgroundColor: Colors.surface,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  summaryValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 17,
    color: Colors.text,
  },
  summaryLabel: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.surfaceLabel,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.surfaceDivider,
  },
  note: {
    marginTop: 10,
    marginBottom: 14,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  offline: {
    marginBottom: 10,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.error,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyTitle: {
    marginTop: 8,
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.textMuted,
  },
});
