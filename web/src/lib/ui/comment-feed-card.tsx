"use client";

// THE COMMENT CARD — a slice of its thread (`_shared.jsx` `CommentFeedCard`,
// `CommentCard`'s `thread` shape; FeedCommentShapes.md, FeedKinds.md). A
// comment is the one feed card whose meaning depends on something else, so it
// says what it answers before a word of it is read: the head row — the
// answered thing's mark, its title, its author — and the comment hung under
// it on a connector rule, the way a reply hangs under what it answers.
//
// THE DOUBLE DOOR. The head row opens what it names. The rest of the card
// opens the comment's own place — the post's comment section, scrolled to
// this comment. Things with their own meaning keep it: the author chip, the
// chips, the row.
//
// THE ROW READS OPINION · SCORE · THE COMMENT GLYPH · SHARE (FeedKinds.md).
// The glyph is the reply: the same comment section at this comment, the
// composer already aimed at it. The score slot waits with the post card's
// (`post-card.tsx`): the figure is a door, and the screens it opens are not
// built yet. REPLIES NEVER APPEAR IN A FEED: the card
// carries no view-replies line.
//
// ITS ⋮ IS THE COMMENT'S MENU (`comment-menu.ts`), the sheet every comment's ⋮
// opens, never the post card's.
//
// THE LINE SHAPE (`CommentCard`'s `targetShape="line"`, ProfileComments): where
// a comment is listed away from its thread and nothing ranks it — a profile's
// comments — the card leads with the one-line `On …` pointer instead of the
// head row, its words stand whole and are no door, and its row is the
// thread's own: the opinion, then the text `Reply`, with the collapsed
// "View n replies" line under the card. Every door — the pointer, Reply and
// the replies line — opens the thread the comment lives in.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { CommentFieldsFragment } from "@/__generated__/graphql";
import { isPending } from "@/lib/api/content-api";
import { withRemoval, type Removal } from "@/lib/api/removal-api";
import { fetchHeldOpinions, type HeldOpinionView } from "@/lib/api/opinions-api";
import { fetchCitingArtifacts, type CitingArtifactView } from "@/lib/api/references-api";
import type { License } from "@/lib/license";
import { useComfortLine } from "@/lib/saved/comfort-line";
import { REMOVED_BY_AUTHOR, postTitle } from "@/lib/saved/row-content";
import { useSavedWrites } from "@/lib/saved/provider";
import { useActiveAccountId } from "@/lib/session/provider";
import type { Notify } from "@/lib/saved/save-row";
import { CitedBySheet } from "@/lib/ui2/cited-by-sheet";
import { OpinionsSheet } from "@/lib/ui2/opinions-sheet";
import { commentMenuItems } from "@/lib/ui2/comment-menu";
import { LicenseSheet } from "@/lib/ui2/license-sheet";
import {
  REMOVED_COMMENT_NOTE,
  RemovedPlaceholder,
  type RemovalReason,
} from "@/lib/ui2/media/removed-placeholder";
import { OverflowMenu } from "@/lib/ui2/overflow-menu";
import { RemoveConfirm } from "@/lib/ui2/remove-confirm";
import { ActorChip } from "./actor-chip";
import { buttonClassName } from "./button";
import { Card } from "./card";
import { part, testAttributes, type DataNode } from "./data-node";
import { Icon } from "./icons";
import { NodeMark } from "./node-mark";
import { PendingMarker } from "./pending-marker";
import {
  BodyRegion,
  PostMedia,
  bodyIsSensitive,
  hasMedia,
  payloadIsRedacted,
  removalReason,
  removalWhen,
  sensitiveSignature,
} from "./post-media";
import { RowLine } from "./row-line";
import { ScoreSlot } from "@/lib/score/score-slot";
import type { TraceOrigin } from "@/lib/score/trace-session";
import { commentCover } from "@/lib/score/cover";
import { ShareButton } from "./share-button";
import { StanceControl } from "./stance-control";
import { shortTimestamp } from "./timestamp";
import { TopicsLine } from "./topics-line";

/* A LONG COMMENT FOLDS AT TWO LINES under `More` (FeedCommentShapes.md, the
   caption's precedent); the card is still the door to its thread. A render
   cannot measure, so the opener is offered on the master's estimate: about
   half an em to the glyph at `body-medium`, 45 characters to the thread
   shape's line, which hangs 44px in. */
