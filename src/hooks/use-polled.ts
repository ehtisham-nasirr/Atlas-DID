import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { type LiveTable, onTableChange } from '@/lib/realtime';
import { loadJSON, saveJSON } from '@/lib/storage';

/** Backup refresh; changes normally arrive at once through realtime. */
const POLL_MS = 15000;
const STORAGE_PREFIX = 'cache.';

/**
 * Last loaded data per key, shared by every screen and saved on the device. A screen opened
 * again (or after an app restart) shows it at once while fresh data loads in the background.
 */
const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();
const inflight = new Map<string, Promise<unknown>>();
/** How to load each key, so a realtime change can reload it. */
const loaders = new Map<string, () => Promise<unknown>>();

// Keys are named after the table they come from, e.g. `orders:<phone>`.
for (const table of ['orders', 'claims', 'redemptions', 'promos'] satisfies LiveTable[]) {
  onTableChange(table, () => {
    for (const [key, load] of loaders) {
      if (key.startsWith(`${table}:`)) refresh(key, load).catch(() => undefined);
    }
  });
}

function store(key: string, data: unknown) {
  cache.set(key, data);
  listeners.get(key)?.forEach((notify) => notify());
  saveJSON(STORAGE_PREFIX + key, data);
}

function subscribe(key: string | null, notify: () => void) {
  if (!key) return () => {};
  const set = listeners.get(key) ?? new Set();
  set.add(notify);
  listeners.set(key, set);
  return () => set.delete(notify);
}

/** Loads `key`, sharing one request between all screens asking for it at the same time. */
function refresh<T>(key: string, load: () => Promise<T>): Promise<T> {
  loaders.set(key, load);
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const request = load()
    .then((data) => {
      store(key, data);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

/** Shows the copy saved on the device, unless fresher data has already arrived. */
function restore(key: string) {
  loadJSON<unknown>(STORAGE_PREFIX + key, null).then((saved) => {
    if (saved !== null && !cache.has(key)) {
      cache.set(key, saved);
      listeners.get(key)?.forEach((notify) => notify());
    }
  });
}

/** Starts loading data before a screen needs it (e.g. right after login). */
export function prefetch<T>(key: string, load: () => Promise<T>) {
  if (!cache.has(key)) restore(key);
  refresh(key, load).catch(() => undefined);
}

/**
 * Loads data now and every few seconds while the screen is focused.
 * `key` identifies what is loaded; pass null to load nothing. `data` is null only until the
 * first copy arrives (from the device or the server).
 */
export function usePolled<T>(key: string | null, load: () => Promise<T>) {
  const data = useSyncExternalStore(
    useCallback((notify: () => void) => subscribe(key, notify), [key]),
    () => (key && cache.has(key) ? (cache.get(key) as T) : null)
  );
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (key && !cache.has(key)) restore(key);
  }, [key]);

  useFocusEffect(
    useCallback(() => {
      if (!key) return;
      let active = true;
      const poll = () =>
        refresh(key, load)
          .then(() => active && setOffline(false))
          .catch(() => active && setOffline(true));
      poll();
      const timer = setInterval(poll, POLL_MS);
      return () => {
        active = false;
        clearInterval(timer);
      };
      // `load` is recreated each render; `key` captures everything it depends on.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key])
  );

  return { data, offline };
}
