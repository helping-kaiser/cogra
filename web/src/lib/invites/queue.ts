// INVITES, AS DATA (the `Invites` board family; behavior/Invites.md and its
// siblings; copy-voice.md *The invites round*). Everything the screen decides
// that is not drawing lives here, pure, so the order law and every drawn word
// are tested once and spoken in one place.

import type { ApplicationView, InviteLinkView } from "@/lib/api/invites-api";
import { dateline, forwardLadder } from "@/lib/ui/timestamp";

// ── The drawn words ─────────────────────────────────────────────────────────

export const INVITES_TITLE = "Invites";
export const NEW_INVITE = "New invite";
export const CREATE_INVITE = "Create invite";
export const CREATING_INVITE = "Creating invite…";
export const APPLICATIONS_LABEL = "Applications";
export const LIVE_LINKS_LABEL = "Live links";
/** Invites' empty halves (copy-voice; Invites.md:11, :13): a half with nothing in it still stands. */
export const NO_APPLICATIONS_WAITING = "No applications waiting.";
export const NO_LIVE_LINKS = "No live links.";
export const READY = "Ready for your approval";
export const NOT_REGISTERED = "Not fully registered yet";
export const WAITING_FOR_KEY = "Waiting for your key";
export const CLOSE_ALL = "Close all";
export const COPY_THE_LINK = "Copy the link";
export const REVOKE = "Revoke";
export const REVOKING = "Revoking…";
export { LINK_COPIED } from "@/lib/ui/share";
export const INVITE_REVOKED = "Invite revoked";
export const INVITES_EMPTY =
  "No invites out yet. A link lets someone make an account. Your vouch — the opinion you sign when you approve them — is what brings them in.";

/** The create sheet (InviteNew.md). */
export const ONLY_ONE_PERSON = "Only one person can use it";
export const EXPIRES_AFTER = "Expires after";
export const CREATE_FOOTNOTE =
  "With it off, anyone holding the link can apply until it expires. Either way each person still needs your approval, one at a time.";
/** The fresh link's sheet (InviteCreated.md). */
export const YOUR_INVITE_LINK = "Your invite link";
export const SHARE_LINK = "Share link";

/** The approval pad's two lines, every open (ApprovePad.md:17, VouchAskPad.md:11). */
export function approvePadNote(handle: string): readonly [string, string] {
  return [
    `Vouching is the act. Set signs your opinion on ${handle} and brings them in.`,
    "It is one signed, priced act — and it is theirs to answer: their opinion back completes the pair.",
  ];
}

/** `How vouching works`, in place (ApprovePad.md:21; copy-voice *The "?" dialogs*). */
export const HOW_VOUCHING_WORKS = "How vouching works";
export const HOW_VOUCHING_WORKS_HELP: readonly string[] = [
  "A link lets someone make an account. Your vouch — the opinion you sign when you approve them — is what brings them in.",
  "Nothing is signed until Set.",
];

/** The snackbar a not-ready row answers with (Invites.md:39, :83). */
export function finishRegistering(handle: string): string {
  return `${handle} has to finish registering before you can approve`;
}

/** The snackbar a member already holding the asker meets (Invites.md:93, VouchAsk.md:17). */
export function alreadyWaiting(handle: string): string {
  return `${handle} is already waiting in your invites.`;
}

// ── The two closing dialogs (RejectConfirm.md, RejectAllConfirm.md) ────────

export function closeApplicationLabel(handle: string): string {
  return `Close ${handle}'s application`;
}

export function rejectTitle(handle: string): string {
  return `Close ${handle}'s application?`;
}

export function rejectBody(handle: string): readonly [string, string] {
  return [
    `It leaves your list and ${handle} is told. Their account stays exactly as it is — signed in, and free to keep reading.`,
    `This is your call and nobody else's. Any member can still vouch them in, and ${handle} gets a link to ask with.`,
  ];
}

