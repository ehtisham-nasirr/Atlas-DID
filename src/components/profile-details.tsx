import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { InfoField } from '@/components/info-field';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { ROLE_LABEL } from '@/data/mock';

/** Pop-up with the user's full details; name, shop and city can be edited. */
export function ProfileDetailsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Mounted only while open, so the form starts from the saved values each time. */}
      {visible && <DetailsForm onClose={onClose} />}
    </Modal>
  );
}

function DetailsForm({ onClose }: { onClose: () => void }) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [shopName, setShopName] = useState(user?.shopName ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [error, setError] = useState('');

  if (!user) return null;

  const save = async () => {
    if (!name.trim() || !shopName.trim() || !city.trim()) {
      setError('Name, shop name and city cannot be empty.');
      return;
    }
    try {
      await updateProfile({ name: name.trim(), shopName: shopName.trim(), city: city.trim() });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Check your internet connection.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.backdrop}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.dialog}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          <Text style={styles.title}>My Details</Text>
          <Text style={styles.subtitle}>{ROLE_LABEL[user.role]}</Text>

          <InfoField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <InfoField
            label={user.role === 'rm' ? 'Office' : 'Shop Name'}
            value={shopName}
            onChangeText={setShopName}
            placeholder="Shop name"
          />
          <InfoField label="Location/City" value={city} onChangeText={setCity} placeholder="City" />
          <InfoField label="Phone Number" value={user.phone} />
          <InfoField label="NIC No." value={user.nic} />
          <Text style={styles.note}>Phone number and NIC are used to log in and cannot be changed here.</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.buttons}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.cancelPressed]}>
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              style={({ pressed }) => [styles.button, styles.save, pressed && styles.savePressed]}>
              <Text style={styles.buttonText}>Save</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.backdrop,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  body: {
    padding: 20,
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    color: Colors.text,
  },
  subtitle: {
    marginBottom: 4,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
  },
  note: {
    marginTop: 10,
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  error: {
    marginTop: 10,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.error,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: {
    backgroundColor: Colors.surface,
  },
  cancelPressed: {
    backgroundColor: Colors.surfaceDivider,
  },
  save: {
    backgroundColor: Colors.bar,
  },
  savePressed: {
    backgroundColor: Colors.barIndicator,
  },
  buttonText: {
    fontFamily: Fonts.medium,
    fontSize: 15.5,
    color: Colors.barLogout,
  },
});
