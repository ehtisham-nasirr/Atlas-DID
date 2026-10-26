import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { RmNav, useRmWide } from '@/components/rm-nav';
import { Colors } from '@/constants/theme';

/**
 * Regional Manager portal: Home, Claims, Users, Promos, Chat and Profile. Desktop browsers get a top bar;
 * phones get the app's logo header and a bottom bar.
 */
export default function RmLayout() {
  const wide = useRmWide();
  return (
    <View style={styles.screen}>
      {!wide && <AppHeader />}
      <Tabs
        tabBar={(props) => <RmNav {...props} />}
        screenOptions={{ headerShown: false, tabBarPosition: wide ? 'top' : 'bottom' }}>
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="claims" options={{ title: 'Claims' }} />
        <Tabs.Screen name="users" options={{ title: 'Users' }} />
        <Tabs.Screen name="promos" options={{ title: 'Promos' }} />
        <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
