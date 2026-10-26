import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { type ComponentProps, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useChat } from '@/context/chat';
import { findUserByPhone, ROLE_LABEL } from '@/data/mock';
import { useMessages } from '@/hooks/use-chat';
import {
  type ChatMessage,
  conversationId,
  fileUrl,
  type PickedFile,
  sendMessage,
  uploadFile,
} from '@/lib/chat-api';
import { formatDateTime, formatSize } from '@/lib/format';

const MAX_BYTES = 10 * 1024 * 1024;

type Source = 'gallery' | 'camera' | 'document';
const SOURCES: { value: Source; label: string; icon: ComponentProps<typeof MaterialIcons>['name'] }[] = [
  { value: 'gallery', label: 'Photo from Gallery', icon: 'photo-library' },
  { value: 'camera', label: 'Take Photo', icon: 'photo-camera' },
  { value: 'document', label: 'Document / File', icon: 'description' },
];

/** Opens the chosen picker; resolves to null if the user cancels. */
async function pickFile(source: Source): Promise<(PickedFile & { size?: number }) | null> {
  if (source === 'document') {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return null;
    return {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType ?? 'application/octet-stream',
      file: asset.file,
      size: asset.size,
    };
  }

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
    name: asset.fileName ?? `photo-${Date.now()}.jpg`,
    type: asset.mimeType ?? 'image/jpeg',
    file: asset.file,
    size: asset.fileSize,
  };
}

