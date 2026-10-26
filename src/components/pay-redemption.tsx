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
import { findUserByPhone, type RedemptionRequest } from '@/data/mock';
import { confirmAction, notify } from '@/lib/dialogs';
import { formatPKR, formatPoints } from '@/lib/format';
import { decideRedemption } from '@/lib/requests-api';

/**
 * Lets the recipient of redemption requests pay (entering the PKR amount sent) or reject them.
 * Returns the card handler, the pop-up to render, and requests updated here (shown at once).
 */
export function useRedemptionDecisions(me: string | undefined) {
  const [paying, setPaying] = useState<RedemptionRequest | null>(null);
  const [updated, setUpdated] = useState<Record<string, RedemptionRequest>>({});

  const save = (r: RedemptionRequest) => setUpdated((u) => ({ ...u, [r.id]: r }));

  const onDecide = (request: RedemptionRequest, action: 'pay' | 'reject') => {
    if (!me) return;
    if (action === 'pay' && request.rewardTitle) {
      // Gift requests have no amount: confirm the gift was handed over.
      const who = findUserByPhone(request.from)?.name ?? request.from;
      return confirmAction(
        'Mark as given',
        `Have you given ${request.rewardTitle} to ${who}? ${formatPoints(request.points)} will be redeemed.`,
        'Given',
        () =>
          decideRedemption(request.id, 'pay')
            .then(save)
            .catch((e) =>
              notify('Update failed', e instanceof Error ? e.message : 'The request could not be updated.')
            )
      );
    }
    if (action === 'pay') return setPaying(request);
    const what = request.rewardTitle ?? formatPoints(request.points);
    confirmAction('Reject request', `Reject the request to redeem ${what}?`, 'Reject', () =>
      decideRedemption(request.id, 'reject')
        .then(save)
        .catch((e) => notify('Update failed', e instanceof Error ? e.message : 'The request could not be updated.'))
    );
  };

  const modal = (
    <Modal visible={paying !== null} transparent animationType="fade" onRequestClose={() => setPaying(null)}>
      {paying && me && (
        <PayForm request={paying} me={me} onClose={() => setPaying(null)} onPaid={save} />
      )}
    </Modal>
  );

  return { onDecide, modal, apply: (r: RedemptionRequest) => updated[r.id] ?? r };
}

function PayForm({
  request,
  me,
  onClose,
  onPaid,
}: {
  request: RedemptionRequest;
  me: string;
  onClose: () => void;
  onPaid: (r: RedemptionRequest) => void;
}) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const from = findUserByPhone(request.from);

  const pay = async () => {
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) return setError('Enter the amount you are paying.');
    setBusy(true);
    try {
      onPaid(await decideRedemption(request.id, 'pay', value));
      onClose();
      notify('Paid', `${formatPKR(value)} paid to ${from?.name ?? request.from}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The payment could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.dialog}>
        <Text style={styles.title}>Pay & Redeem</Text>
        <Text style={styles.meta}>
          {from?.name ?? request.from} wants to redeem {formatPoints(request.points)}.
        </Text>
        <InfoField
          label="Amount paid (PKR)"
          value={amount}
          onChangeText={(t) => {
            setAmount(t.replace(/\D/g, ''));
            if (error) setError('');
          }}
          keyboardType="number-pad"
          placeholder="Enter amount"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.buttons}>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.cancelPressed]}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={pay}
            disabled={busy}
            style={({ pressed }) => [styles.button, styles.confirm, pressed && styles.confirmPressed]}>
            <Text style={styles.buttonText}>{busy ? 'Saving...' : 'Pay'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  meta: {
    marginTop: 2,
    marginBottom: 4,
    fontFamily: Fonts.regular,
    fontSize: 13,
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
  confirm: {
    backgroundColor: Colors.bar,
  },
  confirmPressed: {
    backgroundColor: Colors.barIndicator,
  },
  buttonText: {
    fontFamily: Fonts.medium,
    fontSize: 15.5,
    color: Colors.barLogout,
  },
});
