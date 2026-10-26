import { Image } from 'expo-image';
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

/** Round profile picture: the user's photo, or the first letter of their name on yellow. */
export function Avatar({
  name,
  photoUrl,
  size,
  style,
}: {
  name: string;
  photoUrl?: string;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.avatar, round, style]}>
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={round}
          contentFit="cover"
          transition={150}
          accessibilityLabel={`${name}'s photo`}
        />
      ) : (
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.4) }]}>
          {name.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: Colors.bar,
  },
  initial: {
    fontFamily: Fonts.semiBold,
    color: Colors.barLogout,
  },
});
