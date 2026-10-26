import { ScreenTitle } from '@/components/app-header';
import { useClaimActions } from '@/components/claim-actions';
import { ClaimsView } from '@/components/claims-view';
import { useAuth } from '@/context/auth';
import { useClaims } from '@/hooks/use-requests';

/** Claims from mechanics, retailers and distributors, which the RM approves or rejects. */
export default function RmClaimsScreen() {
  const { user } = useAuth();
  const { claims } = useClaims(user?.phone);
  const actions = useClaimActions(user?.phone);
  return (
    <ClaimsView
      claims={(claims ?? []).filter((c) => c.to === user?.phone).map(actions.apply)}
      showSender
      top={<ScreenTitle style={{ marginBottom: 10 }}>Claims</ScreenTitle>}
      loading={claims === null}
      viewer={user?.phone}
      onAction={actions.onAction}
      emptyText="Claims from mechanics, retailers and distributors will appear here. Approved claims go to the distributor to settle."
      bottomPadding={40}
    />
  );
}
