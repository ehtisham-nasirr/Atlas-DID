import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatOverview } from '@/components/chat-overview';
import { ScreenHeader } from '@/components/screen-header';
import { Colors } from '@/constants/theme';

/** Opened from Home. */
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ScreenHeader title="Chat" />
      <ChatOverview bottomPadding={insets.bottom + 32} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
