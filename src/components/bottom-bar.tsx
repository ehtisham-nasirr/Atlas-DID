import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { type ComponentProps, useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useChat } from '@/context/chat';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Height of the yellow bar, excluding the system navigation inset. */
export const BAR_HEIGHT = 66;
/** Room above the bar for the part of the Scan button that sticks out. */
const OVERHANG = 50;
const FILLET = 8;
const SIDE_PADDING = 16;

// Scan button geometry: index 0 = docked on other tabs, index 1 = compact on the Scan tab.
const BUTTON_SIZE = [98, 66];
const NOTCH_RADIUS = [58.5, 42];
const NOTCH_DROP = [0, 24];

// Selection bubble: a pill behind the icon at rest, a glass lens over icon + label while touched.
const PILL = { width: 43, height: 26, centerY: 25 };
const LENS = { width: 70, height: 56, centerY: 36 };
const UNDERLINE_TOP = 59.4;
const UNDERLINE_WIDTH = 41;
const MAGNIFY = 0.18;

const FOLLOW_SPRING = { damping: 20, stiffness: 300, mass: 0.6 };
const SETTLE_SPRING = { damping: 14, stiffness: 170, mass: 0.8 };
const LENS_IN_SPRING = { damping: 15, stiffness: 260 };
const LENS_OUT_SPRING = { damping: 18, stiffness: 200 };

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Bar tabs left to right. The Scan button sits in the gap after the first LEFT_COUNT tabs. */
const ITEMS: { name: string; label: string; icon: IconName }[] = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'points', label: 'Points', icon: 'workspace-premium' },
  { name: 'promos', label: 'Promos', icon: 'local-offer' },
  { name: 'profile', label: 'Profile', icon: 'person' },
];
const LEFT_COUNT = 2;
const RIGHT_COUNT = ITEMS.length - LEFT_COUNT;
const INDEXES = ITEMS.map((_, i) => i);

/** Space a screen should leave at the bottom so content is not hidden by the bar. */
export function useBottomBarSpace() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + insets.bottom;
}

/**
 * Builds the bar outline: a rectangle with a circular notch cut into the top edge,
 * joined to the edge by small rounded fillets.
 */
function notchedBarPath(width: number, height: number, cy: number, radius: number) {
  'worklet';
  const cx = width / 2;
  const r = FILLET;
  const dx = Math.sqrt((radius + r) ** 2 - (cy - r) ** 2);
  const k = radius / (radius + r);
  const tangentY = cy + (r - cy) * k;
  const largeArc = tangentY < cy ? 1 : 0;
  return (
    `M0 0 H${cx - dx} ` +
    `A${r} ${r} 0 0 1 ${cx - dx * k} ${tangentY} ` +
    `A${radius} ${radius} 0 ${largeArc} 0 ${cx + dx * k} ${tangentY} ` +
    `A${r} ${r} 0 0 1 ${cx + dx} 0 ` +
    `H${width} V${height} H0 Z`
  );
}

/**
 * Item centres for the current Scan-button size. Each side of the Scan button gets half the
 * remaining width, shared equally by the tabs on that side.
 */
function itemLayout(width: number, progress: number) {
  'worklet';
  const gap = interpolate(progress, [0, 1], NOTCH_RADIUS) * 2 + 2;
  const half = (width - SIDE_PADDING * 2 - gap) / 2;
  const leftWidth = half / LEFT_COUNT;
  const rightWidth = half / RIGHT_COUNT;
  const centers: number[] = [];
  for (let i = 0; i < LEFT_COUNT; i++) centers.push(SIDE_PADDING + leftWidth * (i + 0.5));
  for (let i = 0; i < RIGHT_COUNT; i++) {
    centers.push(SIDE_PADDING + half + gap + rightWidth * (i + 0.5));
  }
  // Touches between these two x positions land on the Scan button gap.
  return { centers, gapStart: SIDE_PADDING + half, gapEnd: SIDE_PADDING + half + gap };
}