export default function ConversationScreen() {
  const insets = useSafeAreaInsets();
  const { partner: partnerPhone } = useLocalSearchParams<{ partner: string }>();
  const { user } = useAuth();
  const { markSeen } = useChat();
  const me = user?.phone ?? '';
  const partner = findUserByPhone(partnerPhone);
  const conversation = conversationId(me, partnerPhone);

  const { messages, setMessages, offline } = useMessages(conversation);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<'' | 'sending' | 'uploading'>('');
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const latestAt = messages?.[messages.length - 1]?.at;
  useEffect(() => {
    if (latestAt) markSeen(conversation, latestAt);
  }, [conversation, latestAt, markSeen]);

  const post = async (text: string, picked?: PickedFile) => {
    setError('');
    try {
      setBusy(picked ? 'uploading' : 'sending');
      const attachment = picked ? await uploadFile(picked) : undefined;
      setBusy('sending');
      const message = await sendMessage(me, partnerPhone, text, attachment);
      setMessages((current) => [...(current ?? []), message]);
      setDraft('');
    } catch {
      setError('Message not sent. Check your connection and try again.');
    } finally {
      setBusy('');
    }
  };

  const sendText = () => {
    const text = draft.trim();
    if (text && !busy) post(text);
  };

  const attach = async (source: Source) => {
    setPickerOpen(false);
    try {
      const picked = await pickFile(source);
      if (!picked) return;
      if (picked.size && picked.size > MAX_BYTES) {
        setError('This file is larger than 10 MB.');
        return;
      }
      // Any typed text is sent along as the caption.
      await post(draft.trim(), picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the file.');
    }
  };

  const title = partner?.name ?? partnerPhone;
  const canSend = !!draft.trim() && !busy;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <ScreenHeader title={title} />
      {partner && (
        <Text style={styles.partnerMeta}>
          {ROLE_LABEL[partner.role]} • {partner.shopName}
        </Text>
      )}

      {messages === null ? (
        <View style={styles.center}>
          {offline ? (
            <Text style={styles.notice}>Can&apos;t reach the chat server. Retrying...</Text>
          ) : (
            <ActivityIndicator color={Colors.barItemActive} />
          )}
        </View>
      ) : (
        <FlatList
          inverted
          data={[...messages].reverse()}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Bubble message={item} mine={item.from === me} onOpenImage={setViewing} />
          )}
          ListEmptyComponent={
            <Text style={[styles.notice, styles.emptyNotice]}>
              Say hello to {title}. Your message will appear in their chat.
            </Text>
          }
        />
      )}

      {busy === 'uploading' && (
        <View style={styles.status}>
          <ActivityIndicator size="small" color={Colors.barItemActive} />
          <Text style={styles.statusText}>Uploading attachment...</Text>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable
          onPress={() => setPickerOpen(true)}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel="Add attachment"
          style={({ pressed }) => [styles.attachButton, pressed && styles.attachPressed]}>
          <MaterialIcons name="attach-file" size={24} color={Colors.barLogout} />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
          multiline
          maxLength={2000}
          cursorColor={Colors.text}
          selectionColor={Colors.bar}
        />
        <Pressable
          onPress={sendText}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={({ pressed }) => [
            styles.sendButton,
            !canSend && styles.sendDisabled,
            pressed && styles.sendPressed,
          ]}>
          {busy === 'sending' ? (
            <ActivityIndicator color={Colors.barLogout} />
          ) : (
            <MaterialIcons name="send" size={22} color={Colors.barLogout} />
          )}
        </Pressable>
      </View>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.sheetTitle}>Send attachment</Text>
            {SOURCES.map((s) => (
              <Pressable
                key={s.value}
                onPress={() => attach(s.value)}
                style={({ pressed }) => [styles.sheetOption, pressed && styles.attachPressed]}>
                <View style={styles.sheetIcon}>
                  <MaterialIcons name={s.icon} size={22} color={Colors.barLogout} />
                </View>
                <Text style={styles.sheetText}>{s.label}</Text>
              </Pressable>
            ))}
            <Text style={styles.sheetHint}>Max 10 MB per file</Text>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={viewing !== null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewer}>
          {viewing && <Image source={{ uri: viewing }} style={styles.viewerImage} contentFit="contain" />}
          <Pressable
            onPress={() => setViewing(null)}
            accessibilityLabel="Close photo"
            style={[styles.viewerClose, { top: insets.top + 12 }]}>
            <MaterialIcons name="close" size={28} color={Colors.background} />
          </Pressable>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Bubble({
  message,
  mine,
  onOpenImage,
}: {
  message: ChatMessage;
  mine: boolean;
  onOpenImage: (uri: string) => void;
}) {
  const attachment = message.attachment;
  const url = attachment ? fileUrl(attachment.url) : '';
  const isImage = attachment?.type.startsWith('image/');

  return (
    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
      {attachment && isImage && (
        <Pressable onPress={() => onOpenImage(url)} accessibilityLabel="Open photo">
          <Image source={{ uri: url }} style={styles.photo} contentFit="cover" transition={150} />
        </Pressable>
      )}
      {attachment && !isImage && (
        <Pressable
          onPress={() => Linking.openURL(url)}
          accessibilityRole="link"
          style={[styles.file, mine ? styles.fileMine : styles.fileTheirs]}>
          <MaterialIcons
            name={attachment.type === 'application/pdf' ? 'picture-as-pdf' : 'insert-drive-file'}
            size={30}
            color={Colors.barItemActive}
          />
          <View style={styles.fileText}>
            <Text style={styles.fileName} numberOfLines={2}>
              {attachment.name}
            </Text>
            <Text style={styles.fileSize}>{formatSize(attachment.size)} • Tap to open</Text>
          </View>
        </Pressable>
      )}
      {message.text ? <Text style={styles.bubbleText}>{message.text}</Text> : null}
      <Text style={styles.bubbleTime}>{formatDateTime(message.at)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  partnerMeta: {
    paddingVertical: 6,
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.surfaceLabel,
    backgroundColor: Colors.surface,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notice: {
    textAlign: 'center',
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
  },
  emptyNotice: {
    marginTop: 'auto',
    marginBottom: 'auto',
    paddingHorizontal: 32,
    transform: [{ scaleY: -1 }],
  },
  bubble: {
    maxWidth: '80%',
    marginVertical: 4,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 7,
    borderRadius: 18,
    gap: 6,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 6,
    backgroundColor: Colors.bar,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
    backgroundColor: Colors.surface,
  },
  bubbleText: {
    paddingHorizontal: 2,
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.text,
  },
  bubbleTime: {
    alignSelf: 'flex-end',
    fontFamily: Fonts.regular,
    fontSize: 10.5,
    color: Colors.surfaceLabel,
  },
  photo: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: Colors.surfaceDivider,
  },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    minWidth: 200,
  },
  fileMine: {
    backgroundColor: Colors.scanButton,
  },
  fileTheirs: {
    backgroundColor: Colors.background,
  },
  fileText: {
    flex: 1,
  },
  fileName: {
    fontFamily: Fonts.medium,
    fontSize: 13.5,
    color: Colors.text,
  },
  fileSize: {
    fontFamily: Fonts.regular,
    fontSize: 11.5,
    color: Colors.surfaceLabel,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  statusText: {
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.surfaceLabel,
  },
  error: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    fontFamily: Fonts.regular,
    fontSize: 12.5,
    color: Colors.error,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.headerDivider,
    backgroundColor: Colors.background,
  },
  attachButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  attachPressed: {
    backgroundColor: Colors.scanButton,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 23,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendPressed: {
    backgroundColor: Colors.barIndicator,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.backdrop,
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: Colors.background,
  },
  sheetTitle: {
    marginBottom: 8,
    fontFamily: Fonts.medium,
    fontSize: 16.5,
    color: Colors.text,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  sheetIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bar,
  },
  sheetText: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.text,
  },
  sheetHint: {
    marginTop: 8,
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  viewer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  viewerImage: {
    flex: 1,
  },
  viewerClose: {
    position: 'absolute',
    right: 16,
    padding: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});
