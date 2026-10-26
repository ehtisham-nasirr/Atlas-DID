import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

/** Pill-shaped two-or-more option switch, as used on the Scan screen. */
export function SegmentTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.option, active && styles.optionActive]}>
            <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    marginBottom: 16,
    padding: 4,
    borderRadius: 999,
    backgroundColor: Colors.surface,
  },
  option: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  optionActive: {
    backgroundColor: Colors.bar,
  },
  text: {
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    color: Colors.textMuted,
  },
  textActive: {
    color: Colors.barLogout,
  },
});
