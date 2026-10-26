import { Alert, Platform } from 'react-native';

/** Simple message. React Native's Alert does nothing on web, so the browser dialog is used there. */
export function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

/** Asks for confirmation before running `onConfirm`. */
export function confirmAction(title: string, message: string, confirmText: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ]);
}

export const comingSoon = (feature: string) => notify(feature, 'This feature is coming soon.');
