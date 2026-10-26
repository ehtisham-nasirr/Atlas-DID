import { Tabs } from 'expo-router';

import { BottomBar } from '@/components/bottom-bar';

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="home"
      tabBar={(props) => <BottomBar {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="points" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="promos" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