const CLAMP_LINES = 2;
const CHARS_PER_LINE = 45;

/**
 * An applicant's Reply answers in place (ProfileComments.md:29; the comment
 * foot's twin, staged-surfaces.md): locked, never gone, never the composer.
 */
export const COMMENT_LOCKED = "You can comment once you're in.";

/** What the line shape's text Reply does for this reader. */
export type LineReply =
  /** A member: the thread opens, its composer aimed at the comment. */
  | "open"
  /** An applicant: the locked look, the tap answered in the snackbar. */
  | "locked"
  /** A guest: no Reply, as the thread draws none for one. */
  | "none";

const REMOVED_LINE: Record<RemovalReason, string> = {
  author: REMOVED_BY_AUTHOR,
  platform: "Removed under the platform's rules",
};

type Moderated = { readonly value?: string | null; readonly status: string } | null | undefined;

/** What a comment answers, as its head row reads it. */
export type CommentTargetView =
  | {
      readonly __typename: "Post";
      readonly id: string;
      readonly title: Moderated;
      readonly content: Moderated;
      readonly attachments: readonly {
        readonly url: string;
        readonly status: string;
        readonly mimeType: string;
        readonly coverMedia?: { readonly url: string; readonly status: string } | null;
      }[];
      readonly author?: { readonly handle: string } | null;
      readonly moderationStatus: string;
      /** The target's own mark (`Post.removal` / `Comment.removal`). */
      readonly removal?: { readonly at: string; readonly by: string } | null;
    }
  | {
      readonly __typename: "Comment";
      readonly id: string;
      readonly content: Moderated;
      readonly author?: { readonly handle: string } | null;
      readonly moderationStatus: string;
      /** The target's own mark (`Post.removal` / `Comment.removal`). */
      readonly removal?: { readonly at: string; readonly by: string } | null;
    };

/** A comment as its feed card reads it: the thread's own fields, what it answers, its thread's post. */
export type CommentFeedView = CommentFieldsFragment & {
  readonly target?: CommentTargetView | null;
  readonly post?: { readonly id: string } | null;
};

function text(field: Moderated): string {
  return field === null || field === undefined || field.status === "REDACTED" ? "" : (field.value ?? "").trim();
}

/** A text's first line — how an untitled post and a comment are named. */
export function firstWords(words: string): string {
  return words.split("\n")[0]!.trim();
}

type HeadRow = {
  readonly kind: "post" | "comment";
  readonly title: string;
  readonly sub: string;
  readonly cover: string | null;
  readonly removed: boolean;
  /** The door's accessible name: `On <this>`. */
  readonly label: string;
};

/** What the head row names, per target (`_shared.jsx` `commentTarget`). */
export function headRowOf(target: CommentTargetView): HeadRow {
  const handle = target.author?.handle ?? null;
  const by = handle === null ? "" : `@${handle}`;
  if (target.__typename === "Comment") {
    return {
      kind: "comment",
      title: by,
      sub: firstWords(text(target.content)),
      cover: null,
      removed: false,
      label: handle === null ? "a comment" : `@${handle}'s comment`,
    };
  }
  // The target's own mark first — the node says it was removed, and by whom —
  // then any field the payload lost (`payloadIsRedacted`'s reading).
  const removed =
    (target.removal !== null && target.removal !== undefined) ||
    target.title?.status === "REDACTED" ||
    target.content?.status === "REDACTED" ||
    target.attachments.some((attachment) => attachment.status === "REDACTED");
  if (removed) {
    const reason: RemovalReason = removalReason(target);
    return {
      kind: "post",
      title: REMOVED_LINE[reason],
      sub: by,
      cover: null,
      removed: true,
      label: handle === null ? "a removed post" : `@${handle}'s removed post`,
    };
  }
  // AN UNTITLED POST IS NAMED BY ITS FIRST WORDS in the title's place
  // (FeedCommentShapes.md); a wordless media post by its stand-in (B11).
  const title = postTitle(target);
  const lead = target.attachments[0];
  const cover =
    lead === undefined
      ? null
      : lead.mimeType.startsWith("video/")
        ? lead.coverMedia?.status === "REDACTED"
          ? null
          : (lead.coverMedia?.url ?? null)
        : lead.url;
  return { kind: "post", title, sub: by, cover, removed: false, label: `“${title}” — ${by}` };
}

