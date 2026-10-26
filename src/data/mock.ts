/**
 * Shared types and the product catalog. Users, orders, claims, redemptions, scans and chat live
 * in the Supabase database (see `supabase/schema.sql`).
 */

/** `rm` is the Regional Manager, who uses the web login. */
export type Role = 'mechanic' | 'retailer' | 'distributor' | 'rm';

export type User = {
  /** Database id (Supabase Auth user id). */
  id?: string;
  role: Role;
  name: string;
  /** Login credential (with a password), also shown on the profile. */
  phone: string;
  nic: string;
  shopName: string;
  city: string;
  /** The retailer / distributor this user can chat with. */
  retailerPhone?: string;
  distributorPhone?: string;
  /** The Regional Manager that orders are sent to. */
  rmPhone?: string;
  /** Profile photo (public URL), when the user has added one. */
  photoUrl?: string;
};

export { findUserByPhone } from '@/data/directory';

export const ROLE_LABEL: Record<Role, string> = {
  mechanic: 'Mechanic',
  retailer: 'Retailer',
  distributor: 'Distributor',
  rm: 'Regional Manager',
};

/** What a QR scan earns. Everyone earns points for now; the cash ledger is kept for later. */
export type Unit = 'points' | 'cash';

export function unitForRole(_role: Role): Unit {
  return 'points';
}

export type Product = {
  /** Stock code printed in the product's QR code. */
  sku: string;
  name: string;
  model: string;
  /** Points credited per QR scan (mechanics). */
  points: number;
  /** Cash credited per QR scan, in PKR (kept for a cash ledger). */
  amount: number;
  /** Points a retailer earns per unit ordered, credited when the order is delivered. */
  orderPoints: number;
};

/** The products that carry Atlas QR codes. */
export const products: Product[] = [
  { sku: 'CSK-CD70', name: 'Chain Sprocket Kit', model: 'CD70', points: 45, amount: 10, orderPoints: 7 },
  { sku: 'CSK-CD70M', name: 'Chain Sprocket Kit', model: 'CD70 Modified', points: 45, amount: 10, orderPoints: 7 },
  { sku: 'CSK-CD100', name: 'Chain Sprocket Kit', model: 'CD100', points: 45, amount: 10, orderPoints: 13 },
  { sku: 'CSK-CG125', name: 'Chain Sprocket Kit', model: 'CG125', points: 45, amount: 10, orderPoints: 11 },
  { sku: 'CCK-82L', name: 'Cam Chain Kit', model: '82 Link', points: 10, amount: 4, orderPoints: 2.5 },
  { sku: 'CCK-84L', name: 'Cam Chain Kit', model: '84 Link', points: 10, amount: 4, orderPoints: 2.5 },
];

/** Retailer order points per unit, e.g. "CD70: 7 · CD100: 13 · CG125: 11 · Timing Chain Kit: 2.5". */
export const ORDER_POINT_RATES = products
  .filter((p, i, all) => all.findIndex((q) => q.name === p.name && q.orderPoints === p.orderPoints) === i)
  .map((p) => `${p.name === 'Cam Chain Kit' ? 'Timing Chain Kit' : p.model}: ${p.orderPoints}`)
  .join(' · ');

export function productBySku(sku: string) {
  return products.find((p) => p.sku === sku);
}

const QR_PREFIX = 'ATLASDID';

/** Text stored in a product's QR code: `ATLASDID|<sku>|<serial>`. */
export function productCode(product: Product, serial: string) {
  return `${QR_PREFIX}|${product.sku}|${serial}`;
}

/** Reads an Atlas product QR code; returns null for any other QR code. */
export function parseProductCode(code: string) {
  const [prefix, sku, serial] = code.trim().split('|');
  const product = prefix === QR_PREFIX && serial ? productBySku(sku) : undefined;
  return product ? { product, serial } : null;
}

const normalizeModel = (model: string) => model.replace(/[^a-z0-9]/gi, '').toLowerCase();

export function productValue(product: Product, unit: Unit) {
  if (unit === 'cash') return product.amount;
  // Scans saved before points existed have no `points`; look them up in the catalog.
  return (
    product.points ??
    products.find((p) => normalizeModel(p.model) === normalizeModel(product.model))?.points ??
    0
  );
}

/** QR scans needed to earn one spin of the wheel. */
export const SCANS_PER_SPIN = 10;

export const NO_PRIZE = 'Better luck next time';

/**
 * Wheel slices, clockwise from the top, mixed so equal prizes never sit side by side.
 * `chance` is the percentage of spins that stop on the slice (they add up to 100), so
 * "Better luck next time" comes up rarely and most spins win cash.
 */
export const wheelSlices: { prize: string; label: string; chance: number }[] = [
  { prize: 'PKR 10', label: 'PKR 10', chance: 15 },
  { prize: 'PKR 5', label: 'PKR 5', chance: 15 },
  { prize: 'PKR 20', label: 'PKR 20', chance: 13 },
  { prize: 'PKR 15', label: 'PKR 15', chance: 11 },
  { prize: 'PKR 5', label: 'PKR 5', chance: 15 },
  { prize: NO_PRIZE, label: 'Better Luck', chance: 5 },
  { prize: 'PKR 10', label: 'PKR 10', chance: 15 },
  { prize: 'PKR 15', label: 'PKR 15', chance: 11 },
];

export type Transaction = {
  id: string;
  title: string;
  subtitle: string;
  note: string;
  type: 'received' | 'sent';
  amount: number;
  /** ISO date-time. */
  date: string;
};

export type ClaimStatus = 'pending' | 'in-review' | 'approved' | 'rejected' | 'settled';

/**
 * A claim on a defective product. Every claim goes to the RM; when the RM approves it, the
 * distributor gets the details and settles it with the claimant.
 */
export type Claim = {
  id: string;
  sku: string;
  quantity: number;
  /** What is wrong with the product. */
  reason: string;
  /** Uploaded photos of the defect (server paths, see `fileUrl`). */
  photos?: string[];
  /** TCS tracking ID, when the item has been sent back by courier. */
  trackingId?: string;
  status: ClaimStatus;
  /** Phone of the user who filed the claim. */
  from?: string;
  /** Phone of the user the claim was sent to. */
  to?: string;
  /** Who decides on the claim (always the RM now; older claims may say retailer). */
  routedTo?: 'retailer' | 'distributor' | 'rm';
  /** Distributor who settles the claim, set when the RM approves it. */
  distributor?: string;
  /** When the RM approved or rejected the claim. */
  decidedAt?: string;
  /** When the distributor settled the claim. */
  settledAt?: string;
  /** ISO date-time. */
  date: string;
};

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  pending: 'Pending',
  'in-review': 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  settled: 'Settled',
};

/**
 * A request to redeem points. Mechanics choose their retailer, distributor or RM; retailers
 * choose their distributor or RM. The recipient pays the requester in cash (which shows in the
 * requester's Earnings) and gets those points added to their own balance.
 */
export type RedemptionRequest = {
  id: string;
  /** Phone of the user redeeming points. */
  from: string;
  /** Phone of the user who receives the request. */
  to: string;
  routedTo: 'retailer' | 'distributor' | 'rm';
  points: number;
  status: 'pending' | 'paid' | 'rejected';
  /** Cash paid in PKR, set when the request is paid. */
  amount?: number;
  /** For a retailer's gift request: the reward asked for (instead of cash). */
  rewardId?: number;
  rewardTitle?: string;
  /** When the request was paid (or the gift given) or rejected. */
  decidedAt?: string;
  /** ISO date-time. */
  date: string;
};

