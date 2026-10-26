import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuantityStepper } from '@/components/quantity-stepper';
import { ScreenHeader } from '@/components/screen-header';
import { SwipeButton } from '@/components/swipe-button';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useCart } from '@/context/cart';
import { productBySku } from '@/data/mock';
import { notify } from '@/lib/dialogs';
import { formatNumber } from '@/lib/format';
import { placeOrder } from '@/lib/orders-api';

/** The mechanic's cart; swiping the button places the order with their RM and retailer. */
export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { items, count, setQuantity, clear } = useCart();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const entries = Object.entries(items);
  // Retailers earn points for the order once it is delivered.
  const orderPoints =
    user?.role === 'retailer'
      ? entries.reduce((sum, [sku, q]) => sum + (productBySku(sku)?.orderPoints ?? 0) * q, 0)
      : 0;

  const checkout = async () => {
    if (!user || entries.length === 0) return;
    setPlacing(true);
    setError('');
    try {
      // The database sends it to the user's RM (and a mechanic's retailer) from their profile.
      const order = await placeOrder(entries.map(([sku, quantity]) => ({ sku, quantity })));
      clear();
      notify(
        'Order placed',
        `Your order ${order.id} has been sent to the Regional Manager.${
          order.points > 0
            ? ` You will earn ${formatNumber(order.points)} pts when it is delivered.`
            : ''
        }`
      );
      router.replace('/orders');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The order could not be placed. Check your connection and try again.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="My Cart" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 140 + insets.bottom }]}>
        {entries.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="remove-shopping-cart" size={52} color={Colors.surfaceDivider} />
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Pressable
              onPress={() => router.replace('/schemes')}
              style={({ pressed }) => [styles.browse, pressed && styles.browsePressed]}>
              <Text style={styles.browseText}>Browse Items</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {entries.map(([sku, quantity]) => {
              const product = productBySku(sku);
              return (
                <View key={sku} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{product?.name ?? sku}</Text>
                    <Text style={styles.meta}>
                      Model: {product?.model ?? '-'} · SKU {sku}
                    </Text>
                  </View>
                  <QuantityStepper
                    value={quantity}
                    onChange={(q) => setQuantity(sku, q)}
                    label={product ? `${product.name} ${product.model}` : sku}
                  />
                </View>
              );
            })}
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>Total items</Text>
              <Text style={styles.summaryValue}>{count}</Text>
            </View>
            {orderPoints > 0 ? (
              <View style={[styles.summary, styles.pointsSummary]}>
                <Text style={styles.summaryLabel}>Points on delivery</Text>
                <Text style={[styles.summaryValue, styles.pointsValue]}>
                  +{formatNumber(orderPoints)} pts
                </Text>
              </View>
            ) : null}
            <Pressable onPress={() => router.back()} style={styles.addMore} hitSlop={8}>
              <MaterialIcons name="add" size={18} color={Colors.barItemActive} />
              <Text style={styles.addMoreText}>Add more items</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {entries.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.footerInner}>
            <SwipeButton
              label="Swipe to place order"
              loadingLabel="Placing order..."
              loading={placing}
              onConfirm={checkout}
            />
          </View>
        </View>
      )}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    padding: 14,
    borderRadius: 13,
    backgroundColor: Colors.surface,
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.text,
  },
  meta: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.surfaceLabel,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  summaryLabel: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.text,
  },
  summaryValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.barItemActive,
  },
  pointsSummary: {
    marginTop: 8,
  },
  pointsValue: {
    color: Colors.success,
  },
  addMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  addMoreText: {
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    color: Colors.barItemActive,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    marginTop: 8,
    fontFamily: Fonts.medium,
    fontSize: 16,
    color: Colors.text,
  },
  browse: {
    marginTop: 18,
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 13,
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  browsePressed: {
    backgroundColor: Colors.barIndicator,
  },
  browseText: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.barLogout,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: PagePadding + 0.5,
    borderTopWidth: 1,
    borderTopColor: Colors.headerDivider,
    backgroundColor: Colors.background,
  },
  footerInner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  error: {
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.error,
  },
});
