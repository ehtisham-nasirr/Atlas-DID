import { createContext, type ReactNode, use, useEffect, useState } from 'react';

import { setDirectory } from '@/data/directory';
import type { User } from '@/data/mock';
import { type PickedFile, uploadFile } from '@/lib/chat-api';
import { startRealtime, stopRealtime } from '@/lib/realtime';
import { loadJSON, saveJSON } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import {
  type EditableProfile,
  fetchDirectory,
  fetchMyPhone,
  signInWithPhone,
  signOutOnServer,
  updateMyPhoto,
  updateMyProfile,
} from '@/lib/users-api';

export type { EditableProfile };

const REMEMBER_KEY = 'auth.remember';
/** Last known profile and directory for a session, so the app opens at once (and offline). */
const cacheKey = (sessionId: string) => `auth.member.${sessionId}`;
const DIRECTORY_REFRESH_MS = 60_000;

type AuthContextValue = {
  user: User | null;
  /** False until the saved session has been checked on startup. */
  ready: boolean;
  /** Whether the login is kept after the app is closed. */
  remember: boolean;
  setRemember: (value: boolean) => void;
  /** Returns an error message, or null when logged in. */
  signIn: (phone: string, password: string) => Promise<string | null>;
  signOut: () => void;
  /** Saves name, shop and city to the database. */
  updateProfile: (changes: EditableProfile) => Promise<void>;
  /** Uploads a new profile photo, or removes it when `photo` is null. */
  updatePhoto: (photo: PickedFile | null) => Promise<void>;
  /** Reloads everyone's details, e.g. after the RM adds a user. */
  refreshDirectory: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const sessionId = async () => (await supabase.auth.getSession()).data.session?.user.id;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [remember, setRememberState] = useState(true);
  const [ready, setReady] = useState(false);

  /** Loads the user's profile and the directory. Returns an error message, or null. */
  const loadMember = async (phone: string): Promise<string | null> => {
    let list: User[];
    try {
      list = await fetchDirectory();
    } catch {
      return 'Could not reach the server. Check your internet connection and try again.';
    }
    const me = list.find((u) => u.phone === phone);
    if (!me) {
      await signOutOnServer();
      return 'This account is not registered. Ask your Regional Manager to add you.';
    }
    setDirectory(list);
    setUser(me);
    const id = await sessionId();
    if (id) saveJSON(cacheKey(id), { user: me, directory: list });
    startRealtime();
    return null;
  };

  /** Checks with the server who this session belongs to, then loads that user. */
  const restore = async () => {
    try {
      const phone = await fetchMyPhone();
      if (phone) await loadMember(phone);
      else setUser(null);
    } catch {
      // Offline: keep whatever was shown from the saved copy.
    }
  };

  // Restore the saved session, if any.
  useEffect(() => {
    (async () => {
      const savedRemember = await loadJSON(REMEMBER_KEY, true);
      setRememberState(savedRemember);
      const session = (await supabase.auth.getSession()).data.session;
      if (session && !savedRemember) {
        await signOutOnServer().catch(() => undefined);
      } else if (session) {
        const cached = await loadJSON<{ user: User; directory: User[] } | null>(
          cacheKey(session.user.id),
          null
        );
        if (cached) {
          // Open with the saved copy straight away; fresh details follow in the background.
          setDirectory(cached.directory);
          setUser(cached.user);
          startRealtime();
          restore();
        } else {
          await restore();
        }
      }
      setReady(true);
    })();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        stopRealtime();
        setUser(null);
        setDirectory([]);
      }
    });
    return () => data.subscription.unsubscribe();
    // Runs once on startup; `restore` only uses setters and module functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New users added by the RM appear without logging in again.
  const phone = user?.phone;
  useEffect(() => {
    if (!phone) return;
    const timer = setInterval(() => loadMember(phone), DIRECTORY_REFRESH_MS);
    return () => clearInterval(timer);
  }, [phone]);

  const signIn = async (loginPhone: string, password: string) => {
    try {
      return await loadMember(await signInWithPhone(loginPhone, password));
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not log in. Please try again.';
    }
  };

  const signOut = () => {
    stopRealtime();
    setUser(null);
    signOutOnServer().catch(() => undefined);
  };

  const setRemember = (value: boolean) => {
    setRememberState(value);
    saveJSON(REMEMBER_KEY, value);
  };

  const updateProfile = async (changes: EditableProfile) => {
    if (!user) return;
    await updateMyProfile(user.phone, changes);
    setUser({ ...user, ...changes });
    loadMember(user.phone);
  };

  const updatePhoto = async (photo: PickedFile | null) => {
    if (!user) return;
    const photoUrl = photo ? (await uploadFile(photo)).url : null;
    await updateMyPhoto(user.phone, photoUrl);
    setUser({ ...user, photoUrl: photoUrl ?? undefined });
    loadMember(user.phone);
  };

  const refreshDirectory = async () => {
    if (user) await loadMember(user.phone);
  };

  return (
    <AuthContext
      value={{
        user,
        ready,
        remember,
        setRemember,
        signIn,
        signOut,
        updateProfile,
        updatePhoto,
        refreshDirectory,
      }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
