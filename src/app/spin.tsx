import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { SpinWheel, type SpinWheelHandle } from '@/components/spin-wheel';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useActivity } from '@/context/activity';
import { NO_PRIZE, SCANS_PER_SPIN, wheelSlices } from '@/data/mock';
import { notify } from '@/lib/dialogs';
import { formatDateTime, formatPKR } from '@/lib/format';

const SLICE_LABELS = wheelSlices.map((s) => s.label);
const SLICE_CHANCES = wheelSlices.map((s) => s.chance);

export default function SpinScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { scans, spinsAvailable, scansToNextSpin, rewards, recordSpin } = useActivity();
  const wheel = useRef<SpinWheelHandle>(null);
  const [won, setWon] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);

  const locked = spinsAvailable === 0;
  const progress = (SCANS_PER_SPIN - scansToNextSpin) / SCANS_PER_SPIN;

  const onSpinPress = () => {
    if (locked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (wheel.current?.spin()) setSpinning(true);
  };

  const onResult = (index: number) => {
    const prize = wheelSlices[index].prize;
    recordSpin(prize === NO_PRIZE ? null : prize).catch((e) =>
      notify('Spin not saved', e instanceof Error ? e.message : 'Check your internet connection.')
    );
    setSpinning(false);
    setWon(prize);
  };

  const noPrize = won === NO_PRIZE;
  const totalWon = rewards.reduce((sum, r) => sum + (Number(r.reward.replace(/\D/g, '')) || 0), 0);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Spin & Win" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{scans.length}</Text>
              <Text style={styles.statLabel}>QR Codes Scanned</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{spinsAvailable}</Text>
              <Text style={styles.statLabel}>Spins Available</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {SCANS_PER_SPIN - scansToNextSpin} / {SCANS_PER_SPIN} scans for the next spin
          </Text>
        </View>

        <Text style={styles.message}>
          {locked
            ? `Abhi (${scansToNextSpin}) aur QR-Code wale Items Scan karein aur (1) SPIN hasil karein!`
            : `Mubarak ho! Aap ke paas (${spinsAvailable}) SPIN hain. Wheel ghumayein!`}
        </Text>

        <View style={styles.wheelWrap}>
          <SpinWheel
            ref={wheel}
            rewards={SLICE_LABELS}
            chances={SLICE_CHANCES}
            size={Math.min(width - 48, 340)}
            locked={locked}
            onResult={onResult}
            onLockedPress={onSpinPress}
          />
        </View>

        <Pressable
          onPress={onSpinPress}
          disabled={spinning}
          style={({ pressed }) => [
            styles.spinButton,
            locked && styles.spinButtonLocked,
            pressed && !locked && styles.spinButtonPressed,
          ]}>
          <MaterialIcons
            name={locked ? 'lock' : 'casino'}
            size={20}
            color={locked ? Colors.textMuted : Colors.barLogout}
          />
          <Text style={[styles.spinButtonText, locked && styles.spinButtonTextLocked]}>
            {locked ? `Locked - ${scansToNextSpin} more scans` : spinning ? 'Spinning...' : 'Spin Now'}
          </Text>
        </Pressable>

        {rewards.length > 0 && (
          <>
            <View style={styles.rewardsHeader}>
              <Text style={styles.sectionTitle}>My Rewards</Text>
              <Text style={styles.totalWon}>Total: {formatPKR(totalWon)}</Text>
            </View>
            {rewards.map((r, i) => (
              <View key={`${r.date}-${i}`} style={styles.rewardRow}>
                <MaterialIcons name="card-giftcard" size={22} color={Colors.barItemActive} />
                <Text style={styles.rewardName}>{r.reward}</Text>
                <Text style={styles.rewardDate}>{formatDateTime(r.date)}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={won !== null} transparent animationType="fade" onRequestClose={() => setWon(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <MaterialIcons
              name={noPrize ? 'sentiment-dissatisfied' : 'celebration'}
              size={56}
              color={noPrize ? Colors.surfaceDivider : Colors.bar}
            />
            <Text style={styles.dialogTitle}>{noPrize ? 'Oh no!' : 'Congratulations!'}</Text>
            {noPrize ? (
              <Text style={styles.dialogReward}>Better luck next time</Text>
            ) : (
              <>
                <Text style={styles.dialogText}>You won</Text>
                <Text style={styles.dialogReward}>{won}</Text>
              </>
            )}
            <Pressable
              onPress={() => setWon(null)}
              style={({ pressed }) => [styles.dialogButton, pressed && styles.spinButtonPressed]}>
              <Text style={styles.spinButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  statusCard: {
    borderRadius: 13,
    backgroundColor: Colors.surface,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: Fonts.medium,
    fontSize: 28,
    lineHeight: 36,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    letterSpacing: 0.3,
    color: Colors.surfaceLabel,
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: Colors.surfaceDivider,
  },
  progressTrack: {
    marginTop: 16,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: Colors.bar,
  },
  progressText: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.surfaceLabel,
  },
  message: {
    marginTop: 20,
    textAlign: 'center',
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.text,
  },
  wheelWrap: {
    marginTop: 16,
    alignItems: 'center',
  },
  spinButton: {
    marginTop: 24,
    height: 52,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.bar,
  },
  spinButtonLocked: {
    backgroundColor: Colors.surface,
  },
  spinButtonPressed: {
    backgroundColor: Colors.barIndicator,
  },
  spinButtonText: {
    fontFamily: Fonts.medium,
    fontSize: 16,
    color: Colors.barLogout,
  },
  spinButtonTextLocked: {
    color: Colors.textMuted,
  },
  rewardsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 8,
  },
  totalWon: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.barItemActive,
  },
  sectionTitle: {
    fontFamily: Fonts.medium,
    fontSize: 16.5,
    color: Colors.text,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
  },
  rewardName: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.text,
  },
  rewardDate: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Colors.backdrop,
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderRadius: 20,
    padding: 24,
    backgroundColor: Colors.background,
  },
  dialogTitle: {
    marginTop: 8,
    fontFamily: Fonts.semiBold,
    fontSize: 22,
    color: Colors.text,
  },
  dialogText: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
  },
  dialogReward: {
    marginTop: 4,
    textAlign: 'center',
    fontFamily: Fonts.semiBold,
    fontSize: 26,
    color: Colors.barItemActive,
  },
  dialogButton: {
    marginTop: 20,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
});
