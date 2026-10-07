// The settings page's decisions, apart from the page that draws them so each
// rule is a function a test can state (Settings.md, SettingsEmailPending.md,
// SignOutConfirm.md).

import type { SessionView, SettingsAccount } from "@/lib/api/settings-api";
import { ladderAge } from "@/lib/ui/timestamp";

/** Where the Email row opens. */
export type EmailDestination = "applicantChange" | "confirmation" | "request";

/**
 * Settings.md: an applicant whose address is not verified yet opens their own
 * address change — even while one is pending, which is where the carve-out's
 * change is answered (G2, RULED: `:97` wins over `:103`); a change with a side
 * still owed opens its confirmation on that side, never a second request; and
 * otherwise — no change, or one that ran out (the read is null then) — the
 * request opens.
 */
export function emailDestination(account: Pick<SettingsAccount, "emailVerified" | "pendingEmailChange">): EmailDestination {
  if (account.emailVerified === false) return "applicantChange";
  if (account.pendingEmailChange !== null && account.pendingEmailChange !== undefined) {
    return "confirmation";
  }
  return "request";
}

export const EMAIL_ROUTES: Record<EmailDestination, string> = {
  applicantChange: "/settings/email/applicant",
  confirmation: "/settings/email/confirm",
  request: "/settings/email",
};

/** What pressing Sign out does (Settings.md:123-127). */
export type SignOutPath = "plain" | "purge" | "ask";

/**
 * The switch off ends the session and keeps everything. The switch on clears
 * the key, the draft and any kept picks — without asking when this browser
 * does not hold the only copy of an unbacked key, and asking first when it
 * does. A backup this browser cannot confirm counts as none: asking costs one
 * dialog, and not asking can erase the only copy (sign-out-custody §8).
 */
export function signOutPath({
  forget,
  keyHere,
  backed,
}: {
  forget: boolean;
  /** The account's key sits in this browser. */
  keyHere: boolean;
  /** A backup is positively known; false when absent OR unknown. */
  backed: boolean;
}): SignOutPath {
  if (!forget) return "plain";
  if (!keyHere || backed) return "purge";
  return "ask";
}

/** The sessions as drawn: this device first, then the rest in the read's order. */
export function orderedSessions(sessions: readonly SessionView[]): SessionView[] {
  return [...sessions.filter((s) => s.isCurrent), ...sessions.filter((s) => !s.isCurrent)];
}

/** A session row's second line: the platform noun for this one, else its age. */
export function sessionStatus(session: SessionView, now: number = Date.now()): string {
  if (session.isCurrent) return "This browser";
  return `Last used ${ladderAge(session.lastUsedAt ?? session.createdAt, now)}`;
}

/** A session row's label — its device, or the drawn fallback. */
export function sessionLabel(session: SessionView): string {
  return session.deviceLabel ?? "Unnamed device";
}

/** What a subpage hands back to the page it returns to (`?done=`). */
export type SettingsNotice = "password" | "handle" | "email" | "canceled" | "applicantSent";

export function settingsNoticeOf(value: string | null): SettingsNotice | null {
  switch (value) {
    case "password":
    case "handle":
    case "email":
    case "canceled":
    case "applicantSent":
      return value;
    default:
      return null;
  }
}

/**
 * The snackbar each return carries, in the drawn words (copy-voice *The
 * settings subpages*). Read off the fresh account, so a reload names what is
 * true now rather than what the subpage remembered.
 */
export function noticeMessage(notice: SettingsNotice, account: SettingsAccount): string | null {
  switch (notice) {
    case "password":
      return "Password changed — other devices are signed out.";
    case "handle":
      return `Your handle is now @${account.handle}.`;
    case "email":
      return account.email ? `Email changed to ${account.email}.` : null;
    case "canceled":
      return account.email ? `Change canceled — your email stays ${account.email}.` : null;
    case "applicantSent": {
      const to = account.pendingEmailChange?.newEmail;
      return to ? `Sent — the link is on its way to ${to}.` : null;
    }
  }
}
