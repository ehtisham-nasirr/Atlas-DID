import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { ScreenTitle } from '@/components/app-header';
import { InfoField } from '@/components/info-field';
import { LoadingState } from '@/components/loading-state';
import { useRmWide } from '@/components/rm-nav';
import { Colors, Fonts, PagePadding } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { usePromos } from '@/hooks/use-requests';
import type { PickedFile } from '@/lib/chat-api';
import { confirmAction, notify } from '@/lib/dialogs';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABEL } from '@/data/mock';
import {
  addPromo,
  deletePromo,
  type Promo,
  PROMO_AUDIENCES,
  type PromoAudience,
  setPromoActive,
  setPromoAudience,
} from '@/lib/promos-api';

/** Banner images are shown in a portrait frame in the app. */
const PROMO_RATIO = 608 / 823;

/**
 * RM: the promotions shown in the app's Promos tab — add them, choose who sees each one
 * (mechanics, retailers, distributors), hide/show and delete them.
 */
export default function RmPromosScreen() {
  const wide = useRmWide();
  const { user } = useAuth();
  const { promos } = usePromos(user?.phone);
  const [adding, setAdding] = useState(false);
  // Changes made here show at once, before the next refresh from the server.
  const [changed, setChanged] = useState<Record<number, Promo | null>>({});
  const list = (promos ?? [])
    .map((p) => (p.id in changed ? changed[p.id] : p))
    .filter((p): p is Promo => p !== null);
  const showing = list.filter((p) => p.active).length;

  const toggle = (promo: Promo, active: boolean) => {
    setChanged((c) => ({ ...c, [promo.id]: { ...promo, active } }));
    setPromoActive(promo.id, active).catch((e) => {
      setChanged((c) => ({ ...c, [promo.id]: promo }));
      notify('Update failed', e instanceof Error ? e.message : 'Please try again.');
    });
  };

  const changeAudience = (promo: Promo, audience: PromoAudience[]) => {
    setChanged((c) => ({ ...c, [promo.id]: { ...promo, audience } }));
    setPromoAudience(promo.id, audience).catch((e) => {
      setChanged((c) => ({ ...c, [promo.id]: promo }));
      notify('Update failed', e instanceof Error ? e.message : 'Please try again.');
    });
  };

  const remove = (promo: Promo) =>
    confirmAction('Delete promo', 'Delete this promotion? It will disappear from the app.', 'Delete', () =>
      deletePromo(promo.id)
        .then(() => setChanged((c) => ({ ...c, [promo.id]: null })))
        .catch((e) => notify('Delete failed', e instanceof Error ? e.message : 'Please try again.'))
    );

  const columns = wide ? 3 : 2;

  return (
    <View style={styles.screen}>
      <FlatList
        data={list}
        keyExtractor={(p) => String(p.id)}
        numColumns={columns}
        key={columns}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.content, wide && styles.contentWide]}
        ListHeaderComponent={
          <>
            <View style={styles.titleRow}>
              <View style={styles.titleText}>
                <ScreenTitle>Promotions</ScreenTitle>
                <Text style={styles.subtitle}>
                  {showing} showing in the app · {list.length - showing} hidden
                </Text>
              </View>
              <Pressable
                onPress={() => setAdding(true)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.add, pressed && styles.addPressed]}>
                <MaterialIcons name="add-photo-alternate" size={20} color={Colors.barLogout} />
                <Text style={styles.addText}>Add Promo</Text>
              </Pressable>
            </View>
          </>
        }
        ListEmptyComponent={
          promos === null ? (
            <LoadingState />
          ) : (
            <View style={styles.empty}>
              <MaterialIcons name="local-offer" size={44} color={Colors.surfaceDivider} />
              <Text style={styles.emptyText}>
                No promotions yet. Tap &quot;Add Promo&quot; to upload a banner for the app.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <PromoCard
            promo={item}
            // A fixed share of the row, so a lone card in the last row keeps its size.
            maxWidth={columns === 3 ? '32%' : '48.5%'}
            onToggle={(v) => toggle(item, v)}
            onAudience={(a) => changeAudience(item, a)}
            onDelete={() => remove(item)}
          />
        )}
      />
      <Modal visible={adding} transparent animationType="fade" onRequestClose={() => setAdding(false)}>
        {adding && <AddPromoForm onClose={() => setAdding(false)} />}
      </Modal>
    </View>
  );
}

