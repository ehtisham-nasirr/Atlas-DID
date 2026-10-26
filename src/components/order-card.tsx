import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { findUserByPhone, productBySku } from '@/data/mock';
import { formatDateTime, formatNumber, formatPKR } from '@/lib/format';
import type { Order } from '@/lib/orders-api';

const STATUS = {
  placed: { label: 'Placed', bg: Colors.bar, fg: Colors.barLogout },
  approved: { label: 'Approved', bg: Colors.scanButton, fg: Colors.barLogout },
  dispatched: { label: 'Out for Delivery', bg: Colors.barItemActive, fg: Colors.background },
  delivered: { label: 'Delivered', bg: Colors.barLogout, fg: Colors.bar },
  rejected: { label: 'Rejected', bg: Colors.error, fg: Colors.background },
} as const;

/** Next step the distributor can take on an order. */
const NEXT_STEP = {
  approved: { action: 'dispatch', label: 'Mark as Dispatched' },
  dispatched: { action: 'deliver', label: 'Mark as Delivered' },
} as const;

const nameOf = (phone?: string) => {
  const user = phone ? findUserByPhone(phone) : undefined;
  return user ? `${user.name} (${user.shopName})` : phone ?? '-';
};

/** One parts order. `viewer` is the phone of the person looking, so they are not shown to themselves. */
export function OrderCard({
  order,
  viewer,
  onReview,
  onAdvance,
}: {
  order: Order;
  viewer: string;
  /** When set (RM view), a "Review" button is shown on orders that are still placed. */
  onReview?: (order: Order) => void;
  /** When set (distributor view), shows the next delivery step as a button. */
  onAdvance?: (order: Order, action: 'dispatch' | 'deliver') => void;
}) {
  const units = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const mine = order.placedBy === viewer;
  const status = STATUS[order.status] ?? STATUS.placed;
  const priced = order.total !== undefined && order.status !== 'rejected';
  const isDistributor = order.distributor === viewer;
  const recipient = findUserByPhone(order.placedBy);
  const next = order.status === 'approved' || order.status === 'dispatched' ? NEXT_STEP[order.status] : null;
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.id}>{order.id}</Text>
        <View style={[styles.status, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.fg }]}>{status.label}</Text>
        </View>
      </View>
      <Text style={styles.meta}>{formatDateTime(order.at)}</Text>
      {mine ? (
        <Text style={styles.meta}>
          Sent to Regional Manager{order.retailer ? ' · Retailer' : ''}
        </Text>
      ) : isDistributor ? (
        <Text style={styles.deliverTo}>
          Deliver to: {recipient ? `${recipient.name}, ${recipient.shopName}, ${recipient.city}` : order.placedBy}
        </Text>
      ) : (
        <Text style={styles.meta}>
          {order.placedByRole === 'mechanic' ? 'Mechanic' : 'Retailer'}: {nameOf(order.placedBy)}
        </Text>
      )}
      {!mine && !isDistributor && order.retailer && order.retailer !== viewer && (
        <Text style={styles.meta}>Retailer: {nameOf(order.retailer)}</Text>
      )}

      <View style={styles.items}>
        {order.items.map((item) => {
          const product = productBySku(item.sku);
          return (
            <View key={item.sku} style={styles.item}>
              <Text style={styles.itemName} numberOfLines={1}>
                {product ? `${product.name} - ${product.model}` : item.sku}
              </Text>
              <Text style={styles.qty}>× {item.quantity}</Text>
              {priced && item.unitPrice !== undefined && (
                <Text style={styles.price}>{formatPKR(item.unitPrice * item.quantity)}</Text>
              )}
            </View>
          );
        })}
      </View>
      <Text style={styles.total}>
        Total: {units} item{units > 1 ? 's' : ''}
        {priced && order.total !== undefined ? ` · ${formatPKR(order.total)}` : ''}
      </Text>
      {order.points > 0 && order.status !== 'rejected' ? (
        <Text style={styles.points}>
          {order.status === 'delivered'
            ? `Earned ${formatNumber(order.points)} pts`
            : `+${formatNumber(order.points)} pts on delivery`}
        </Text>
      ) : null}
      {order.status === 'placed' && !mine && order.rm !== viewer && (
        <Text style={styles.reviewed}>Waiting for Regional Manager approval</Text>
      )}
      {order.reviewedAt && (
        <Text style={styles.reviewed}>
          {order.status === 'rejected' ? 'Rejected' : 'Approved'} by Regional Manager ·{' '}
          {formatDateTime(order.reviewedAt)}
          {order.status === 'approved' ? ' · Sent to distributor' : ''}
        </Text>
      )}
      {order.dispatchedAt && (
        <Text style={styles.reviewed}>
          Dispatched by distributor · {formatDateTime(order.dispatchedAt)}
        </Text>
      )}
      {order.deliveredAt && (
        <Text style={styles.reviewed}>Delivered · {formatDateTime(order.deliveredAt)}</Text>
      )}
      {onAdvance && isDistributor && next && (
        <Pressable
          onPress={() => onAdvance(order, next.action)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.review, pressed && styles.reviewPressed]}>
          <Text style={styles.reviewText}>{next.label}</Text>
        </Pressable>
      )}
      {onReview && order.status === 'placed' && (
        <Pressable
          onPress={() => onReview(order)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.review, pressed && styles.reviewPressed]}>
          <Text style={styles.reviewText}>Review Order</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 13,
    backgroundColor: Colors.background,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.08)',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  id: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.text,
  },
  status: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.bar,
  },
  statusText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.barLogout,
  },
  meta: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  items: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 3,
  },
  itemName: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    color: Colors.text,
  },
  qty: {
    fontFamily: Fonts.semiBold,
    fontSize: 13.5,
    color: Colors.barItemActive,
  },
  price: {
    minWidth: 76,
    textAlign: 'right',
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.text,
  },
  deliverTo: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.text,
  },
  reviewed: {
    marginTop: 4,
    textAlign: 'right',
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  review: {
    marginTop: 10,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  reviewPressed: {
    backgroundColor: Colors.barIndicator,
  },
  reviewText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14.5,
    color: Colors.barLogout,
  },
  total: {
    marginTop: 8,
    textAlign: 'right',
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.text,
  },
  points: {
    marginTop: 2,
    textAlign: 'right',
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.success,
  },
});
