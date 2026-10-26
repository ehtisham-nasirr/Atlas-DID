import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type LiveTable = 'orders' | 'claims' | 'redemptions' | 'messages' | 'promos';
const TABLES: LiveTable[] = ['orders', 'claims', 'redemptions', 'messages', 'promos'];

const listeners = new Map<LiveTable, Set<() => void>>();
let channel: RealtimeChannel | null = null;

/**
 * Listens for database changes the user is allowed to see, so screens refresh the moment
 * something changes instead of waiting for the next poll.
 */
export function startRealtime() {
  if (channel) return;
  channel = supabase.channel('atlas-changes');
  for (const table of TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () =>
      listeners.get(table)?.forEach((notify) => notify())
    );
  }
  channel.subscribe();
}

export function stopRealtime() {
  if (channel) supabase.removeChannel(channel);
  channel = null;
}

/** Calls `notify` whenever a row of `table` changes. Returns the unsubscribe function. */
export function onTableChange(table: LiveTable, notify: () => void) {
  const set = listeners.get(table) ?? new Set();
  set.add(notify);
  listeners.set(table, set);
  return () => {
    set.delete(notify);
  };
}
