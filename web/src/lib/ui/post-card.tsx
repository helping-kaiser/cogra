"use client";

// The post card — `design/components/content/PostCard.jsx`, and the one
// component both surfaces draw, because "the moment a piece appears on a
// second surface it moves into the shared module; a copy is never the answer"
// is what produced the three drifted copies this replaces.
//
// PEOPLE FIRST (§1): the author leads. The chip sits ABOVE the content on both
// variants, never below it as a byline — including on a media post, where
// every other product would put the picture first.
//
// THE BODY IS WORDS XOR MEDIA (`docs/instances/post.md`): a media post carries
// no `content` at all, because the words beside a picture ARE the description.
// One order for both kinds — TITLE · BODY · DESCRIPTION — so the two shapes
// read as one card re-proportioned rather than two layouts. Handed both (an
// impossible post), the card draws the documented media reading and the
// `content` never appears: the manifest is the body, and half a card is better
// than an invented one.
//
// THE AFFORDANCE ROW is one line that never wraps, in a fixed order — stance,
// Post Score, comments, share. A second row reads as a second kind of thing
// and costs the height the post does not have; that constraint is why every
// affordance in it is glyph-plus-number rather than words.
//
// TWO SLOTS ARE EMPTY, DELIBERATELY, and each says why where it stands: the
// Post Score (no field on the contract until slice 3's ranker) and the
// overflow ⋮ (its menus are undrawn here yet). A slot arrives WITH its
// surface — the `BottomNav` precedent — and a control that goes nowhere is
// worse than one that is not there.

import Link from "next/link";
import { useState } from "react";

import { isPending, type PostView } from "@/lib/api/content-api";
import { RemovedPlaceholder } from "@/lib/ui2/media/removed-placeholder";
import { ActorChip } from "./actor-chip";
import { Card } from "./card";
import { Icon } from "./icons";
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
import { ShareButton } from "./share-button";
import { StanceControl } from "./stance-control";
import { shortTimestamp } from "./timestamp";
import { TopicsLine } from "./topics-line";

/* THE DESCRIPTION IS TWO LINES in the feed, on both kinds of post. It is the
   caption, not the body: enough to say what the thing is, never enough to
   become the reading. */
const DESCRIPTION_CLAMP_LINES = 2;

/* THE TEXT BODY'S CEILING — a text post stands about as tall as a media post,
   never taller, so a feed of both keeps one rhythm. Derived rather than
   chosen: `--media-max-height` is 376px on the 390×844 board and
   `--text-body-medium--line-height` is 20px, so floor(376 / 20) = 18 lines.
   Past that the body folds and `More` opens it. The detail view is the read
   surface and clamps nothing. */
const TEXT_BODY_CLAMP_LINES = 18;

/* A render cannot measure a paragraph, so the opener is offered on an estimate
   from the same tokens: at `--text-body-medium` (14px) the sans averages about
   half an em to the glyph, so 358 / 7 ≈ 51 characters to the line. A media
   post needs no estimate — its caption is clamped to two lines and the opener
   always stands under it. */
const CHARS_PER_LINE = 51;

/**
 * Whether anything is folded away, and so whether the opener is offered.
 */
function isFolded(media: boolean, words: string | null, description: string | null): boolean {
  if (media) return description !== null && description !== "";
  return (
    (words !== null && words.length > TEXT_BODY_CLAMP_LINES * CHARS_PER_LINE) ||
    (description !== null && description.length > DESCRIPTION_CLAMP_LINES * CHARS_PER_LINE)
  );
}

/**
 * The comments affordance: `chat_bubble` plus the count, the same
 * glyph-plus-number shape as the score beside it, with the count spoken by the
 * accessible name and zero showing the glyph alone.
 *
 * "Read the replies" is a different intent from "read the post", so it does not
 * hide behind the card tap. Its ruled destination is the comments sheet, which
 * is not drawn here yet — so on a card it goes to the thread's current home
 * (the post page) and on the detail it takes the reader to the thread already
 * on the page. Neither is a control that goes nowhere.
 */
function CommentCount({
  count,
  href,
  onOpen,
  testId,
}: {
  count: number;
  href?: string;
  onOpen?: () => void;
  testId: string;
}) {
  const label = count === 1 ? "1 comment" : `${count} comments`;
  const className =
    "cg-state cg-focus cg-hit flex flex-none items-center gap-1.5 rounded-full px-2 py-1.5 text-label-large text-on-surface-variant";
  const inside = (
    <>
      <Icon name="chat_bubble" size={18} />
      {count > 0 && <span aria-hidden="true">{count}</span>}
    </>
  );
  if (href !== undefined) {
    return (
      <Link href={href} aria-label={label} data-testid={testId} className={className}>
        {inside}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} data-testid={testId} onClick={onOpen} className={className}>
      {inside}
    </button>
  );
}

