import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

/** A "+" button that turns into a − / quantity / + stepper once the quantity is above zero. */
export function QuantityStepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  /** Used in accessibility labels, e.g. the product name. */
  label: string;
}) {
  if (value <= 0) {
    return (
      <Pressable
        onPress={() => onChange(1)}
        accessibilityRole="button"
        accessibilityLabel={`Add ${label}`}
        style={({ pressed }) => [styles.plus, pressed && styles.pressed]}>
        <MaterialIcons name="add" size={24} color={Colors.barLogout} />
      </Pressable>
    );
  }
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onChange(value - 1)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        style={styles.step}>
        <MaterialIcons name={value === 1 ? 'delete-outline' : 'remove'} size={20} color={Colors.barLogout} />
      </Pressable>
      <Text style={styles.value} accessibilityLabel={`${value} selected`}>
        {value}
      </Text>
      <Pressable
        onPress={() => onChange(Math.min(999, value + 1))}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        style={styles.step}>
        <MaterialIcons name="add" size={20} color={Colors.barLogout} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  plus: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  pressed: {
    backgroundColor: Colors.barIndicator,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bar,
  },
  step: {
    width: 38,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minWidth: 26,
    textAlign: 'center',
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.barLogout,
  },
});
