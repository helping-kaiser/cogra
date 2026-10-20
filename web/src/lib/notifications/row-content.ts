// WHAT A NOTIFICATION ROW SAYS AND WHERE IT LANDS (Notifications.md;
// copy-voice; packet notifications-list §6.2-§6.3). A pure reading of one row
// into ContentRow's slots and a destination, so every rule below is pinned by
// a test of its own rather than by a screen.
//
// - THE SENTENCE, one per kind, the actor's handle its subject:
//   `@ada commented on your post` … `@kel closed your application`. A deleted
//   actor reads `A deleted account …` and wears the reserved disc (design
//   digest items 18, 56a).
// - THE SECOND LINE: a comment's or a reply's words; `in <title>` for a
//   mention or a citation; nothing else.
// - THE DISC: the opinion row wears the opinion's face, the withdrawal row 🤷;
//   the approvable row the applicant's monogram, never a picture; every other
//   row the actor's picture, else their monogram.
// - THE TAP: a comment row lands on its comment in the thread (Saved's comment
//   landing); a mention or citation opens the post that carries it; a person
//   row opens that person's profile; the application rows open Invites and
//   the reader's own feed. Every destination reads `Back to Notifications`.
//
// THE NT-G3 / NT-G4 BRANCHES ship the packet's recommended defaults and are
// marked where they apply (packet §17): they are design's to confirm.

import type { Notification } from "@/lib/api/notifications-api";
import { mediaStandIn, postTitle, REMOVED_BY_AUTHOR } from "@/lib/saved/row-content";
import type { ContentRowDisc } from "@/lib/ui2/content-row";

/** The roots a bell stands on, by the slot each lights. */
export type BellRoot = "feed" | "explore" | "wallet" | "profile";

/** Where each root lives and what the list's back arrow calls it (Notifications.md:49). */
export const ROOTS: Record<BellRoot, { readonly href: string; readonly backLabel: string }> = {
  feed: { href: "/feed", backLabel: "Back to feed" },
  explore: { href: "/explore", backLabel: "Back to Explore" },
  wallet: { href: "/wallet", backLabel: "Back to Wallet" },
  profile: { href: "/profile", backLabel: "Back to your profile" },
};

/** A `from` the list was opened with, read back; unknown values fall to the feed. */
export function bellRootOf(from: string | null | undefined): BellRoot {
  return from === "explore" || from === "wallet" || from === "profile" ? from : "feed";
}

/** NotificationsEmpty.md:3, verbatim. */
export const NOTIFICATIONS_EMPTY =
  "Nothing here yet. Comments, replies, citations, mentions and opinions on you arrive here as they happen, along with what becomes of your invites and your own application.";

/** The prose name a deleted actor takes inside a sentence (design digest item 18). */
export const DELETED_ACTOR_PROSE = "A deleted account";

export type NotificationRow = {
  readonly title: string;
  readonly second: string | undefined;
  readonly disc: ContentRowDisc;
  /** The actor's handle is gone and the sentence names a deleted account. */
  readonly deleted: boolean;
  /** Where the tap lands; null when nothing resolves to land on. */
  readonly href: string | null;
};

type Moderated = { readonly value?: string | null; readonly status: string };

function text(field: Moderated | null | undefined): string {
  return field?.value?.trim() ?? "";
}

function oneLine(words: string): string {
  return words.replace(/\s+/g, " ").trim();
}

function sensitiveReason(node: { moderationStatus: string; sensitiveReason?: string | null }) {
  if (node.moderationStatus !== "SENSITIVE") return undefined;
  const reason = node.sensitiveReason?.trim();
  return reason === undefined || reason === "" ? undefined : reason;
}

const FROM = "from=notifications";

/** The sentence's tail per kind (Notifications.md:11). */
function predicate(row: Notification): string {
  switch (row.kind) {
    case "COMMENT":
      return "commented on your post";
    case "REPLY":
      return "replied to your comment";
    case "PROFILE_OPINION":
      return "gave an opinion on you";
    case "PROFILE_OPINION_WITHDRAWN":
      return "walked back their opinion on you";
    case "MENTION":
      return "mentioned you";
    case "CITATION":
      // NT-G3(b): a citation of the reader's comment reads `cited your
      // comment`, the reply sentence's pattern (packet recommendation).
      return row.context?.__typename === "Comment" ? "cited your comment" : "cited your post";
    case "APPLICATION_APPROVABLE":
      return "is ready for your approval";
    case "INVITE_LANDED":
      return "landed through your invite";
    case "APPLICATION_APPROVED":
      return "approved your application";
    case "APPLICATION_REJECTED":
      return "closed your application";
  }
}

