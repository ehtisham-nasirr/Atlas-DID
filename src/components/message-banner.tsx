import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Colors, Fonts } from '@/constants/theme';
import type { BannerData } from '@/context/chat';
import { findUserByPhone } from '@/data/directory';

export function messagePreview(message: { text: string; attachment?: { type: string } }) {
  if (message.text) return message.text;
  if (message.attachment?.type.startsWith('image/')) return '📷 Photo';
  return '📎 File';
}

/** "New message" card that slides down from the top of the screen. */
export function MessageBanner({
  banner,
  onPress,
  onDismiss,
}: {
  banner: BannerData | null;
  onPress: (partner: string) => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!banner) return null;

  return (
    <Animated.View
      key={banner.key}
      entering={SlideInUp.springify().damping(16)}
      exiting={SlideOutUp.duration(220)}
      style={[styles.wrap, { top: insets.top + 8 }]}>
      <Pressable
        onPress={() => onPress(banner.partner)}
        accessibilityRole="button"
        accessibilityLabel={`New message from ${banner.name}`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <Avatar name={banner.name} photoUrl={findUserByPhone(banner.partner)?.photoUrl} size={42} />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {banner.name}
          </Text>
          <Text style={styles.text} numberOfLines={2}>
            {messagePreview(banner.message)}
          </Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel="Dismiss">
          <MaterialIcons name="close" size={20} color={Colors.surfaceDivider} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: Colors.barLogout,
    boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.3)',
  },
  pressed: {
    opacity: 0.9,
  },
  body: {
    flex: 1,
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 14.5,
    color: Colors.bar,
  },
  text: {
    fontFamily: Fonts.regular,
    fontSize: 13.5,
    color: Colors.background,
  },
});
