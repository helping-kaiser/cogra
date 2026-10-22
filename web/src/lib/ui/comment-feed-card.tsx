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
// (`post-card.tsx`): no field carries a card's score until the ranker's
// figure reaches the contract. REPLIES NEVER APPEAR IN A FEED: the card
// carries no view-replies line.
//
// ITS ⋮ IS THE COMMENT'S MENU (`comment-menu.ts`), the sheet every comment's ⋮
// opens, never the post card's.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { CommentFieldsFragment } from "@/__generated__/graphql";
import { isPending } from "@/lib/api/content-api";
import { appendDeduped } from "@/lib/api/pagination";
import { fetchCitedBy, type CitingRecordView } from "@/lib/api/references-api";
import type { License } from "@/lib/license";
import { useComfortLine } from "@/lib/saved/comfort-line";
import { REMOVED_BY_AUTHOR, postTitle } from "@/lib/saved/row-content";
import { useSavedWrites } from "@/lib/saved/provider";
import type { Notify } from "@/lib/saved/save-row";
import { CitedBySheet } from "@/lib/ui2/cited-by-sheet";
import { commentMenuItems } from "@/lib/ui2/comment-menu";
import { LicenseSheet } from "@/lib/ui2/license-sheet";
import { RemovedPlaceholder, type RemovalReason } from "@/lib/ui2/media/removed-placeholder";
import { OverflowMenu } from "@/lib/ui2/overflow-menu";
import { ActorChip } from "./actor-chip";
import { Card } from "./card";
import type { DataNode } from "./data-node";
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
  sensitiveSignature,
} from "./post-media";
import { RowLine } from "./row-line";
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
    }
  | {
      readonly __typename: "Comment";
      readonly id: string;
      readonly content: Moderated;
      readonly author?: { readonly handle: string } | null;
      readonly moderationStatus: string;
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
  const removed =
    target.title?.status === "REDACTED" ||
    target.content?.status === "REDACTED" ||
    target.attachments.some((attachment) => attachment.status === "REDACTED");
  if (removed) {
    const reason: RemovalReason = target.moderationStatus === "ILLEGAL" ? "platform" : "author";
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
  comment,
  from,
  testId,
  node,
  onNotify,
  onLinkCopied,
}: {
  comment: CommentFeedView;
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
  const comfort = useComfortLine(comment.id);
  const [unfolded, setUnfolded] = useState(false);
  const [licenseShown, setLicenseShown] = useState<License | null>(null);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [citedBy, setCitedBy] = useState<{
    readonly records: readonly CitingRecordView[];
    readonly cursor: string | null;
    readonly more: boolean;
  } | null>(null);

  const threadPost = comment.post?.id ?? null;
  // THE COMMENT'S OWN PLACE: its thread, landed on it.
  const place =
    threadPost === null ? null : `/posts/${threadPost}?comment=${comment.id}&from=${from}`;
  const head = comment.target ? headRowOf(comment.target) : null;
  const headHref =
    comment.target === null || comment.target === undefined
      ? null
      : comment.target.__typename === "Post"
        ? `/posts/${comment.target.id}?from=${from}`
        : threadPost === null
          ? null
          : `/posts/${threadPost}?comment=${comment.target.id}&from=${from}`;

  const redacted = payloadIsRedacted(comment);
  const words = redacted ? "" : (comment.content.value ?? "");
  const folds = words.length > CLAMP_LINES * CHARS_PER_LINE;
  const stamp = shortTimestamp(comment.createdAt);
  const handle = comment.author?.handle ?? null;

  const openCitedBy = (id: string) => {
    setCitedBy({ records: [], cursor: null, more: false });
    void fetchCitedBy(client, id).then((outcome) => {
      if (outcome.kind !== "success") return;
      setCitedBy({ records: outcome.value.items, cursor: outcome.value.endCursor, more: outcome.value.hasNextPage });
    });
  };
  const moreCitedBy = () => {
    if (citedBy === null || !citedBy.more) return;
    void fetchCitedBy(client, comment.id, citedBy.cursor).then((outcome) => {
      if (outcome.kind !== "success") return;
      setCitedBy((current) => ({
        records: appendDeduped(current?.records ?? [], outcome.value.items),
        cursor: outcome.value.endCursor,
        more: outcome.value.hasNextPage,
      }));
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
        openLicense: (license) => {
          setLicenseShown(license);
          setLicenseOpen(true);
        },
        testIdPrefix: `${testId}-menu`,
      });

  const body = (
    <>
      {words !== "" &&
        (place === null ? (
          <p className={`text-body-medium ${folds && !unfolded ? "line-clamp-2" : ""}`}>{words}</p>
        ) : (
          <Link href={place} data-testid={`${testId}-link`} className="block">
            <p className={`text-body-medium ${folds && !unfolded ? "line-clamp-2" : ""}`}>{words}</p>
          </Link>
        ))}
      {/* A COMMENT IS WORDS FIRST and its pictures join them: inset at the
          card's medium rung, square and filled, capped at comment scale
          (FeedCommentShapes.md). The pictures take the words' door. */}
      {hasMedia(comment) && (
        <div
          onClick={place === null ? undefined : () => router.push(place)}
          className={place === null ? undefined : "cursor-pointer"}
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
            testId={`${testId}-menu`}
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
                    records={citedBy.records}
                    hasMore={citedBy.more}
                    onLoadMore={moreCitedBy}
                    testId={`${testId}-cited-by-sheet`}
                  />
                )}
              </>
            }
          />
        </div>
      </div>
      {redacted ? (
        <RemovedPlaceholder reason={removalReason(comment)} testId={`${testId}-removed`} />
      ) : (
        // THE COMPACT VEIL TAKES THE WORDS; the head row stays readable.
        <BodyRegion
          veiled={bodyIsSensitive(comment)}
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
          className="cg-state cg-focus self-start border-0 bg-transparent px-0 py-1 text-label-medium text-on-surface-variant"
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

  return (
    <Card testId={testId} node={node}>
      {head !== null && headHref !== null ? (
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
        data-testid={`${testId}-affordances`}
        className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1"
      >
        <StanceControl
          target={{ id: comment.id, kind: "comment", label: "this comment" }}
          testIdPrefix={`${testId}-stance`}
        />
        {place !== null && !redacted && (
          <Link
            href={`${place}&reply=1`}
            aria-label={handle === null ? "Reply" : `Reply to @${handle}`}
            data-testid={`${testId}-reply`}
            className="cg-state cg-focus cg-hit flex flex-none items-center rounded-full px-2 py-1.5 text-on-surface-variant"
          >
            <Icon name="chat_bubble" size={18} />
          </Link>
        )}
        {threadPost !== null && (
          <ShareButton
            href={`/posts/${threadPost}?comment=${comment.id}`}
            targetLabel="this comment"
            onCopied={onLinkCopied}
            testId={`${testId}-share`}
          />
        )}
      </div>
      {/* THE ROW LINE, under the face (RowSigning.md): a save or unsave of this
          comment that did not go through. */}
      {comfort !== null && <RowLine state={comfort} testId={`${testId}-row-line`} />}
    </Card>
  );
}