function PromoCard({
  promo,
  maxWidth,
  onToggle,
  onAudience,
  onDelete,
}: {
  promo: Promo;
  maxWidth: `${number}%`;
  onToggle: (active: boolean) => void;
  onAudience: (audience: PromoAudience[]) => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.card, { maxWidth }, !promo.active && styles.cardHidden]}>
      <Image source={{ uri: promo.imageUrl }} style={styles.image} contentFit="cover" transition={150} />
      <View style={styles.cardBody}>
        {promo.title ? (
          <Text style={styles.cardTitle} numberOfLines={2}>
            {promo.title}
          </Text>
        ) : null}
        <Text style={styles.meta}>{formatDateTime(promo.createdAt)}</Text>
        <Text style={styles.showTo}>Show to</Text>
        <AudienceChecks value={promo.audience} onChange={onAudience} compact />
        <View style={styles.switchRow}>
          <Text style={[styles.status, promo.active && styles.statusOn]}>
            {promo.active ? 'Showing in app' : 'Hidden'}
          </Text>
          <Switch
            value={promo.active}
            onValueChange={onToggle}
            trackColor={{ true: Colors.bar, false: Colors.switchOff }}
            thumbColor={promo.active ? Colors.barItemActive : Colors.background}
          />
        </View>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          style={({ pressed }) => [styles.delete, pressed && styles.deletePressed]}>
          <MaterialIcons name="delete-outline" size={18} color={Colors.error} />
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AddPromoForm({ onClose }: { onClose: () => void }) {
  const [image, setImage] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState<PromoAudience[]>(PROMO_AUDIENCES);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setError('');
    setImage({
      uri: asset.uri,
      name: asset.fileName ?? `promo-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
      file: asset.file,
      size: asset.fileSize,
    });
  };

  const publish = async () => {
    if (!image) return setError('Choose the banner image first.');
    setSaving(true);
    try {
      await addPromo(image, title, audience);
      onClose();
      notify('Promo published', 'It now shows in the Promos tab of the app.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The promo could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.backdrop}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.dialog}>
        <Text style={styles.dialogTitle}>Add Promo</Text>
        <Text style={styles.subtitle}>
          Upload a banner image. Tall (portrait) images fill the app screen best.
        </Text>
        <Pressable
          onPress={pick}
          accessibilityRole="button"
          accessibilityLabel={image ? 'Change image' : 'Choose image'}
          style={({ pressed }) => [styles.picker, pressed && styles.pickerPressed]}>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.preview} contentFit="contain" />
          ) : (
            <View style={styles.pickerEmpty}>
              <MaterialIcons name="add-photo-alternate" size={40} color={Colors.barItemActive} />
              <Text style={styles.pickerText}>Choose image</Text>
            </View>
          )}
        </Pressable>
        <InfoField
          label="Title (optional)"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Eid offer on Chain Sprocket Kits"
        />
        <Text style={styles.showTo}>Show this promo to</Text>
        <AudienceChecks value={audience} onChange={setAudience} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.buttons}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.cancelPressed]}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={publish}
            disabled={saving}
            style={({ pressed }) => [styles.button, styles.submit, (pressed || saving) && styles.submitPressed]}>
            {saving ? (
              <ActivityIndicator color={Colors.barLogout} />
            ) : (
              <Text style={styles.buttonText}>Publish</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Check buttons for who sees a promo. At least one must stay ticked. */
function AudienceChecks({
  value,
  onChange,
  compact,
}: {
  value: PromoAudience[];
  onChange: (audience: PromoAudience[]) => void;
  compact?: boolean;
}) {
  const toggle = (role: PromoAudience) => {
    const next = value.includes(role) ? value.filter((r) => r !== role) : [...value, role];
    if (next.length === 0) {
      notify('Choose who sees it', 'A promo must be shown to at least one group.');
      return;
    }
    // Keep a fixed order: mechanic, retailer, distributor.
    onChange(PROMO_AUDIENCES.filter((r) => next.includes(r)));
  };
  return (
    <View style={[styles.checks, compact && styles.checksCompact]}>
      {PROMO_AUDIENCES.map((role) => {
        const checked = value.includes(role);
        return (
          <Pressable
            key={role}
            onPress={() => toggle(role)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={`Show to ${ROLE_LABEL[role]}s`}
            style={({ pressed }) => [
              styles.check,
              compact && styles.checkCompact,
              checked && styles.checkOn,
              pressed && styles.checkPressed,
            ]}>
            <MaterialIcons
              name={checked ? 'check-box' : 'check-box-outline-blank'}
              size={compact ? 16 : 20}
              color={checked ? Colors.barItemActive : Colors.textMuted}
            />
            <Text style={[styles.checkText, compact && styles.checkTextCompact]}>
              {ROLE_LABEL[role]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: PagePadding + 0.5,
    paddingTop: 12,
    paddingBottom: 32,
  },
  contentWide: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  row: {
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  titleText: {
    flex: 1,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.bar,
  },
  addPressed: {
    backgroundColor: Colors.barIndicator,
  },
  addText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.barLogout,
  },
  card: {
    flex: 1,
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.background,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.1)',
  },
  cardHidden: {
    opacity: 0.6,
  },
  image: {
    width: '100%',
    aspectRatio: PROMO_RATIO,
    backgroundColor: Colors.surface,
  },
  cardBody: {
    gap: 4,
    padding: 10,
  },
  cardTitle: {
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    color: Colors.text,
  },
  meta: {
    fontFamily: Fonts.regular,
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  showTo: {
    marginTop: 2,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    color: Colors.text,
  },
  checks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checksCompact: {
    gap: 4,
  },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  checkCompact: {
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
  },
  checkOn: {
    borderColor: Colors.bar,
    backgroundColor: Colors.surface,
  },
  checkPressed: {
    opacity: 0.8,
  },
  checkText: {
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    color: Colors.text,
  },
  checkTextCompact: {
    fontSize: 11.5,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  status: {
    flexShrink: 1,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  statusOn: {
    color: Colors.success,
  },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 34,
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  deletePressed: {
    backgroundColor: Colors.surface,
  },
  deleteText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.error,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textMuted,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: Colors.backdrop,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    gap: 10,
    padding: 20,
    borderRadius: 20,
    backgroundColor: Colors.background,
  },
  dialogTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 18,
    color: Colors.text,
  },
  picker: {
    height: 260,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.surfaceDivider,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  pickerPressed: {
    opacity: 0.85,
  },
  pickerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pickerText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.barItemActive,
  },
  preview: {
    flex: 1,
  },
  error: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.error,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
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