export function BottomBar({ state, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const barHeight = BAR_HEIGHT + insets.bottom;

  const activeRoute = state.routes[state.index]?.name;
  const isScan = activeRoute === 'scan';
  const activeIndex = ITEMS.findIndex((item) => item.name === activeRoute);
  const { unreadCount } = useChat();
  // Distributors don't scan products: the centre button opens Chat instead.
  const chatInCenter = useAuth().user?.role === 'distributor';

  const progress = useSharedValue(isScan ? 1 : 0);
  // Bubble position as a fractional item index, so it stays aligned while the layout animates.
  const bubble = useSharedValue(Math.max(activeIndex, 0));
  const lens = useSharedValue(0);
  const visible = useSharedValue(activeIndex >= 0 ? 1 : 0);
  const stretch = useSharedValue(0);
  const hovered = useSharedValue(-1);
  const tracking = useSharedValue(false);

  useEffect(() => {
    progress.set(withTiming(isScan ? 1 : 0, { duration: 260 }));
  }, [isScan, progress]);

  useEffect(() => {
    if (activeIndex >= 0) {
      bubble.set(withSpring(activeIndex, SETTLE_SPRING));
      visible.set(withTiming(1, { duration: 150 }));
    } else {
      visible.set(withTiming(0, { duration: 150 }));
    }
  }, [activeIndex, bubble, visible]);

  // Stretch the bubble in proportion to how fast it is moving, then let it wobble back.
  useAnimatedReaction(
    () => bubble.value,
    (current, previous) => {
      if (previous === null) return;
      const speed = Math.min(Math.abs(current - previous) * 3, 0.3);
      if (speed < 0.01) return;
      stretch.set(
        withSequence(
          withTiming(speed, { duration: 16 }),
          withSpring(0, { damping: 10, stiffness: 180 })
        )
      );
    }
  );

  const pathProps = useAnimatedProps(() => {
    const radius = interpolate(progress.value, [0, 1], NOTCH_RADIUS);
    const cy = interpolate(progress.value, [0, 1], NOTCH_DROP);
    return { d: notchedBarPath(width, barHeight, cy, radius) };
  });

  const gapStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], NOTCH_RADIUS) * 2 + 2,
  }));

  const bubbleStyle = useAnimatedStyle(() => {
    const { centers } = itemLayout(width, progress.value);
    const x = interpolate(bubble.value, INDEXES, centers, Extrapolation.CLAMP);
    const w = interpolate(lens.value, [0, 1], [PILL.width, LENS.width]);
    const h = interpolate(lens.value, [0, 1], [PILL.height, LENS.height]);
    const cy = interpolate(lens.value, [0, 1], [PILL.centerY, LENS.centerY]);
    return {
      width: w,
      height: h,
      borderRadius: h / 2,
      opacity: visible.value,
      transform: [
        { translateX: x - w / 2 },
        { translateY: cy - h / 2 },
        { scaleX: 1 + stretch.value },
        { scaleY: 1 - stretch.value * 0.35 },
      ],
    };
  });

  const pillStyle = useAnimatedStyle(() => ({ opacity: 1 - lens.value }));
  const glassStyle = useAnimatedStyle(() => ({ opacity: lens.value }));

  const underlineStyle = useAnimatedStyle(() => {
    const { centers } = itemLayout(width, progress.value);
    const x = interpolate(bubble.value, INDEXES, centers, Extrapolation.CLAMP);
    return {
      opacity: visible.value * (1 - lens.value),
      transform: [{ translateX: x - UNDERLINE_WIDTH / 2 }],
    };
  });

  const navigate = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (activeRoute !== name && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const selectItem = (index: number) => {
    Haptics.selectionAsync();
    navigate(ITEMS[index].name);
  };

  const hoverFeedback = () => {
    Haptics.selectionAsync();
  };

  const renderItem = (index: number) => (
    <BarItem
      key={ITEMS[index].name}
      index={index}
      label={ITEMS[index].label}
      icon={ITEMS[index].icon}
      focused={index === activeIndex}
      // Chat opens from Home, so unread messages are flagged on the Home tab.
      badge={ITEMS[index].name === 'home' && !chatInCenter ? unreadCount : 0}
      bubble={bubble}
      lens={lens}
      onActivate={() => selectItem(index)}
    />
  );

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      const { centers, gapStart, gapEnd } = itemLayout(width, progress.get());
      // Ignore touches in the gap under the Scan button.
      if (e.x > gapStart && e.x < gapEnd) return;
      tracking.set(true);
      const target = interpolate(e.x, centers, INDEXES, Extrapolation.CLAMP);
      bubble.set(visible.get() < 0.5 ? target : withSpring(target, FOLLOW_SPRING));
      visible.set(withTiming(1, { duration: 120 }));
      lens.set(withSpring(1, LENS_IN_SPRING));
      hovered.set(Math.round(target));
    })
    .onUpdate((e) => {
      if (!tracking.get()) return;
      const { centers } = itemLayout(width, progress.get());
      const target = interpolate(e.x, centers, INDEXES, Extrapolation.CLAMP);
      bubble.set(withSpring(target, FOLLOW_SPRING));
      const nearest = Math.round(target);
      if (nearest !== hovered.get()) {
        hovered.set(nearest);
        scheduleOnRN(hoverFeedback);
      }
    })
    .onFinalize(() => {
      if (!tracking.get()) return;
      tracking.set(false);
      const index = hovered.get();
      lens.set(withSpring(0, LENS_OUT_SPRING));
      bubble.set(withSpring(index, SETTLE_SPRING));
      scheduleOnRN(selectItem, index);
    });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { height: OVERHANG + barHeight }]}>
      <View style={[styles.bar, { height: barHeight }]}>
        <Svg width={width} height={barHeight} style={StyleSheet.absoluteFill}>
          <AnimatedPath animatedProps={pathProps} fill={Colors.bar} />
        </Svg>
        <GestureDetector gesture={pan}>
          <View style={styles.row}>
            <Animated.View pointerEvents="none" style={[styles.bubble, bubbleStyle]}>
              <Animated.View style={[styles.pill, pillStyle]} />
              <Animated.View style={[styles.glass, glassStyle]}>
                <View style={styles.glassHighlight} />
              </Animated.View>
            </Animated.View>
            <Animated.View pointerEvents="none" style={[styles.underline, underlineStyle]} />

            <View style={styles.side}>{ITEMS.slice(0, LEFT_COUNT).map((_, i) => renderItem(i))}</View>
            <Animated.View style={gapStyle} />
            <View style={styles.side}>
              {ITEMS.slice(LEFT_COUNT).map((_, i) => renderItem(LEFT_COUNT + i))}
            </View>
          </View>
        </GestureDetector>
      </View>
      {chatInCenter ? (
        <ScanButton
          progress={progress}
          width={width}
          icon="chat"
          label="Chat"
          badge={unreadCount}
          onPress={() => router.push('/chat')}
        />
      ) : (
        <ScanButton progress={progress} width={width} onPress={() => navigate('scan')} />
      )}
    </View>
  );
}

