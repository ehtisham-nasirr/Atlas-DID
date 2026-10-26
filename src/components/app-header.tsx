import { Image } from 'expo-image';
import { type StyleProp, StyleSheet, Text, type TextStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Colors, Fonts } from '@/constants/theme';

/** Logo and fading divider line shown at the top of every screen. */
export function AppHeader() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top + 6 }}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="Atlas D.I.D"
      />
      <Svg height={1.5} width="100%" style={styles.divider}>
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0.04" stopColor={Colors.headerDivider} stopOpacity={0} />
            <Stop offset="0.35" stopColor={Colors.headerDivider} stopOpacity={1} />
            <Stop offset="0.65" stopColor={Colors.headerDivider} stopOpacity={1} />
            <Stop offset="0.96" stopColor={Colors.headerDivider} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={1.5} fill="url(#fade)" />
      </Svg>
    </View>
  );
}

/** Page heading such as "My Profile" or "Point Status". */
export function ScreenTitle({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: 'center',
    width: 141,
    height: 41.5,
  },
  divider: {
    marginTop: 8,
  },
  title: {
    marginTop: 4.5,
    fontFamily: Fonts.medium,
    fontSize: 16.5,
    lineHeight: 27,
    color: Colors.text,
  },
});
