import * as Haptics from 'expo-haptics';
import { router, usePathname } from 'expo-router';
import { createContext, type ReactNode, use, useEffect, useRef, useState } from 'react';

import { MessageBanner } from '@/components/message-banner';
import { useAuth } from '@/context/auth';
import { findUserByPhone } from '@/data/mock';
import { type ChatMessage, type ConversationSummary, fetchConversations } from '@/lib/chat-api';
import { onTableChange } from '@/lib/realtime';
import { loadJSON, saveJSON } from '@/lib/storage';

/** Backup refresh; new messages normally arrive at once through realtime. */
const POLL_MS = 15000;
const BANNER_MS = 4500;

export type BannerData = {
  key: string;
  partner: string;
  name: string;
  message: ChatMessage;
};

type ChatContextValue = {
  /** Latest message of each conversation; null until the first load. */
  conversations: ConversationSummary[] | null;
  /** True when the chat server could not be reached on the last try. */
  offline: boolean;
  unreadCount: number;
  isUnread: (summary: ConversationSummary) => boolean;
  /** Records that the user has read a conversation up to `at`. */
  markSeen: (conversation: string, at: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Keeps the signed-in user's conversations up to date in the background and shows a banner
 * at the top of the screen when a new message arrives.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const me = user?.phone ?? null;
  const pathname = usePathname();

  const [loaded, setLoaded] = useState<{ user: string; list: ConversationSummary[] } | null>(null);
  const [seenState, setSeenState] = useState<{ user: string; seen: Record<string, string> } | null>(
    null
  );
  const [offline, setOffline] = useState(false);
  const [banner, setBanner] = useState<BannerData | null>(null);

  // Newest incoming message already announced; null until the first load for this user.
  const announcedAt = useRef<string | null>(null);
  const currentPath = useRef(pathname);
  useEffect(() => {
    currentPath.current = pathname;
  }, [pathname]);

  const conversations = loaded && loaded.user === me ? loaded.list : null;
  const seen = seenState && seenState.user === me ? seenState.seen : {};

  useEffect(() => {
    if (!me) return;
    let active = true;
    loadJSON<Record<string, string>>(`chat.seen.${me}`, {}).then((saved) => {
      if (active) setSeenState({ user: me, seen: saved });
    });
    return () => {
      active = false;
    };
  }, [me]);

  useEffect(() => {
    if (!me) return;
    announcedAt.current = null;
    let active = true;

    const poll = async () => {
      try {
        const list = await fetchConversations(me);
        if (!active) return;
        setLoaded({ user: me, list });
        setOffline(false);

        const incoming = list.filter((c) => c.last.from !== me);
        const newest = incoming.reduce((max, c) => (c.last.at > max ? c.last.at : max), '');
        const since = announcedAt.current;
        announcedAt.current = newest > (since ?? '') ? newest : since ?? '';
        // Messages that were already there when the app opened are shown as unread, not announced.
        if (since === null) return;

        const fresh = incoming
          .filter((c) => c.last.at > since)
          .sort((a, b) => b.last.at.localeCompare(a.last.at))[0];
        if (!fresh || currentPath.current === `/chat/${fresh.partner}`) return;
        setBanner({
          key: fresh.last.id,
          partner: fresh.partner,
          name: findUserByPhone(fresh.partner)?.name ?? fresh.partner,
          message: fresh.last,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        if (active) setOffline(true);
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    const stopListening = onTableChange('messages', poll);
    return () => {
      active = false;
      clearInterval(timer);
      stopListening();
    };
  }, [me]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), BANNER_MS);
    return () => clearTimeout(timer);
  }, [banner]);

  const isUnread = (summary: ConversationSummary) =>
    summary.last.from !== me && summary.last.at > (seen[summary.conversation] ?? '');

  const markSeen = (conversation: string, at: string) => {
    if (!me || (seen[conversation] ?? '') >= at) return;
    const next = { ...seen, [conversation]: at };
    setSeenState({ user: me, seen: next });
    saveJSON(`chat.seen.${me}`, next);
  };

  return (
    <ChatContext
      value={{
        conversations,
        offline,
        unreadCount: (conversations ?? []).filter(isUnread).length,
        isUnread,
        markSeen,
      }}>
      {children}
      <MessageBanner
        banner={me ? banner : null}
        onPress={(partner) => {
          setBanner(null);
          router.push({ pathname: '/chat/[partner]', params: { partner } });
        }}
        onDismiss={() => setBanner(null)}
      />
    </ChatContext>
  );
}

export function useChat() {
  const value = use(ChatContext);
  if (!value) throw new Error('useChat must be used inside <ChatProvider>');
  return value;
}
