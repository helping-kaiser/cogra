// The inviter's side of admission, lifted into outcomes (auth.md
// "Invite-link generation", "Approval and landing").

import type { ApolloClient } from "@apollo/client";

import {
  ApproveApplicantsDocument,
  CreateInviteLinkDocument,
  InviteLinksDocument,
  RevokeInviteLinkDocument,
  type InviteLinksQuery,
} from "@/__generated__/graphql";
import {
  payloadOutcome,
  success,
  viewerField,
  type Outcome,
} from "./outcome";
import { stagedFromPrepared, type StagedWriteView } from "./writes-api";

type InviteLinksUser = NonNullable<InviteLinksQuery["me"]>;
export type InviteLinkView =
  NonNullable<InviteLinksUser["inviteLinks"]>["edges"][number]["node"];
export type ApplicationView = InviteLinkView["applications"]["edges"][number]["node"];

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
  const links = await viewerField(
    () => client.query({ query: InviteLinksDocument, fetchPolicy: "network-only" }),
    (data) => data.me?.inviteLinks,
  );
  if (links.kind !== "success") return links;
  return success(links.value.edges.map((edge) => edge.node));
}

/** The operational default lifetime of a fresh link; links are revocable any time. */
export const LINK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

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
