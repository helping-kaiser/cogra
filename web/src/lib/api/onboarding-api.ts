// The joining-flow calls, lifted into outcomes (auth.md "Application").
// The status read is the admission flow's repair hook: an approved
// application whose staged Registration was lost re-stages on it
// (schema `User.application`).

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
  payloadOutcome,
  success,
  viewerField,
  type Outcome,
} from "./outcome";
import { toView, type StagedWriteView } from "./writes-api";
import { sessionAuthOf } from "./auth-api";
import type { SessionAuth } from "@/lib/session/token-store";

export type InviteCheck = NonNullable<InviteLinkCheckQuery["inviteLinkCheck"]>;

export type ApplicationView = NonNullable<
  NonNullable<ApplicationStatusQuery["me"]>["application"]
>;

/** The one status shape a poll pass branches on (Android's ApplicationStatus). */
export type ApplicationStatus = {
  accountState: "GUEST" | "APPLICANT" | "MEMBER" | null;
  /** The attached actor public key (base64), null before the ceremony. */
  actorPubkey: string | null;
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
): Promise<Outcome<SessionAuth>> {
  return payloadOutcome(
    () => client.mutate({ mutation: RegisterDocument, variables: { input } }),
    (data) => data.register.userErrors,
    (data) => sessionAuthOf(data.register.auth),
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

/** One of api-spec.md's three deliberately-silent verbs — never a userError. */
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
 * first unexpired REGISTRATION node (Android parity).
 */
export async function fetchApplicationStatus(
  client: ApolloClient,
): Promise<Outcome<ApplicationStatus>> {
  const fetched = await viewerField(
    () => client.query({ query: ApplicationStatusDocument, fetchPolicy: "network-only" }),
    (data) => data.me,
  );
  if (fetched.kind !== "success") return fetched;
  const me = fetched.value;
  const staged =
    me.stagedWrites?.nodes.find((n) => n.family === "REGISTRATION" && n.state !== "EXPIRED") ??
    null;
  return success({
    accountState: me.accountState,
    actorPubkey: me.actorPubkey ?? null,
    application: me.application,
    stagedRegistration: staged === null ? null : toView(staged),
  });
}
