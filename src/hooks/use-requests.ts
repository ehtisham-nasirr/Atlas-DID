import { ordersKey } from '@/hooks/use-orders';
import { prefetch, usePolled } from '@/hooks/use-polled';
import { fetchOrders } from '@/lib/orders-api';
import { fetchPromos } from '@/lib/promos-api';
import { fetchClaims, fetchRedemptions, fetchRewards } from '@/lib/requests-api';

const claimsKey = (user: string) => `claims:${user}`;
const redemptionsKey = (user: string) => `redemptions:${user}`;

/** Claims filed by or sent to the user, and claims the user settles as distributor. */
export function useClaims(user: string | undefined) {
  const { data, offline } = usePolled(user ? claimsKey(user) : null, () => fetchClaims(user!));
  return { claims: data, offline };
}

/** Redemption requests made by, or sent to, the user. */
export function useRedemptions(user: string | undefined) {
  const { data, offline } = usePolled(user ? redemptionsKey(user) : null, () =>
    fetchRedemptions(user!)
  );
  return { redemptions: data, offline };
}

/** The rewards (gifts) retailers can redeem their points for. */
export function useRewards(user: string | undefined) {
  const { data, offline } = usePolled(user ? 'rewards:all' : null, fetchRewards);
  return { rewards: data, offline };
}

/** All promos (the app shows the active ones; the RM manages them all). */
export function usePromos(user: string | undefined) {
  const { data, offline } = usePolled(user ? 'promos:all' : null, fetchPromos);
  return { promos: data, offline };
}

/** Loads the user's orders, claims, redemptions and promos right after login, before any screen asks. */
export function prefetchUserData(user: string) {
  prefetch('promos:all', fetchPromos);
  prefetch(ordersKey(user), () => fetchOrders(user));
  prefetch(claimsKey(user), () => fetchClaims(user));
  prefetch(redemptionsKey(user), () => fetchRedemptions(user));
}