/** The second line: the words that arrived, or the piece that carries them. */
function secondLine(row: Notification): string | undefined {
  const subject = row.subject;
  switch (row.kind) {
    case "COMMENT":
    case "REPLY": {
      if (subject?.__typename !== "Comment") return undefined;
      // NT-G3(e): a removed comment reads its removal; (d): a sensitive one's
      // words give way to the reason; (c): a wordless one has no second line.
      if (subject.content.status === "REDACTED") return REMOVED_BY_AUTHOR;
      const words = oneLine(text(subject.content));
      return sensitiveReason(subject) ?? (words === "" ? undefined : words);
    }
    case "MENTION":
    case "CITATION": {
      if (subject?.__typename === "Post") {
        if (subject.title.status === "REDACTED" || subject.content.status === "REDACTED") {
          return REMOVED_BY_AUTHOR;
        }
        return `in ${postTitle(subject)}`;
      }
      if (subject?.__typename === "Comment") {
        if (subject.content.status === "REDACTED") return REMOVED_BY_AUTHOR;
        // NT-G3(a): a mention or citation carried by a comment reads the
        // thread's post — the saved comment row's construction turned to the
        // citing side.
        const post = subject.post ?? null;
        if (post !== null) return `in ${postTitle(post)}`;
        const words = oneLine(text(subject.content));
        return words === "" ? `in ${mediaStandIn(subject.attachments, subject.author?.handle ?? null)}` : `in ${words}`;
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/** Where the tap lands (Notifications.md:33-45). */
function destination(row: Notification): string | null {
  const subject = row.subject;
  const handle = row.actor.handle;
  switch (row.kind) {
    case "COMMENT":
    case "REPLY": {
      // The thread landed on that comment — Saved's comment landing (OS-3).
      if (subject?.__typename === "Comment") {
        const post = subject.post ?? null;
        return post === null
          ? `/posts/${subject.id}?${FROM}`
          : `/posts/${post.id}?comment=${subject.id}&${FROM}`;
      }
      // A comment that no longer resolves: the reader's own post, which
      // carries the thread.
      return row.context?.__typename === "Post" ? `/posts/${row.context.id}?${FROM}` : null;
    }
    case "MENTION":
    case "CITATION": {
      if (subject?.__typename === "Post") return `/posts/${subject.id}?${FROM}`;
      if (subject?.__typename === "Comment") {
        // NT-G3(a): the citing comment, in its thread.
        const post = subject.post ?? null;
        return post === null
          ? `/posts/${subject.id}?${FROM}`
          : `/posts/${post.id}?comment=${subject.id}&${FROM}`;
      }
      return null;
    }
    case "PROFILE_OPINION":
    case "PROFILE_OPINION_WITHDRAWN":
    case "INVITE_LANDED":
    case "APPLICATION_APPROVED":
      return `/u/${handle}?${FROM}`;
    case "APPLICATION_APPROVABLE":
      // Invites, as the application now stands, and never a notice that it
      // moved on (Notifications.md:43). Invites has no per-application focus
      // yet, so it opens on the reader's queue, where the application stands.
      return `/invites?${FROM}`;
    case "APPLICATION_REJECTED":
      // NT-G4 (packet recommendation (a)): the reader's own feed as it now
      // stands — the closed card when it still stands, the plain feed once
      // the reader has moved on — with no notice.
      return "/feed";
  }
}

/** The row's disc, by the board's precedence for each kind. */
function discOf(row: Notification, deleted: boolean, name: string): ContentRowDisc {
  if (deleted) return { kind: "redacted" };
  if (row.kind === "PROFILE_OPINION" && row.record !== null && row.record !== undefined) {
    return { kind: "face", pDirected: row.record.pDirected, pInterest: row.record.pInterest };
  }
  // The opinion row's sibling: 🤷 where the opinion's face would be.
  if (row.kind === "PROFILE_OPINION_WITHDRAWN") return { kind: "walkedBack" };
  // The applicant has no Profile to carry a picture until the approval lands.
  if (row.kind === "APPLICATION_APPROVABLE") return { kind: "monogram", name: row.actor.handle };
  const avatar = "avatar" in row.actor ? row.actor.avatar : null;
  if (avatar?.url && avatar.status !== "REDACTED") return { kind: "picture", src: avatar.url, name };
  return { kind: "monogram", name };
}

export function notificationRow(row: Notification): NotificationRow {
  const deleted = row.actor.displayName.status === "REDACTED";
  const subject = deleted ? DELETED_ACTOR_PROSE : `@${row.actor.handle}`;
  const display = text(row.actor.displayName);
  const name = display !== "" ? display : row.actor.handle;
  return {
    title: `${subject} ${predicate(row)}`,
    second: secondLine(row),
    disc: discOf(row, deleted, name),
    deleted,
    href: destination(row),
  };
}
