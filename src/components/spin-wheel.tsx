import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { useEffect, useImperativeHandle, useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Colors, Fonts } from '@/constants/theme';

const SLICE_COLORS = [Colors.bar, Colors.surface, Colors.scanButton, Colors.background];
const SPIN_MS = 5200;
const FULL_TURNS = 6;
const BULBS = 16;

export type SpinWheelHandle = {
  /** Starts a spin. Returns false if the wheel is locked or already spinning. */
  spin: () => boolean;
};

type Props = {
  rewards: string[];
  /** Relative chance of stopping on each slice; equal chances when omitted. */
  chances?: number[];
  size: number;
  locked: boolean;
  /** Called with the index of the reward the pointer stopped on. */
  onResult: (index: number) => void;
  onLockedPress?: () => void;
  ref?: Ref<SpinWheelHandle>;
};

/** Point on a circle, with 0° at the top and angles growing clockwise. */
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function slicePath(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  return `M${cx} ${cy} L${a.x} ${a.y} A${r} ${r} 0 0 1 ${b.x} ${b.y} Z`;
}

/** Wheel slices with their labels, drawn upright for slice 0 at the top. */
function WheelFace({ rewards, size, showLabels }: { rewards: string[]; size: number; showLabels: boolean }) {
  const c = size / 2;
  const r = size / 2;
  const slice = 360 / rewards.length;

  return (
    <Svg width={size} height={size}>
      {rewards.map((reward, i) => (
        <G key={i}>
          <Path
            d={slicePath(c, c, r, i * slice, (i + 1) * slice)}
            fill={SLICE_COLORS[i % SLICE_COLORS.length]}
            stroke={Colors.barItemActive}
            strokeWidth={size > 100 ? 1.5 : 0.75}
          />
          {showLabels && (
            <SvgText
              x={c}
              y={c - r * 0.68}
              fill={Colors.barLogout}
              // Long labels get a smaller font so they stay inside their slice.
              fontSize={size * 0.042 * Math.min(1, 8 / reward.length)}
              fontFamily={Fonts.semiBold}
              textAnchor="middle"
              transform={`rotate(${i * slice + slice / 2} ${c} ${c})`}>
              {reward}
            </SvgText>
          )}
        </G>
      ))}
    </Svg>
  );
}

/** Small static wheel used as an icon. */
export function WheelIcon({ size }: { size: number }) {
  return (
    <View style={[styles.iconRim, { width: size, height: size, borderRadius: size / 2 }]}>
      <WheelFace rewards={Array.from({ length: 8 }, () => '')} size={size - 6} showLabels={false} />
    </View>
  );
}

/** Picks a slice index, weighted by `chances`. */
function pickSlice(count: number, chances?: number[]) {
  if (!chances) return Math.floor(Math.random() * count);
  const total = chances.reduce((sum, c) => sum + c, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < count; i++) {
    roll -= chances[i] ?? 0;
    if (roll < 0) return i;
  }
  return count - 1;
}

