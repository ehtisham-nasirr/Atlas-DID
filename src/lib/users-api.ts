import type { Role, User } from '@/data/mock';
import { supabase } from '@/lib/supabase';

type ProfileRow = {
  id: string;
  phone: string;
  name: string;
  nic: string;
  shop_name: string;
  city: string;
  role: Role;
  retailer_phone: string | null;
  distributor_phone: string | null;
  rm_phone: string | null;
  photo_url: string | null;
};

export function toUser(row: ProfileRow): User {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    nic: row.nic,
    shopName: row.shop_name,
    city: row.city,
    role: row.role,
    retailerPhone: row.retailer_phone ?? undefined,
    distributorPhone: row.distributor_phone ?? undefined,
    rmPhone: row.rm_phone ?? undefined,
    photoUrl: row.photo_url ?? undefined,
  };
}

/** Throws the database's error message, so screens can show it. */
export function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

/** Everyone the signed-in user can see (all registered users, for the pilot). */
export async function fetchDirectory(): Promise<User[]> {
  const rows = unwrap(await supabase.from('profiles').select('*').order('name'));
  return (rows as ProfileRow[]).map(toUser);
}

/** Phone of the user this device's session is logged in as, or null. */
export async function fetchMyPhone(): Promise<string | null> {
  return unwrap(await supabase.rpc('my_phone')) as string | null;
}

const OFFLINE = 'Could not reach the server. Check your internet connection and try again.';

/**
 * Logs in with phone + password. The app first opens an anonymous connection to the database
 * (no email needed), then the database checks the password and links it to the user.
 * Returns the user's phone, or throws a message to show.
 */
export async function signInWithPhone(phone: string, password: string): Promise<string> {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      throw new Error(
        /anonymous/i.test(error.message)
          ? 'Login is turned off on the server. In Supabase, turn on "Allow anonymous sign-ins".'
          : OFFLINE
      );
    }
  }
  const { data, error } = await supabase.rpc('login', {
    p_phone: normalizePhone(phone),
    p_password: password,
  });
  if (error) throw new Error(/incorrect/i.test(error.message) ? error.message : OFFLINE);
  return (data as ProfileRow).phone;
}

/** Ends the session on the server too, so this device is no longer linked to the user. */
export async function signOutOnServer() {
  await supabase.rpc('logout');
  await supabase.auth.signOut();
}

export type EditableProfile = Pick<User, 'name' | 'shopName' | 'city'>;

export async function updateMyProfile(phone: string, changes: EditableProfile) {
  unwrap(
    await supabase
      .from('profiles')
      .update({ name: changes.name, shop_name: changes.shopName, city: changes.city })
      .eq('phone', phone)
  );
}

/** Sets (or with null, removes) the user's profile photo. */
export async function updateMyPhoto(phone: string, photoUrl: string | null) {
  unwrap(await supabase.from('profiles').update({ photo_url: photoUrl }).eq('phone', phone));
}

export type NewUser = Omit<User, 'id' | 'rmPhone' | 'photoUrl'> & { password: string };

/** The RM registers a new mechanic, retailer or distributor in their region. */
export async function createUser(input: NewUser): Promise<User> {
  const row = unwrap(
    await supabase.rpc('create_user', {
      p_phone: normalizePhone(input.phone),
      p_password: input.password,
      p_name: input.name,
      p_role: input.role,
      p_nic: input.nic,
      p_shop: input.shopName,
      p_city: input.city,
      p_retailer: input.retailerPhone ?? null,
      p_distributor: input.distributorPhone ?? null,
    })
  );
  return toUser(row as ProfileRow);
}

/** The RM sets a new password for a user in their region. */
export async function resetPassword(phone: string, password: string) {
  unwrap(await supabase.rpc('reset_password', { p_phone: phone, p_password: password }));
}
