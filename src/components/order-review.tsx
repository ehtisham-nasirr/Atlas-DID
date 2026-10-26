import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { findUserByPhone, productBySku, ROLE_LABEL } from '@/data/mock';
import { confirmAction } from '@/lib/dialogs';
import { formatPKR } from '@/lib/format';
import { type Order, updateOrder } from '@/lib/orders-api';

/** RM pop-up: enter a unit price for each item, then approve or reject the order. */
export function OrderReviewModal({
  order,
  rm,
  onClose,
  onReviewed,
}: {
  order: Order | null;
  rm: string;
  onClose: () => void;
  onReviewed: (order: Order) => void;
}) {
  return (
    <Modal visible={order !== null} transparent animationType="fade" onRequestClose={onClose}>
      {order && <ReviewForm order={order} rm={rm} onClose={onClose} onReviewed={onReviewed} />}
    </Modal>
  );
}

function ReviewForm({
  order,
  rm,
  onClose,
  onReviewed,
}: {
  order: Order;
  rm: string;
  onClose: () => void;
  onReviewed: (order: Order) => void;
}) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const placedBy = findUserByPhone(order.placedBy);

  const numeric = (sku: string) => Number(prices[sku]);
  const allPriced = order.items.every((i) => prices[i.sku]?.trim() && Number.isFinite(numeric(i.sku)));
  const total = order.items.reduce((sum, i) => sum + (allPriced ? numeric(i.sku) * i.quantity : 0), 0);

  const submit = async (decision: 'approved' | 'rejected') => {
    if (decision === 'approved' && !allPriced) return setError('Enter a price for every item.');
    setBusy(true);
    setError('');
    try {
      const priceMap = Object.fromEntries(order.items.map((i) => [i.sku, numeric(i.sku)]));
      // Approved orders go to the distributor of whoever placed the order.
      onReviewed(
        await updateOrder(order.id, decision === 'approved' ? 'approve' : 'reject', {
          prices: decision === 'approved' ? priceMap : undefined,
        })
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The order could not be updated. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.backdrop}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.dialog}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          <Text style={styles.title}>Review Order</Text>
          <Text style={styles.meta}>
            {order.id} · {placedBy ? `${placedBy.name} (${ROLE_LABEL[placedBy.role]})` : order.placedBy}
          </Text>

          <Text style={styles.label}>Price per item (PKR)</Text>
          {order.items.map((item) => {
            const product = productBySku(item.sku);
            const line = Number.isFinite(numeric(item.sku)) && prices[item.sku]?.trim()
              ? numeric(item.sku) * item.quantity
              : null;
            return (
              <View key={item.sku} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.itemName}>
                    {product ? `${product.name} - ${product.model}` : item.sku}
                  </Text>
                  <Text style={styles.meta}>
                    × {item.quantity}
                    {line !== null ? ` = ${formatPKR(line)}` : ''}
                  </Text>
                </View>
                <TextInput
                  value={prices[item.sku] ?? ''}
                  onChangeText={(t) => {
                    setPrices((p) => ({ ...p, [item.sku]: t.replace(/[^\d]/g, '') }));
                    if (error) setError('');
                  }}
                  keyboardType="number-pad"
                  placeholder="PKR"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                  accessibilityLabel={`Price per unit for ${product?.model ?? item.sku}`}
                />
              </View>
            );
          })}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Order total</Text>
            <Text style={styles.totalValue}>{allPriced ? formatPKR(total) : '-'}</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.buttons}>
            <Pressable
              disabled={busy}
              onPress={() =>
                confirmAction('Reject order', `Reject order ${order.id}?`, 'Reject', () =>
                  submit('rejected')
                )
              }
              style={({ pressed }) => [styles.button, styles.reject, pressed && styles.rejectPressed]}>
              <Text style={[styles.buttonText, styles.rejectText]}>Reject</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => submit('approved')}
              style={({ pressed }) => [styles.button, styles.approve, pressed && styles.approvePressed]}>
              <Text style={styles.buttonText}>{busy ? 'Saving...' : 'Approve'}</Text>
            </Pressable>
          </View>
          <Pressable onPress={onClose} style={styles.cancel} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.backdrop,
  },
  dialog: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  body: {
    padding: 20,
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    color: Colors.text,
  },
  meta: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  label: {
    marginTop: 16,
    marginBottom: 8,
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  rowText: {
    flex: 1,
  },
  itemName: {
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    color: Colors.text,
  },
  input: {
    width: 96,
    height: 42,
    paddingHorizontal: 10,
    borderRadius: 10,
    textAlign: 'right',
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  totalLabel: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.text,
  },
  totalValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 17,
    color: Colors.barItemActive,
  },
  error: {
    marginTop: 10,
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
  approve: {
    backgroundColor: Colors.bar,
  },
  approvePressed: {
    backgroundColor: Colors.barIndicator,
  },
  buttonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15.5,
    color: Colors.barLogout,
  },
  cancel: {
    alignSelf: 'center',
    marginTop: 14,
  },
  cancelText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.textMuted,
  },
});
