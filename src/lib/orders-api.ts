import { unwrap } from '@/lib/users-api';
import { supabase } from '@/lib/supabase';

export type OrderItem = {
  sku: string;
  quantity: number;
  /** Price per unit in PKR, set by the RM when approving. */
  unitPrice?: number;
};

/** placed -> (RM) approved | rejected -> (distributor) dispatched -> delivered */
export type OrderStatus = 'placed' | 'approved' | 'rejected' | 'dispatched' | 'delivered';

export type Order = {
  id: string;
  /** Phone of the user who placed the order (a mechanic or a retailer). */
  placedBy: string;
  placedByRole: 'mechanic' | 'retailer';
  /** For mechanic orders: their retailer, who can also see the order. */
  retailer?: string;
  /** The Regional Manager the order is sent to. */
  rm?: string;
  /** Distributor who delivers the order once the RM approves it. */
  distributor?: string;
  items: OrderItem[];
  status: OrderStatus;
  /** Sum of unitPrice × quantity, set on approval. */
  total?: number;
  /** Points a retailer's order earns them, credited when the RM approves it (0 for mechanics). */
  points: number;
  reviewedAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  /** ISO date-time the order was placed. */
  at: string;
};

type OrderRow = {
  id: string;
  placed_by: string;
  placed_by_role: Order['placedByRole'];
  retailer: string | null;
  rm: string | null;
  distributor: string | null;
  items: OrderItem[];
  status: OrderStatus;
  total: number | null;
  points: number | string | null;
  created_at: string;
  reviewed_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
};

/** ISO date-time in one consistent format, or undefined. */
export const iso = (value: string | null | undefined) =>
  value ? new Date(value).toISOString() : undefined;

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    placedBy: row.placed_by,
    placedByRole: row.placed_by_role,
    retailer: row.retailer ?? undefined,
    rm: row.rm ?? undefined,
    distributor: row.distributor ?? undefined,
    items: row.items,
    status: row.status,
    total: row.total === null ? undefined : Number(row.total),
    points: Number(row.points ?? 0),
    reviewedAt: iso(row.reviewed_at),
    dispatchedAt: iso(row.dispatched_at),
    deliveredAt: iso(row.delivered_at),
    at: iso(row.created_at)!,
  };
}

/** Orders the user placed, or that were sent to them (the database only returns those). */
export async function fetchOrders(_user: string) {
  const rows = unwrap(await supabase.from('orders').select('*').order('created_at', { ascending: false }));
  return (rows as OrderRow[]).map(toOrder);
}

/** Places an order; the retailer, RM and distributor come from the user's profile. */
export async function placeOrder(items: { sku: string; quantity: number }[]) {
  return toOrder(unwrap(await supabase.rpc('place_order', { p_items: items })) as OrderRow);
}

type OrderAction = 'approve' | 'reject' | 'dispatch' | 'deliver';

/**
 * Moves an order along: the RM approves (with unit prices in PKR per SKU) or rejects it, then
 * the distributor dispatches and delivers it.
 */
export async function updateOrder(
  id: string,
  action: OrderAction,
  extra: { prices?: Record<string, number> } = {}
) {
  const row =
    action === 'approve' || action === 'reject'
      ? unwrap(
          await supabase.rpc('review_order', {
            p_id: id,
            p_decision: action,
            p_prices: extra.prices ?? {},
          })
        )
      : unwrap(await supabase.rpc('advance_order', { p_id: id, p_step: action }));
  return toOrder(row as OrderRow);
}
