import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Colors, Fonts } from '@/constants/theme';

const HEIGHT = 62;
const PADDING = 5;
const KNOB = HEIGHT - PADDING * 2;
/** How far (0..1) the knob must be dragged before releasing confirms. */
const CONFIRM_AT = 0.85;

/**
 * Long "slide to confirm" button: drag the knob to the right end to run `onConfirm`.
 * Releasing early springs the knob back. Shows a spinner while `loading`.
 */
export function SwipeButton({
  label,
  loadingLabel,
  loading,
  disabled,
  onConfirm,
}: {
  label: string;
  loadingLabel: string;
  loading: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [width, setWidth] = useState(0);
  const max = Math.max(0, width - KNOB - PADDING * 2);
  const x = useSharedValue(0);
  const start = useSharedValue(0);

  // Slide back once the action has finished.
  useEffect(() => {
    if (!loading) x.set(withSpring(0, { damping: 16 }));
  }, [loading, x]);

  const confirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
  };

  const pan = Gesture.Pan()
    .enabled(!disabled && !loading && max > 0)
    .onBegin(() => {
      start.set(x.get());
    })
    .onUpdate((e) => {
      x.set(Math.min(max, Math.max(0, start.get() + e.translationX)));
    })
    .onEnd(() => {
      if (x.get() >= max * CONFIRM_AT) {
        x.set(withTiming(max, { duration: 120 }));
        scheduleOnRN(confirm);
      } else {
        x.set(withSpring(0, { damping: 16 }));
      }
    });

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: x.value + KNOB }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: max > 0 ? interpolate(x.value, [0, max * 0.6], [1, 0], 'clamp') : 1,
  }));

  return (
    <View
      style={[styles.track, disabled && styles.disabled]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => !disabled && !loading && confirm()}>
      <Animated.View style={[styles.fill, fillStyle]} />
      {!loading && <Animated.Text style={[styles.label, labelStyle]}>{label}</Animated.Text>}
      {loading && <Text style={styles.label}>{loadingLabel}</Text>}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.knob, knobStyle]}>
          {loading ? (
            <ActivityIndicator color={Colors.bar} />
          ) : (
            <MaterialIcons name="double-arrow" size={26} color={Colors.bar} />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    padding: PADDING,
    justifyContent: 'center',
    backgroundColor: Colors.bar,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
  fill: {
    position: 'absolute',
    left: PADDING,
    top: PADDING,
    bottom: PADDING,
    borderRadius: KNOB / 2,
    backgroundColor: Colors.barIndicator,
  },
  label: {
    position: 'absolute',
    left: KNOB + 16,
    right: 16,
    textAlign: 'center',
    fontFamily: Fonts.semiBold,
    fontSize: 15.5,
    color: Colors.barLogout,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.barLogout,
    boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.25)',
  },
});
