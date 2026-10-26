import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { InfoField } from '@/components/info-field';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { findUserByPhone, type RedemptionRequest, ROLE_LABEL } from '@/data/mock';
import { notify } from '@/lib/dialogs';
import { formatNumber, formatPoints } from '@/lib/format';
import { postRedemption } from '@/lib/requests-api';

/** Floating "Redeem Points" button and its request form. */
export function RedeemPointsButton({
  available,
  bottom,
  onPress,
  label = 'Redeem Points',
}: {
  available: number;
  bottom: number;
  /** Replaces the cash form, e.g. retailers open the rewards list. */
  onPress?: () => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={onPress ?? (() => setOpen(true))}
        accessibilityRole="button"
        style={({ pressed }) => [styles.fab, { bottom }, pressed && styles.fabPressed]}>
        <MaterialIcons name="redeem" size={22} color={Colors.barLogout} />
        <Text style={styles.fabText}>{label}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {open && <RedeemForm available={available} onClose={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

type Recipient = RedemptionRequest['routedTo'];

/**
 * Cash redemptions: mechanics redeem with their retailer or distributor, distributors with the
 * RM. (Retailers redeem gifts on the Rewards screen.) The user picks who to send the request to.
 */
function RedeemForm({ available, onClose }: { available: number; onClose: () => void }) {
  const { user } = useAuth();
  const [points, setPoints] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const choices = (
    [
      ['retailer', user?.role === 'mechanic' ? user.retailerPhone : undefined],
      ['distributor', user?.role === 'mechanic' ? user.distributorPhone : undefined],
      // Mechanics redeem cash with their retailer or distributor; distributors with the RM.
      ['rm', user?.role === 'distributor' ? user.rmPhone : undefined],
    ] as const
  ).flatMap(([routedTo, phone]) => {
    const person = phone ? findUserByPhone(phone) : undefined;
    return person ? [{ routedTo: routedTo as Recipient, person }] : [];
  });
  const [picked, setPicked] = useState<Recipient | null>(null);
  const choice = choices.find((c) => c.routedTo === picked) ?? choices[0];

  const submit = async () => {
    const value = Number(points);
    if (!Number.isInteger(value) || value <= 0) return setError('Enter the number of points to redeem.');
    if (value > available) return setError(`You can redeem up to ${formatPoints(available)}.`);
    if (!user || !choice) return setError('No one is assigned to receive your request yet.');
    setSending(true);
    try {
      const request = await postRedemption(choice.routedTo, value);
      onClose();
      notify(
        'Request submitted',
        `Your request to redeem ${formatPoints(value)} (${request.id}) has been sent to ${
          choice.person.name
        } (${ROLE_LABEL[choice.person.role]}).`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The request could not be sent. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.backdrop}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.dialog}>
        <Text style={styles.title}>Redeem Points</Text>

        <View style={styles.available}>
          <Text style={styles.availableLabel}>Points available to redeem</Text>
          <Text style={styles.availableValue}>{formatNumber(Math.max(0, available))}</Text>
        </View>

        <InfoField
          label="Points to redeem"
          value={points}
          onChangeText={(t) => {
            setPoints(t.replace(/\D/g, ''));
            if (error) setError('');
          }}
          keyboardType="number-pad"
          placeholder="Enter points"
        />
        {available > 0 && (
          <Pressable onPress={() => setPoints(String(available))} style={styles.max}>
            <Text style={styles.maxText}>Use all {formatPoints(available)}</Text>
          </Pressable>
        )}

        {choices.length > 0 && (
          <>
            <Text style={styles.label}>Redeem with</Text>
            <View style={styles.choices}>
              {choices.map((c) => {
                const selected = c.routedTo === choice?.routedTo;
                return (
                  <Pressable
                    key={c.routedTo}
                    onPress={() => setPicked(c.routedTo)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.choice,
                      selected && styles.choiceSelected,
                      pressed && !selected && styles.choicePressed,
                    ]}>
                    <MaterialIcons
                      name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={20}
                      color={selected ? Colors.barItemActive : Colors.textMuted}
                    />
                    <View style={styles.choiceText}>
                      <Text style={styles.choiceRole}>{ROLE_LABEL[c.person.role]}</Text>
                      <Text style={styles.choiceName} numberOfLines={1}>
                        {c.person.name}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.buttons}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.cancelPressed]}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={available <= 0 || sending}
            style={({ pressed }) => [
              styles.button,
              styles.submit,
              available <= 0 && styles.disabled,
              pressed && styles.submitPressed,
            ]}>
            <Text style={styles.buttonText}>{sending ? 'Sending...' : 'Submit'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    paddingHorizontal: 18,
    borderRadius: 25,
    backgroundColor: Colors.bar,
    boxShadow: '0px 6px 14px rgba(46, 27, 0, 0.3)',
  },
  fabPressed: {
    backgroundColor: Colors.barIndicator,
  },
  fabText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14.5,
    color: Colors.barLogout,
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
    padding: 20,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    color: Colors.text,
  },
  available: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 4,
    paddingVertical: 14,
    borderRadius: 13,
    backgroundColor: Colors.surface,
  },
  availableLabel: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.surfaceLabel,
  },
  availableValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 30,
    lineHeight: 40,
    color: Colors.barItemActive,
  },
  max: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingVertical: 4,
  },
  maxText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.barItemActive,
  },
  label: {
    marginTop: 10,
    marginBottom: 8,
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    color: Colors.text,
  },
  choices: {
    gap: 8,
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
    backgroundColor: Colors.background,
  },
  choiceSelected: {
    borderColor: Colors.bar,
    backgroundColor: Colors.surface,
  },
  choicePressed: {
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
    marginTop: 8,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.error,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
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
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: Fonts.medium,
    fontSize: 15.5,
    color: Colors.barLogout,
  },
});