export const CLOSE_IT = "Close it";
export const CLOSING_IT = "Closing it…";
export const KEEP_IT = "Keep it";
export const CLOSE_THEM = "Close them";
export const CLOSING_THEM = "Closing them…";
export const KEEP_THEM = "Keep them";
export const DIDNT_SEND = "That didn't send. Try again.";
export const RETRY = "Retry";

export function closeAllLabel(count: number): string {
  return `Close all ${count} applications from this link`;
}

export function rejectAllTitle(count: number): string {
  return `${closeAllLabel(count)}?`;
}

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"] as const;

/**
 * A count in the batch dialog's prose: spelled through nine, digits from 10
 * (RejectAllConfirm.md:9, the common style rule — `All four`, `All 12`).
 */
export function countWord(count: number): string {
  return COUNT_WORDS[count] ?? String(count);
}

const ACCOUNTS_STAY = "Their accounts stay exactly as they are — signed in, and free to keep reading.";

/**
 * The row's two sentences, in the count's English (RejectAllConfirm.md:7-9,
 * copy-voice seam 248). A group never holds `Close all` below two, so two is
 * the smallest the dialog meets, and two is a pair: `Both leave…` and
 * `either of them`. From three, `All four leave your list and all four
 * people are told.`
 */
export function rejectAllBody(count: number): readonly [string, string] {
  if (count <= 2) {
    return [
      `Both leave your list and both people are told. ${ACCOUNTS_STAY}`,
      "This is your call and nobody else's. Any member can still vouch either of them in, and each gets a link to ask with.",
    ];
  }
  const n = countWord(count);
  return [
    `All ${n} leave your list and all ${n} people are told. ${ACCOUNTS_STAY}`,
    "This is your call and nobody else's. Any member can still vouch any of them in, and each gets a link to ask with.",
  ];
}

// ── The queue ──────────────────────────────────────────────────────────────

/** Whether the reader can approve the row now: both proofs are in. */
export function approvable(application: ApplicationView): boolean {
  return application.emailVerified && application.keyAttached;
}

/** The row's title: the handle, never a display name (Invites.md:19). */
export function handleOf(application: Pick<ApplicationView, "handle">): string {
  return `@${application.handle}`;
}

/**
 * The second line — the reader's fact, never the proof still missing
 * (Invites.md:21). A kept approval whose key is elsewhere reads the kept
 * pick's blessed `Waiting for your key` (:73).
 */
export function secondLine(application: ApplicationView, keyElsewhere = false): string {
  if (keyElsewhere) return WAITING_FOR_KEY;
  return approvable(application) ? READY : NOT_REGISTERED;
}

export type ApplicationGroup = {
  /** The link's id: the group's registered key (`invites.group`). */
  readonly linkId: string;
  readonly singleUse: boolean;
  /** Oldest first (Invites.md:11). */
  readonly rows: readonly ApplicationView[];
};

export type QueueLayout = {
  /**
   * Rows taken up through the reader's ask-link door, at the head of
   * Applications before every group (Invites.md:71; design digest item 5:
   * "the same head-of-list Invites row on every device").
   */
  readonly head: readonly ApplicationView[];
  readonly groups: readonly ApplicationGroup[];
};

const byAge = (a: ApplicationView, b: ApplicationView) =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt);

/**
 * THE ORDER LAW (Invites.md:9-13): rows grouped by the link they came
 * through, groups standing by their oldest waiting application, rows by age
 * inside them — so the oldest application in the queue is the first row
 * under any kept approval, and nothing is ever ordered by whether the reader
 * can act on it. Only WAITING rows stand: the queue read already serves only
 * those, and the filter holds the line against a stale read.
 */
export function layoutQueue(queue: readonly ApplicationView[]): QueueLayout {
  const waiting = queue
    .filter((a) => a.approvedAt === null && a.rejectedAt === null && a.landedAt === null)
    .slice()
    .sort(byAge);
  const head: ApplicationView[] = [];
  const groups = new Map<string, { singleUse: boolean; rows: ApplicationView[] }>();
  for (const application of waiting) {
    const link = application.inviteLink;
    if (link === null || link === undefined) {
      head.push(application);
      continue;
    }
    const group = groups.get(link.id);
    if (group === undefined) groups.set(link.id, { singleUse: link.singleUse, rows: [application] });
    else group.rows.push(application);
  }
  // A Map keeps insertion order, and rows were inserted oldest first, so the
  // groups already stand by their oldest row.
  return {
    head,
    groups: [...groups].map(([linkId, group]) => ({ linkId, ...group })),
  };
}

