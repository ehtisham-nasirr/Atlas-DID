import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InfoField } from '@/components/info-field';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { products } from '@/data/mock';
import { type PickedFile, uploadFile } from '@/lib/chat-api';
import { notify } from '@/lib/dialogs';
import { postClaim } from '@/lib/requests-api';

const MAX_PHOTOS = 4;

async function pickPhoto(source: 'gallery' | 'camera'): Promise<PickedFile | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Camera permission is needed to take a photo.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    name: asset.fileName ?? `claim-${Date.now()}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
    file: asset.file,
  };
}

/**
 * Claim form for a defective product: product, quantity, details, photos and an optional TCS ID.
 * Every claim goes to the Regional Manager; once approved, the distributor settles it.
 */
export default function NewClaimScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const recipient = user?.rmPhone;
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState<PickedFile[]>([]);
  const [trackingId, setTrackingId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addPhoto = async (source: 'gallery' | 'camera') => {
    try {
      const photo = await pickPhoto(source);
      if (photo) setPhotos((current) => [...current, photo].slice(0, MAX_PHOTOS));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the photo.');
    }
  };

  const submit = async () => {
    const qty = Number(quantity);
    if (!sku) return setError('Please select the product.');
    if (!Number.isInteger(qty) || qty < 1) return setError('Please enter a valid quantity.');
    if (!details.trim()) return setError('Please describe the defect.');
    if (photos.length === 0) return setError('Please add at least one photo of the defect.');

    if (!user || !recipient) return setError('No one is assigned to receive your claims yet.');

    setError('');
    setSubmitting(true);
    try {
      const uploaded = await Promise.all(photos.map((p) => uploadFile(p)));
      const claim = await postClaim({
        sku,
        quantity: qty,
        reason: details.trim(),
        photos: uploaded.map((a) => a.url),
        trackingId: trackingId.trim() || undefined,
      });
      notify(
        'Claim submitted',
        `Your claim ${claim.id} has been sent to your Regional Manager.`
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The claim could not be submitted. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="New Claim" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.label}>Product</Text>
        <View style={styles.products}>
          {products.map((p) => {
            const selected = sku === p.sku;
            return (
              <Pressable
                key={p.sku}
                onPress={() => setSku(p.sku)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.product, selected && styles.productSelected]}>
                <MaterialIcons
                  name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={20}
                  color={selected ? Colors.barLogout : Colors.textMuted}
                />
                <View style={styles.productText}>
                  <Text style={styles.productName}>{p.name}</Text>
                  <Text style={styles.productModel}>Model: {p.model}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <InfoField
          label="Quantity"
          value={quantity}
          onChangeText={(t) => setQuantity(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          placeholder="1"
        />

        <Text style={[styles.label, styles.gap]}>Defect Details</Text>
        <TextInput
          value={details}
          onChangeText={setDetails}
          placeholder="Describe what is wrong with the product"
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={1000}
          style={styles.details}
          cursorColor={Colors.text}
          selectionColor={Colors.bar}
        />

        <Text style={[styles.label, styles.gap]}>
          Photos ({photos.length}/{MAX_PHOTOS})
        </Text>
        <View style={styles.photos}>
          {photos.map((p, i) => (
            <View key={`${p.uri}-${i}`} style={styles.photoWrap}>
              <Image source={{ uri: p.uri }} style={styles.photo} contentFit="cover" />
              <Pressable
                onPress={() => setPhotos((current) => current.filter((_, j) => j !== i))}
                hitSlop={8}
                accessibilityLabel="Remove photo"
                style={styles.removePhoto}>
                <MaterialIcons name="close" size={16} color={Colors.background} />
              </Pressable>
            </View>
          ))}
          {photos.length < MAX_PHOTOS && (
            <>
              <PhotoButton icon="photo-library" label="Gallery" onPress={() => addPhoto('gallery')} />
              <PhotoButton icon="photo-camera" label="Camera" onPress={() => addPhoto('camera')} />
            </>
          )}
        </View>

        <View style={styles.gap}>
          <InfoField
            label="TCS Tracking ID (optional)"
            value={trackingId}
            onChangeText={setTrackingId}
            placeholder="Add if the item was sent by TCS"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={submit}
          disabled={submitting}
          accessibilityRole="button"
          style={({ pressed }) => [styles.submit, pressed && styles.submitPressed]}>
          {submitting ? (
            <ActivityIndicator color={Colors.barLogout} />
          ) : (
            <Text style={styles.submitText}>Submit Claim</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PhotoButton({
  icon,
  label,
  onPress,
}: {
  icon: 'photo-library' | 'photo-camera';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Add photo from ${label}`}
      style={({ pressed }) => [styles.addPhoto, pressed && styles.addPhotoPressed]}>
      <MaterialIcons name={icon} size={26} color={Colors.barItemActive} />
      <Text style={styles.addPhotoText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingTop: 16,
    paddingHorizontal: PagePadding + 0.5,
  },
  label: {
    marginBottom: 8,
    fontFamily: Fonts.medium,
    fontSize: 15,
    color: Colors.text,
  },
  gap: {
    marginTop: 18,
  },
  products: {
    gap: 8,
    marginBottom: 4,
  },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.surface,
    backgroundColor: Colors.background,
  },
  productSelected: {
    borderColor: Colors.bar,
    backgroundColor: Colors.surface,
  },
  productText: {
    flex: 1,
  },
  productName: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.text,
  },
  productModel: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.surfaceLabel,
  },
  details: {
    minHeight: 110,
    padding: 14,
    borderRadius: 13,
    textAlignVertical: 'top',
    fontFamily: Fonts.regular,
    fontSize: 14.5,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoWrap: {
    width: 96,
    height: 96,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backdrop,
  },
  addPhoto: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.surfaceDivider,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPhotoPressed: {
    backgroundColor: Colors.surface,
  },
  addPhotoText: {
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    color: Colors.barItemActive,
  },
  error: {
    marginTop: 14,
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.error,
  },
  submit: {
    marginTop: 24,
    height: 52,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  submitPressed: {
    backgroundColor: Colors.barIndicator,
  },
  submitText: {
    fontFamily: Fonts.medium,
    fontSize: 16,
    color: Colors.barLogout,
  },
});
