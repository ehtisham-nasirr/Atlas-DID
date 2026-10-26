import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { type ComponentProps, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import type { PickedFile } from '@/lib/chat-api';
import { notify } from '@/lib/dialogs';

type Choice = 'camera' | 'gallery' | 'remove';
type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Opens the camera or gallery with a square crop; resolves to null if the user cancels. */
async function pickPhoto(source: 'camera' | 'gallery'): Promise<PickedFile | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Camera permission is needed to take a photo.');
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    name: asset.fileName ?? `profile-${Date.now()}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
    file: asset.file,
    size: asset.fileSize,
  };
}

/** The signed-in user's avatar; tapping it adds, changes or removes their profile photo. */
export function ProfilePhotoButton({ size = 60 }: { size?: number }) {
  const { user, updatePhoto } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const choose = async (choice: Choice) => {
    setOpen(false);
    try {
      const photo = choice === 'remove' ? null : await pickPhoto(choice);
      if (choice !== 'remove' && !photo) return;
      setBusy(true);
      await updatePhoto(photo);
    } catch (e) {
      notify(
        'Photo not saved',
        e instanceof Error ? e.message : 'Check your internet connection and try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const options: { value: Choice; label: string; icon: IconName }[] = [
    { value: 'camera', label: 'Take Photo', icon: 'photo-camera' },
    { value: 'gallery', label: 'Choose from Gallery', icon: 'photo-library' },
    ...(user.photoUrl
      ? [{ value: 'remove' as const, label: 'Remove Photo', icon: 'delete-outline' as const }]
      : []),
  ];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={user.photoUrl ? 'Change profile photo' : 'Add profile photo'}>
        <Avatar name={user.name} photoUrl={user.photoUrl} size={size} />
        {busy ? (
          <View style={[styles.busy, { borderRadius: size / 2 }]}>
            <ActivityIndicator color={Colors.background} />
          </View>
        ) : null}
        <View style={styles.badge}>
          <MaterialIcons name="photo-camera" size={13} color={Colors.bar} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.title}>Profile Photo</Text>
            {options.map((o) => (
              <Pressable
                key={o.value}
                onPress={() => choose(o.value)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
                <View style={[styles.optionIcon, o.value === 'remove' && styles.removeIcon]}>
                  <MaterialIcons
                    name={o.icon}
                    size={22}
                    color={o.value === 'remove' ? Colors.background : Colors.barLogout}
                  />
                </View>
                <Text style={[styles.optionText, o.value === 'remove' && styles.removeText]}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.cancel, pressed && styles.optionPressed]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  busy: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
    backgroundColor: Colors.barLogout,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.backdrop,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: 8,
    padding: 20,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: Colors.background,
  },
  title: {
    marginBottom: 4,
    fontFamily: Fonts.semiBold,
    fontSize: 17,
    color: Colors.text,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.surface,
  },
  optionPressed: {
    backgroundColor: Colors.scanButton,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  removeIcon: {
    backgroundColor: Colors.error,
  },
  optionText: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.text,
  },
  removeText: {
    color: Colors.error,
  },
  cancel: {
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 14,
  },
  cancelText: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.textMuted,
  },
});