export function SpinWheel({ rewards, chances, size, locked, onResult, onLockedPress, ref }: Props) {
  const [spinning, setSpinning] = useState(false);
  const rotation = useSharedValue(0);
  const pointerKick = useSharedValue(0);
  const blink = useSharedValue(0);
  const isSpinning = useSharedValue(false);

  const rim = size * 0.06;
  const faceSize = size - rim * 2;
  const slice = 360 / rewards.length;

  useEffect(() => {
    blink.set(withRepeat(withTiming(1, { duration: 450 }), -1, true));
  }, [blink]);

  // Click the pointer and the phone each time a slice boundary passes under it.
  useAnimatedReaction(
    () => Math.floor((rotation.value + slice / 2) / slice),
    (current, previous) => {
      if (previous === null || current === previous || !isSpinning.get()) return;
      pointerKick.set(
        withSequence(withTiming(-18, { duration: 40 }), withSpring(0, { damping: 8, stiffness: 300 }))
      );
      scheduleOnRN(Haptics.selectionAsync);
    }
  );

  const finish = (index: number) => {
    setSpinning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onResult(index);
  };

  const spin = () => {
    if (locked || spinning) return false;
    setSpinning(true);
    const index = pickSlice(rewards.length, chances);
    const jitter = (Math.random() - 0.5) * slice * 0.6;
    // The slice under the top pointer is the one at angle -rotation.
    const landing = (((-(index * slice + slice / 2 + jitter)) % 360) + 360) % 360;
    const start = Math.ceil(rotation.get() / 360) * 360;
    isSpinning.set(true);
    rotation.set(
      withTiming(
        start + FULL_TURNS * 360 + landing,
        { duration: SPIN_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          isSpinning.set(false);
          if (finished) scheduleOnRN(finish, index);
        }
      )
    );
    return true;
  };

  useImperativeHandle(ref, () => ({ spin }));

  const discStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const pointerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${pointerKick.value}deg` }],
  }));
  const evenBulbs = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * blink.value }));
  const oddBulbs = useAnimatedStyle(() => ({ opacity: 1 - 0.65 * blink.value }));

  const bulbSize = rim * 0.55;
  const renderBulbs = (odd: boolean) =>
    Array.from({ length: BULBS / 2 }, (_, k) => {
      const i = k * 2 + (odd ? 1 : 0);
      const p = polar(size / 2, size / 2, size / 2 - rim / 2, (i * 360) / BULBS);
      return (
        <View
          key={i}
          style={[
            styles.bulb,
            {
              width: bulbSize,
              height: bulbSize,
              borderRadius: bulbSize / 2,
              left: p.x - bulbSize / 2,
              top: p.y - bulbSize / 2,
            },
          ]}
        />
      );
    });

  const hubSize = size * 0.24;

  return (
    <View style={{ width: size, height: size + 14 }}>
      <View style={[styles.rim, { width: size, height: size, borderRadius: size / 2, top: 14 }]}>
        <Animated.View style={[{ width: faceSize, height: faceSize }, discStyle]}>
          <WheelFace rewards={rewards} size={faceSize} showLabels />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, evenBulbs]}>
          {renderBulbs(false)}
        </Animated.View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, oddBulbs]}>
          {renderBulbs(true)}
        </Animated.View>
        {locked && <View pointerEvents="none" style={[styles.lockedVeil, { borderRadius: size / 2 }]} />}

        <Pressable
          onPress={() => (locked ? onLockedPress?.() : spin())}
          disabled={spinning}
          accessibilityRole="button"
          accessibilityLabel={locked ? 'Spin locked' : 'Spin the wheel'}
          style={({ pressed }) => [
            styles.hub,
            { width: hubSize, height: hubSize, borderRadius: hubSize / 2 },
            pressed && styles.hubPressed,
          ]}>
          {locked ? (
            <MaterialIcons name="lock" size={hubSize * 0.4} color={Colors.bar} />
          ) : (
            <Text style={[styles.hubText, { fontSize: hubSize * 0.22 }]}>SPIN</Text>
          )}
        </Pressable>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[styles.pointerWrap, { left: size / 2 - 16 }, pointerStyle]}>
        <Svg width={32} height={40}>
          <Path
            d="M16 38 L3 8 Q16 -2 29 8 Z"
            fill={Colors.barLogout}
            stroke={Colors.bar}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <Circle cx={16} cy={12} r={4} fill={Colors.bar} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  rim: {
    position: 'absolute',
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.barLogout,
    boxShadow: '0px 8px 18px rgba(46, 27, 0, 0.3)',
  },
  iconRim: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.barLogout,
  },
  bulb: {
    position: 'absolute',
    backgroundColor: '#FFF6C8',
    boxShadow: '0px 0px 6px rgba(255, 213, 30, 0.9)',
  },
  lockedVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  hub: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.barLogout,
    borderWidth: 4,
    borderColor: Colors.bar,
    boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.35)',
  },
  hubPressed: {
    transform: [{ scale: 0.94 }],
  },
  hubText: {
    fontFamily: Fonts.semiBold,
    color: Colors.bar,
    letterSpacing: 1,
  },
  pointerWrap: {
    position: 'absolute',
    top: 0,
    transformOrigin: '50% 30%',
  },
});
