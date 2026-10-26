import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClaimsView } from '@/components/claims-view';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useClaims } from '@/hooks/use-requests';

/** Claims the user has filed, with a button to file a new one. */
export default function ClaimsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { claims } = useClaims(user?.phone);
  const mine = (claims ?? []).filter((c) => c.from === user?.phone);
  const canFile = user !== null && user.role !== 'rm';
  return (
    <View style={styles.screen}>
      <ScreenHeader title="Claims" />
      <ClaimsView
        claims={mine}
        loading={claims === null}
        emptyText={
          canFile
            ? 'No claims yet. Tap "New Claim" to report a defective product.'
            : 'Your claims will appear here with their status once claims are submitted.'
        }
        bottomPadding={insets.bottom + 32}
        action={
          canFile ? (
            <Pressable
              onPress={() => router.push('/claim-new')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.newClaim, pressed && styles.newClaimPressed]}>
              <MaterialIcons name="add-circle-outline" size={22} color={Colors.barLogout} />
              <Text style={styles.newClaimText}>New Claim</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  newClaim: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    marginBottom: 16,
    borderRadius: 13,
    backgroundColor: Colors.bar,
  },
  newClaimPressed: {
    backgroundColor: Colors.barIndicator,
  },
  newClaimText: {
    fontFamily: Fonts.medium,
    fontSize: 15.5,
    color: Colors.barLogout,
  },
});
