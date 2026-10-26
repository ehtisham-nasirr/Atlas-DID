import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';
import { ActivityProvider } from '@/context/activity';
import { AuthProvider, useAuth } from '@/context/auth';
import { CartProvider } from '@/context/cart';
import { ChatProvider } from '@/context/chat';
import { prefetchUserData } from '@/hooks/use-requests';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: Colors.background, primary: Colors.bar },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ActivityProvider>
          <ChatProvider>
            <CartProvider>
              <ThemeProvider value={theme}>
                <StatusBar style="dark" />
                <RootNavigator />
              </ThemeProvider>
            </CartProvider>
          </ChatProvider>
        </ActivityProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Only the login screen is reachable until a user signs in. After that, the Regional Manager
 * gets the web portal (`/rm`) and everyone else gets the mobile app tabs.
 */
function RootNavigator() {
  const { user, ready } = useAuth();
  const signedIn = user !== null;
  const isRm = user?.role === 'rm';

  // Keep the splash screen up until the saved login has been checked.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Start loading the user's data at login so screens open with it already there.
  const phone = user?.phone;
  useEffect(() => {
    if (phone) prefetchUserData(phone);
  }, [phone]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Protected guard={signedIn && !isRm}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="spin" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="qr-details" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="claims" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="claim-new" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="schemes" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="cart" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="orders" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="earnings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="rewards" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="requests" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="deliveries" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="chat/index" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && isRm}>
        <Stack.Screen name="rm" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="chat/[partner]" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
