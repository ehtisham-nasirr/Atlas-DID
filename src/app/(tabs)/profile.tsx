import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { useBottomBarSpace } from '@/components/bottom-bar';
import { ProfileView } from '@/components/profile-view';

export default function ProfileScreen() {
  const bottomSpace = useBottomBarSpace();
  return (
    <View style={styles.screen}>
      <AppHeader />
      <ProfileView bottomPadding={bottomSpace + 60} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
