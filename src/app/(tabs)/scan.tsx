import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppHeader, ScreenTitle } from '@/components/app-header';
import { useBottomBarSpace } from '@/components/bottom-bar';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { type ScanRecord, useActivity } from '@/context/activity';
import { useAuth } from '@/context/auth';
import { type Product, SCANS_PER_SPIN } from '@/data/mock';
import { formatDateTime, formatNumber, formatValue } from '@/lib/format';

type Mode = 'cash' | 'check';

type LastResult =
  | { kind: 'added'; scan: ScanRecord }
  | { kind: 'duplicate'; scan: ScanRecord }
  | { kind: 'invalid' }
  /** Scanned before by another account. */
  | { kind: 'used'; at?: string }
  /** The server could not be reached. */
  | { kind: 'error' }
  | { kind: 'check'; product: Product; serial: string; scannedOn?: string }
  | { kind: 'check-invalid' };

/** Pause between reads so one QR code is not picked up several times in a row. */
const SCAN_PAUSE_MS = 2500;
const CAMERA_RADIUS = 13;

export default function ScanScreen() {
  const { width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const bottomSpace = useBottomBarSpace();
  const { scans, totalEarned, scansToNextSpin, addScan, checkCode, unit, valueOf } = useActivity();
  const { user } = useAuth();
  // Retailers earn points from orders, not scans: they only check that a product is genuine.
  const checkOnly = user?.role === 'retailer';
  const isPoints = unit === 'points';
  const scanLabel = isPoints ? 'Points Scan' : 'Cash Amount Scan';
  const [chosenMode, setMode] = useState<Mode>('cash');
  const mode: Mode = checkOnly ? 'check' : chosenMode;
  const [last, setLast] = useState<LastResult | null>(null);
  const paused = useRef(false);

  const boxWidth = width - (PagePadding + 0.5) * 2;
  const boxHeight = Math.round(boxWidth * 0.73);

  const onBarcodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (paused.current) return;
    paused.current = true;
    setTimeout(() => (paused.current = false), SCAN_PAUSE_MS);

    try {
      if (mode === 'cash') {
        const result = await addScan(data);
        setLast(
          result.status === 'invalid'
            ? { kind: 'invalid' }
            : result.status === 'used'
              ? { kind: 'used', at: result.at }
              : { kind: result.status, scan: result.scan }
        );
        Haptics.notificationAsync(
          result.status === 'added'
            ? Haptics.NotificationFeedbackType.Success
            : result.status === 'duplicate'
              ? Haptics.NotificationFeedbackType.Warning
              : Haptics.NotificationFeedbackType.Error
        );
      } else {
        const check = await checkCode(data);
        setLast(check ? { kind: 'check', ...check } : { kind: 'check-invalid' });
        Haptics.notificationAsync(
          check ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
        );
      }
    } catch {
      setLast({ kind: 'error' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setLast(null);
  };

  return (
    <View style={styles.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomSpace + 60 }]}>
        <ScreenTitle style={styles.title}>{checkOnly ? 'Authenticity Check' : 'Scan QR'}</ScreenTitle>

        <View style={[styles.cameraBox, { width: boxWidth, height: boxHeight }]}>
          {permission?.granted ? (
            <>
              {isFocused && (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={onBarcodeScanned}
                />
              )}
              <ScanGuide width={boxWidth} height={boxHeight} />
            </>
          ) : permission ? (
            <View style={styles.permission}>
              <MaterialIcons name="photo-camera" size={36} color={Colors.bar} />
              <Text style={styles.permissionText}>
                Camera access is needed to scan the QR code on the product.
              </Text>
              <Pressable style={styles.permissionButton} onPress={requestPermission}>
                <Text style={styles.permissionButtonText}>Allow Camera</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Retailers only check authenticity, so they get no mode switch. */}
        {!checkOnly && (
          <View style={styles.segment}>
            <SegmentOption label={scanLabel} active={mode === 'cash'} onPress={() => changeMode('cash')} />
            <SegmentOption label="Authenticity Check" active={mode === 'check'} onPress={() => changeMode('check')} />
          </View>
        )}

        {mode === 'cash' ? (
          <View style={styles.resultCard}>
            <Text style={styles.amount}>
              {formatValue(last?.kind === 'added' ? valueOf(last.scan.product) : 0, unit)}
            </Text>
            <Text style={styles.amountLabel}>{isPoints ? 'Item Scan Points' : 'Item Scan Amount'}</Text>
            {last?.kind === 'invalid' && (
              <Text style={styles.errorLine}>This QR code is not an Atlas product.</Text>
            )}
            {last?.kind === 'used' && (
              <Text style={styles.errorLine}>
                This QR code was already used by another account
                {last.at ? ` on ${formatDateTime(last.at)}` : ''}.
              </Text>
            )}
            {last?.kind === 'error' && (
              <Text style={styles.errorLine}>
                Could not reach the server. Check your internet connection and scan again.
              </Text>
            )}
            {last?.kind === 'duplicate' && (
              <Text style={styles.errorLine}>
                This QR code was already scanned on {formatDateTime(last.scan.date)}.
              </Text>
            )}
            {(last?.kind === 'added' || last?.kind === 'duplicate') && (
              <ProductDetails
                product={last.scan.product}
                serial={last.scan.serial}
                valueLabel={isPoints ? 'Points' : 'Amount'}
                value={formatValue(valueOf(last.scan.product), unit)}
              />
            )}
            <View style={styles.totals}>
              <View style={styles.totalBox}>
                <Text style={styles.totalValue}>{scans.length}</Text>
                <Text style={styles.totalLabel}>Total Items Scanned</Text>
              </View>
              <View style={styles.totalBox}>
                <Text style={[styles.totalValue, styles.totalAmount]}>
                  {formatValue(totalEarned, unit)}
                </Text>
                <Text style={styles.totalLabel}>{isPoints ? 'Total Points' : 'Total Scan Amount'}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.resultCard}>
            {last?.kind === 'check' ? (
              <>
                <View style={styles.verifiedIcon}>
                  <MaterialIcons name="verified" size={30} color={Colors.barLogout} />
                </View>
                <Text style={styles.checkTitle}>Genuine Product</Text>
                <ProductDetails
                  product={last.product}
                  serial={last.serial}
                  valueLabel={checkOnly ? 'Order Points' : isPoints ? 'Points' : 'Amount'}
                  value={
                    checkOnly
                      ? `${formatNumber(last.product.orderPoints)} pts / unit`
                      : formatValue(valueOf(last.product), unit)
                  }
                />
                <Text style={styles.checkNote}>
                  {last.scannedOn
                    ? `Already scanned on ${formatDateTime(last.scannedOn)}.`
                    : checkOnly
                      ? 'Not scanned yet.'
                      : `Not scanned yet. Use ${scanLabel} to earn ${formatValue(valueOf(last.product), unit)}.`}
                </Text>
              </>
            ) : last?.kind === 'error' ? (
              <Text style={styles.errorLine}>
                Could not reach the server. Check your internet connection and scan again.
              </Text>
            ) : last?.kind === 'check-invalid' ? (
              <>
                <View style={[styles.verifiedIcon, styles.invalidIcon]}>
                  <MaterialIcons name="gpp-bad" size={30} color={Colors.background} />
                </View>
                <Text style={styles.checkTitle}>Not Recognized</Text>
                <Text style={styles.checkNote}>
                  This QR code is not an Atlas product. The item may not be genuine.
                </Text>
              </>
            ) : (
              <>
                <MaterialIcons name="verified-user" size={34} color={Colors.barItemActive} />
                <Text style={styles.checkNote}>
                  Point the camera at the QR code on the product to check that it is genuine.
                </Text>
              </>
            )}
          </View>
        )}

        {user?.role === 'mechanic' && (
          <Pressable onPress={() => router.push('/spin')} style={styles.spinHint}>
            <Text style={styles.spinHintText}>
              Every {SCANS_PER_SPIN} scans earn 1 spin · {scansToNextSpin} more to go
            </Text>
            <Text style={styles.spinHintLink}>Spin & Win ›</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

/** Product data read from the QR code. */
function ProductDetails({
  product,
  serial,
  valueLabel,
  value,
}: {
  product: Product;
  serial?: string;
  valueLabel: string;
  value: string;
}) {
  const rows: [string, string | undefined][] = [
    ['Product', product.name],
    ['Model', product.model],
    ['SKU', product.sku],
    ['Serial No.', serial],
    [valueLabel, value],
  ];
  return (
    <View style={styles.details}>
      {rows
        .filter(([, v]) => v)
        .map(([label, v]) => (
          <View key={label} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{v}</Text>
          </View>
        ))}
    </View>
  );
}

function SegmentOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.segmentOption, active && styles.segmentOptionActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Rounds the camera's corners (the native preview ignores clipping on Android) and draws a target frame. */
function ScanGuide({ width, height }: { width: number; height: number }) {
  const r = CAMERA_RADIUS;
  const mask =
    `M0 0 H${width} V${height} H0 Z ` +
    `M${r} 0 H${width - r} A${r} ${r} 0 0 1 ${width} ${r} V${height - r} ` +
    `A${r} ${r} 0 0 1 ${width - r} ${height} H${r} A${r} ${r} 0 0 1 0 ${height - r} V${r} ` +
    `A${r} ${r} 0 0 1 ${r} 0 Z`;

  const side = height * 0.62;
  const x0 = (width - side) / 2;
  const y0 = (height - side) / 2;
  const x1 = x0 + side;
  const y1 = y0 + side;
  const arm = side * 0.18;
  const brackets =
    `M${x0} ${y0 + arm} V${y0} H${x0 + arm} ` +
    `M${x1 - arm} ${y0} H${x1} V${y0 + arm} ` +
    `M${x1} ${y1 - arm} V${y1} H${x1 - arm} ` +
    `M${x0 + arm} ${y1} H${x0} V${y1 - arm}`;

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={brackets} stroke={Colors.bar} strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d={mask} fill={Colors.background} fillRule="evenodd" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: PagePadding + 0.5,
  },
  title: {
    marginBottom: 12,
  },
  cameraBox: {
    borderRadius: CAMERA_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  permissionText: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.background,
  },
  permissionButton: {
    marginTop: 14,
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  permissionButtonText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.barLogout,
  },
  segment: {
    flexDirection: 'row',
    marginTop: 16,
    padding: 4,
    borderRadius: 999,
    backgroundColor: Colors.surface,
  },
  segmentOption: {
    flex: 1,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentOptionActive: {
    backgroundColor: Colors.bar,
  },
  segmentText: {
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    color: Colors.textMuted,
  },
  segmentTextActive: {
    color: Colors.barLogout,
  },
  resultCard: {
    marginTop: 16,
    alignItems: 'center',
    padding: 16,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: Colors.bar,
    backgroundColor: Colors.surface,
  },
  amount: {
    fontFamily: Fonts.semiBold,
    fontSize: 24,
    lineHeight: 32,
    color: Colors.barItemActive,
  },
  amountLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.surfaceLabel,
  },
  errorLine: {
    marginTop: 6,
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.error,
  },
  totals: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    alignSelf: 'stretch',
  },
  totalBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  totalValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 17,
    color: Colors.text,
  },
  totalAmount: {
    color: Colors.barItemActive,
  },
  totalLabel: {
    fontFamily: Fonts.medium,
    fontSize: 11.5,
    color: Colors.surfaceLabel,
  },
  details: {
    alignSelf: 'stretch',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  detailLabel: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.surfaceLabel,
  },
  detailValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    color: Colors.text,
  },
  invalidIcon: {
    backgroundColor: Colors.error,
  },
  verifiedIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  checkTitle: {
    marginTop: 8,
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    color: Colors.text,
  },
  checkNote: {
    marginTop: 6,
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.surfaceLabel,
  },
  spinHint: {
    marginTop: 14,
    alignItems: 'center',
  },
  spinHintText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  spinHintLink: {
    marginTop: 2,
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.barItemActive,
  },
});
