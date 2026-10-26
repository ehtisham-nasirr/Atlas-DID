import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
import { SegmentTabs } from '@/components/segment-tabs';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useDirectory } from '@/data/directory';
import type { User } from '@/data/mock';
import { notify } from '@/lib/dialogs';
import { createUser, normalizePhone } from '@/lib/users-api';

type NewRole = 'mechanic' | 'retailer' | 'distributor';

/** Pop-up where the RM registers a new mechanic, retailer or distributor in their region. */
export function AddUserModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {visible && <AddUserForm onClose={onClose} />}
    </Modal>
  );
}

function AddUserForm({ onClose }: { onClose: () => void }) {
  const { user, refreshDirectory } = useAuth();
  const directory = useDirectory();
  const [role, setRole] = useState<NewRole>('mechanic');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nic, setNic] = useState('');
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [retailer, setRetailer] = useState<string | undefined>();
  const [distributor, setDistributor] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) return null;
  const inRegion = (r: NewRole) => directory.filter((u) => u.role === r && u.rmPhone === user.phone);
  const retailers = inRegion('retailer');
  const distributors = inRegion('distributor');

  const save = async () => {
    const digits = normalizePhone(phone);
    if (!name.trim()) return setError('Enter the name.');
    if (digits.length < 3) return setError('Enter a valid phone number.');
    if (password.length < 3) return setError('The password must be at least 3 characters.');
    if (role === 'mechanic' && !retailer) return setError('Choose the retailer for this mechanic.');
    if (role !== 'distributor' && !distributor) return setError('Choose the distributor.');
    setError('');
    setSaving(true);
    try {
      const created = await createUser({
        role,
        name,
        phone: digits,
        nic,
        shopName,
        city,
        password,
        retailerPhone: role === 'mechanic' ? retailer : undefined,
        distributorPhone: role === 'distributor' ? undefined : distributor,
      });
      await refreshDirectory();
      onClose();
      notify(
        'User added',
        `${created.name} can now log in with phone ${created.phone} and the password you set.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The user could not be added. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.backdrop}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.dialog}>
        <View style={styles.header}>
          <Text style={styles.title}>Add User</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <MaterialIcons name="close" size={24} color={Colors.text} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          <SegmentTabs<NewRole>
            value={role}
            onChange={setRole}
            options={[
              { value: 'mechanic', label: 'Mechanic' },
              { value: 'retailer', label: 'Retailer' },
              { value: 'distributor', label: 'Distributor' },
            ]}
          />
          <InfoField label="Name" value={name} onChangeText={setName} placeholder="Full name" />
          <InfoField
            label="Phone Number (login)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="03XXXXXXXXX"
          />
          <InfoField
            label="Password (login)"
            value={password}
            onChangeText={setPassword}
            placeholder="Set a password"
          />
          <InfoField
            label="NIC No."
            value={nic}
            onChangeText={setNic}
            keyboardType="number-pad"
            placeholder="CNIC number"
          />
          <InfoField label="Shop Name" value={shopName} onChangeText={setShopName} placeholder="Shop / business name" />
          <InfoField label="City" value={city} onChangeText={setCity} placeholder="City" />

          {role === 'mechanic' && (
            <Picker
              label="Retailer"
              people={retailers}
              value={retailer}
              onChange={setRetailer}
              empty="Add a retailer first."
            />
          )}
          {role !== 'distributor' && (
            <Picker
              label="Distributor"
              people={distributors}
              value={distributor}
              onChange={setDistributor}
              empty="Add a distributor first."
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
        <View style={styles.buttons}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.cancelPressed]}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={saving}
            style={({ pressed }) => [styles.button, styles.submit, (pressed || saving) && styles.submitPressed]}>
            <Text style={styles.buttonText}>{saving ? 'Adding...' : 'Add User'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Picker({
  label,
  people,
  value,
  onChange,
  empty,
}: {
  label: string;
  people: User[];
  value?: string;
  onChange: (phone: string) => void;
  empty: string;
}) {
  return (
    <View style={styles.picker}>
      <Text style={styles.pickerLabel}>{label}</Text>
      {people.length === 0 ? (
        <Text style={styles.pickerEmpty}>{empty}</Text>
      ) : (
        people.map((p) => {
          const selected = p.phone === value;
          return (
            <Pressable
              key={p.phone}
              onPress={() => onChange(p.phone)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.option, selected && styles.optionSelected]}>
              <MaterialIcons
                name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={20}
                color={selected ? Colors.barItemActive : Colors.textMuted}
              />
              <View style={styles.optionText}>
                <Text style={styles.optionName}>{p.name}</Text>
                <Text style={styles.optionMeta} numberOfLines={1}>
                  {p.shopName} · {p.phone}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: Colors.backdrop,
  },
  dialog: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    borderRadius: 20,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  title: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    color: Colors.text,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  picker: {
    marginTop: 16,
    gap: 8,
  },
  pickerLabel: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.text,
  },
  pickerEmpty: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.error,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  optionSelected: {
    borderColor: Colors.bar,
    backgroundColor: Colors.surface,
  },
  optionText: {
    flex: 1,
  },
  optionName: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.text,
  },
  optionMeta: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  error: {
    marginTop: 12,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.error,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
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
  submit: {
    backgroundColor: Colors.bar,
  },
  submitPressed: {
    backgroundColor: Colors.barIndicator,
  },
  buttonText: {
    fontFamily: Fonts.medium,
    fontSize: 15.5,
    color: Colors.barLogout,
  },
});
