import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppHeader, ScreenTitle } from '@/components/app-header';
import { useBottomBarSpace } from '@/components/bottom-bar';
import { LoadingState } from '@/components/loading-state';
import { RedeemPointsButton } from '@/components/redeem-points';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useActivity } from '@/context/activity';
import { useAuth } from '@/context/auth';
import { ORDER_POINT_RATES, type Transaction, type Unit } from '@/data/mock';
import { useLedger } from '@/hooks/use-ledger';
import { useRewards } from '@/hooks/use-requests';
import { notify } from '@/lib/dialogs';
import { dayKey, formatDateTime, formatDay, formatNumber, formatValue } from '@/lib/format';

type Filter = 'all' | 'received' | 'sent';

/** Wording for the cash ledger (retailers, distributors) and the points ledger (mechanics). */
const COPY = {
  cash: { title: 'Cash Ledger', received: 'Received', sent: 'Sent' },
  points: { title: 'Points Ledger', received: 'Earned', sent: 'Redeemed' },
} as const;
type Copy = (typeof COPY)[Unit];

export default function LedgerScreen() {
  const bottomSpace = useBottomBarSpace();
  const { user } = useAuth();
  const { unit } = useActivity();
  // Mechanics, retailers and distributors redeem points (the RM portal has no Points tab).
  const canRedeem = user !== null && user.role !== 'rm';
  // Retailers redeem their points for gifts from the rewards list instead of cash.
  const isRetailer = user?.role === 'retailer';
  const { transactions, received, sent, pendingOrderPoints, loading } = useLedger();
  const copy = COPY[unit];
  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All Transactions' },
    { value: 'received', label: copy.received },
    { value: 'sent', label: copy.sent },
  ];
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [filterOpen, setFilterOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const visible = transactions
    .filter((t) => filter === 'all' || t.type === filter)
    .filter((t) => !q || t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));

  const sections: { key: string; title: string; data: Transaction[] }[] = [];
  for (const t of visible) {
    const key = dayKey(t.date);
    const last = sections[sections.length - 1];
    if (last?.key === key) last.data.push(t);
    else sections.push({ key, title: formatDay(t.date), data: [t] });
  }

  const downloadPdf = async () => {
    const html = ledgerHtml(visible, unit, {
      sent,
      received,
      name: user?.name,
      phone: user?.phone,
      shop: user?.shopName,
    });
    try {
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: copy.title,
        UTI: 'com.adobe.pdf',
      });
    } catch {
      notify('Download failed', 'The PDF could not be created. Please try again.');
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpace + 130 }]}
        ListHeaderComponent={
          <>
            <View style={styles.titleRow}>
              <ScreenTitle>{copy.title}</ScreenTitle>
              <Pressable
                onPress={downloadPdf}
                style={({ pressed }) => [styles.pdfButton, pressed && styles.pressed]}
                accessibilityRole="button">
                <MaterialIcons name="file-download" size={18} color={Colors.barLogout} />
                <Text style={styles.pdfText}>Download PDF</Text>
              </Pressable>
            </View>

            {canRedeem && (
              <Pressable
                onPress={() => router.push(isRetailer ? '/rewards' : '/earnings')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.earnings, pressed && styles.earningsPressed]}>
                <View style={styles.earningsIcon}>
                  <MaterialIcons name={isRetailer ? 'card-giftcard' : 'payments'} size={22} color={Colors.barLogout} />
                </View>
                <View style={styles.earningsText}>
                  <Text style={styles.earningsTitle}>{isRetailer ? 'My Rewards' : 'Earnings'}</Text>
                  <Text style={styles.earningsDetail}>
                    {isRetailer ? 'Redeem points for gifts' : 'View your earnings ledger'}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
              </Pressable>
            )}
            {loading ? (
              <View style={styles.statusCard}>
                <LoadingState label="Loading points..." />
              </View>
            ) : unit === 'points' ? (
              <View style={styles.statusCard}>
                <StatusColumn label="Total" value={received} />
                <View style={styles.statusDivider} />
                <StatusColumn label="Redeemed" value={sent} />
                <View style={styles.statusDivider} />
                <StatusColumn label="Remaining" value={received - sent} />
              </View>
            ) : (
              <View style={styles.totals}>
                <View style={styles.totalCard}>
                  <Text style={styles.totalValue}>{formatValue(sent, unit)}</Text>
                  <Text style={styles.totalLabel}>{copy.sent}</Text>
                </View>
                <View style={[styles.totalCard, styles.totalCardReceived]}>
                  <Text style={styles.totalValue}>{formatValue(received, unit)}</Text>
                  <Text style={styles.totalLabel}>{copy.received}</Text>
                </View>
              </View>
            )}
            {!loading && isRetailer ? (
              <NextRewardCard remaining={received - sent} pending={pendingOrderPoints} />
            ) : null}

            <View style={styles.searchRow}>
              <View style={styles.search}>
                <MaterialIcons name="search" size={22} color={Colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search transactions"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.searchInput}
                  cursorColor={Colors.text}
                  selectionColor={Colors.bar}
                />
              </View>
              <Pressable
                onPress={() => setFilterOpen(true)}
                style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
                accessibilityRole="button">
                <MaterialIcons name="filter-list" size={20} color={Colors.barLogout} />
                <Text style={styles.filterText}>Filter</Text>
                {filter !== 'all' && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>1</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.dayRow}>
            <Text style={styles.dayText}>{section.title}</Text>
            <View style={styles.dayCount}>
              <Text style={styles.dayCountText}>{section.data.length}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => <TransactionCard item={item} unit={unit} copy={copy} />}
        ListEmptyComponent={
          loading ? null : <Text style={styles.empty}>No transactions found.</Text>
        }
      />

      {canRedeem && (
        <RedeemPointsButton
          available={received - sent}
          bottom={bottomSpace + 58}
          onPress={isRetailer ? () => router.push('/rewards') : undefined}
          label={isRetailer ? 'Redeem Rewards' : undefined}
        />
      )}

      <Modal
        visible={filterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFilterOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Filter</Text>
            {filters.map((f) => (
              <Pressable
                key={f.value}
                style={styles.sheetOption}
                onPress={() => {
                  setFilter(f.value);
                  setFilterOpen(false);
                }}>
                <MaterialIcons
                  name={filter === f.value ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={22}
                  color={filter === f.value ? Colors.barItemActive : Colors.textMuted}
                />
                <Text style={styles.sheetOptionText}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function StatusColumn({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statusColumn}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue} numberOfLines={1} adjustsFontSizeToFit>
        {formatNumber(value)}
      </Text>
    </View>
  );
}

/**
 * Retailers: how far they are from the next reward, points on the way from undelivered orders,
 * and how points are earned. Opens the Rewards screen.
 */
function NextRewardCard({ remaining, pending }: { remaining: number; pending: number }) {
  const { user } = useAuth();
  const { rewards } = useRewards(user?.phone);
  const tiers = [...new Set((rewards ?? []).map((r) => r.points))].sort((a, b) => a - b);
  const next = tiers.find((p) => p > remaining);
  const gifts = (rewards ?? []).filter((r) => r.points === next).map((r) => r.title);
  const affordable = (rewards ?? []).filter((r) => r.points <= remaining).length;
  const progress = next ? Math.max(0, Math.min(1, remaining / next)) : 1;

  return (
    <Pressable
      onPress={() => router.push('/rewards')}
      accessibilityRole="button"
      style={({ pressed }) => [styles.next, pressed && styles.nextPressed]}>
      <View style={styles.nextTop}>
        <MaterialIcons name="emoji-events" size={22} color={Colors.barItemActive} />
        <Text style={styles.nextTitle}>
          {next
            ? `${formatNumber(Math.ceil((next - remaining) * 10) / 10)} more pts for ${gifts.join(' or ')}`
            : rewards === null
              ? 'Rewards'
              : 'You can redeem any reward!'}
        </Text>
      </View>
      {next ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      ) : null}
      {affordable > 0 ? (
        <Text style={styles.nextReady}>
          {affordable} reward{affordable > 1 ? 's' : ''} ready to redeem ›
        </Text>
      ) : null}
      {pending > 0 ? (
        <Text style={styles.nextPending}>
          +{formatNumber(pending)} pts on the way from orders not yet delivered
        </Text>
      ) : null}
      <Text style={styles.nextRates}>Points per unit ordered: {ORDER_POINT_RATES}</Text>
    </Pressable>
  );
}

function TransactionCard({ item, unit, copy }: { item: Transaction; unit: Unit; copy: Copy }) {
  const isSent = item.type === 'sent';
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardMeta}>{item.subtitle}</Text>
      <View style={[styles.tag, isSent && styles.tagSent]}>
        <Text style={[styles.tagText, isSent && styles.tagTextSent]}>{item.note}</Text>
      </View>
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.cardMeta}>Transaction ID</Text>
          <Text style={styles.cardId}>{item.id}</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardMeta}>{isSent ? copy.sent : copy.received}</Text>
          <View style={[styles.amountPill, isSent && styles.amountPillSent]}>
            <Text style={[styles.amountText, isSent && styles.amountTextSent]}>
              {formatValue(item.amount, unit)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Printable version of the ledger for the PDF download. */
function ledgerHtml(
  rows: Transaction[],
  unit: Unit,
  info: { sent: number; received: number; name?: string; phone?: string; shop?: string }
) {
  const copy = COPY[unit];
  const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const box = (value: string, label: string) => `<div class="box"><b>${escape(value)}</b>${label}</div>`;
  const totals =
    unit === 'points'
      ? box(formatNumber(info.received), 'Total') +
        box(formatNumber(info.sent), 'Redeemed') +
        box(formatNumber(info.received - info.sent), 'Remaining')
      : box(formatValue(info.sent, unit), copy.sent) + box(formatValue(info.received, unit), copy.received);
  const body = rows
    .map(
      (t) => `<tr>
        <td>${escape(formatDateTime(t.date))}</td>
        <td>${escape(t.id)}</td>
        <td>${escape(t.title)}</td>
        <td>${t.type === 'sent' ? copy.sent : copy.received}</td>
        <td class="num">${escape(formatValue(t.amount, unit))}</td>
      </tr>`
    )
    .join('');
  return `<html><head><meta charset="utf-8" /><style>
    body { font-family: Helvetica, Arial, sans-serif; color: #222; padding: 24px; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    .muted { color: ${Colors.textMuted}; font-size: 12px; }
    .totals { display: flex; gap: 16px; margin: 16px 0; }
    .box { flex: 1; background: ${Colors.surface}; border-radius: 10px; padding: 12px; text-align: center; }
    .box b { display: block; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: ${Colors.bar}; text-align: left; padding: 8px; }
    td { border-bottom: 1px solid #ddd; padding: 8px; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
  </style></head><body>
    <h1>Atlas - ${copy.title}</h1>
    <div class="muted">${escape(info.name ?? '')} · ${escape(info.phone ?? '')} · ${escape(info.shop ?? '')}</div>
    <div class="muted">Generated ${escape(formatDateTime(new Date().toISOString()))}</div>
    <div class="totals">${totals}</div>
    <table>
      <thead><tr><th>Date</th><th>Transaction ID</th><th>Description</th><th>Type</th><th class="num">Amount</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </body></html>`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: PagePadding + 0.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: Colors.bar,
  },
  pdfText: {
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    color: Colors.barLogout,
  },
  pressed: {
    backgroundColor: Colors.barIndicator,
  },
  totals: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  next: {
    gap: 8,
    marginTop: 2,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.bar,
    backgroundColor: Colors.background,
  },
  nextPressed: {
    backgroundColor: Colors.surface,
  },
  nextTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextTitle: {
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.text,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.bar,
  },
  nextReady: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.success,
  },
  nextPending: {
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    color: Colors.barItemActive,
  },
  nextRates: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  earnings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: Colors.bar,
    backgroundColor: Colors.background,
  },
  earningsPressed: {
    backgroundColor: Colors.surface,
  },
  earningsIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  earningsText: {
    flex: 1,
  },
  earningsTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.text,
  },
  earningsDetail: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  statusCard: {
    marginTop: 14,
    height: 99.5,
    borderRadius: 13,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  statusColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statusDivider: {
    width: 1,
    height: 47,
    backgroundColor: Colors.surfaceDivider,
  },
  statusLabel: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.3,
    color: Colors.surfaceLabel,
  },
  statusValue: {
    marginTop: 5,
    fontFamily: Fonts.medium,
    fontSize: 29,
    lineHeight: 40,
    color: Colors.text,
  },
  totalCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 13,
    backgroundColor: Colors.surface,
  },
  totalCardReceived: {
    borderWidth: 1.5,
    borderColor: Colors.bar,
  },
  totalValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 19,
    color: Colors.text,
  },
  totalLabel: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.surfaceLabel,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: Colors.surface,
  },
  searchInput: {
    flex: 1,
    height: 48,
    padding: 0,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.text,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 13,
    backgroundColor: Colors.bar,
  },
  filterText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.barLogout,
  },
  filterBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.barLogout,
  },
  filterBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: Colors.bar,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  dayText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.text,
  },
  dayCount: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.barLogout,
  },
  dayCountText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.bar,
  },
  card: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 13,
    backgroundColor: Colors.background,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.08)',
  },
  cardTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text,
  },
  cardMeta: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  tag: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Colors.surface,
  },
  tagSent: {
    backgroundColor: Colors.scanButton,
  },
  tagText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.surfaceLabel,
  },
  tagTextSent: {
    color: Colors.barLogout,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cardId: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.text,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  amountPill: {
    marginTop: 2,
    minWidth: 90,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.bar,
  },
  amountPillSent: {
    backgroundColor: Colors.barItemActive,
  },
  amountText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.barLogout,
  },
  amountTextSent: {
    color: Colors.background,
  },
  empty: {
    marginTop: 32,
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.backdrop,
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: Colors.background,
  },
  sheetTitle: {
    marginBottom: 8,
    fontFamily: Fonts.medium,
    fontSize: 16.5,
    color: Colors.text,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  sheetOptionText: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.text,
  },
});
