import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

type Props = {
  label: string;
  value: string;
  /** When provided the field becomes editable. */
  onChangeText?: (text: string) => void;
  keyboardType?: TextInputProps['keyboardType'];
  placeholder?: string;
  /** Hides the text, for passwords. */
  secureTextEntry?: boolean;
};

/** Beige rounded field with a floating label notched into its top edge. */
export function InfoField({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
  secureTextEntry,
}: Props) {
  return (
    <View style={styles.field}>
      {onChangeText ? (
        <TextInput
          style={[styles.value, styles.input]}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          secureTextEntry={secureTextEntry}
          autoCapitalize={secureTextEntry ? 'none' : undefined}
          autoCorrect={secureTextEntry ? false : undefined}
          placeholderTextColor={Colors.textMuted}
          cursorColor={Colors.text}
          selectionColor={Colors.bar}
        />
      ) : (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      )}
      <View style={styles.labelPill} pointerEvents="none">
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const FIELD_HEIGHT = 55;
const LABEL_HEIGHT = 21;

const styles = StyleSheet.create({
  field: {
    height: FIELD_HEIGHT,
    marginTop: LABEL_HEIGHT / 2 + 2,
    borderRadius: 13,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    paddingHorizontal: 17,
  },
  value: {
    fontFamily: Fonts.medium,
    fontSize: 14.7,
    color: Colors.text,
    includeFontPadding: false,
  },
  input: {
    height: FIELD_HEIGHT,
    padding: 0,
  },
  labelPill: {
    position: 'absolute',
    top: -LABEL_HEIGHT / 2,
    left: 13,
    height: LABEL_HEIGHT,
    paddingHorizontal: 9,
    borderRadius: 7,
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
  label: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    letterSpacing: 0.6,
    color: Colors.surfaceLabel,
    includeFontPadding: false,
  },
});
