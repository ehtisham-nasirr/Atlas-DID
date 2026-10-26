import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { type ChatMessage, fetchMessages } from '@/lib/chat-api';
import { onTableChange } from '@/lib/realtime';

/** Backup refresh; new messages normally arrive at once through realtime. */
const POLL_MS = 10000;

/** Messages of one conversation, refreshed every few seconds while the screen is open. */
export function useMessages(conversation: string) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [offline, setOffline] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const poll = () =>
        fetchMessages(conversation)
          .then((data) => {
            if (!active) return;
            setMessages(data);
            setOffline(false);
          })
          .catch(() => active && setOffline(true));
      poll();
      const timer = setInterval(poll, POLL_MS);
      const stopListening = onTableChange('messages', poll);
      return () => {
        active = false;
        clearInterval(timer);
        stopListening();
      };
    }, [conversation])
  );

  return { messages, setMessages, offline };
}
