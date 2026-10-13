// THE DELETION'S WORDS, ONE HOME (copy-voice.md "Deleting the account"; the
// boards DeleteAccount, DeleteAccountMail, DeleteAccountConfirmed,
// DeleteAccountPending, DeleteAccountCanceled, SettingsDeleting, FeedDeleting
// and the DeletionBand master). Every count is the forward ladder's
// (`forwardLadder`), read off the server's `scheduledFor` — never a client
// clock started at the confirm.

import { dateline, forwardLadder } from "@/lib/ui/timestamp";

import type { AccountDeletion } from "@/lib/api/deletion-api";

/** The band's sentence, which is also the landing's heading on its first day (without the stop). */
export function deletionSentence(deletion: AccountDeletion, now?: number): string {
  const when = forwardLadder(deletion.scheduledFor, now);
  return deletion.includesContent
    ? `Your account and everything you posted are deleted in ${when}`
    : `Your account is deleted in ${when}`;
}

/** The band's line (FeedDeleting.md:7, :9). */
export function bandLine(deletion: AccountDeletion, now?: number): string {
  return `${deletionSentence(deletion, now)}.`;
}

/** The settings row's status during the grace (SettingsDeleting.md:5). */
export function settingsRowStatus(deletion: AccountDeletion, now?: number): string {
  return `Deletion in ${forwardLadder(deletion.scheduledFor, now)}`;
}

/** DeleteAccountPending's paragraph (`DeleteAccountPending.jsx:51-52`). */
export function pendingBody(deletion: AccountDeletion, now?: number): string {
  return `Your account is deleted in ${forwardLadder(deletion.scheduledFor, now)}, on ${dateline(deletion.scheduledFor)}. Until then nothing has changed, and canceling keeps everything as it is.`;
}

/** DeleteAccountConfirmed's paragraph (`DeleteAccountConfirmed.jsx:60`). */
export function confirmedBody(deletion: AccountDeletion): string {
  return `That's ${dateline(deletion.scheduledFor)}. Until then nothing changes, and you can cancel from any device.`;
}

/** DeleteAccountMail's paragraph, naming the address (`DeleteAccountMail.jsx:60-61`). */
export function mailBody(email: string): string {
  return `We sent a link to ${email}. Opening it confirms the deletion and starts the seven days.`;
}

/** The Resend, answered, naming the account's address (DeleteAccountMail.md:13). */
export function resentTo(email: string): string {
  return `Sent again — the link is on its way to ${email}.`;
}

/** No answer reached the device (copy-voice *Faults by code*, "No answer at all"). */
export const NO_ANSWER = "That didn't send. Try again.";

/** The cancel's one confirmation, everywhere, never with Undo (DeleteAccountCanceled.md:5). */
export const CANCELED = "Canceled — your account stays, and nothing was deleted.";

/** The applicant's landing on the bare view (DeleteAccount.md:29). */
export const DELETED = "Your account is deleted.";

/** The locked row's answer (Settings.md:175, reworded in design round 8). */
export const LOCKED_ROW = "You can delete your account once your registration lands.";

/** The sweep, offered at the request and again at the landing (`DeleteAccount.jsx:133-136`). */
export const SWEEP_LABEL = "Also remove what I posted";
export const SWEEP_HINT =
  "The words and pictures go out of your posts and comments, each leaving its mark. Leave this off and they stay as you wrote them.";

/** The landing's add, answered (DeleteAccountConfirmed.md:27). */
export const SWEEP_ADDED = "Added — what you posted goes too.";

/** The signed-out landing's quiet line (DeleteAccountConfirmed.md:37). */
export const LINK_WAS_THE_PROOF = "You're not signed in here, and you don't need to be — the link was the proof.";
