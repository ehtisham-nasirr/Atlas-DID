import { createContext, type ReactNode, use, useEffect, useState } from 'react';

import { useAuth } from '@/context/auth';
import {
  parseProductCode,
  type Product,
  productBySku,
  productValue,
  SCANS_PER_SPIN,
  type Transaction,
  type Unit,
  unitForRole,
  type User,
} from '@/data/mock';
import {
  codeStatus,
  creditScan,
  fetchScans,
  fetchSpins,
  saveSpin,
  type ScanRow,
  type SpinRow,
} from '@/lib/activity-api';
import { iso } from '@/lib/orders-api';
import { loadJSON, saveJSON } from '@/lib/storage';

export type ScanRecord = {
  /** Raw QR code text. */
  code: string;
  product: Product;
  serial?: string;
  /** Ledger transaction id. */
  id: string;
  /** ISO date-time. */
  date: string;
};

export type RewardRecord = {
  reward: string;
  date: string;
};

type Activity = {
  scans: ScanRecord[];
  spinsUsed: number;
  rewards: RewardRecord[];
};

export type ScanResult =
  | { status: 'added' | 'duplicate'; scan: ScanRecord }
  /** Already scanned by another account (ISO date of that scan). */
  | { status: 'used'; at?: string }
  /** Not an Atlas product QR code. */
  | { status: 'invalid' };

export type CodeCheck = { product: Product; serial: string; scannedOn?: string } | null;

type ActivityContextValue = Activity & {
  /** What this user earns per scan. */
  unit: Unit;
  /** Total earned from the user's own scans, in `unit`. */
  totalEarned: number;
  /** Value of one scan of `product`, in `unit`. */
  valueOf: (product: Product) => number;
  spinsAvailable: number;
  /** Scans still needed for the next spin. */
  scansToNextSpin: number;
  /** Ledger entries for the user's scans, newest first. */
  transactions: Transaction[];
  /** Credits a QR code. Throws when the server cannot be reached. */
  addScan: (code: string) => Promise<ScanResult>;
  /** Checks a QR code without crediting it; null if it is not an Atlas product code. */
  checkCode: (code: string) => Promise<CodeCheck>;
  /** Uses one available spin and records the reward won (null when nothing was won). */
  recordSpin: (reward: string | null) => Promise<void>;
};

const EMPTY: Activity = { scans: [], spinsUsed: 0, rewards: [] };
const ActivityContext = createContext<ActivityContextValue | null>(null);

function toScan(row: ScanRow): ScanRecord | null {
  const product = productBySku(row.sku);
  return product
    ? { code: row.code, product, serial: row.serial, id: row.id, date: iso(row.created_at)! }
    : null;
}

function toActivity(scans: ScanRow[], spins: SpinRow[]): Activity {
  return {
    scans: scans.flatMap((r) => toScan(r) ?? []),
    spinsUsed: spins.length,
    rewards: spins.flatMap((s) => (s.reward ? [{ reward: s.reward, date: iso(s.created_at)! }] : [])),
  };
}

function toTransaction(scan: ScanRecord, user: User): Transaction {
  return {
    id: scan.id,
    title: `${scan.product.name} (${scan.product.model}) - [QR-Scan]`,
    subtitle: `${user.shopName} • ${user.city}`,
    note: 'QR Scan',
    type: 'received',
    amount: productValue(scan.product, unitForRole(user.role)),
    date: scan.date,
  };
}

/** The user's QR scans and spins, kept in the database and cached on the device. */
export function ActivityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Only mechanics and retailers scan; distributors and the RM have no scans.
  const phone = user && (user.role === 'mechanic' || user.role === 'retailer') ? user.phone : null;
  const storageKey = phone ? `activity.db.${phone}` : null;
  // Tagged with the storage key so a different user never sees stale data.
  const [loaded, setLoaded] = useState<{ key: string; data: Activity } | null>(null);
  const activity = loaded && loaded.key === storageKey ? loaded.data : EMPTY;

  const update = (next: Activity) => {
    if (!storageKey) return;
    setLoaded({ key: storageKey, data: next });
    saveJSON(storageKey, next);
  };

  useEffect(() => {
    if (!storageKey) return;
    let cancelled = false;
    // Show the saved copy first, then the server's.
    loadJSON<Activity | null>(storageKey, null).then((saved) => {
      if (!cancelled && saved) {
        setLoaded((current) => (current?.key === storageKey ? current : { key: storageKey, data: saved }));
      }
    });
    Promise.all([fetchScans(), fetchSpins()])
      .then(([scans, spins]) => {
        if (cancelled) return;
        const data = toActivity(scans, spins);
        setLoaded({ key: storageKey, data });
        saveJSON(storageKey, data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const addScan = async (code: string): Promise<ScanResult> => {
    if (!parseProductCode(code)) return { status: 'invalid' };
    const result = await creditScan(code);
    if (result.status === 'used') return { status: 'used', at: iso(result.at) };
    if (result.status === 'invalid') return { status: 'invalid' };
    const scan = toScan(result.scan);
    if (!scan) return { status: 'invalid' };
    if (result.status === 'added') update({ ...activity, scans: [scan, ...activity.scans] });
    return { status: result.status, scan };
  };

  const checkCode = async (code: string): Promise<CodeCheck> => {
    const parsed = parseProductCode(code);
    if (!parsed) return null;
    const status = await codeStatus(code);
    return { ...parsed, scannedOn: status.scanned ? status.at : undefined };
  };

  const recordSpin = async (reward: string | null) => {
    const spin = await saveSpin(reward);
    update({
      ...activity,
      spinsUsed: activity.spinsUsed + 1,
      rewards: reward
        ? [{ reward, date: iso(spin.created_at)! }, ...activity.rewards]
        : activity.rewards,
    });
  };

  const unit = unitForRole(user?.role ?? 'mechanic');
  const valueOf = (product: Product) => productValue(product, unit);
  const spinsEarned = Math.floor(activity.scans.length / SCANS_PER_SPIN);
  const transactions = user ? activity.scans.map((s) => toTransaction(s, user)) : [];

  return (
    <ActivityContext
      value={{
        ...activity,
        unit,
        totalEarned: activity.scans.reduce((sum, s) => sum + valueOf(s.product), 0),
        valueOf,
        spinsAvailable: Math.max(0, spinsEarned - activity.spinsUsed),
        scansToNextSpin: SCANS_PER_SPIN - (activity.scans.length % SCANS_PER_SPIN),
        transactions,
        addScan,
        checkCode,
        recordSpin,
      }}>
      {children}
    </ActivityContext>
  );
}

export function useActivity() {
  const value = use(ActivityContext);
  if (!value) throw new Error('useActivity must be used inside <ActivityProvider>');
  return value;
}
