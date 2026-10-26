import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingState } from '@/components/loading-state';
import { OrderCard } from '@/components/order-card';
import { ScreenHeader } from '@/components/screen-header';
import { SegmentTabs } from '@/components/segment-tabs';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useOrders } from '@/hooks/use-orders';

type OrdersView = 'mine' | 'mechanics';

/** Mechanic: their own orders. Retailer: their own orders and those placed by their mechanics. */
export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { orders, offline } = useOrders(user?.phone);
  const isMechanic = user?.role === 'mechanic';
  const [view, setView] = useState<OrdersView>('mine');
  const showMine = isMechanic || view === 'mine';
  const visible = (orders ?? []).filter((o) =>
    showMine ? o.placedBy === user?.phone : o.placedBy !== user?.phone
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Orders" />
      <FlatList
        data={visible}
        keyExtractor={(o) => o.id}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        ListHeaderComponent={
          <>
            {!isMechanic && (
              <SegmentTabs<OrdersView>
                value={view}
                onChange={setView}
                options={[
                  { value: 'mine', label: 'My Orders' },
                  { value: 'mechanics', label: 'Mechanic Orders' },
                ]}
              />
            )}
            {offline && <Text style={styles.offline}>Can&apos;t reach the server. Retrying...</Text>}
          </>
        }
        ListEmptyComponent={
          orders === null ? (
            <LoadingState label="Loading orders..." />
          ) : (
            <View style={styles.empty}>
              <MaterialIcons name="receipt-long" size={52} color={Colors.surfaceDivider} />
              <Text style={styles.emptyText}>
                {showMine
                  ? 'No orders yet. Order parts from Item Schemes.'
                  : 'Orders placed by your mechanics will appear here.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <OrderCard order={item} viewer={user?.phone ?? ''} />
        )}
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
  offline: {
    marginBottom: 10,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.error,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 50,
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