export function PostCard({
  post,
  variant = "summary",
  href,
  testId,
  authorTestId,
  stanceTestId,
  comments,
  commentsHref,
  onOpenComments,
  onLinkCopied,
}: {
  post: PostView;
  /** `detail` is the read surface: nothing clamps, and the title leads at `headline-small`. */
  variant?: "summary" | "detail";
  /** The post's own route — the summary card's link, and what share hands over. */
  href: string;
  /** The card's test-id scope; every part of it derives from this. */
  testId: string;
  authorTestId: string;
  stanceTestId: string;
  /** The whole thread's count, off `Post.comments.totalCount`. */
  comments: number;
  /** Where the count leads on a summary card. */
  commentsHref?: string;
  /** What it does on the detail, where the thread is already on the page. */
  onOpenComments?: () => void;
  /** Says `Link copied` where the browser has no platform share sheet. */
  onLinkCopied: () => void;
}) {
  const detail = variant === "detail";
  const [open, setOpen] = useState(false);

  const redacted = payloadIsRedacted(post);
  const media = !redacted && hasMedia(post);
  const veiled = !redacted && bodyIsSensitive(post);
  const title = redacted ? null : (post.title.value ?? null);
  // WORDS XOR MEDIA: the picture is the body, so a media post draws no
  // `content` even when a caller hands it one.
  const words = redacted || media ? null : (post.content.value ?? null);
  const description = redacted ? null : (post.description.value ?? null);
  const folded = isFolded(media, words, description);
  const stamp = shortTimestamp(post.createdAt);

  // The SUMMARY title clamps to one line — readme §13's collapse order has the
  // title give way before media or the affordance row ever shrink. The detail
  // title never clamps and stands at `headline-small`.
  const heading =
    title === null ? null : detail ? (
      <h1 className="text-headline-small" data-testid={`${testId}-title`}>
        {title}
      </h1>
    ) : (
      <h2 className="line-clamp-1 break-words text-title-medium" data-testid={`${testId}-title`}>
        {title}
      </h2>
    );

  const bodyText = (
    <>
      {!media && heading}
      {words !== null && words !== "" && (
        <p
          data-testid={`${testId}-body`}
          className={
            detail
              ? "whitespace-pre-wrap text-body-large"
              : `text-body-medium ${open ? "" : "line-clamp-[18]"}`
          }
        >
          {words}
        </p>
      )}
      {description !== null && description !== "" && (
        <p
          data-testid={`${testId}-description`}
          className={`text-body-medium text-on-surface-variant ${
            detail || open ? "" : "line-clamp-2"
          }`}
        >
          {description}
        </p>
      )}
    </>
  );

  return (
    <Card testId={testId}>
      {/* AUTHOR, TIMESTAMP, AND THE ⋮'s PLACE — the card's header line. On a
          detail surface the page header owns the one overflow menu; on a
          summary card the ⋮ has no menus drawn here yet, so the slot stands
          empty rather than holding a control that goes nowhere. */}
      <div className="flex items-center justify-between gap-2">
        {post.author && (
          <ActorChip
            handle={post.author.handle}
            displayName={post.author.displayName.value}
            avatarUrl={post.author.avatar?.url}
            testId={authorTestId}
          />
        )}
        {stamp !== "" && (
          <time
            dateTime={post.createdAt}
            data-testid={`${testId}-timestamp`}
            className="flex-none text-body-small text-on-surface-variant"
          >
            {stamp}
          </time>
        )}
      </div>
      {/* The title stays ABOVE the media because it titles the thing — below
          it, it reads as a caption and the caption reads as a second caption.
          It is also OUTSIDE the veil, so choosing to look is informed. */}
      {media && heading}
      {redacted ? (
        // The skeleton, not a field: author, timestamp, thread position and the
        // stance a reader can still take are what survive, because no record
        // leaves the graph and no removal is silent.
        <RemovedPlaceholder reason={removalReason(post)} testId={`${testId}-removed`} />
      ) : (
        <BodyRegion
          veiled={veiled}
          testId={testId}
          nodeId={post.id}
          signature={sensitiveSignature(post)}
        >
          {detail ? (
            <>
              {media && <PostMedia node={post} testId={`${testId}-media`} preloadLead />}
              {bodyText}
            </>
          ) : (
            /* TAPPING THE CARD OPENS THE POST — one link over the whole body,
               media included, so there is one tab stop rather than two to the
               same destination. Anything with its own meaning (the author chip,
               the affordance row, the opener) stands outside it. */
            <Link href={href} data-testid={`${testId}-link`} className="flex flex-col gap-2">
              {media && <PostMedia node={post} testId={`${testId}-media`} />}
              {bodyText}
            </Link>
          )}
        </BodyRegion>
      )}
      {/* `More` is a text control, not a link: it opens the text in place and
          never navigates, so it stands outside the link region. */}
      {!detail && !redacted && folded && (
        <button
          type="button"
          aria-expanded={open}
          data-testid={`${testId}-opener`}
          onClick={() => setOpen((shown) => !shown)}
          className="cg-state cg-focus self-start border-0 bg-transparent px-0 py-1 text-label-medium text-on-surface-variant"
        >
          {open ? "Less" : "More"}
        </button>
      )}
      {/* ONE LINE for topics and citations on both variants. Its handlers open
          the topics-and-references sheet, which is undrawn here yet — so the
          counts state the fact and open nothing. */}
      {!redacted && (
        <TopicsLine
          topics={post.topics.map((claim) => ({
            name: claim.hashtag.name.value ?? "",
            pending: claim.pending,
          }))}
          references={post.references.length}
          testIdPrefix={testId}
        />
      )}
      {/* Shown in full, marked quietly (design.md §9) — a pending post is real
          content whose place in the order is not yet fixed. */}
      {isPending(post) && <PendingMarker testId={`${testId}-pending`} />}
      {/* THE AFFORDANCE ROW. Stance leads — it is the gesture the product lives
          on — then the Post Score, then comments, then share. ONE LINE, NEVER
          WRAPPING. */}
      <div className="flex min-w-0 flex-nowrap items-center gap-2">
        <StanceControl
          target={{ id: post.id, kind: "post", label: "this post" }}
          testIdPrefix={stanceTestId}
        />
        <CommentCount
          count={comments}
          href={detail ? undefined : (commentsHref ?? href)}
          onOpen={onOpenComments}
          testId={`${testId}-comments`}
        />
        <ShareButton href={href} onCopied={onLinkCopied} testId={`${testId}-share`} />
      </div>
    </Card>
  );
}
