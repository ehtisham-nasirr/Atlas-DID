import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { type ComponentProps, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, ScreenTitle } from '@/components/app-header';
import { InfoField } from '@/components/info-field';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useAuth } from '@/context/auth';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** From this width (desktop browsers, e.g. the RM portal) the login uses a two-panel layout. */
const WIDE = 900;

const FEATURES: { icon: IconName; text: string }[] = [
  { icon: 'qr-code-scanner', text: 'Scan genuine parts and earn points' },
  { icon: 'receipt-long', text: 'Order parts and track deliveries' },
  { icon: 'assignment-turned-in', text: 'Claims and redemptions approved fast' },
  { icon: 'forum', text: 'Chat across your whole network' },
];

/**
 * Sign-in with phone number + password for users registered by the Regional Manager.
 * On success the root navigator switches to the app.
 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width >= WIDE;
  const { signIn, remember, setRemember } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onLogin = async () => {
    if (busy) return;
    if (!phone.trim() || !password) {
      setError('Please enter your phone number and password.');
      return;
    }
    setBusy(true);
    const message = await signIn(phone.trim(), password);
    // On success this screen closes; only failures come back here.
    if (message) {
      setError(message);
      setBusy(false);
    }
  };

  const onChange = (setter: (text: string) => void) => (text: string) => {
    setter(text);
    if (error) setError('');
  };

  const form = (
    <>
      <InfoField
        label="Phone Number"
        value={phone}
        onChangeText={onChange(setPhone)}
        keyboardType="phone-pad"
        placeholder="Enter phone number"
      />
      <InfoField
        label="Password"
        value={password}
        onChangeText={onChange(setPassword)}
        placeholder="Enter password"
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={styles.remember}
        onPress={() => setRemember(!remember)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: remember }}>
        <MaterialIcons
          name={remember ? 'check-box' : 'check-box-outline-blank'}
          size={24}
          color={remember ? Colors.barItemActive : Colors.textMuted}
        />
        <Text style={styles.rememberText}>Remember me</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
        onPress={onLogin}
        disabled={busy}
        accessibilityRole="button">
        <Text style={styles.buttonText}>{busy ? 'Logging in...' : 'Login'}</Text>
      </Pressable>
    </>
  );

  if (wide) {
    return (
      <View style={styles.wide}>
        <View style={styles.brandPanel}>
          <View style={styles.brandInner}>
            <View style={styles.logoCard}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.logo}
                contentFit="contain"
                accessibilityLabel="Atlas"
              />
            </View>
            <Text style={styles.brandTitle}>Rewards for every genuine part</Text>
            <Text style={styles.brandText}>
              One app for mechanics, retailers, distributors and Regional Managers.
            </Text>
            <View style={styles.features}>
              {FEATURES.map((f) => (
                <View key={f.text} style={styles.feature}>
                  <View style={styles.featureIcon}>
                    <MaterialIcons name={f.icon} size={20} color={Colors.barLogout} />
                  </View>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <ScrollView
          style={styles.formPanel}
          contentContainerStyle={styles.formPanelContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <Text style={styles.welcome}>Welcome back</Text>
            <Text style={styles.welcomeText}>Login with your phone number and password.</Text>
            <View style={styles.formFields}>{form}</View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <ScreenTitle style={styles.title}>Login</ScreenTitle>
        {form}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: PagePadding + 0.5,
  },
  title: {
    marginBottom: 11,
  },
  error: {
    marginTop: 12,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.error,
  },
  remember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingVertical: 4,
  },
  rememberText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.text,
  },
  button: {
    marginTop: 20,
    height: 52,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  buttonPressed: {
    backgroundColor: Colors.barIndicator,
  },
  buttonText: {
    fontFamily: Fonts.medium,
    fontSize: 16,
    color: Colors.scanContent,
  },
  wide: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  brandPanel: {
    flex: 1,
    justifyContent: 'center',
    padding: 48,
    backgroundColor: Colors.bar,
  },
  brandInner: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  logoCard: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: Colors.background,
    boxShadow: '0px 6px 18px rgba(46, 27, 0, 0.15)',
  },
  logo: {
    width: 170,
    height: 50,
  },
  brandTitle: {
    marginTop: 32,
    fontFamily: Fonts.semiBold,
    fontSize: 30,
    lineHeight: 40,
    color: Colors.barLogout,
  },
  brandText: {
    marginTop: 8,
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.barItemActive,
  },
  features: {
    marginTop: 28,
    gap: 14,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.scanButton,
  },
  featureText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14.5,
    color: Colors.barLogout,
  },
  formPanel: {
    flex: 1,
  },
  formPanelContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 48,
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  welcome: {
    fontFamily: Fonts.semiBold,
    fontSize: 26,
    color: Colors.text,
  },
  welcomeText: {
    marginTop: 4,
    fontFamily: Fonts.regular,
    fontSize: 14.5,
    color: Colors.textMuted,
  },
  formFields: {
    marginTop: 20,
  },
});
