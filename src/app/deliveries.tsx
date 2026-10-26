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
import { confirmAction, notify } from '@/lib/dialogs';
import { type Order, updateOrder } from '@/lib/orders-api';

type Tab = 'pending' | 'open' | 'delivered';

/**
 * Distributor: every order meant for them. Orders can only be dispatched once the RM has
 * approved them.
 */
export default function DeliveriesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { orders, offline } = useOrders(user?.phone);
  const [tab, setTab] = useState<Tab>('open');
  // Updates made here show at once, before the next refresh from the server.
  const [updated, setUpdated] = useState<Record<string, Order>>({});

  const mine = (orders ?? [])
    .map((o) => updated[o.id] ?? o)
    .filter((o) => o.distributor === user?.phone);
  const pending = mine.filter((o) => o.status === 'placed');
  const open = mine.filter((o) => o.status === 'approved' || o.status === 'dispatched');
  const done = mine.filter((o) => o.status === 'delivered');
  const lists = { pending, open, delivered: done };

  const advance = (order: Order, action: 'dispatch' | 'deliver') => {
    if (!user) return;
    const run = async () => {
      try {
        const next = await updateOrder(order.id, action);
        setUpdated((u) => ({ ...u, [next.id]: next }));
      } catch (e) {
        notify('Update failed', e instanceof Error ? e.message : 'The order could not be updated. Please try again.');
      }
    };
    if (action === 'deliver') {
      confirmAction('Mark as delivered', `Confirm order ${order.id} has been delivered?`, 'Delivered', run);
    } else {
      run();
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Deliveries" />
      <FlatList
        data={lists[tab]}
        keyExtractor={(o) => o.id}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        ListHeaderComponent={
          <>
            <SegmentTabs<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'pending', label: `Awaiting RM (${pending.length})` },
                { value: 'open', label: `To Deliver (${open.length})` },
                { value: 'delivered', label: `Delivered (${done.length})` },
              ]}
            />
            {offline && <Text style={styles.offline}>Can&apos;t reach the server. Retrying...</Text>}
          </>
        }
        ListEmptyComponent={
          orders === null ? (
            <LoadingState label="Loading orders..." />
          ) : (
            <View style={styles.empty}>
              <MaterialIcons name="local-shipping" size={52} color={Colors.surfaceDivider} />
              <Text style={styles.emptyText}>
                {tab === 'pending'
                  ? 'New orders waiting for the Regional Manager to approve will appear here.'
                  : tab === 'open'
                    ? 'Orders approved by the Regional Manager will appear here for delivery.'
                    : 'Delivered orders will appear here.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <OrderCard order={item} viewer={user?.phone ?? ''} onAdvance={advance} />
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
