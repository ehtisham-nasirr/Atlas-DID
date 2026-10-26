import { Platform } from 'react-native';

import { iso } from '@/lib/orders-api';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/users-api';

export type Attachment = {
  /** Public URL of the uploaded file. */
  url: string;
  name: string;
  type: string;
  size: number;
};

export type ChatMessage = {
  id: string;
  conversation: string;
  from: string;
  to: string;
  text: string;
  attachment?: Attachment;
  /** ISO date-time. */
  at: string;
};

export type ConversationSummary = {
  conversation: string;
  partner: string;
  last: ChatMessage;
};

/** A file chosen with the image or document picker, ready to upload. */
export type PickedFile = {
  uri: string;
  name: string;
  type: string;
  size?: number;
  /** Present on web, where the picker returns a browser File. */
  file?: File;
};

const BUCKET = 'uploads';

/** Full URL of an uploaded file (older records may hold a bare path). */
export function fileUrl(url: string) {
  return url.startsWith('http') ? url : supabase.storage.from(BUCKET).getPublicUrl(url).data.publicUrl;
}

export function conversationId(a: string, b: string) {
  return [a, b].sort().join('_');
}

type MessageRow = {
  id: string;
  conversation: string;
  from_phone: string;
  to_phone: string;
  text: string;
  attachment: Attachment | null;
  created_at: string;
};

function toMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversation: row.conversation,
    from: row.from_phone,
    to: row.to_phone,
    text: row.text,
    attachment: row.attachment ?? undefined,
    at: iso(row.created_at)!,
  };
}

export async function fetchMessages(conversation: string) {
  const rows = unwrap(
    await supabase
      .from('messages')
      .select('*')
      .eq('conversation', conversation)
      .order('created_at', { ascending: true })
  );
  return (rows as MessageRow[]).map(toMessage);
}

/** Latest message of each of the user's conversations, newest first. */
export async function fetchConversations(_user: string) {
  const rows = unwrap(await supabase.rpc('my_conversations')) as {
    conversation: string;
    partner: string;
    last: ChatMessage;
  }[];
  return rows
    .map((r) => ({ ...r, last: { ...r.last, at: iso(r.last.at)!, attachment: r.last.attachment ?? undefined } }))
    .sort((a, b) => b.last.at.localeCompare(a.last.at));
}

export async function sendMessage(from: string, to: string, text: string, attachment?: Attachment) {
  const row: unknown = unwrap(
    await supabase
      .from('messages')
      .insert({
        conversation: conversationId(from, to),
        from_phone: from,
        to_phone: to,
        text,
        attachment: attachment ?? null,
      })
      .select()
      .single()
  );
  return toMessage(row as MessageRow);
}

/** Uploads a photo or document to file storage. */
export async function uploadFile(picked: PickedFile): Promise<Attachment> {
  const ext = picked.name.includes('.') ? picked.name.split('.').pop() : '';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext ? `.${ext}` : ''}`;
  let body: File | FormData;
  if (Platform.OS === 'web' && picked.file) {
    body = picked.file;
  } else {
    // React Native uploads a local file from its uri inside a form.
    body = new FormData();
    body.append('file', { uri: picked.uri, name: picked.name, type: picked.type } as unknown as Blob);
  }
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: picked.type, upsert: false });
  if (error) throw new Error(error.message);
  return {
    url: fileUrl(path),
    name: picked.name,
    type: picked.type,
    size: picked.file?.size ?? picked.size ?? 0,
  };
}
