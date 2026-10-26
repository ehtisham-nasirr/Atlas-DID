import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

/** Project URL and publishable key. The publishable key is meant to ship inside the app. */
export const SUPABASE_URL = 'https://jtawikihciuxbnlczqpw.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_t62gUmpcIrr3Zv4npY8ByA_pjMl_USN';

/** The app's database client. The session is kept on the device between launches. */
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // On web supabase-js uses the browser's localStorage by itself.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Keep the login fresh only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
