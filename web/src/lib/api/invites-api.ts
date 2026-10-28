// The approver's side of admission, lifted into outcomes (auth.md
// "Invite-link generation", "Approval and landing", "Rejection", "The ask
// link"; api-spec.md "Invites").

import type { ApolloClient } from "@apollo/client";

import {
  ApproveApplicantsDocument,
  AskLinkCheckDocument,
  CreateInviteLinkDocument,
  InvitesDocument,
  MyApplicationDocument,
  RejectApplicationDocument,
  RejectLinkApplicationsDocument,
  RevokeInviteLinkDocument,
  StageApplicantDocument,
  type AskLinkCheckQuery,
  type InvitesQuery,
  type MyApplicationQuery,
  type QueueApplicationFieldsFragment,
} from "@/__generated__/graphql";
import {
  fetchOutcome,
  payloadOutcome,
  success,
  viewerField,
  type Outcome,
} from "./outcome";
import { stagedFromPrepared, type StagedWriteView } from "./writes-api";

type InvitesUser = NonNullable<InvitesQuery["me"]>;
export type InviteLinkView = NonNullable<InvitesUser["inviteLinks"]>["edges"][number]["node"];
export type ApplicationView = QueueApplicationFieldsFragment;

/** What Invites reads in one round trip: the queue and the reader's links. */
export type InvitesRead = {
  /** Waiting applications only, oldest first (`approvalQueue`). */
  readonly queue: readonly ApplicationView[];
  /** Every link the reader issued — dead ones included; the screen filters. */
  readonly links: readonly InviteLinkView[];
};

export async function fetchInvites(client: ApolloClient): Promise<Outcome<InvitesRead>> {
  const me = await viewerField(
    () => client.query({ query: InvitesDocument, fetchPolicy: "network-only" }),
    (data) => data.me,
  );
  if (me.kind !== "success") return me;
  return success({
    queue: (me.value.approvalQueue?.edges ?? []).map((edge) => edge.node),
    links: (me.value.inviteLinks?.edges ?? []).map((edge) => edge.node),
  });
}

export type CreateInviteLinkFields = {
  expiresAt: string;
  singleUse: boolean;
};

/** The fresh link, for the create sheet's second stage (InviteCreated). */
export async function createInviteLink(
  client: ApolloClient,
  input: CreateInviteLinkFields,
): Promise<Outcome<InviteLinkView>> {
  return payloadOutcome(
    () => client.mutate({ mutation: CreateInviteLinkDocument, variables: { input } }),
    (data) => data.createInviteLink.userErrors,
    (data) => data.createInviteLink.inviteLink,
  );
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
 * The priced approval for one applicant: triggers the admission burn and
 * staged Registration backend-side and returns the approver's Opinion
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

/** Closes one application without approving it (auth.md "Rejection"). */
export async function rejectApplication(
  client: ApolloClient,
  application: string,
): Promise<Outcome<true>> {
  const outcome = await payloadOutcome(
    () =>
      client.mutate({
        mutation: RejectApplicationDocument,
        variables: { input: { application } },
      }),
    (data) => data.rejectApplication.userErrors,
    (data) => data.rejectApplication.application,
  );
  if (outcome.kind !== "success") return outcome;
  return success(true);
}

/** Closes every application still waiting through one link; how many it closed. */
export async function rejectLinkApplications(
  client: ApolloClient,
  inviteLink: string,
): Promise<Outcome<number>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: RejectLinkApplicationsDocument,
        variables: { input: { inviteLink } },
      }),
    (data) => data.rejectLinkApplications.userErrors,
    (data) => data.rejectLinkApplications.rejectedCount,
  );
}

export type AskCheck = NonNullable<AskLinkCheckQuery["askLinkCheck"]>;

/**
 * The ask link's pre-stage view — who is asking, and whether this reader can
 * take them up now. Null when the id resolves to nobody (VouchAskInvalid).
 * Anonymous-capable: with a session it answers for the reader's own queue.
 */
export async function checkAskLink(
  client: ApolloClient,
  id: string,
): Promise<Outcome<AskCheck | null>> {
  const fetched = await fetchOutcome(() =>
    client.query({ query: AskLinkCheckDocument, variables: { id }, fetchPolicy: "network-only" }),
  );
  if (fetched.kind !== "success") return fetched;
  return success(fetched.value.askLinkCheck);
}

/**
 * Takes an ask link up: stages its asker in the reader's own queue. Writes
 * the queue entry only — the approval is the ordinary approveApplicants act.
 */
export async function stageApplicant(
  client: ApolloClient,
  askLink: string,
): Promise<Outcome<ApplicationView>> {
  return payloadOutcome(
    () => client.mutate({ mutation: StageApplicantDocument, variables: { input: { askLink } } }),
    (data) => data.stageApplicant.userErrors,
    (data) => data.stageApplicant.application,
  );
}

type MyApplicationUser = NonNullable<MyApplicationQuery["me"]>;
export type MyApplication = {
  readonly askLink: string | null;
  readonly application: MyApplicationUser["application"];
};

/** The applicant's own application, as the card reads it, and their ask link. */
export async function fetchMyApplication(
  client: ApolloClient,
): Promise<Outcome<MyApplication>> {
  const me = await viewerField(
    () => client.query({ query: MyApplicationDocument, fetchPolicy: "network-only" }),
    (data) => data.me,
  );
  if (me.kind !== "success") return me;
  return success({ askLink: me.value.askLink ?? null, application: me.value.application });
}
