import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ClaimAction } from '@/components/claim-actions';
import { LoadingState } from '@/components/loading-state';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import {
  type Claim,
  CLAIM_STATUS_LABEL,
  type ClaimStatus,
  findUserByPhone,
  productBySku,
  ROLE_LABEL,
} from '@/data/mock';
import { fileUrl } from '@/lib/chat-api';
import { formatDateTime } from '@/lib/format';

const STATUS_STYLE: Record<ClaimStatus, { bg: string; fg: string }> = {
  pending: { bg: Colors.bar, fg: Colors.barLogout },
  'in-review': { bg: Colors.scanButton, fg: Colors.barLogout },
  approved: { bg: Colors.barItemActive, fg: Colors.background },
  rejected: { bg: Colors.error, fg: Colors.background },
  settled: { bg: Colors.barLogout, fg: Colors.bar },
};

/**
 * Claims list with status counts. Users see their own claims, the RM the claims sent to them and
 * the distributor the approved claims they settle. With `onAction`, the RM can approve or reject
 * pending claims sent to `viewer`, and the distributor can settle approved claims.
 */
export function ClaimsView({
  claims,
  emptyText,
  bottomPadding,
  action,
  top,
  showSender,
  viewer,
  onAction,
  loading,
}: {
  claims: Claim[];
  emptyText: string;
  bottomPadding: number;
  /** Shown under the status counts, e.g. a "New Claim" button. */
  action?: ReactNode;
  /** Shown above the status counts, e.g. tabs. */
  top?: ReactNode;
  /** Show who filed each claim (for claims received from others). */
  showSender?: boolean;
  /** Phone of the person looking. */
  viewer?: string;
  onAction?: (claim: Claim, action: ClaimAction) => void;
  /** True until the claims have loaded for the first time. */
  loading?: boolean;
}) {
  const count = (status: ClaimStatus) => claims.filter((c) => c.status === status).length;

  return (
    <View style={styles.screen}>
      <FlatList
        data={[...claims].sort((a, b) => b.date.localeCompare(a.date))}
        keyExtractor={(c) => c.id}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        ListHeaderComponent={
          <>
            {top}
            <View style={styles.summary}>
              <SummaryItem label="Total" value={claims.length} />
              <View style={styles.divider} />
              <SummaryItem label="Pending" value={count('pending') + count('in-review')} />
              <View style={styles.divider} />
              <SummaryItem label="Approved" value={count('approved') + count('settled')} />
              <View style={styles.divider} />
              <SummaryItem label="Rejected" value={count('rejected')} />
            </View>
            {action}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState />
          ) : (
            <View style={styles.empty}>
              <MaterialIcons name="assignment" size={52} color={Colors.surfaceDivider} />
              <Text style={styles.emptyTitle}>No claims yet</Text>
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ClaimCard claim={item} showSender={showSender} viewer={viewer} onAction={onAction} />
        )}
      />
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ClaimCard({
  claim,
  showSender,
  viewer,
  onAction,
}: {
  claim: Claim;
  showSender?: boolean;
  viewer?: string;
  onAction?: (claim: Claim, action: ClaimAction) => void;
}) {
  const product = productBySku(claim.sku);
  const sender = showSender && claim.from ? findUserByPhone(claim.from) : undefined;
  const distributor = claim.distributor ? findUserByPhone(claim.distributor) : undefined;
  const status = STATUS_STYLE[claim.status] ?? STATUS_STYLE.pending;
  const canDecide =
    onAction && viewer === claim.to && (claim.status === 'pending' || claim.status === 'in-review');
  const canSettle = onAction && viewer === claim.distributor && claim.status === 'approved';
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {product ? `${product.name} (${product.model})` : claim.sku}
        </Text>
        <View style={[styles.status, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.fg }]}>
            {CLAIM_STATUS_LABEL[claim.status]}
          </Text>
        </View>
      </View>
      {sender && (
        <Text style={styles.sender}>
          From: {sender.name} ({ROLE_LABEL[sender.role]}) · {sender.shopName}
        </Text>
      )}
      {sender && <Text style={styles.cardMeta}>Phone: {sender.phone}</Text>}
      <Text style={styles.cardMeta}>Quantity: {claim.quantity}</Text>
      <Text style={styles.cardMeta}>Details: {claim.reason}</Text>
      {claim.trackingId ? (
        <Text style={styles.cardMeta}>TCS Tracking ID: {claim.trackingId}</Text>
      ) : null}
      {claim.photos && claim.photos.length > 0 && (
        <View style={styles.photos}>
          {claim.photos.map((path) => (
            <Image
              key={path}
              source={{ uri: fileUrl(path) }}
              style={styles.photo}
              contentFit="cover"
            />
          ))}
        </View>
      )}
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>
          {claim.id} · {formatDateTime(claim.date)}
        </Text>
        {claim.routedTo && (
          <Text style={styles.routed}>
            Sent to{' '}
            {claim.routedTo === 'rm'
              ? 'Regional Manager'
              : claim.routedTo === 'retailer'
                ? 'Retailer'
                : 'Distributor'}
          </Text>
        )}
        {claim.decidedAt && (
          <Text style={styles.cardMeta}>
            {claim.status === 'rejected' ? 'Rejected' : 'Approved'} by Regional Manager ·{' '}
            {formatDateTime(claim.decidedAt)}
          </Text>
        )}
        {distributor && claim.status !== 'rejected' && (
          <Text style={styles.routed}>
            {claim.status === 'settled' ? 'Settled by' : 'To be settled by'} {distributor.name}
            {claim.settledAt ? ` · ${formatDateTime(claim.settledAt)}` : ''}
          </Text>
        )}
      </View>
      {canDecide && (
        <View style={styles.actions}>
          <ActionButton label="Reject" danger onPress={() => onAction(claim, 'reject')} />
          <ActionButton label="Approve" onPress={() => onAction(claim, 'approve')} />
        </View>
      )}
      {canSettle && (
        <View style={styles.actions}>
          <ActionButton label="Mark as Settled" onPress={() => onAction(claim, 'settle')} />
        </View>
      )}
    </View>
  );
}

function ActionButton({
  label,
  danger,
  onPress,
}: {
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        danger ? styles.reject : styles.approve,
        pressed && (danger ? styles.rejectPressed : styles.approvePressed),
      ]}>
      <Text style={[styles.actionText, danger && styles.rejectText]}>{label}</Text>
    </Pressable>
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
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 13,
    backgroundColor: Colors.surface,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontFamily: Fonts.medium,
    fontSize: 22,
    lineHeight: 30,
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
  empty: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 8,
    fontFamily: Fonts.medium,
    fontSize: 16,
    color: Colors.text,
  },
  emptyText: {
    marginTop: 4,
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: Colors.textMuted,
  },
  card: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 13,
    backgroundColor: Colors.background,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.08)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4,
  },
  cardTitle: {
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: 14.5,
    color: Colors.text,
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
  cardMeta: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  cardFooter: {
    marginTop: 8,
    gap: 2,
  },
  photos: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  sender: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.text,
  },
  routed: {
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    color: Colors.barItemActive,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  action: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approve: {
    backgroundColor: Colors.bar,
  },
  approvePressed: {
    backgroundColor: Colors.barIndicator,
  },
  reject: {
    backgroundColor: Colors.surface,
  },
  rejectPressed: {
    backgroundColor: Colors.surfaceDivider,
  },
  actionText: {
    fontFamily: Fonts.medium,
    fontSize: 14.5,
    color: Colors.barLogout,
  },
  rejectText: {
    color: Colors.error,
  },
});
