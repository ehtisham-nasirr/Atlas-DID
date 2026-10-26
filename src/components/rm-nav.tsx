import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { useChat } from '@/context/chat';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const ITEMS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Home', icon: 'dashboard' },
  { name: 'claims', label: 'Claims', icon: 'assignment' },
  { name: 'users', label: 'Users', icon: 'group' },
  { name: 'promos', label: 'Promos', icon: 'local-offer' },
  { name: 'chat', label: 'Chat', icon: 'chat' },
  { name: 'profile', label: 'Profile', icon: 'person' },
];

/** From this width the portal uses the desktop layout: a top bar and multi-column pages. */
export const RM_WIDE = 768;

export function useRmWide() {
  return useWindowDimensions().width >= RM_WIDE;
}

/**
 * Regional Manager navigation: a top bar on desktop, and on phones a yellow bottom bar like the
 * rest of the app.
 */
export function RmNav({ state, navigation }: BottomTabBarProps) {
  const wide = useRmWide();
  const { unreadCount } = useChat();
  const active = state.routes[state.index]?.name;

  const open = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (active !== name && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  };

  const items = ITEMS.map((item) => ({
    ...item,
    focused: active === item.name,
    badge: item.name === 'chat' ? unreadCount : 0,
    onPress: () => open(item.name),
  }));

  return wide ? <TopBar items={items} /> : <BottomNav items={items} />;
}

type NavItem = (typeof ITEMS)[number] & { focused: boolean; badge: number; onPress: () => void };

function TopBar({ items }: { items: NavItem[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top }]}>
      <View style={styles.topInner}>
        <View style={styles.brand}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="Atlas"
          />
          <View style={styles.portalPill}>
            <Text style={styles.portalText}>Regional Manager Portal</Text>
          </View>
        </View>
        <View style={styles.topNav} accessibilityRole="tablist">
          {items.map((item) => (
            <Pressable
              key={item.name}
              onPress={item.onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: item.focused }}
              accessibilityLabel={item.badge > 0 ? `${item.label}, ${item.badge} unread` : item.label}
              style={({ pressed }) => [
                styles.topButton,
                item.focused && styles.topButtonActive,
                !item.focused && pressed && styles.topButtonHover,
              ]}>
              <Icon item={item} />
              <Text style={[styles.topLabel, item.focused && styles.labelActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function BottomNav({ items }: { items: NavItem[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bottomBar, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
      {items.map((item) => (
        <Pressable
          key={item.name}
          onPress={item.onPress}
          accessibilityRole="tab"
          accessibilityState={{ selected: item.focused }}
          accessibilityLabel={item.badge > 0 ? `${item.label}, ${item.badge} unread` : item.label}
          style={styles.bottomItem}>
          <View style={[styles.pill, item.focused && styles.pillActive]}>
            <Icon item={item} />
          </View>
          <Text style={[styles.bottomLabel, item.focused && styles.labelActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Icon({ item }: { item: NavItem }) {
  return (
    <View>
      <MaterialIcons
        name={item.icon}
        size={22}
        color={item.focused ? Colors.barItemActive : Colors.barItem}
      />
      {item.badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    backgroundColor: Colors.background,
    borderBottomWidth: 3,
    borderBottomColor: Colors.bar,
    boxShadow: '0px 2px 10px rgba(46, 27, 0, 0.06)',
  },
  topInner: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 141,
    height: 41.5,
  },
  portalPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.surface,
  },
  portalText: {
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    color: Colors.barItemActive,
  },
  topNav: {
    flexDirection: 'row',
    gap: 6,
  },
  topButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  topButtonActive: {
    backgroundColor: Colors.bar,
  },
  topButtonHover: {
    backgroundColor: Colors.surface,
  },
  topLabel: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.barItem,
  },
  labelActive: {
    color: Colors.barItemActive,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bar,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
    boxShadow: '0px -2px 10px rgba(46, 27, 0, 0.12)',
  },
  bottomItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 9,
    paddingBottom: 8,
  },
  pill: {
    width: 52,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: Colors.barIndicator,
  },
  bottomLabel: {
    marginTop: 2,
    fontFamily: Fonts.regular,
    fontSize: 11.5,
    color: Colors.barItem,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
  },
  badgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 9.5,
    lineHeight: 12,
    color: Colors.background,
  },
});
