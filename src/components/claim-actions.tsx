import { useState } from 'react';

import { type Claim, findUserByPhone, productBySku } from '@/data/mock';
import { confirmAction, notify } from '@/lib/dialogs';
import { decideClaim } from '@/lib/requests-api';

export type ClaimAction = 'approve' | 'reject' | 'settle';

/**
 * Lets the RM approve or reject claims, and the distributor settle approved ones.
 * Returns the card handler and claims updated here (shown at once, before the next refresh).
 */
export function useClaimActions(me: string | undefined) {
  const [updated, setUpdated] = useState<Record<string, Claim>>({});

  const onAction = (claim: Claim, action: ClaimAction) => {
    if (!me) return;
    // The claimant's distributor settles it; a distributor's own claim is settled by themselves.
    const claimant = findUserByPhone(claim.from ?? '');
    const distributor = claimant?.role === 'distributor' ? claimant.phone : claimant?.distributorPhone;
    const product = productBySku(claim.sku);
    const item = product ? `${product.name} (${product.model})` : claim.sku;
    const [title, message, label] =
      action === 'approve'
        ? [
            'Approve claim',
            `Approve the claim for ${claim.quantity} x ${item}? ${
              findUserByPhone(distributor ?? '')?.name ?? 'The distributor'
            } will get the details to settle it.`,
            'Approve',
          ]
        : action === 'reject'
          ? ['Reject claim', `Reject the claim for ${claim.quantity} x ${item}?`, 'Reject']
          : ['Mark as settled', `Have you settled the claim for ${claim.quantity} x ${item}?`, 'Settled'];

    confirmAction(title, message, label, () =>
      decideClaim(claim.id, action)
        .then((c) => setUpdated((u) => ({ ...u, [c.id]: c })))
        .catch((e) =>
          notify('Update failed', e instanceof Error ? e.message : 'The claim could not be updated. Please try again.')
        )
    );
  };

  return { onAction, apply: (c: Claim) => updated[c.id] ?? c };
}
