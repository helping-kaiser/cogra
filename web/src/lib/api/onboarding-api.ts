// The joining-flow calls, lifted into outcomes (auth.md "Application").
// inviteLinkCheck, register, verifyEmail, and the resend are anonymous
// entry gestures; attachActorKey, applyWithInvite, and the status poll
// are guarded by the caller. The staged Registration is selected
// client-side from the viewer's staged writes — the me read is the
// admission flow's repair hook (schema `User.application`).

import type { ApolloClient } from "@apollo/client";

import {
  ApplicationStatusDocument,
  ApplyWithInviteDocument,
  AttachActorKeyDocument,
  InviteLinkCheckDocument,
  RegisterDocument,
  ResendVerificationEmailDocument,
  VerifyEmailDocument,
  type ApplicationStatusQuery,
  type InviteLinkCheckQuery,
} from "@/__generated__/graphql";
import {
  fetchOutcome,
  payload,
  payloadOutcome,
  success,
  unauthenticated,
  type Outcome,
} from "./outcome";
import type { StagedWriteView } from "./writes-api";
import type { TokenPair } from "@/lib/session/token-store";

export type InviteCheck = NonNullable<InviteLinkCheckQuery["inviteLinkCheck"]>;

export type ApplicationView = NonNullable<
  NonNullable<ApplicationStatusQuery["me"]>["application"]
>;

/** The one status shape a poll pass branches on (Android's ApplicationStatus). */
export type ApplicationStatus = {
  accountState: "GUEST" | "APPLICANT" | "MEMBER" | null;
  application: ApplicationView | null;
  stagedRegistration: StagedWriteView | null;
};

/** null means the id references no link — the not-found rendering. */
export async function checkInviteLink(
  client: ApolloClient,
  id: string,
): Promise<Outcome<InviteCheck | null>> {
  const fetched = await fetchOutcome(() =>
    client.query({ query: InviteLinkCheckDocument, variables: { id }, fetchPolicy: "network-only" }),
  );
  if (fetched.kind !== "success") return fetched;
  return success(fetched.value.inviteLinkCheck);
}

export type RegisterInputFields = {
  inviteLink: string;
  handle: string;
  email: string;
  password: string;
  deviceLabel: string | null;
};

export function register(
  client: ApolloClient,
  input: RegisterInputFields,
): Promise<Outcome<TokenPair>> {
  return payloadOutcome(
    () => client.mutate({ mutation: RegisterDocument, variables: { input } }),
    (data) => data.register.userErrors,
    (data) => data.register.auth,
  );
}

export function verifyEmail(
  client: ApolloClient,
  verificationToken: string,
): Promise<Outcome<true>> {
  return payloadOutcome(
    () =>
      client.mutate({ mutation: VerifyEmailDocument, variables: { input: { verificationToken } } }),
    (data) => data.verifyEmail.userErrors,
    (data) => (data.verifyEmail.ok === true ? true : null),
  );
}

/** Silent verb: no userErrors by design — success and refusal are one. */
export function resendVerificationEmail(
  client: ApolloClient,
  email: string,
): Promise<Outcome<boolean>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: ResendVerificationEmailDocument,
        variables: { input: { email } },
      }),
    () => [],
    (data) => data.resendVerificationEmail.ok,
  );
}

export function attachActorKey(
  client: ApolloClient,
  actorPubkey: string,
  l0Address: string,
): Promise<Outcome<true>> {
  return payloadOutcome(
    () =>
      client.mutate({
        mutation: AttachActorKeyDocument,
        variables: { input: { actorPubkey, l0Address } },
      }),
    (data) => data.attachActorKey.userErrors,
    (data) => (data.attachActorKey.user === null ? null : true),
  );
}

export function applyWithInvite(
  client: ApolloClient,
  inviteLink: string,
): Promise<Outcome<true>> {
  return payloadOutcome(
    () =>
      client.mutate({ mutation: ApplyWithInviteDocument, variables: { input: { inviteLink } } }),
    (data) => data.applyWithInvite.userErrors,
    (data) => (data.applyWithInvite.application === null ? null : true),
  );
}

/**
 * One status read for the poll pass. The staged Registration is the
 * first unexpired REGISTRATION node (Android parity); a null viewer is
 * the shared UNAUTHENTICATED refusal so the guard can replay.
 */
export async function fetchApplicationStatus(
  client: ApolloClient,
): Promise<Outcome<ApplicationStatus>> {
  const fetched = await fetchOutcome(() =>
    client.query({ query: ApplicationStatusDocument, fetchPolicy: "network-only" }),
  );
  if (fetched.kind !== "success") return fetched;
  const me = fetched.value.me;
  if (me === null) return unauthenticated();
  const staged =
    me.stagedWrites?.nodes.find((n) => n.family === "REGISTRATION" && n.state !== "EXPIRED") ??
    null;
  return payload([], {
    accountState: me.accountState,
    application: me.application,
    stagedRegistration:
      staged === null
        ? null
        : {
            id: staged.id,
            state: staged.state,
            family: staged.family,
            canonicalProposal: staged.canonicalProposal,
            verifiedAct: staged.verifiedAct,
          },
  });
}
