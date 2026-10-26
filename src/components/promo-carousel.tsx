import { Image, type ImageSource } from 'expo-image';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  scrollTo,
  type SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';

const AUTOPLAY_MS = 3500;
const DOT_SIZE = 8;
const DOT_ACTIVE_WIDTH = 20;

type Props = {
  images: ImageSource[];
  width: number;
  height: number;
  /** Space between the slide edge and the image. */
  inset: number;
};

/**
 * Auto-sliding promo banner. The first slide is repeated at the end so autoplay
 * always slides forward; when the copy is reached we jump back to the real first slide.
 */
export function PromoCarousel({ images, width, height, inset }: Props) {
  const slides = images.length > 1 ? [...images, images[0]] : images;
  const lastOffset = (slides.length - 1) * width;

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.set(e.contentOffset.x);
      if (lastOffset > 0 && e.contentOffset.x >= lastOffset - 0.5) {
        scrollTo(scrollRef, 0, 0, false);
      }
    },
  });

  const stopAutoplay = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const startAutoplay = useCallback(() => {
    stopAutoplay();
    if (images.length < 2 || width <= 0) return;
    timer.current = setInterval(() => {
      const next = Math.round(scrollX.get() / width) + 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    }, AUTOPLAY_MS);
  }, [images.length, width, scrollRef, scrollX, stopAutoplay]);

  useEffect(() => {
    startAutoplay();
    return stopAutoplay;
  }, [startAutoplay, stopAutoplay]);

  return (
    <View>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={stopAutoplay}
        onMomentumScrollEnd={startAutoplay}
        style={{ width, height }}>
        {slides.map((source, i) => (
          <View key={i} style={{ width, height, paddingHorizontal: inset }}>
            <Image source={source} style={styles.image} contentFit="contain" />
          </View>
        ))}
      </Animated.ScrollView>

      {images.length > 1 && (
        <View style={styles.dots}>
          {images.map((_, i) => (
            <Dot key={i} index={i} count={images.length} scrollX={scrollX} width={width} />
          ))}
        </View>
      )}
    </View>
  );
}

function Dot({
  index,
  count,
  scrollX,
  width,
}: {
  index: number;
  count: number;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const style = useAnimatedStyle(() => {
    const page = scrollX.value / width;
    let distance = Math.abs(page - index);
    // The first dot is also active while the repeated first slide is showing.
    if (index === 0) distance = Math.min(distance, Math.abs(page - count));
    const active = Math.max(0, 1 - distance);
    return {
      width: interpolate(active, [0, 1], [DOT_SIZE, DOT_ACTIVE_WIDTH]),
      backgroundColor: interpolateColor(active, [0, 1], [Colors.dotInactive, Colors.dotActive]),
    };
  });

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  image: {
    flex: 1,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 2,
  },
  dot: {
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginHorizontal: 4,
  },
});
