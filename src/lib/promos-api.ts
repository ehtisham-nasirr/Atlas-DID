import type { Role } from '@/data/mock';
import { type PickedFile, uploadFile } from '@/lib/chat-api';
import { iso } from '@/lib/orders-api';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/users-api';

/** A promotion banner shown in the app's Promos tab, managed by the RM. */
export type Promo = {
  id: number;
  imageUrl: string;
  title: string;
  /** Hidden promos stay in the RM's list but are not shown in the app. */
  active: boolean;
  /** Who sees the promo in the app. */
  audience: PromoAudience[];
  createdAt: string;
};

export type PromoAudience = Exclude<Role, 'rm'>;
export const PROMO_AUDIENCES: PromoAudience[] = ['mechanic', 'retailer', 'distributor'];

type PromoRow = {
  id: number;
  image_url: string;
  title: string;
  active: boolean;
  audience: PromoAudience[] | null;
  created_at: string;
};

const toPromo = (row: PromoRow): Promo => ({
  id: row.id,
  imageUrl: row.image_url,
  title: row.title,
  active: row.active,
  // Promos saved before audiences existed are for everyone.
  audience: row.audience ?? PROMO_AUDIENCES,
  createdAt: iso(row.created_at)!,
});

/** All promos, newest first. */
export async function fetchPromos() {
  const rows = unwrap(await supabase.from('promos').select('*').order('created_at', { ascending: false }));
  return (rows as PromoRow[]).map(toPromo);
}

/** RM: uploads the banner image and publishes it. */
export async function addPromo(image: PickedFile, title: string, audience: PromoAudience[]) {
  const { url } = await uploadFile(image);
  const row: unknown = unwrap(
    await supabase
      .from('promos')
      .insert({ image_url: url, title: title.trim(), audience })
      .select()
      .single()
  );
  return toPromo(row as PromoRow);
}

/** RM: shows or hides a promo in the app. */
export async function setPromoActive(id: number, active: boolean) {
  unwrap(await supabase.from('promos').update({ active }).eq('id', id));
}

/** RM: chooses who sees a promo. */
export async function setPromoAudience(id: number, audience: PromoAudience[]) {
  unwrap(await supabase.from('promos').update({ audience }).eq('id', id));
}

/** RM: deletes a promo. */
export async function deletePromo(id: number) {
  unwrap(await supabase.from('promos').delete().eq('id', id));
}
