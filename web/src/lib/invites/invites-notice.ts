// WHAT INVITES SAYS ON ARRIVAL, when an ask link sent the reader there
// (VouchAsk.md:17, :27, :31; VouchAskPad.md:25, :33). The ask's own page is
// gone by the time Invites stands, so it hands the outcome over here and
// Invites takes it once: the snackbar's words, and the row to stand at.
//
// One slot, in memory: a client navigation keeps it, a reload drops it — an
// arrival nobody watched has nothing to say. It is the vouching account's:
// when the tab's active account ends or changes it is dropped, so no other
// account's Invites says it.

import { onAccountChange } from "@/lib/session/account-change";
import type { StancePair } from "@/lib/stance/model";

export type InvitesNotice =
  /** The asker already waits in the reader's own queue. */
  | { readonly kind: "alreadyWaiting"; readonly handle: string }
  /** Staged, the vouch kept: the asker has to finish registering. */
  | { readonly kind: "notRegistered"; readonly handle: string }
  /** The vouch landed: the ordinary signed snackbar, with the pick's face. */
  | { readonly kind: "signed"; readonly handle: string; readonly landing: StancePair };

let carried: InvitesNotice | null = null;

onAccountChange(() => {
  carried = null;
});

export function carryToInvites(notice: InvitesNotice): void {
  carried = notice;
}

/** The notice handed over, without taking it (read during the first render). */
export function peekInvitesNotice(): InvitesNotice | null {
  return carried;
}

/** The notice handed over, once; null when there is none. */
export function takeInvitesNotice(): InvitesNotice | null {
  const notice = carried;
  carried = null;
  return notice;
}