export function CommentFeedCard({
  comment: given,
  from,
  testId,
  node,
  onNotify,
  onLinkCopied,
  scoreOrigin,
  shape = "thread",
  authorHere = false,
  reply = "open",
  replyCount = 0,
  onRemoved,
}: {
  comment: CommentFeedView;
  /**
   * How the card names what it answers (`CommentCard`'s `targetShape`): the
   * feed's `thread` head row, or the `line` pointer of a comment listed away
   * from its thread (ProfileComments.md:5).
   */
  shape?: "thread" | "line";
  /**
   * The card stands on its author's own profile, where the chip's door would
   * open the page it is on: the chip is inert (ProfileComments.md:21).
   */
  authorHere?: boolean;
  /** The line shape's text Reply, for this reader. */
  reply?: LineReply;
  /** The line shape's collapsed branch: the "View n replies" line under the card. */
  replyCount?: number;
  /**
   * The author's own Remove, taken from the card's ⋮: the host keeps the mark
   * too, so a view held for a return comes back wearing it.
   */
  onRemoved?: (removal: Removal) => void;
  /** Where the card stands, for its score slot's trace; absent, no score is drawn. */
  scoreOrigin?: TraceOrigin;
  /** The surface the doors' destinations name on their back arrows (`saved`). */
  from: string;
  testId: string;
  /** The registered card (`saved.commentCard`). */
  node?: DataNode;
  /** The host's snackbar, for the menu's aftermath. */
  onNotify: Notify;
  onLinkCopied: () => void;
}) {
  const router = useRouter();
  const client = useApolloClient();
  const writes = useSavedWrites();
  const viewerId = useActiveAccountId();
  // THE OWN COMMENT'S REMOVAL, OFF THE THREAD (RM-G9's build word: the
  // `OWN_COMMENT_MENU` rows, and the card standing as its mark in place). The
  // card is its own menu's host, so it keeps a taken removal itself.
  const [removing, setRemoving] = useState(false);
  const [taken, setTaken] = useState<Removal | null>(null);
  const comment = taken === null ? given : withRemoval(given, taken);
  const own = viewerId !== null && comment.author?.id === viewerId;
  const comfort = useComfortLine(comment.id);
  const [unfolded, setUnfolded] = useState(false);
  const [licenseShown, setLicenseShown] = useState<License | null>(null);
  const [licenseOpen, setLicenseOpen] = useState(false);
  // The ⋮'s two readings, each null until raised, and its rows null while the
  // read is out — so the empty line never shows before the answer does.
  const [citedBy, setCitedBy] = useState<{
    readonly artifacts: readonly CitingArtifactView[] | null;
  } | null>(null);
  const [opinions, setOpinions] = useState<{
    readonly opinions: readonly HeldOpinionView[] | null;
  } | null>(null);

  const line = shape === "line";
  const threadPost = comment.post?.id ?? null;
  // The origin rides every door's query, encoded: a profile's is `u:<handle>`.
  const origin = encodeURIComponent(from);
  // THE COMMENT'S OWN PLACE: its thread, landed on it.
  const place =
    threadPost === null ? null : `/posts/${threadPost}?comment=${comment.id}&from=${origin}`;
  const head = comment.target ? headRowOf(comment.target) : null;
  const headHref =
    comment.target === null || comment.target === undefined
      ? null
      : comment.target.__typename === "Comment"
        ? threadPost === null
          ? null
          : `/posts/${threadPost}?comment=${comment.target.id}&from=${origin}`
        : line
          // THE POINTER OPENS THE THREAD THE COMMENT LIVES IN
          // (ProfileComments.md:23; graph.json: "the post, its thread open"),
          // landed on the comment that answers it.
          ? place
          : `/posts/${comment.target.id}?from=${origin}`;

  const redacted = payloadIsRedacted(comment);
  const words = redacted ? "" : (comment.content.value ?? "");
  // A profile's list draws the words whole (`CommentCard`'s `clampLines`,
  // off outside the feed).
  const folds = !line && words.length > CLAMP_LINES * CHARS_PER_LINE;
  // In the line shape the words are no door: the card is reached through
  // its pointer, its Reply and its replies line (ProfileComments.md:23-27).
  const wordsDoor = line ? null : place;
  const stamp = shortTimestamp(comment.createdAt);
  const handle = comment.author?.handle ?? null;

  const openCitedBy = (id: string) => {
    setCitedBy({ artifacts: null });
    void fetchCitingArtifacts(client, id).then((outcome) => {
      if (outcome.kind !== "success") return;
      setCitedBy((current) => (current === null ? current : { artifacts: outcome.value }));
    });
  };
  const openOpinions = (id: string) => {
    setOpinions({ opinions: null });
    void fetchHeldOpinions(client, id).then((outcome) => {
      if (outcome.kind !== "success") return;
      setOpinions((current) => (current === null ? current : { opinions: outcome.value }));
    });
  };

  const items = redacted
    ? []
    : commentMenuItems({
        comment,
        writes,
        notify: onNotify,
        onGuest: null,
        navigate: (route) => router.push(route),
        openCitedBy,
        openOpinions,
        openLicense: (license) => {
          setLicenseShown(license);
          setLicenseOpen(true);
        },
        openRemove: own ? () => setRemoving(true) : undefined,
        testIdPrefix: `${testId}-menu`,
      });

  const body = (
    <>
      {words !== "" &&
        (wordsDoor === null ? (
          <p className={`text-body-medium ${folds && !unfolded ? "line-clamp-2" : ""}`}>{words}</p>
        ) : (
          <Link href={wordsDoor} data-testid={`${testId}-link`} className="block">
            <p className={`text-body-medium ${folds && !unfolded ? "line-clamp-2" : ""}`}>{words}</p>
          </Link>
        ))}
      {/* A COMMENT IS WORDS FIRST and its pictures join them: inset at the
          card's medium rung, square and filled, capped at comment scale
          (FeedCommentShapes.md). The pictures take the words' door. */}
      {hasMedia(comment) && (
        <div
          onClick={wordsDoor === null ? undefined : () => router.push(wordsDoor)}
          className={wordsDoor === null ? undefined : "cursor-pointer"}
        >
          <PostMedia
            node={comment}
            bleed="none"
            radius="var(--radius-medium)"
            ratio={1}
            fit="cover"
            maxHeight="220px"
            surface="reading"
            testId={`${testId}-media`}
          />
        </div>
      )}
    </>
  );

  const ownPart = (
    <>
      <div className="flex items-center justify-between gap-2">
        {comment.author && (
          <ActorChip
            handle={comment.author.handle}
            displayName={comment.author.displayName.value}
            avatarUrl={comment.author.avatar?.url}
            testId={`${testId}-author`}
            node={part(node, "authorChip")}
            here={authorHere}
          />
        )}
        <div className="flex flex-none items-center gap-3">
          {stamp !== "" && (
            <time
              dateTime={comment.createdAt}
              data-testid={`${testId}-timestamp`}
              className="flex-none text-body-small text-on-surface-variant"
            >
              {stamp}
            </time>
          )}
          <OverflowMenu
            items={items}
            ariaLabel="More on this comment"
            sheetLabel="Comment actions"
            testId={`${testId}-menu`}
            node={part(node, "menu")}
            trailing={
              <>
                {licenseShown !== null && (
                  <LicenseSheet
                    open={licenseOpen}
                    onClose={() => setLicenseOpen(false)}
                    license={licenseShown}
                    testId={`${testId}-license-sheet`}
                  />
                )}
                {citedBy !== null && (
                  <CitedBySheet
                    open
                    onClose={() => setCitedBy(null)}
                    artifacts={citedBy.artifacts}
                    testId={`${testId}-cited-by-sheet`}
                  />
                )}
                {opinions !== null && (
                  <OpinionsSheet
                    open
                    onClose={() => setOpinions(null)}
                    on="comment"
                    opinions={opinions.opinions}
                    testId={`${testId}-opinions-sheet`}
                  />
                )}
                {removing && (
                  <RemoveConfirm
                    kind="comment"
                    nodeId={comment.id}
                    record={comment.genesisRecordId}
                    onClose={() => setRemoving(false)}
                    onRemoved={(removal) => {
                      setTaken(removal);
                      onRemoved?.(removal);
                    }}
                    testId={`${testId}-remove-confirm`}
                  />
                )}
              </>
            }
          />
        </div>
      </div>
      {redacted ? (
        // The comment-scale mark (`REMOVED_COMMENT_NOTE`), dated by the
        // removal's own moment, as in the thread.
        <RemovedPlaceholder
          reason={removalReason(comment)}
          when={removalWhen(comment)}
          note={removalReason(comment) === "author" ? REMOVED_COMMENT_NOTE : undefined}
          testId={`${testId}-removed`}
          // The mark's registered name where its placer gives one
          // (`CommentCard`'s `removalMark`, the thread sheet's).
          node={line ? part(node, "removalMark") : undefined}
        />
      ) : (
        // THE COMPACT VEIL TAKES THE WORDS; the head row stays readable.
        <BodyRegion
          veiled={bodyIsSensitive(comment)}
          marks={comment}
          face="compact"
          testId={testId}
          nodeId={comment.id}
          signature={sensitiveSignature(comment)}
        >
          {body}
        </BodyRegion>
      )}
      {!redacted && folds && (
        <button
          type="button"
          aria-expanded={unfolded}
          data-testid={`${testId}-opener`}
          onClick={() => setUnfolded((shown) => !shown)}
          className="cg-state cg-focus cg-hit self-start border-0 bg-transparent px-0 py-1 text-label-medium text-on-surface-variant"
        >
          {unfolded ? "Less" : "More"}
        </button>
      )}
      {!redacted && (
        <TopicsLine
          topics={comment.topics.map((claim) => ({
            name: claim.hashtag.name.value ?? "",
            pending: claim.pending,
          }))}
          references={comment.references.length}
          testIdPrefix={testId}
        />
      )}
    </>
  );

  const card = (
    <Card testId={testId} node={node}>
      {/* THE TARGET POINTER (`CommentCard`'s line shape; ProfileComments.md:5):
          one line, one tap to the thread — the target kind's glyph, then
          `On …` in the quiet ink, ellipsized. */}
      {line && head !== null && headHref !== null && (
        <Link
          href={headHref}
          {...testAttributes(part(node, "target"), `${testId}-target`)}
          className="cg-state cg-focus cg-hit flex max-w-full items-center gap-2 rounded-small text-left text-on-surface-variant"
        >
          <Icon name={head.kind === "comment" ? "chat_bubble" : "dynamic_feed"} size={14} />
          {/* The label-small SIZE in the reading weight: the master sets the size
              and line alone, so the pointer reads quieter than a label. */}
          <span className="truncate text-[length:var(--text-label-small)]/[var(--text-label-small--line-height)]">
            On {head.label}
          </span>
        </Link>
      )}
      {!line && head !== null && headHref !== null ? (
        <div className="flex flex-col">
          {/* THE HEAD ROW — its own door, to what it names. A removed target
              keeps its row: its mark keeps its space empty and the title's
              place reads the removal mark's line in the system's voice. */}
          <Link
            href={headHref}
            aria-label={`On ${head.label}`}
            data-testid={`${testId}-head`}
            className="cg-state cg-focus flex items-center gap-3 rounded-small"
          >
            <NodeMark kind={head.kind} src={head.cover} redacted={head.removed} testId={`${testId}-head-mark`} />
            <span className="flex min-w-0 flex-col">
              <span
                data-testid={`${testId}-head-title`}
                // The removal line in the system's voice: the title's size at
                // the body's weight, in the quiet ink (`CommentCard.jsx`: the
                // label-large size with weight 400 — the register `Deleted
                // account` takes). The size alone, so no role brings its 500.
                className={`truncate ${
                  head.removed
                    ? "text-[length:var(--text-label-large)]/[var(--text-label-large--line-height)] text-on-surface-variant"
                    : "text-label-large"
                }`}
              >
                {head.title}
              </span>
              <span className="truncate text-body-small text-on-surface-variant">{head.sub}</span>
            </span>
          </Link>
          {/* THE CONNECTOR: a hairline rule down from the head's mark — centred
              on its 32px tile — to the comment, which hangs inset beside it. */}
          <div className="ml-[15px] flex flex-col gap-3 border-l-2 border-outline-variant pt-3 pl-[27px]">
            {ownPart}
          </div>
        </div>
      ) : (
        ownPart
      )}
      {isPending(comment) && <PendingMarker testId={`${testId}-pending`} />}
      {/* One affordance row, as on the post card: the opinion leads and it
          spreads across the card (`CommentCard.jsx`, jakob's ruling, the geek
          round), every control on a 48px target. */}
      <div
        {...testAttributes(part(node, "actionRow"), `${testId}-affordances`)}
        className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1"
      >
        <StanceControl
          target={{ id: comment.id, kind: "comment", label: "this comment" }}
          testIdPrefix={`${testId}-stance`}
          node={part(node, "actionRow.stance")}
        />
        {/* OPINION, THEN THE SCORE, THEN THE REPLY GLYPH (FeedKinds.md:3),
            the row and its controls wearing the card's registered
            `actionRow` parts (round 23). */}
        {scoreOrigin !== undefined && (
          <ScoreSlot
            targetId={comment.id}
            kind="comment"
            pending={isPending(comment)}
            cover={() => commentCover(comment)}
            origin={scoreOrigin}
            node={part(node, "actionRow.score")}
            testId={`${testId}-score`}
          />
        )}
        {/* THE LINE SHAPE'S REPLY IS THE THREAD'S TEXT BUTTON (`CommentCard`
            without `replyGlyph`): the thread opens, its composer aimed at
            this comment (ProfileComments.md:25) — and a removed comment keeps
            it, as in its thread (CommentRemoved.md). An applicant's stands
            locked and answers in the snackbar, never the composer (:29). */}
        {line && place !== null && reply === "open" && (
          <Link
            href={`${place}&reply=1`}
            {...testAttributes(part(node, "actionRow.reply"), `${testId}-reply`)}
            className={buttonClassName({ variant: "text", size: "sm" })}
          >
            Reply
          </Link>
        )}
        {line && place !== null && reply === "locked" && (
          <button
            type="button"
            {...testAttributes(part(node, "actionRow.reply"), `${testId}-reply`)}
            onClick={() => onNotify(COMMENT_LOCKED)}
            className={`${buttonClassName({ variant: "text", size: "sm" })} opacity-[var(--state-disabled)]`}
          >
            Reply
          </button>
        )}
        {!line && place !== null && !redacted && (
          <Link
            href={`${place}&reply=1`}
            aria-label={handle === null ? "Reply" : `Reply to @${handle}`}
            {...testAttributes(part(node, "actionRow.reply"), `${testId}-reply`)}
            className="cg-state cg-focus cg-hit flex flex-none items-center rounded-full px-2 py-1.5 text-on-surface-variant"
          >
            <Icon name="chat_bubble" size={18} />
          </Link>
        )}
        {!line && threadPost !== null && (
          <ShareButton
            href={`/posts/${threadPost}?comment=${comment.id}`}
            targetLabel="this comment"
            onCopied={onLinkCopied}
            testId={`${testId}-share`}
            node={part(node, "actionRow.share")}
          />
        )}
      </div>
      {/* THE ROW LINE, under the face (RowSigning.md): a save or unsave of this
          comment that did not go through. */}
      {comfort !== null && <RowLine state={comfort} testId={`${testId}-row-line`} />}
    </Card>
  );
  if (!line) return card;
  return (
    <>
      {card}
      {/* THE COLLAPSED BRANCH, as the thread draws it: a short rule and the
          count, indented under the card — its door the thread
          (ProfileComments.md:27). */}
      {replyCount > 0 && place !== null && (
        <Link
          href={place}
          {...testAttributes(part(node, "viewReplies"), `${testId}-replies`)}
          className="cg-state cg-focus cg-hit ml-7 flex items-center gap-3 self-start py-1 pl-0 pr-2 text-label-medium text-on-surface-variant"
        >
          <span aria-hidden="true" className="h-px w-6 bg-outline-variant" />
          View {replyCount === 1 ? "1 reply" : `${replyCount} replies`}
        </Link>
      )}
    </>
  );
}
