import { iso } from '@/lib/orders-api';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/users-api';

export type ScanRow = {
  id: string;
  code: string;
  sku: string;
  serial: string;
  points: number;
  created_at: string;
};

export type SpinRow = { reward: string | null; created_at: string };

/** The signed-in user's scans, newest first. */
export async function fetchScans() {
  return unwrap(
    await supabase.from('scans').select('*').order('created_at', { ascending: false })
  ) as ScanRow[];
}

/** The signed-in user's spins, newest first. */
export async function fetchSpins() {
  return unwrap(
    await supabase.from('spins').select('reward, created_at').order('created_at', { ascending: false })
  ) as SpinRow[];
}

/**
 * Credits a QR code to the user. `used` means another account already scanned it; every code
 * is credited only once across the whole system.
 */
export async function creditScan(code: string) {
  return unwrap(await supabase.rpc('credit_scan', { p_code: code })) as
    | { status: 'added' | 'duplicate'; scan: ScanRow }
    | { status: 'used'; at: string }
    | { status: 'invalid' };
}

/** Whether a code has been scanned by anyone, and when (ISO), without crediting it. */
export async function codeStatus(code: string) {
  const result = unwrap(await supabase.rpc('code_status', { p_code: code })) as {
    scanned: boolean;
    at: string | null;
  };
  return { scanned: result.scanned, at: iso(result.at) };
}

/** Uses one spin and records the reward (null when nothing was won). */
export async function saveSpin(reward: string | null) {
  return unwrap(await supabase.rpc('record_spin', { p_reward: reward })) as SpinRow;
}
