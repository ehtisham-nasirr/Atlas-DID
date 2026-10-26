import type { Claim, RedemptionRequest } from '@/data/mock';
import { iso } from '@/lib/orders-api';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/users-api';

type ClaimRow = {
  id: string;
  from_phone: string;
  to_phone: string;
  routed_to: Claim['routedTo'];
  sku: string;
  quantity: number;
  reason: string;
  photos: string[];
  tracking_id: string | null;
  status: Claim['status'];
  distributor: string | null;
  created_at: string;
  decided_at: string | null;
  settled_at: string | null;
};

function toClaim(row: ClaimRow): Claim {
  return {
    id: row.id,
    from: row.from_phone,
    to: row.to_phone,
    routedTo: row.routed_to,
    sku: row.sku,
    quantity: row.quantity,
    reason: row.reason,
    photos: row.photos,
    trackingId: row.tracking_id ?? undefined,
    status: row.status,
    distributor: row.distributor ?? undefined,
    date: iso(row.created_at)!,
    decidedAt: iso(row.decided_at),
    settledAt: iso(row.settled_at),
  };
}

/** Claims filed by or sent to the user, and claims the user settles as distributor. */
export async function fetchClaims(_user: string) {
  const rows = unwrap(await supabase.from('claims').select('*').order('created_at', { ascending: false }));
  return (rows as ClaimRow[]).map(toClaim);
}

/** Files a claim; it goes to the user's Regional Manager. */
export async function postClaim(claim: Pick<Claim, 'sku' | 'quantity' | 'reason' | 'photos' | 'trackingId'>) {
  const row = unwrap(
    await supabase.rpc('file_claim', {
      p_sku: claim.sku,
      p_quantity: claim.quantity,
      p_reason: claim.reason,
      p_photos: claim.photos ?? [],
      p_tracking: claim.trackingId ?? null,
    })
  );
  return toClaim(row as ClaimRow);
}

/** The RM approves or rejects a claim (the claimant's distributor then settles it); the distributor settles. */
export async function decideClaim(id: string, action: 'approve' | 'reject' | 'settle') {
  return toClaim(unwrap(await supabase.rpc('decide_claim', { p_id: id, p_action: action })) as ClaimRow);
}

type RedemptionRow = {
  id: string;
  from_phone: string;
  to_phone: string;
  routed_to: RedemptionRequest['routedTo'];
  points: number;
  status: RedemptionRequest['status'];
  amount: number | null;
  reward_id: number | null;
  reward_title: string | null;
  created_at: string;
  decided_at: string | null;
};

function toRedemption(row: RedemptionRow): RedemptionRequest {
  return {
    id: row.id,
    from: row.from_phone,
    to: row.to_phone,
    routedTo: row.routed_to,
    points: row.points,
    status: row.status,
    amount: row.amount ?? undefined,
    rewardId: row.reward_id ?? undefined,
    rewardTitle: row.reward_title ?? undefined,
    date: iso(row.created_at)!,
    decidedAt: iso(row.decided_at),
  };
}

/** Redemption requests made by, or sent to, the user. */
export async function fetchRedemptions(_user: string) {
  const rows = unwrap(
    await supabase.from('redemptions').select('*').order('created_at', { ascending: false })
  );
  return (rows as RedemptionRow[]).map(toRedemption);
}

/** The recipient pays a redemption request (amount in PKR) or rejects it. */
export async function decideRedemption(id: string, action: 'pay' | 'reject', amount?: number) {
  const row = unwrap(
    await supabase.rpc('decide_redemption', { p_id: id, p_action: action, p_amount: amount ?? null })
  );
  return toRedemption(row as RedemptionRow);
}

/** Asks the user's retailer, distributor or RM to redeem points; the database checks the balance. */
export async function postRedemption(routedTo: RedemptionRequest['routedTo'], points: number) {
  const row = unwrap(
    await supabase.rpc('request_redemption', { p_routed_to: routedTo, p_points: points })
  );
  return toRedemption(row as RedemptionRow);
}

/** A gift from the rewards list that retailers redeem their points for. */
export type Reward = { id: number; tier: number; points: number; title: string; icon: string };

export async function fetchRewards() {
  const rows = unwrap(
    await supabase
      .from('rewards')
      .select('id, tier, points, title, icon')
      .eq('active', true)
      .order('points', { ascending: false })
      .order('id')
  );
  return rows as Reward[];
}

/** A retailer asks their distributor or RM for a gift; the database checks the points. */
export async function requestReward(routedTo: 'distributor' | 'rm', rewardId: number) {
  const row = unwrap(
    await supabase.rpc('request_reward', { p_routed_to: routedTo, p_reward_id: rewardId })
  );
  return toRedemption(row as RedemptionRow);
}
