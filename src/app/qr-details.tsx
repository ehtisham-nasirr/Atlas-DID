import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { type ScanRecord, useActivity } from '@/context/activity';
import { formatDateTime, formatValue } from '@/lib/format';

export default function QrDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { scans, totalEarned, unit } = useActivity();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="QR Details" />
      <FlatList
        data={scans}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        ListHeaderComponent={
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{scans.length}</Text>
              <Text style={styles.summaryLabel}>Total Items Scanned</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatValue(totalEarned, unit)}</Text>
              <Text style={styles.summaryLabel}>
                {unit === 'points' ? 'Total Points' : 'Total Scan Amount'}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="qr-code-scanner" size={48} color={Colors.surfaceDivider} />
            <Text style={styles.emptyText}>No QR codes scanned yet.</Text>
            <Pressable
              onPress={() => router.navigate('/scan')}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonText}>Scan Now</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => <ScanRow scan={item} />}
      />
    </View>
  );
}

function ScanRow({ scan }: { scan: ScanRecord }) {
  const { unit, valueOf } = useActivity();
  return (
    <View style={styles.card}>
      <View style={styles.cardIcon}>
        <MaterialIcons name="qr-code-2" size={22} color={Colors.barLogout} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>
          {scan.product.name} ({scan.product.model})
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {scan.serial ? `SKU ${scan.product.sku} · Serial ${scan.serial}` : `Code: ${scan.code}`}
        </Text>
        <Text style={styles.cardMeta}>{formatDateTime(scan.date)}</Text>
      </View>
      <View style={styles.pill}>
        <Text style={styles.pillText}>{formatValue(valueOf(scan.product), unit)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: PagePadding + 0.5,
    paddingTop: 16,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 18,
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
    letterSpacing: 0.3,
    color: Colors.surfaceLabel,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.surfaceDivider,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.background,
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.scanButton,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: Fonts.medium,
    fontSize: 14.5,
    color: Colors.text,
  },
  cardMeta: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.bar,
  },
  pillText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.barLogout,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    marginTop: 8,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
  },
  button: {
    marginTop: 20,
    height: 48,
    paddingHorizontal: 32,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  buttonPressed: {
    backgroundColor: Colors.barIndicator,
  },
  buttonText: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.barLogout,
  },
});
