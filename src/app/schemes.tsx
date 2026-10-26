import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuantityStepper } from '@/components/quantity-stepper';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useCart } from '@/context/cart';
import { products } from '@/data/mock';
import { formatNumber } from '@/lib/format';

/** Products grouped by name, each with its models. */
const GROUPS = products.reduce<{ name: string; items: typeof products }[]>((groups, p) => {
  const group = groups.find((g) => g.name === p.name);
  if (group) group.items.push(p);
  else groups.push({ name: p.name, items: [p] });
  return groups;
}, []);

/** Item Schemes: the mechanic picks parts and quantities, then adds them to the cart. */
export default function SchemesScreen() {
  const insets = useSafeAreaInsets();
  const { add, count, items } = useCart();
  // Retailers earn points per unit ordered.
  const showPoints = useAuth().user?.role === 'retailer';
  const [selected, setSelected] = useState<Record<string, number>>({});
  const selectedCount = Object.values(selected).reduce((sum, q) => sum + q, 0);

  const setQuantity = (sku: string, quantity: number) =>
    setSelected((current) => {
      const next = { ...current };
      if (quantity > 0) next[sku] = quantity;
      else delete next[sku];
      return next;
    });

  const addToCart = () => {
    Object.entries(selected).forEach(([sku, quantity]) => add(sku, quantity));
    setSelected({});
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Item Schemes" right={<CartIcon count={count} />} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}>
        <View style={styles.introRow}>
          <Text style={styles.intro}>Select the parts you need and add them to your cart.</Text>
          <Pressable onPress={() => router.push('/orders')} hitSlop={8}>
            <Text style={styles.link}>My Orders ›</Text>
          </Pressable>
        </View>

        {GROUPS.map((group) => (
          <View key={group.name} style={styles.group}>
            <View style={styles.groupHeader}>
              <MaterialIcons
                name={group.name.startsWith('Chain') ? 'settings' : 'link'}
                size={22}
                color={Colors.barLogout}
              />
              <Text style={styles.groupTitle}>{group.name}</Text>
            </View>
            {group.items.map((p) => (
              <View key={p.sku} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.model}>{p.model}</Text>
                  <Text style={styles.meta}>SKU {p.sku}</Text>
                  {showPoints ? (
                    <Text style={styles.points}>+{formatNumber(p.orderPoints)} pts / unit</Text>
                  ) : null}
                  {items[p.sku] ? (
                    <Text style={styles.inCart}>{items[p.sku]} in cart</Text>
                  ) : null}
                </View>
                <QuantityStepper
                  value={selected[p.sku] ?? 0}
                  onChange={(q) => setQuantity(p.sku, q)}
                  label={`${p.name} ${p.model}`}
                />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {selectedCount > 0 ? (
          <Pressable
            onPress={addToCart}
            accessibilityRole="button"
            style={({ pressed }) => [styles.footerButton, pressed && styles.footerPressed]}>
            <MaterialIcons name="add-shopping-cart" size={22} color={Colors.barLogout} />
            <Text style={styles.footerText}>
              Add to Cart · {selectedCount} item{selectedCount > 1 ? 's' : ''}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push('/cart')}
            disabled={count === 0}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.footerButton,
              count === 0 && styles.footerDisabled,
              pressed && styles.footerPressed,
            ]}>
            <MaterialIcons name="shopping-cart" size={22} color={Colors.barLogout} />
            <Text style={styles.footerText}>
              {count > 0 ? `View Cart · ${count} item${count > 1 ? 's' : ''}` : 'Your cart is empty'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function CartIcon({ count }: { count: number }) {
  return (
    <Pressable
      onPress={() => router.push('/cart')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`Cart, ${count} items`}
      style={styles.cartIcon}>
      <MaterialIcons name="shopping-cart" size={24} color={Colors.text} />
      {count > 0 && (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
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
    paddingTop: 14,
    paddingHorizontal: PagePadding + 0.5,
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  intro: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
  },
  link: {
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    color: Colors.barItemActive,
  },
  group: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginLeft: 4,
  },
  groupTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 13,
    backgroundColor: Colors.background,
  },
  rowText: {
    flex: 1,
  },
  model: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.text,
  },
  meta: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  points: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.success,
  },
  inCart: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.barItemActive,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: PagePadding + 0.5,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.headerDivider,
    backgroundColor: Colors.background,
  },
  footerButton: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 13,
    backgroundColor: Colors.bar,
  },
  footerPressed: {
    backgroundColor: Colors.barIndicator,
  },
  footerDisabled: {
    backgroundColor: Colors.surface,
  },
  footerText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15.5,
    color: Colors.barLogout,
  },
  cartIcon: {
    padding: 4,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
  },
  cartBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    lineHeight: 13,
    color: Colors.background,
  },
});
