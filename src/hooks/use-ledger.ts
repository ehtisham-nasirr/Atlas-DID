import { useActivity } from '@/context/activity';
import { useAuth } from '@/context/auth';
import { findUserByPhone, type Transaction } from '@/data/mock';
import { useOrders } from '@/hooks/use-orders';
import { useRedemptions } from '@/hooks/use-requests';

/**
 * The signed-in user's points ledger, matching the balance the database checks:
 * scans (mechanics) + delivered order points (retailers) + points received for requests the user
 * paid - the user's own redemption and reward requests (unless rejected).
 */
export function useLedger() {
  const { user } = useAuth();
  const { transactions: scanTransactions } = useActivity();
  const { redemptions } = useRedemptions(user?.phone);
  const { orders } = useOrders(user?.role === 'retailer' ? user.phone : undefined);
  const me = user?.phone;

  const myOrders = (orders ?? []).filter((o) => o.placedBy === me && o.points > 0);
  const orderTransactions: Transaction[] = myOrders
    .filter((o) => o.status === 'delivered')
    .map((o) => ({
      id: o.id,
      title: `Order Points - ${o.id}`,
      subtitle: `${o.items.reduce((n, i) => n + i.quantity, 0)} items delivered`,
      note: 'Order Delivered',
      type: 'received',
      amount: o.points,
      date: o.deliveredAt ?? o.at,
    }));

  const redemptionTransactions = (redemptions ?? []).flatMap((r): Transaction[] => {
    if (r.from === me && r.status !== 'rejected') {
      const reward = r.rewardTitle;
      return [
        {
          id: r.id,
          title: reward ? `Reward: ${reward}` : 'Points Redemption Request',
          subtitle: `Status: ${r.status === 'paid' ? (reward ? 'Given' : 'Paid') : 'Pending'}`,
          note: reward ? 'Reward Redeemed' : 'Redemption Request',
          type: 'sent',
          amount: r.points,
          date: r.date,
        },
      ];
    }
    if (r.to === me && r.status === 'paid') {
      return [
        {
          id: r.id,
          title: r.rewardTitle ? `Reward given: ${r.rewardTitle}` : 'Points from Redemption',
          subtitle: `${r.rewardTitle ? 'Given' : 'Paid'} to ${findUserByPhone(r.from)?.name ?? r.from}`,
          note: 'Points Received',
          type: 'received',
          amount: r.points,
          date: r.decidedAt ?? r.date,
        },
      ];
    }
    return [];
  });

  const transactions = [...orderTransactions, ...redemptionTransactions, ...scanTransactions];
  const sum = (type: Transaction['type']) =>
    transactions.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  const received = sum('received');
  const sent = sum('sent');

  return {
    transactions,
    received,
    sent,
    remaining: received - sent,
    /** Points from orders not yet delivered (retailers). */
    pendingOrderPoints: myOrders
      .filter((o) => o.status !== 'delivered' && o.status !== 'rejected')
      .reduce((s, o) => s + o.points, 0),
    /** True until the server data has loaded for the first time. */
    loading: redemptions === null || (user?.role === 'retailer' && orders === null),
  };
}
