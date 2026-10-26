import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { useBottomBarSpace } from '@/components/bottom-bar';
import { WheelIcon } from '@/components/spin-wheel';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useActivity } from '@/context/activity';
import { useAuth } from '@/context/auth';
import { useChat } from '@/context/chat';
import { useLedger } from '@/hooks/use-ledger';
import { useOrders } from '@/hooks/use-orders';
import { useClaims, useRedemptions } from '@/hooks/use-requests';
import { formatNumber } from '@/lib/format';

export default function HomeScreen() {
  const bottomSpace = useBottomBarSpace();
  const { scans, spinsAvailable, scansToNextSpin } = useActivity();
  const { user } = useAuth();
  const { unreadCount } = useChat();
  const ledger = useLedger();
  const isMechanic = user?.role === 'mechanic';
  const isRetailer = user?.role === 'retailer';
  const isDistributor = user?.role === 'distributor';
  // Retailers and distributors get redeem requests; distributors settle RM-approved claims.
  const { claims } = useClaims(isDistributor ? user?.phone : undefined);
  const { redemptions } = useRedemptions(isRetailer || isDistributor ? user?.phone : undefined);
  // Distributors see orders the RM approved for delivery.
  const { orders } = useOrders(isDistributor ? user?.phone : undefined);
  const toDeliver = (orders ?? []).filter(
    (o) => o.distributor === user?.phone && (o.status === 'approved' || o.status === 'dispatched')
  ).length;
  const toSettle = (claims ?? []).filter(
    (c) => c.distributor === user?.phone && c.status === 'approved'
  ).length;
  const redeemIn = (redemptions ?? []).filter(
    (r) => r.to === user?.phone && r.status === 'pending'
  ).length;
  const redeemButton = (wide: boolean) => (
    <HomeButton
      wide={wide}
      icon={<ButtonIcon name="redeem" />}
      label="Redeem Requests"
      detail={redeemIn > 0 ? `${redeemIn} pending` : 'Pay points redemptions'}
      badge={redeemIn > 0 ? redeemIn : undefined}
      onPress={() => router.push({ pathname: '/requests', params: { tab: 'redeem' } })}
    />
  );

  return (
    <View style={styles.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomSpace + 60 }]}>
        {isDistributor && (
          <Section title="Deliveries">
            <HomeButton
              wide
              icon={<ButtonIcon name="local-shipping" />}
              label="Orders to Deliver"
              detail={
                toDeliver > 0
                  ? `${toDeliver} order${toDeliver > 1 ? 's' : ''} waiting`
                  : 'Orders approved by the Regional Manager'
              }
              badge={toDeliver > 0 ? toDeliver : undefined}
              onPress={() => router.push('/deliveries')}
            />
          </Section>
        )}

        {isDistributor && (
          <Section title="Requests">
            <View style={styles.pair}>
              <HomeButton
                icon={<ButtonIcon name="assignment-turned-in" />}
                label="Approved Claims"
                detail={toSettle > 0 ? `${toSettle} to settle` : 'Approved by the RM'}
                badge={toSettle > 0 ? toSettle : undefined}
                onPress={() =>
                  router.push({
                    pathname: '/requests',
                    params: { tab: 'claims' },
                  })
                }
              />
              {redeemButton(false)}
            </View>
          </Section>
        )}

        {!isDistributor && (
          <Section title="Rewards">
            {isMechanic && (
              <HomeButton
                wide
                icon={<WheelIcon size={46} />}
                label="Spin & Win"
                detail={
                  spinsAvailable > 0
                    ? `${spinsAvailable} spin${spinsAvailable > 1 ? 's' : ''} ready!`
                    : `${scansToNextSpin} more scans to unlock`
                }
                badge={spinsAvailable > 0 ? spinsAvailable : undefined}
                onPress={() => router.push('/spin')}
              />
            )}
            <View style={styles.pair}>
              {isRetailer ? (
                // Retailers earn points from orders and redeem them for gifts.
                <HomeButton
                  icon={<ButtonIcon name="emoji-events" />}
                  label="Rewards"
                  detail={
                    ledger.loading
                      ? 'Redeem gifts'
                      : `${formatNumber(Math.max(0, ledger.remaining))} pts`
                  }
                  onPress={() => router.push('/rewards')}
                />
              ) : (
                <HomeButton
                  icon={<ButtonIcon name="qr-code-2" />}
                  label="QR Details"
                  detail={`${scans.length} scanned`}
                  onPress={() => router.push('/qr-details')}
                />
              )}
              <HomeButton
                icon={<ButtonIcon name="card-giftcard" />}
                label="Item Schemes"
                detail="Order parts"
                onPress={() => router.push('/schemes')}
              />
            </View>
            {isRetailer && (
              <HomeButton
                wide
                icon={<ButtonIcon name="receipt-long" />}
                label="Orders"
                detail="Your orders and your mechanics' orders"
                onPress={() => router.push('/orders')}
              />
            )}
          </Section>
        )}

        {isRetailer && <Section title="Mechanic Requests">{redeemButton(true)}</Section>}

        {!isDistributor && (
          <Section title="Support">
            <HomeButton
              wide
              icon={<ButtonIcon name="chat" />}
              label="Chat"
              detail={
                unreadCount > 0
                  ? `${unreadCount} new message${unreadCount > 1 ? 's' : ''}`
                  : isMechanic
                    ? 'Talk to your retailer and distributor'
                    : 'Talk to your Regional Manager, distributor and mechanics'
              }
              badge={unreadCount > 0 ? unreadCount : undefined}
              onPress={() => router.push('/chat')}
            />
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ButtonIcon({ name }: { name: ComponentProps<typeof MaterialIcons>['name'] }) {
  return (
    <View style={styles.iconBox}>
      <MaterialIcons name={name} size={24} color={Colors.barLogout} />
    </View>
  );
}

function HomeButton({
  icon,
  label,
  detail,
  badge,
  wide,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  badge?: number;
  wide?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        wide ? styles.buttonWide : styles.buttonHalf,
        pressed && styles.buttonPressed,
      ]}>
      {icon}
      <View style={styles.buttonText}>
        <Text style={styles.buttonLabel}>{label}</Text>
        {detail ? (
          <Text style={styles.buttonDetail} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: PagePadding + 0.5,
  },
  section: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  sectionTitle: {
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: Fonts.medium,
    fontSize: 16.5,
    color: Colors.text,
  },
  sectionBody: {
    gap: 10,
  },
  pair: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 13,
    backgroundColor: Colors.background,
  },
  buttonWide: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  buttonHalf: {
    flex: 1,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  buttonPressed: {
    backgroundColor: Colors.scanButton,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  buttonText: {
    flex: 1,
  },
  buttonLabel: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.text,
  },
  buttonDetail: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.barLogout,
  },
  badgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.bar,
  },
});
