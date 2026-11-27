// The intro's reads and its one write (api-spec.md `UserPreferences`,
// `setPreferences`): the seen flag is account state, so the intro shows once
// per account on whichever device signs in first (OnboardingSteps.md:3–5).

import type { ApolloClient } from "@apollo/client";

import {
  IntroAccountDocument,
  MarkIntroSeenDocument,
  type IntroAccountQuery,
} from "@/__generated__/graphql";
import type { IntroInviter } from "@/lib/intro/intro-stages";

import { payloadOutcome, viewerField, type Outcome } from "./outcome";

export type IntroAccount = NonNullable<IntroAccountQuery["me"]>;

type InviterFields = NonNullable<IntroAccount["invitedBy"]>;

function inviterFrom(actor: InviterFields): IntroInviter {
  const displayName = actor.displayName.value?.trim();
  return {
    handle: actor.handle,
    name: displayName ? displayName : actor.handle,
    avatarUrl: "avatar" in actor ? (actor.avatar?.url ?? null) : null,
  };
}

/**
 * The fifth card's face: the actual link-issuer (OnboardingVouch.md:9) — the
 * member who vouched a landed account in, else the applicant's own link
 * issuer. Null for an account with neither (a genesis actor).
 */
export function introInviterOf(account: IntroAccount): IntroInviter | null {
  if (account.invitedBy) return inviterFrom(account.invitedBy);
  const approver = account.application?.approver;
  return approver ? inviterFrom(approver) : null;
}

/** The viewer as the intro reads it, live. */
export function fetchIntroAccount(client: ApolloClient): Promise<Outcome<IntroAccount>> {
  return viewerField(
    () => client.query({ query: IntroAccountDocument, fetchPolicy: "network-only" }),
    (data) => data.me,
  );
}

/** Sets the account's seen flag — on every device, for good. */
export function markIntroSeen(client: ApolloClient): Promise<Outcome<true>> {
  return payloadOutcome(
    () => client.mutate({ mutation: MarkIntroSeenDocument }),
    (data) => data.setPreferences.userErrors,
    (data) => (data.setPreferences.preferences?.hasSeenOnboarding === true ? true : null),
  );
}
