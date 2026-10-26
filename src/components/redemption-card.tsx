import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { findUserByPhone, ROLE_LABEL, type RedemptionRequest } from '@/data/mock';
import { formatDateTime, formatPKR, formatPoints } from '@/lib/format';

const STATUS = {
  pending: { label: 'Pending', bg: Colors.bar, fg: Colors.barLogout },
  paid: { label: 'Paid', bg: Colors.barItemActive, fg: Colors.background },
  rejected: { label: 'Rejected', bg: Colors.error, fg: Colors.background },
} as const;

/**
 * A points redemption request: cash, or a gift from the rewards list (retailers). `viewer` is the
 * phone of the person looking: the requester sees who it went to, the recipient sees who sent it
 * and (with `onDecide`) can pay / give the gift, or reject it.
 */
export function RedemptionCard({
  request,
  viewer,
  onDecide,
}: {
  request: RedemptionRequest;
  viewer?: string;
  onDecide?: (request: RedemptionRequest, action: 'pay' | 'reject') => void;
}) {
  const outgoing = request.from === viewer;
  const other = findUserByPhone(outgoing ? request.to : request.from);
  const reward = request.rewardTitle;
  const status = STATUS[request.status] ?? STATUS.pending;
  const statusLabel = reward && request.status === 'paid' ? 'Given' : status.label;
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.points}>{formatPoints(request.points)}</Text>
        <View style={[styles.status, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.fg }]}>{statusLabel}</Text>
        </View>
      </View>
      {reward ? (
        <View style={styles.reward}>
          <MaterialIcons name="card-giftcard" size={18} color={Colors.barItemActive} />
          <Text style={styles.rewardText}>Reward: {reward}</Text>
        </View>
      ) : null}
      <Text style={styles.from}>
        {outgoing ? 'To: ' : 'From: '}
        {other ? `${other.name} (${ROLE_LABEL[other.role]})` : outgoing ? request.to : request.from}
      </Text>
      {other ? <Text style={styles.meta}>{other.shopName}</Text> : null}
      <Text style={styles.meta}>
        {request.id} · {formatDateTime(request.date)}
      </Text>
      {request.status === 'paid' && request.amount !== undefined && outgoing && (
        // The requester sees that the money reached them.
        <View style={styles.received}>
          <MaterialIcons name="check-circle" size={18} color={Colors.success} />
          <Text style={styles.receivedText}>
            Received {formatPKR(request.amount)}
            {request.decidedAt ? ` · ${formatDateTime(request.decidedAt)}` : ''}
          </Text>
        </View>
      )}
      {request.status === 'paid' && request.amount !== undefined && !outgoing && (
        <Text style={styles.paid}>
          Paid {formatPKR(request.amount)}
          {request.decidedAt ? ` · ${formatDateTime(request.decidedAt)}` : ''}
        </Text>
      )}
      {request.status === 'paid' && reward ? (
        outgoing ? (
          <View style={styles.received}>
            <MaterialIcons name="check-circle" size={18} color={Colors.success} />
            <Text style={styles.receivedText}>
              Gift received
              {request.decidedAt ? ` · ${formatDateTime(request.decidedAt)}` : ''}
            </Text>
          </View>
        ) : (
          <Text style={styles.paid}>
            Gift given{request.decidedAt ? ` · ${formatDateTime(request.decidedAt)}` : ''}
          </Text>
        )
      ) : null}
      {request.status === 'rejected' && request.decidedAt && (
        <Text style={styles.meta}>Rejected · {formatDateTime(request.decidedAt)}</Text>
      )}
      {onDecide && !outgoing && request.status === 'pending' && (
        <View style={styles.actions}>
          <Pressable
            onPress={() => onDecide(request, 'reject')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, styles.reject, pressed && styles.rejectPressed]}>
            <Text style={[styles.actionText, styles.rejectText]}>Reject</Text>
          </Pressable>
          <Pressable
            onPress={() => onDecide(request, 'pay')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, styles.pay, pressed && styles.payPressed]}>
            <Text style={styles.actionText}>{reward ? 'Mark as Given' : 'Pay & Redeem'}</Text>
          </Pressable>
        </View>
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
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  rewardText: {
    flexShrink: 1,
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.text,
  },
  points: {
    fontFamily: Fonts.semiBold,
    fontSize: 20,
    color: Colors.barItemActive,
  },
  status: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
  from: {
    marginTop: 4,
    fontFamily: Fonts.medium,
    fontSize: 14.5,
    color: Colors.text,
  },
  meta: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  received: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.successSurface,
  },
  receivedText: {
    flexShrink: 1,
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.success,
  },
  paid: {
    marginTop: 6,
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.barItemActive,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  action: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reject: {
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  rejectPressed: {
    backgroundColor: Colors.surface,
  },
  rejectText: {
    color: Colors.error,
  },
  pay: {
    backgroundColor: Colors.bar,
  },
  payPressed: {
    backgroundColor: Colors.barIndicator,
  },
  actionText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.barLogout,
  },
});
