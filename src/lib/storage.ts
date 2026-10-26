import AsyncStorage from '@react-native-async-storage/async-storage';

/** Reads a JSON value saved with {@link saveJSON}; returns `fallback` when missing or unreadable. */
export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function saveJSON(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persisting is best effort; the app keeps working with in-memory state.
  }
}

export async function removeKey(key: string) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore: nothing to clean up.
  }
}
