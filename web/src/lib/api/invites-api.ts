// The inviter's side of admission (auth.md "Invite-link generation",
// "Approval and landing"), lifted into outcomes. approveApplicants
// returns the inviter's own Opinion records — the vouch is the
// inviter's signature, so the caller drives the write handshake over
// the adapted staged writes.

import type { ApolloClient } from "@apollo/client";

import {
  ApproveApplicantsDocument,
  CreateInviteLinkDocument,
  InviteLinksDocument,
  RevokeInviteLinkDocument,
  type InviteLinksQuery,
} from "@/__generated__/graphql";
import {
  fetchOutcome,
  payloadOutcome,
  success,
  unauthenticated,
  type Outcome,
} from "./outcome";
import { stagedFromPrepared, type StagedWriteView } from "./writes-api";

type InviteLinksUser = NonNullable<InviteLinksQuery["me"]>;
export type InviteLinkView = NonNullable<InviteLinksUser["inviteLinks"]>["nodes"][number];
export type ApplicationView = InviteLinkView["applications"]["nodes"][number];

export type CreateInviteLinkFields = {
  expiresAt: string;
  prefillPDirected: number;
  prefillPInterest: number;
  singleUse: boolean;
};

/**
 * Every link the viewer issued — revoked and expired included, newest
 * first; partitioning is the surface's concern.
 */
export async function fetchInviteLinks(
  client: ApolloClient,
): Promise<Outcome<readonly InviteLinkView[]>> {
  const fetched = await fetchOutcome(() =>
    client.query({ query: InviteLinksDocument, fetchPolicy: "network-only" }),
  );
  if (fetched.kind !== "success") return fetched;
  const links = fetched.value.me?.inviteLinks;
  if (links === null || links === undefined) return unauthenticated();
  return success(links.nodes);
}

export async function createInviteLink(
  client: ApolloClient,
  input: CreateInviteLinkFields,
): Promise<Outcome<true>> {
  const outcome = await payloadOutcome(
    () => client.mutate({ mutation: CreateInviteLinkDocument, variables: { input } }),
    (data) => data.createInviteLink.userErrors,
    (data) => data.createInviteLink.inviteLink,
  );
  if (outcome.kind !== "success") return outcome;
  return success(true);
}

export async function revokeInviteLink(
  client: ApolloClient,
  inviteLink: string,
): Promise<Outcome<true>> {
  const outcome = await payloadOutcome(
    () =>
      client.mutate({ mutation: RevokeInviteLinkDocument, variables: { input: { inviteLink } } }),
    (data) => data.revokeInviteLink.userErrors,
    (data) => data.revokeInviteLink.inviteLink,
  );
  if (outcome.kind !== "success") return outcome;
  return success(true);
}

/**
 * The priced approval for one applicant: triggers the funding burn and
 * staged Registration backend-side and returns the inviter's Opinion
 * records to sign, adapted for the write signer.
 */
export async function approveApplicant(
  client: ApolloClient,
  application: string,
  pDirected: number,
  pInterest: number,
): Promise<Outcome<readonly StagedWriteView[]>> {
  const outcome = await payloadOutcome(
    () =>
      client.mutate({
        mutation: ApproveApplicantsDocument,
        variables: { input: { approvals: [{ application, pDirected, pInterest }] } },
      }),
    (data) => data.approveApplicants.userErrors,
    (data) => data.approveApplicants.writes,
  );
  if (outcome.kind !== "success") return outcome;
  return success(outcome.value.map(stagedFromPrepared));
}
