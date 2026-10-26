import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { type ComponentProps, type ReactNode, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ScreenTitle } from '@/components/app-header';
import { ProfileDetailsModal } from '@/components/profile-details';
import { ProfilePhotoButton } from '@/components/profile-photo';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { ROLE_LABEL } from '@/data/mock';
import { comingSoon, confirmAction, notify } from '@/lib/dialogs';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Profile card, settings and logout. Used by the app's Profile tab and the RM web portal. */
export function ProfileView({ bottomPadding }: { bottomPadding: number }) {
  const { user, signOut, remember, setRemember } = useAuth();
  const [securityOpen, setSecurityOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!user) return null;
  // App users file claims from here; the RM reviews claims in the portal's Claims tab.
  const filesClaims = user.role !== 'rm';

  const confirmLogout = () =>
    confirmAction('Logout', 'Are you sure you want to logout?', 'Logout', signOut);

  const showAbout = () => {
    notify(
      'About App',
      `${Constants.expoConfig?.name ?? 'Atlas'}\nVersion ${Constants.expoConfig?.version ?? '1.0.0'}`
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
        <ScreenTitle style={styles.title}>My Profile</ScreenTitle>

        <View style={styles.profileCard}>
          {/* A sibling of the details button: on web a button cannot sit inside another. */}
          <ProfilePhotoButton size={60} />
          <Pressable
            onPress={() => setDetailsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="View and edit my details"
            style={({ pressed }) => [styles.profileMain, pressed && styles.profileMainPressed]}>
            <View style={styles.profileText}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {user.name}
                </Text>
                <MaterialIcons name="verified" size={18} color={Colors.barItemActive} />
              </View>
              <Text style={styles.phone}>{user.phone}</Text>
              <Text style={styles.shop} numberOfLines={2}>
                {user.shopName} • {ROLE_LABEL[user.role].toUpperCase()}
              </Text>
              <View style={styles.editHint}>
                <MaterialIcons name="edit" size={14} color={Colors.barItemActive} />
                <Text style={styles.editHintText}>Tap to view & edit details</Text>
              </View>
            </View>
          </Pressable>
          <Pressable
            onPress={() => setQrOpen(true)}
            style={({ pressed }) => [styles.qrButton, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel="Show my QR code">
            <MaterialIcons name="qr-code-2" size={28} color={Colors.barLogout} />
          </Pressable>
        </View>

        <SectionLabel>Settings</SectionLabel>
        <Row
          icon="shield"
          title="App Security"
          trailing={securityOpen ? 'expand-less' : 'expand-more'}
          onPress={() => setSecurityOpen((open) => !open)}>
          {securityOpen && (
            <View style={styles.securityBody}>
              <View style={styles.securityText}>
                <Text style={styles.rowTitle}>Keep me logged in</Text>
                <Text style={styles.rowSubtitle}>Stay signed in after closing the app</Text>
              </View>
              <Switch
                value={remember}
                onValueChange={setRemember}
                trackColor={{ true: Colors.bar, false: Colors.switchOff }}
                thumbColor={remember ? Colors.barItemActive : Colors.background}
              />
            </View>
          )}
        </Row>

        <SectionLabel>Preferences</SectionLabel>
        <Row icon="translate" title="Language" subtitle="English" onPress={() => comingSoon('Language')} />

        <SectionLabel>Support</SectionLabel>
        {filesClaims && (
          <Row
            icon="assignment"
            title="Claims"
            subtitle="Report a defective product"
            onPress={() => router.push('/claims')}
          />
        )}
        <Row icon="info" title="About App" onPress={showAbout} />

        <Pressable
          style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed]}
          onPress={confirmLogout}
          accessibilityRole="button">
          <MaterialIcons name="logout" size={20} color={Colors.barLogout} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>

      <ProfileDetailsModal visible={detailsOpen} onClose={() => setDetailsOpen(false)} />

      <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setQrOpen(false)}>
          <View style={styles.qrDialog}>
            <Text style={styles.qrTitle}>My QR Code</Text>
            <Text style={styles.rowSubtitle}>
              {user.name} • {ROLE_LABEL[user.role].toUpperCase()}
            </Text>
            <View style={styles.qrFrame}>
              <QRCode
                value={`ATLASDID:${user.role}:${user.phone}`}
                size={200}
                color={Colors.barLogout}
                backgroundColor={Colors.background}
              />
            </View>
            <Pressable
              onPress={() => setQrOpen(false)}
              style={({ pressed }) => [styles.closeButton, pressed && styles.logoutPressed]}>
              <Text style={styles.logoutText}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Row({
  icon,
  title,
  subtitle,
  trailing = 'chevron-right',
  onPress,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  trailing?: IconName;
  onPress: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={styles.rowCard}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="button">
        <View style={styles.rowIcon}>
          <MaterialIcons name={icon} size={22} color={Colors.barLogout} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
        <MaterialIcons name={trailing} size={26} color={Colors.textMuted} />
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: PagePadding + 0.5,
  },
  title: {
    marginBottom: 12,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  profileMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 12,
  },
  profileMainPressed: {
    opacity: 0.7,
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  editHintText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.barItemActive,
  },
  profileText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    color: Colors.text,
  },
  phone: {
    fontFamily: Fonts.regular,
    fontSize: 14.5,
    color: Colors.text,
  },
  shop: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.surfaceLabel,
  },
  qrButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  sectionLabel: {
    marginTop: 22,
    marginBottom: 10,
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.surfaceLabel,
  },
  rowCard: {
    marginBottom: 10,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowPressed: {
    backgroundColor: Colors.scanButton,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.text,
  },
  rowSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  securityBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  securityText: {
    flex: 1,
  },
  logout: {
    marginTop: 24,
    height: 52,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.bar,
  },
  logoutPressed: {
    backgroundColor: Colors.barIndicator,
  },
  logoutText: {
    fontFamily: Fonts.medium,
    fontSize: 16,
    color: Colors.barLogout,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Colors.backdrop,
  },
  qrDialog: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderRadius: 20,
    padding: 24,
    backgroundColor: Colors.background,
  },
  qrTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    color: Colors.text,
  },
  qrFrame: {
    marginTop: 16,
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.bar,
  },
  closeButton: {
    marginTop: 20,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
});
