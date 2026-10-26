import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type ComponentProps, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingState } from '@/components/loading-state';
import { RedemptionCard } from '@/components/redemption-card';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { findUserByPhone } from '@/data/directory';
import { ORDER_POINT_RATES, ROLE_LABEL, type User } from '@/data/mock';
import { useLedger } from '@/hooks/use-ledger';
import { useRedemptions, useRewards } from '@/hooks/use-requests';
import { notify } from '@/lib/dialogs';
import { formatNumber } from '@/lib/format';
import { type Reward, requestReward } from '@/lib/requests-api';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Retailers: points earned from RM-approved orders, the rewards list (gifts by points), and their
 * reward requests. A request goes to their distributor or RM, who marks the gift as given.
 */
export default function RewardsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { rewards } = useRewards(user?.phone);
  const { redemptions } = useRedemptions(user?.phone);
  const { remaining, pendingOrderPoints, loading } = useLedger();
  const [choosing, setChoosing] = useState<Reward | null>(null);

  const myRequests = (redemptions ?? []).filter((r) => r.from === user?.phone && r.rewardTitle);
  const tiers = (rewards ?? []).reduce<{ points: number; items: Reward[] }[]>((list, r) => {
    const tier = list.find((t) => t.points === r.points);
    if (tier) tier.items.push(r);
    else list.push({ points: r.points, items: [r] });
    return list;
  }, []);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Rewards" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.balance}>
          <Text style={styles.balanceLabel}>Your points</Text>
          {loading ? (
            <ActivityIndicator color={Colors.barItemActive} style={styles.balanceLoading} />
          ) : (
            <Text style={styles.balanceValue}>{formatNumber(Math.max(0, remaining))}</Text>
          )}
          {pendingOrderPoints > 0 ? (
            <Text style={styles.pending}>
              +{formatNumber(pendingOrderPoints)} pts on the way from orders awaiting approval
            </Text>
          ) : null}
        </View>

        <View style={styles.earn}>
          <MaterialIcons name="shopping-cart-checkout" size={20} color={Colors.barItemActive} />
          <Text style={styles.earnText}>
            Earn points on every order (per unit): {ORDER_POINT_RATES}. Points are added when the
            Regional Manager approves the order.
          </Text>
        </View>

        {myRequests.length > 0 ? (
          <>
            <Text style={styles.heading}>My Reward Requests</Text>
            {myRequests.map((r) => (
              <RedemptionCard key={r.id} request={r} viewer={user?.phone} />
            ))}
          </>
        ) : null}

        <Text style={styles.heading}>Choose a Reward</Text>
        {rewards === null ? (
          <LoadingState label="Loading rewards..." />
        ) : (
          tiers.map((tier, index) => {
            const short = Math.ceil(tier.points - remaining);
            const affordable = !loading && short <= 0;
            return (
              <View key={tier.points} style={[styles.tier, affordable && styles.tierAffordable]}>
                <View style={styles.tierHeader}>
                  <View style={styles.tierBadge}>
                    <Text style={styles.tierBadgeText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.tierPoints}>{formatNumber(tier.points)} pts</Text>
                  <Text style={[styles.tierStatus, affordable && styles.tierStatusOn]}>
                    {loading ? '' : affordable ? 'Available' : `${formatNumber(short)} more pts`}
                  </Text>
                </View>
                <View style={styles.gifts}>
                  {tier.items.map((reward, i) => (
                    <View key={reward.id} style={styles.giftWrap}>
                      {i > 0 ? <Text style={styles.or}>OR</Text> : null}
                      <Pressable
                        onPress={() => setChoosing(reward)}
                        disabled={!affordable}
                        accessibilityRole="button"
                        accessibilityLabel={`Redeem ${reward.title} for ${reward.points} points`}
                        style={({ pressed }) => [
                          styles.gift,
                          !affordable && styles.giftLocked,
                          pressed && styles.giftPressed,
                        ]}>
                        <View style={styles.giftIcon}>
                          <MaterialIcons
                            name={reward.icon as IconName}
                            size={26}
                            color={Colors.barLogout}
                          />
                        </View>
                        <Text style={styles.giftTitle} numberOfLines={2}>
                          {reward.title}
                        </Text>
                        {affordable ? <Text style={styles.giftAction}>Redeem ›</Text> : null}
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={choosing !== null} transparent animationType="fade" onRequestClose={() => setChoosing(null)}>
        {choosing && user && (
          <RedeemRewardForm
            reward={choosing}
            user={user}
            onClose={() => setChoosing(null)}
          />
        )}
      </Modal>
    </View>
  );
}

/** Confirms the gift and who the request goes to: the retailer's distributor or RM. */
function RedeemRewardForm({
  reward,
  user,
  onClose,
}: {
  reward: Reward;
  user: User;
  onClose: () => void;
}) {
  const choices = (
    [
      ['distributor', user.distributorPhone],
      ['rm', user.rmPhone],
    ] as const
  ).flatMap(([routedTo, phone]) => {
    const person = phone ? findUserByPhone(phone) : undefined;
    return person ? [{ routedTo, person }] : [];
  });
  const [picked, setPicked] = useState(choices[0]?.routedTo);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const choice = choices.find((c) => c.routedTo === picked);

  const send = async () => {
    if (!choice) return setError('No distributor or Regional Manager is assigned to you yet.');
    setSending(true);
    try {
      await requestReward(choice.routedTo, reward.id);
      onClose();
      notify(
        'Reward requested',
        `Your request for ${reward.title} (${formatNumber(reward.points)} pts) has been sent to ${
          choice.person.name
        } (${ROLE_LABEL[choice.person.role]}).`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The request could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.dialog}>
        <View style={styles.dialogGift}>
          <View style={[styles.giftIcon, styles.dialogIcon]}>
            <MaterialIcons name={reward.icon as IconName} size={32} color={Colors.barLogout} />
          </View>
          <View style={styles.dialogGiftText}>
            <Text style={styles.dialogTitle}>{reward.title}</Text>
            <Text style={styles.dialogPoints}>{formatNumber(reward.points)} pts</Text>
          </View>
        </View>
        <Text style={styles.label}>Redeem with</Text>
        {choices.map((c) => {
          const selected = c.routedTo === picked;
          return (
            <Pressable
              key={c.routedTo}
              onPress={() => setPicked(c.routedTo)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.choice, selected && styles.choiceSelected]}>
              <MaterialIcons
                name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={20}
                color={selected ? Colors.barItemActive : Colors.textMuted}
              />
              <View style={styles.choiceText}>
                <Text style={styles.choiceRole}>{ROLE_LABEL[c.person.role]}</Text>
                <Text style={styles.choiceName}>{c.person.name}</Text>
              </View>
            </Pressable>
          );
        })}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.buttons}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.cancelPressed]}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={send}
            disabled={sending}
            style={({ pressed }) => [styles.button, styles.submit, (pressed || sending) && styles.submitPressed]}>
            <Text style={styles.buttonText}>{sending ? 'Sending...' : 'Request Reward'}</Text>
          </Pressable>
        </View>
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
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingTop: 16,
    paddingHorizontal: PagePadding + 0.5,
  },
  balance: {
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: Colors.bar,
  },
  balanceLabel: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.barLogout,
  },
  balanceValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 36,
    lineHeight: 46,
    color: Colors.barLogout,
  },
  balanceLoading: {
    marginVertical: 12,
  },
  pending: {
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    color: Colors.barItemActive,
  },
  earn: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: 13,
    backgroundColor: Colors.surface,
  },
  earnText: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.surfaceLabel,
  },
  heading: {
    marginTop: 20,
    marginBottom: 10,
    fontFamily: Fonts.medium,
    fontSize: 16.5,
    color: Colors.text,
  },
  tier: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  tierAffordable: {
    borderColor: Colors.bar,
    backgroundColor: Colors.scanButton + '33',
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tierBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  tierBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.barLogout,
  },
  tierPoints: {
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.text,
  },
  tierStatus: {
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  tierStatusOn: {
    color: Colors.success,
  },
  gifts: {
    flexDirection: 'row',
    gap: 8,
  },
  giftWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  or: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: Colors.textMuted,
  },
  gift: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    minHeight: 112,
    padding: 10,
    borderRadius: 13,
    backgroundColor: Colors.background,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.08)',
  },
  giftLocked: {
    opacity: 0.5,
  },
  giftPressed: {
    backgroundColor: Colors.surface,
  },
  giftIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  giftTitle: {
    textAlign: 'center',
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.text,
  },
  giftAction: {
    fontFamily: Fonts.semiBold,
    fontSize: 12.5,
    color: Colors.barItemActive,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.backdrop,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    gap: 8,
    padding: 20,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  dialogGift: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  dialogIcon: {
    width: 56,
    height: 56,
  },
  dialogGiftText: {
    flex: 1,
  },
  dialogTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 17,
    color: Colors.text,
  },
  dialogPoints: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.barItemActive,
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    color: Colors.text,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  choiceSelected: {
    borderColor: Colors.bar,
    backgroundColor: Colors.surface,
  },
  choiceText: {
    flex: 1,
  },
  choiceRole: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.text,
  },
  choiceName: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  error: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.error,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: {
    backgroundColor: Colors.surface,
  },
  cancelPressed: {
    backgroundColor: Colors.surfaceDivider,
  },
  submit: {
    backgroundColor: Colors.bar,
  },
  submitPressed: {
    backgroundColor: Colors.barIndicator,
  },
  buttonText: {
    fontFamily: Fonts.medium,
    fontSize: 15.5,
    color: Colors.barLogout,
  },
});
