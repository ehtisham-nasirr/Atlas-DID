import { usePolled } from '@/hooks/use-polled';
import { fetchOrders } from '@/lib/orders-api';

export const ordersKey = (user: string) => `orders:${user}`;

/** Orders placed by, or sent to, the user; refreshed every few seconds while the screen is open. */
export function useOrders(user: string | undefined) {
  const { data, offline } = usePolled(user ? ordersKey(user) : null, () => fetchOrders(user!));
  return { orders: data, offline };
}