function BarItem({
  index,
  label,
  icon,
  focused,
  badge,
  bubble,
  lens,
  onActivate,
}: {
  index: number;
  label: string;
  icon: IconName;
  focused: boolean;
  badge: number;
  bubble: SharedValue<number>;
  lens: SharedValue<number>;
  onActivate: () => void;
}) {
  // Items under the glass lens are slightly magnified, like looking through a drop of water.
  const contentStyle = useAnimatedStyle(() => {
    const proximity = Math.max(0, 1 - Math.abs(bubble.value - index));
    return { transform: [{ scale: 1 + MAGNIFY * lens.value * proximity }] };
  });

  const color = focused ? Colors.barItemActive : Colors.barItem;

  return (
    <View
      style={styles.item}
      accessible
      accessibilityRole="tab"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} unread` : label}
      accessibilityState={{ selected: focused }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={onActivate}>
      <Animated.View style={[styles.itemContent, contentStyle]}>
        <View style={styles.iconWrap}>
          <MaterialIcons name={icon} size={22} color={color} />
          {badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
      </Animated.View>
    </View>
  );
}

/** The raised centre button: Scan, or Chat for distributors. */
function ScanButton({
  progress,
  width,
  icon = 'qr-code-scanner',
  label = 'Scan',
  badge = 0,
  onPress,
}: {
  progress: SharedValue<number>;
  width: number;
  icon?: IconName;
  label?: string;
  badge?: number;
  onPress: () => void;
}) {
  const circleStyle = useAnimatedStyle(() => {
    const size = interpolate(progress.value, [0, 1], BUTTON_SIZE);
    const cy = interpolate(progress.value, [0, 1], NOTCH_DROP);
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      left: width / 2 - size / 2,
      top: OVERHANG + cy - size / 2,
    };
  });

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 0.89]) }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
    height: interpolate(progress.value, [0, 1], [18, 0]),
  }));

  return (
    <Animated.View style={[styles.scanButton, circleStyle]}>
      <Pressable
        style={styles.scanPressable}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          label === 'Scan' ? 'Scan QR code' : badge > 0 ? `${label}, ${badge} unread` : label
        }>
        <Animated.View style={iconStyle}>
          <MaterialIcons name={icon} size={41} color={Colors.scanContent} />
          {badge > 0 && (
            <View style={[styles.badge, styles.centerBadge]}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </Animated.View>
        <Animated.Text style={[styles.scanLabel, labelStyle]}>{label}</Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  row: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    paddingHorizontal: SIDE_PADDING,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 12,
  },
  itemContent: {
    alignItems: 'center',
  },
  iconWrap: {
    width: PILL.width,
    height: PILL.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: 2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.bar,
  },
  centerBadge: {
    top: -2,
    right: -8,
    borderColor: Colors.scanButton,
  },
  badgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 9.5,
    lineHeight: 12,
    color: Colors.background,
  },
  label: {
    marginTop: 2.4,
    fontFamily: Fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.3,
    color: Colors.barItem,
  },
  labelActive: {
    fontFamily: Fonts.medium,
    color: Colors.barItemActive,
  },
  bubble: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  pill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    backgroundColor: Colors.barIndicator,
  },
  glass: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    backgroundColor: Colors.glassFill,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    boxShadow:
      '0px 6px 14px rgba(110, 80, 0, 0.28), inset 0px 1px 2px rgba(255, 255, 255, 0.9), inset 0px -3px 6px rgba(255, 213, 30, 0.35)',
  },
  glassHighlight: {
    position: 'absolute',
    top: 3,
    left: '14%',
    right: '14%',
    height: '34%',
    borderRadius: 999,
    backgroundColor: Colors.glassHighlight,
  },
  underline: {
    position: 'absolute',
    left: 0,
    top: UNDERLINE_TOP,
    width: UNDERLINE_WIDTH,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.barItemActive,
  },
  scanButton: {
    position: 'absolute',
    backgroundColor: Colors.scanButton,
    boxShadow: '0px 3px 5px rgba(0, 0, 0, 0.2)',
  },
  scanPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLabel: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.scanContent,
  },
});
