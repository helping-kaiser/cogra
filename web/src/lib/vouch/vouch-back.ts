// THE VOUCH-BACK's words and its pad variant, written once for every place
// it opens from: the feed's vouch card (VouchBack.md:31) and the profile of the
// member who vouched the account in (ProfileOther.md:35). Android's twin is
// `feature/home`'s `VouchBack.kt`; the strings are the boards' verbatim
// (copy-voice.md, the applicant remainder and the ceremony).

import type { MeUser } from "@/lib/api/auth-api";
import type { PadVariant } from "@/lib/ui/stance-control";

/** The pad's title, and its `?`'s name (VouchBackPad.md:9). */
export const VOUCH_BACK_TITLE = "Your vouch back";

/** The line the vouch-back pad carries on every open (VouchBackPad.md:13). */
export const VOUCH_BACK_NOTE =
  "Your vouch back. The pad is how you shape what reaches you — for or against, and how much.";

/** The help that replaces the pad's body in place (VouchBackPad.md:21). */
export const VOUCH_BACK_HELP: readonly string[] = [
  "Vouching back signs your opinion of the person who vouched you in, and your feed grows from it.",
  "The pad is how you shape what reaches you — for or against, and how much. Nothing is signed until Set.",
];

/**
 * Where the vouch-back pad parks: 16px above the bar
 * (`--bottom-bar-height` 64 + 16, VouchBackPad.md:3).
 */
export const VOUCH_BACK_PAD_INSET_PX = 80;

export const vouchCardTitle = (handle: string) => `@${handle} vouched you in`;

/** The card's body; it claims no order between opinions (VouchBack.md:7, :11). */
export const vouchCardBody = (handle: string) =>
  `Vouch back to open the way from your side — your opinion toward @${handle}, and your feed grows from it. Vouching opens the opinion control, set to a gentle default.`;

export const GOT_IT = "Got it";
export const VOUCH_BACK = "Vouch back";
/** A put-away that did not go through says so in the card's row (VouchBack.md:39). */
export const PUT_AWAY_FAILED = "That didn't go through.";
export const RETRY = "Retry";

export const CEREMONY_TITLE = "You're part of the sky now.";
export const ceremonyBody = (handle: string) =>
  `Your opinion on @${handle} is signed, and the way is open both ways. The feed you see from here is your own.`;
export const GO_TO_YOUR_FEED = "Go to your feed";

/** The ceremony's own destination (VouchedIn.md:3). */
export const VOUCHED_IN_PATH = "/vouched-in";

/** The voucher, as the vouch-back's surfaces wear them: handle, name and face. */
export type Voucher = {
  readonly id: string;
  readonly handle: string;
  readonly name: string;
  readonly avatarUrl: string | null;
};

/** The member who vouched the account in, off the `me` read; null for none. */
export function voucherOf(me: MeUser): Voucher | null {
  const inviter = me.invitedBy;
  if (inviter === null || inviter === undefined) return null;
  const displayName = inviter.displayName.value?.trim();
  return {
    id: inviter.id,
    handle: inviter.handle,
    name: displayName ? displayName : inviter.handle,
    avatarUrl: "avatar" in inviter ? (inviter.avatar?.url ?? null) : null,
  };
}

/**
 * THE CARD STANDS on server state alone (VouchBack.md:3): landed, the pair
 * with the voucher incomplete, never put away. No key term — a vouch-back
 * set with the key elsewhere waits as any pick does (VouchBackPad.md:41).
 */
export function vouchCardStands(me: MeUser): boolean {
  return (
    me.accountState === "MEMBER" &&
    me.invitedBy !== null &&
    me.invitedBy !== undefined &&
    !me.hasReciprocated &&
    !me.vouchBackDismissed
  );
}

/**
 * The profile's anchor opens the vouch-back GIVEN the person vouched the
 * reader in and the pair is incomplete (ProfileOther.md:35) — the card put
 * away or not (VouchBack.md:51).
 */
export function opensVouchBackOn(me: MeUser, profileId: string): boolean {
  return (
    me.accountState === "MEMBER" &&
    me.invitedBy?.id === profileId &&
    !me.hasReciprocated
  );
}

/** The pad variant the vouch-back opens as. */
export function vouchBackVariant(
  onTaken: () => void,
  padNode?: PadVariant["padNode"],
): PadVariant {
  return {
    title: VOUCH_BACK_TITLE,
    help: VOUCH_BACK_HELP,
    note: VOUCH_BACK_NOTE,
    onTaken,
    padNode,
    padInset: VOUCH_BACK_PAD_INSET_PX,
  };
}
