import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { type ComponentProps, type ReactNode, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { LoadingState } from '@/components/loading-state';
import { OrderCard } from '@/components/order-card';
import { OrderReviewModal } from '@/components/order-review';
import { useRedemptionDecisions } from '@/components/pay-redemption';
import { RedemptionCard } from '@/components/redemption-card';
import { useRmWide } from '@/components/rm-nav';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useChat } from '@/context/chat';
import { useDirectory } from '@/data/directory';
import { ROLE_LABEL } from '@/data/mock';
import { useOrders } from '@/hooks/use-orders';
import { useClaims, useRedemptions } from '@/hooks/use-requests';
import type { Order } from '@/lib/orders-api';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * RM dashboard: what needs a decision (orders, claims, redeem requests), the network at a glance,
 * then the orders and redeem requests themselves. Two columns on desktop, one on phones.
 */
export default function RmHomeScreen() {
  const wide = useRmWide();
  const { user } = useAuth();
  const directory = useDirectory();
  const { unreadCount, conversations } = useChat();
  const { orders: loadedOrders } = useOrders(user?.phone);
  const [reviewing, setReviewing] = useState<Order | null>(null);
  // Reviews made here show at once, before the next refresh from the server.
  const [reviewed, setReviewed] = useState<Record<string, Order>>({});
  const orders = loadedOrders
    ?.map((o) => reviewed[o.id] ?? o)
    .sort((a, b) => Number(b.status === 'placed') - Number(a.status === 'placed'));
  const pendingOrders = (orders ?? []).filter((o) => o.status === 'placed').length;
  const { claims } = useClaims(user?.phone);
  const { redemptions } = useRedemptions(user?.phone);
  const claimsToReview = (claims ?? []).filter(
    (c) => c.to === user?.phone && (c.status === 'pending' || c.status === 'in-review')
  ).length;
  const decisions = useRedemptionDecisions(user?.phone);
  const redeemIn = (redemptions ?? []).filter((r) => r.to === user?.phone).map(decisions.apply);
  const pendingRedeem = redeemIn.filter((r) => r.status === 'pending').length;

  // Phones: the attention cards scroll down to their section.
  const scroll = useRef<ScrollView>(null);
  const [sectionY, setSectionY] = useState({ orders: 0, redeem: 0 });
  const scrollTo = (section: 'orders' | 'redeem') =>
    scroll.current?.scrollTo({ y: Math.max(0, sectionY[section] - 12), animated: true });

  if (!user) return null;

  // Users in this RM's region.
  const count = (role: 'mechanic' | 'retailer' | 'distributor') =>
    directory.filter((u) => u.role === role && u.rmPhone === user.phone).length;
  const toDo = pendingOrders + claimsToReview + pendingRedeem;

  const ordersSection = (
    <View
      onLayout={(e) => {
        const y = e.nativeEvent.layout.y;
        setSectionY((s) => ({ ...s, orders: y }));
      }}>
      <SectionHeader title="Orders" count={pendingOrders} countLabel="to approve" />
      {orders === undefined ? (
        <LoadingState label="Loading orders..." />
      ) : orders.length === 0 ? (
        <EmptyCard icon="receipt-long" text="Orders placed by mechanics and retailers will appear here." />
      ) : (
        <View>
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} viewer={user.phone} onReview={setReviewing} />
          ))}
        </View>
      )}
    </View>
  );

  const redeemSection = (
    <View
      onLayout={(e) => {
        const y = e.nativeEvent.layout.y;
        setSectionY((s) => ({ ...s, redeem: y }));
      }}>
      <SectionHeader title="Redeem Requests" count={pendingRedeem} countLabel="pending" />
      {redemptions === null ? (
        <LoadingState />
      ) : redeemIn.length === 0 ? (
        <EmptyCard
          icon="redeem"
          text="Points redemption requests from mechanics, retailers and distributors will appear here."
        />
      ) : (
        <View>
          {redeemIn.slice(0, 20).map((r) => (
            <RedemptionCard key={r.id} request={r} viewer={user.phone} onDecide={decisions.onDecide} />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScrollView
      ref={scroll}
      style={styles.screen}
      contentContainerStyle={[styles.content, wide && styles.contentWide]}>
      <View style={[styles.welcome, wide && styles.welcomeWide]}>
        <Avatar name={user.name} photoUrl={user.photoUrl} size={48} />
        <View style={styles.welcomeText}>
          <Text style={[styles.welcomeTitle, wide && styles.welcomeTitleWide]}>
            Welcome, {user.name}
          </Text>
          <Text style={styles.welcomeMeta}>
            {ROLE_LABEL[user.role]} • {user.city}
          </Text>
        </View>
        {wide && (
          <View style={styles.todo}>
            <Text style={styles.todoValue}>{toDo}</Text>
            <Text style={styles.todoLabel}>{toDo === 1 ? 'item needs you' : 'items need you'}</Text>
          </View>
        )}
      </View>

      <Text style={styles.heading}>Needs your attention</Text>
      <View style={styles.attention}>
        <AttentionCard
          icon="receipt-long"
          label="Orders to Approve"
          value={pendingOrders}
          wide={wide}
          onPress={() => scrollTo('orders')}
        />
        <AttentionCard
          icon="assignment-late"
          label="Claims to Review"
          value={claimsToReview}
          wide={wide}
          onPress={() => router.navigate('/rm/claims')}
        />
        <AttentionCard
          icon="redeem"
          label="Redeem Requests"
          value={pendingRedeem}
          wide={wide}
          onPress={() => scrollTo('redeem')}
        />
      </View>

      <Text style={styles.heading}>Your network</Text>
      <View style={styles.network}>
        <NetworkItem icon="build" label="Mechanics" value={count('mechanic')} />
        <View style={styles.networkDivider} />
        <NetworkItem icon="storefront" label="Retailers" value={count('retailer')} />
        <View style={styles.networkDivider} />
        <NetworkItem icon="local-shipping" label="Distributors" value={count('distributor')} />
        <View style={styles.networkDivider} />
        <NetworkItem
          icon={unreadCount > 0 ? 'mark-chat-unread' : 'forum'}
          label={unreadCount > 0 ? 'Unread' : 'Chats'}
          value={unreadCount > 0 ? unreadCount : (conversations?.length ?? 0)}
          onPress={() => router.navigate('/rm/chat')}
        />
      </View>

      {wide ? (
        <View style={styles.columns}>
          <View style={styles.mainColumn}>{ordersSection}</View>
          <View style={styles.sideColumn}>{redeemSection}</View>
        </View>
      ) : (
        <>
          {ordersSection}
          {redeemSection}
        </>
      )}

      {decisions.modal}
      <OrderReviewModal
        order={reviewing}
        rm={user.phone}
        onClose={() => setReviewing(null)}
        onReviewed={(o) => setReviewed((r) => ({ ...r, [o.id]: o }))}
      />
    </ScrollView>
  );
}

function SectionHeader({
  title,
  count,
  countLabel,
}: {
  title: string;
  count: number;
  countLabel: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count > 0 && (
        <View style={styles.countPill}>
          <Text style={styles.countText}>
            {count} {countLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

function AttentionCard({
  icon,
  label,
  value,
  wide,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: number;
  wide: boolean;
  onPress: () => void;
}) {
  const active = value > 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [
        styles.attentionCard,
        wide && styles.attentionCardWide,
        active ? styles.attentionActive : styles.attentionIdle,
        pressed && styles.attentionPressed,
      ]}>
      <View style={[styles.attentionIcon, active && styles.attentionIconActive]}>
        <MaterialIcons name={icon} size={wide ? 24 : 20} color={Colors.barLogout} />
      </View>
      <Text style={[styles.attentionValue, wide && styles.attentionValueWide]}>{value}</Text>
      <Text style={styles.attentionLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function NetworkItem({
  icon,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: number;
  onPress?: () => void;
}) {
  const body: ReactNode = (
    <>
      <MaterialIcons name={icon} size={20} color={Colors.barItemActive} />
      <Text style={styles.networkValue}>{value}</Text>
      <Text style={styles.networkLabel} numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.networkItem}>
      {body}
    </Pressable>
  ) : (
    <View style={styles.networkItem}>{body}</View>
  );
}

function EmptyCard({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.empty}>
      <MaterialIcons name={icon} size={36} color={Colors.surfaceDivider} />
      <Text style={styles.emptyText}>{text}</Text>
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
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: PagePadding + 0.5,
    paddingTop: 16,
    paddingBottom: 32,
  },
  contentWide: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  welcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  welcomeWide: {
    gap: 16,
    paddingVertical: 20,
    paddingHorizontal: 22,
  },
  welcomeText: {
    flex: 1,
  },
  welcomeTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 17,
    color: Colors.text,
  },
  welcomeTitleWide: {
    fontSize: 21,
  },
  welcomeMeta: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.surfaceLabel,
  },
  todo: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: Colors.background,
  },
  todoValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 24,
    lineHeight: 32,
    color: Colors.barItemActive,
  },
  todoLabel: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.surfaceLabel,
  },
  heading: {
    marginTop: 20,
    marginBottom: 10,
    fontFamily: Fonts.medium,
    fontSize: 16.5,
    color: Colors.text,
  },
  attention: {
    flexDirection: 'row',
    gap: 10,
  },
  attentionCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  attentionCardWide: {
    padding: 18,
  },
  attentionIdle: {
    backgroundColor: Colors.background,
    borderColor: Colors.surface,
  },
  attentionActive: {
    backgroundColor: Colors.scanButton,
    borderColor: Colors.bar,
  },
  attentionPressed: {
    opacity: 0.85,
  },
  attentionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  attentionIconActive: {
    backgroundColor: Colors.bar,
  },
  attentionValue: {
    marginTop: 8,
    fontFamily: Fonts.semiBold,
    fontSize: 24,
    lineHeight: 32,
    color: Colors.text,
  },
  attentionValueWide: {
    fontSize: 30,
    lineHeight: 40,
  },
  attentionLabel: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.surfaceLabel,
  },
  network: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.surface,
  },
  networkItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  networkDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.surfaceDivider,
  },
  networkValue: {
    marginTop: 2,
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    lineHeight: 24,
    color: Colors.text,
  },
  networkLabel: {
    fontFamily: Fonts.regular,
    fontSize: 11.5,
    color: Colors.surfaceLabel,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  mainColumn: {
    flex: 3,
  },
  sideColumn: {
    flex: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: Fonts.medium,
    fontSize: 16.5,
    color: Colors.text,
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Colors.bar,
  },
  countText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.barLogout,
  },
  empty: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.surfaceDivider,
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    color: Colors.textMuted,
  },
});
