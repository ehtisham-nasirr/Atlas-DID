import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, ScreenTitle } from '@/components/app-header';
import { useBottomBarSpace } from '@/components/bottom-bar';
import { LoadingState } from '@/components/loading-state';
import { PromoCarousel } from '@/components/promo-carousel';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { usePromos } from '@/hooks/use-requests';

const SLIDE_INSET = 8;
/** Width / height of a typical portrait promo, so it can use the full banner width. */
const TALLEST_PROMO_RATIO = 608 / 823;
/** Header, title and gap above the banner. */
const ABOVE_BANNER = 104;
/** Dots plus the part of the Scan button that rises above the bar. */
const BELOW_BANNER = 66;

/** Promotions published by the Regional Manager from the web portal. */
export default function PromosScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomSpace = useBottomBarSpace();
  const { user } = useAuth();
  const { promos } = usePromos(user?.phone);
  // Active promos meant for this user's role (mechanic, retailer or distributor).
  const images = (promos ?? [])
    .filter((p) => p.active && p.audience.some((role) => role === user?.role))
    .map((p) => ({ uri: p.imageUrl }));

  // As tall as the screen allows, but no taller than the tallest promo needs at full width.
  const fullWidthHeight = (width - SLIDE_INSET * 2) / TALLEST_PROMO_RATIO;
  const availableHeight = height - insets.top - ABOVE_BANNER - BELOW_BANNER - bottomSpace;
  const bannerHeight = Math.max(240, Math.min(fullWidthHeight, availableHeight));

  return (
    <View style={styles.screen}>
      <AppHeader />
      <ScreenTitle style={styles.title}>Promotions</ScreenTitle>
      {promos === null ? (
        <LoadingState label="Loading promotions..." />
      ) : images.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="local-offer" size={48} color={Colors.surfaceDivider} />
          <Text style={styles.emptyText}>No promotions right now. Check back soon!</Text>
        </View>
      ) : (
        <PromoCarousel
          // Restart the slideshow when the RM changes the promos.
          key={images.map((i) => i.uri).join('|')}
          images={images}
          width={width}
          height={bannerHeight}
          inset={SLIDE_INSET}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  title: {
    paddingHorizontal: PagePadding + 0.5,
    marginBottom: 14,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
  },
});
