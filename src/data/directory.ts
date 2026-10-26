import { useSyncExternalStore } from 'react';

import type { User } from '@/data/mock';

/**
 * Everyone in the signed-in user's network, loaded from the database at login and refreshed now
 * and then. Lets any screen look up a name or shop from a phone number without waiting.
 */
let directory: User[] = [];
const listeners = new Set<() => void>();

export function setDirectory(list: User[]) {
  directory = list;
  listeners.forEach((notify) => notify());
}

export function findUserByPhone(phone: string): User | undefined {
  return directory.find((u) => u.phone === phone);
}

/** The directory, re-rendering the caller when it changes. */
export function useDirectory(): User[] {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => directory
  );
}
