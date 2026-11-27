// THE APPROVALS THAT LANDED WHILE THEIR VOUCH DID NOT SIGN — the web twin of
// the app's `approvalLanded` (ApprovalPad.kt).
//
// `approveApplicants` is the vouch's prepare, and the server marks the row
// approved there (crates/api onboarding.rs `still_waiting`): a second call
// answers BAD_INPUT "already approved". So once an approval has answered, the
// pad's Retry must not send it again; it asks the vouch's signing again
// (SigningAfterClose.md:27: "the same signing is asked again … AND NEVER
// anything else is signed"), and this is where the vouch it staged is kept.
//
// Keyed by the account AND the applicant: Invites builds its seam from the
// row it last read, so the memory outlives one seam, and it is never another
// account's. Memory only: a reload forgets it and Home's Resume continues
// the parked vouch; an account boundary lets every one go.

import type { SigningAttempt } from "@/lib/compose/same-signing";
import { onAccountChange } from "@/lib/session/account-change";
import type { StancePair } from "@/lib/stance/model";

/** The vouch a landed approval staged, and the pick it was approved with. */
export type LandedApproval = SigningAttempt & { readonly pick: StancePair };

const landed = new Map<string, LandedApproval>();

onAccountChange(() => landed.clear());

const keyOf = (account: string | null, application: string) => `${account ?? ""}:${application}`;

export function landedApproval(account: string | null, application: string): LandedApproval | null {
  return landed.get(keyOf(account, application)) ?? null;
}

export function rememberLandedApproval(account: string | null, application: string, approval: LandedApproval): void {
  landed.set(keyOf(account, application), approval);
}

export function forgetLandedApproval(account: string | null, application: string): void {
  landed.delete(keyOf(account, application));
}