/** `Many uses · 4 waiting`, `Single use · 1 waiting` (Invites.md:9). */
export function groupLabel(group: ApplicationGroup): string {
  return `${group.singleUse ? "Single use" : "Many uses"} · ${group.rows.length} waiting`;
}

/** The batch control stands only where more than one waits (Invites.md:15-17). */
export function groupClosesAll(group: ApplicationGroup): boolean {
  return group.rows.length > 1;
}

// ── The links ──────────────────────────────────────────────────────────────

/** Only a link that still works stands under Live links (Invites.md:29). */
export function liveLinks(links: readonly InviteLinkView[]): readonly InviteLinkView[] {
  return links.filter((link) => link.usable);
}

/**
 * What it is, nothing else: the slot state rides the single-use label only,
 * and a single-use link on the page is one whose slot is open, simply by
 * being there (copy-voice; design digest item 4: used stays used).
 */
export function linkLabel(link: Pick<InviteLinkView, "singleUse">): string {
  return link.singleUse ? "Single use · not used yet" : "Many uses";
}

/** `Expires in 7 days · 22.09.2026` — the forward ladder and the house date. */
export function linkCaption(link: Pick<InviteLinkView, "expiresAt">, now: number = Date.now()): string {
  return `Expires in ${forwardLadder(link.expiresAt, now)} · ${dateline(link.expiresAt)}`;
}

/** The invite link whole — the id inside it is the capability (auth.md *Link URLs*). */
export function joinUrl(origin: string, linkId: string): string {
  return `${origin}/join/${linkId}`;
}

/** The ask link whole (auth.md:347, `/vouch/<link-id>`). */
export function askUrl(origin: string, askLinkId: string): string {
  return `${origin}/vouch/${askLinkId}`;
}

// ── The expiry chooser (InviteExpiry.md) ───────────────────────────────────

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type ExpiryChoice = { readonly label: string; readonly ms: number };

/** Three lengths and no custom date (InviteExpiry.md:5). */
export const EXPIRY_CHOICES: readonly ExpiryChoice[] = [
  { label: "24 hours", ms: 24 * HOUR_MS },
  { label: "7 days", ms: 7 * DAY_MS },
  { label: "30 days", ms: 30 * DAY_MS },
];

/** The sheet opens at 7 days (InviteNew.md:9). */
export const DEFAULT_EXPIRY = EXPIRY_CHOICES[1];

/**
 * A length's registered key (nodes.json `invites.expirySheet.expiryOption`):
 * its row's words, lowercased, each run of other characters one `-`.
 */
export function expiryKey(choice: ExpiryChoice): string {
  return choice.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// ── Where Invites was opened from (Invites.md:95-97) ───────────────────────

export type InvitesOrigin = { readonly href: string; readonly label: string };

/**
 * The back arrow names its door: the reader's own profile, Notifications, or
 * the kept picks' review (or its seal). `from` is the query value the door
 * sent (`/invites?from=notifications`, the bell's own convention).
 */
export function invitesOrigin(from: string | null): InvitesOrigin {
  switch (from) {
    case "notifications":
      return { href: "/notifications", label: "Back to Notifications" };
    case "kept-picks":
      return { href: "/kept-picks", label: "Back to Kept picks" };
    default:
      return { href: "/profile", label: "Back to your profile" };
  }
}

/**
 * Puts a link on the clipboard; whether it landed. A copy that did not land
 * says nothing (no board draws a copy refusal), so `Link copied` is only ever
 * said of a copy that happened.
 */
export async function copyLink(url: string): Promise<boolean> {
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  if (typeof clipboard?.writeText !== "function") return false;
  try {
    await clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
