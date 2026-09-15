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
// ONE SLOT IS EMPTY, DELIBERATELY, and says why where it stands: the Post
// Score, which has no field on the contract until slice 3's ranker. A slot
// arrives WITH its surface — the `BottomNav` precedent — and a control that
// goes nowhere is worse than one that is not there.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { isPending, type PostView } from "@/lib/api/content-api";
import type { License } from "@/lib/license";
import { useActiveAccountId } from "@/lib/session/provider";
import { LicenseSheet } from "@/lib/ui2/license-sheet";
import { RemovedPlaceholder } from "@/lib/ui2/media/removed-placeholder";
import { OverflowMenu } from "@/lib/ui2/overflow-menu";
import { postMenuItems } from "@/lib/ui2/post-menu";
import { RefsSheet } from "@/lib/ui2/refs-sheet";
import { RemoveConfirm } from "@/lib/ui2/remove-confirm";
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

/* THE TEXT BODY'S CEILING — the media law's drawn clamp (title 1 line, body
   18, description 2; tmp_dev/2026-09-11-mvp-design-queue-rulings.md) keeps a
   text post about as tall as a media post, so a feed of both keeps one
   rhythm. Past that the body folds and `More` opens it. The detail view is
   the read surface and clamps nothing. */
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
 * hide behind the card tap. Its ruled destination is the comments sheet, over
 * whichever surface the card is on (jakob 2026-09-15) — the same full-function
 * thread from a feed card as from the detail.
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
  citedBy = 0,
  onOpenCitedBy,
  mediaPinned = false,
  onOpenMedia,
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
  /** Where the count leads on a card with no thread to raise. */
  commentsHref?: string;
  /** The count's ruled destination: the comments sheet, over this surface. */
  onOpenComments?: () => void;
  /** Says `Link copied` where the browser has no platform share sheet. */
  onLinkCopied: () => void;
  /**
   * How many artifacts cite this one — the INBOUND mirror of `references`,
   * which counts what this post points at. DETAIL VARIANT ONLY, and only above
   * zero. Never folded into the references count: that number is the
   * tags-and-references sheet's length, and this is a different list by
   * different authors, in a different order.
   */
  citedBy?: number;
  /** Opens the cited-by sheet. */
  onOpenCitedBy?: () => void;
  /**
   * The surface is already showing this post's media above the card, so the
   * card draws none — the video detail, where "THE CLIP IS PINNED ABOVE THE
   * CARD, not inside it, which is why the author chip leads the card rather
   * than the screen" (`screens/PostDetailVideo.jsx:7-10`).
   *
   * It moves the GALLERY only. Whether the post bears media is still what
   * decides everything else the card reads off it — words xor media above all:
   * the clip is the body wherever it is drawn, so pinning it out of the card
   * cannot turn a caption into one.
   */
  mediaPinned?: boolean;
  /**
   * Opens the fullscreen viewer on one attachment of this post.
   *
   * THE DETAIL'S ALONE. The graph draws exactly one edge from a card's media to
   * the viewer and it starts at `PostDetail` — "detail media → the frame, whole
   * and full-screen" (graph.json, `PostDetail` via 4). On the FEED the tap
   * already means something else and the card's own link owns it: "the card's
   * tap opens the post, the post's tap opens the frame"
   * (`ViewerPicture.jsx:2-3`). So a summary card is handed none.
   */
  onOpenMedia?: (index: number) => void;
}) {
  const detail = variant === "detail";
  const router = useRouter();
  // WHOSE POST THIS IS, read here rather than threaded in from every surface
  // that draws a card. The stance control beside it already reaches the
  // session the same way: a card-level control that needs the viewer asks for
  // the viewer, and a prop would be one more thing a new call site can forget.
  const viewerId = useActiveAccountId();
  const [open, setOpen] = useState(false);
  // The tags-and-references sheet, raised by the line that counts them.
  const [refsOpen, setRefsOpen] = useState(false);
  // THE LICENSE IS NEVER A STATE OF THE CARD (`ReaderPostMenu.jsx:27-29`): the
  // license it shows outlives the `open` flag so the block does not blank out
  // mid-exit.
  const [licenseShown, setLicenseShown] = useState<License | null>(null);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const redacted = payloadIsRedacted(post);
  const media = !redacted && hasMedia(post);
  // What the card DRAWS, as distinct from what the post bears.
  const drawsMedia = media && !mediaPinned;
  const veiled = !redacted && bodyIsSensitive(post);
  const title = redacted ? null : (post.title.value ?? null);
  // WORDS XOR MEDIA: the picture is the body, so a media post draws no
  // `content` even when a caller hands it one.
  const words = redacted || media ? null : (post.content.value ?? null);
  const description = redacted ? null : (post.description.value ?? null);
  const folded = isFolded(media, words, description);
  const stamp = shortTimestamp(post.createdAt);

  const menuItems = postMenuItems({
    postId: post.id,
    own: viewerId !== null && post.author?.id === viewerId,
    handle: post.author?.handle ?? null,
    license: post.license,
    navigate: (route) => router.push(route),
    openLicense: (license) => {
      setLicenseShown(license);
      setLicenseOpen(true);
    },
    openRemove: () => setRemoveOpen(true),
    testIdPrefix: `${testId}-menu`,
  });

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
      {/* AUTHOR, TIMESTAMP, AND THE ⋮ — the card's header line. ON A DETAIL
          SURFACE THE PAGE HEADER OWNS THE ONE OVERFLOW (`_shared.jsx:341-346`
          — the master hides the card's dot in `detail`): two dots would be two
          menus for one post. A summary card keeps its own, because in a feed
          there is no header to carry it (`PostCard.jsx:262`). */}
      <div className="flex items-center justify-between gap-2">
        {post.author && (
          <ActorChip
            handle={post.author.handle}
            displayName={post.author.displayName.value}
            avatarUrl={post.author.avatar?.url}
            testId={authorTestId}
          />
        )}
        <div className="flex flex-none items-center gap-3">
          {stamp !== "" && (
            <time
              dateTime={post.createdAt}
              data-testid={`${testId}-timestamp`}
              className="flex-none text-body-small text-on-surface-variant"
            >
              {stamp}
            </time>
          )}
          {/* A REMOVED POST HAS NO MENU LEFT (`Removed.jsx:5-6`): there is
              nothing of it to edit, cite or license, so the ⋮ is dropped
              wholesale rather than a row at a time.
              THE SHEETS ITS ROWS OPEN RIDE THE MENU, the way the refs sheet
              rides this card: the same card is the feed's, the topic page's
              and the detail's, and each of them carries the rows that raise
              them. */}
          {!detail && !redacted && (
            <OverflowMenu
              items={menuItems}
              ariaLabel="More on this post"
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
                  {/* THE DIALOG SHIPS, THE REMOVAL DOES NOT (jakob
                      2026-09-14): erasure is slice 8's, whole. */}
                  <RemoveConfirm
                    open={removeOpen}
                    onClose={() => setRemoveOpen(false)}
                    onRemove={() => setRemoveOpen(false)}
                  />
                </>
              }
            />
          )}
        </div>
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
              {drawsMedia && (
                <PostMedia
                  node={post}
                  testId={`${testId}-media`}
                  preloadLead
                  // THE POST'S TAP OPENS THE FRAME (`ViewerPicture.jsx:2-3`).
                  onOpen={onOpenMedia}
                />
              )}
              {bodyText}
            </>
          ) : (
            /* TAPPING THE CARD OPENS THE POST — one link over the whole body,
               media included, so there is one tab stop rather than two to the
               same destination. Anything with its own meaning (the author chip,
               the affordance row, the opener) stands outside it. */
            <Link href={href} data-testid={`${testId}-link`} className="flex flex-col gap-2">
              {drawsMedia && <PostMedia node={post} testId={`${testId}-media`} />}
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
      {/* ONE LINE for topics and citations on both variants, and its handlers
          open the sheet the counts have always pointed at (graph.json: every
          `reference count` edge advances to `RefsSheet`). Which handler is the
          master's own split: on a detail surface the WHOLE line opens it, on a
          summary card the counts do and the chips still navigate. */}
      {!redacted && (
        <>
          <TopicsLine
            topics={post.topics.map((claim) => ({
              name: claim.hashtag.name.value ?? "",
              pending: claim.pending,
            }))}
            references={post.references.length}
            testIdPrefix={testId}
            onOpen={detail ? () => setRefsOpen(true) : undefined}
            onOpenReferences={detail ? undefined : () => setRefsOpen(true)}
          />
          {/* THE SHEET RIDES THE CARD, not the page: the same card is the feed's
              summary, the profile's and the detail's, and every one of them
              carries the line that opens it. */}
          <RefsSheet
            open={refsOpen}
            onClose={() => setRefsOpen(false)}
            topics={post.topics}
            references={post.references}
            testId={`${testId}-refs-sheet`}
          />
        </>
      )}
      {/* WHAT CITES THIS, as a count that opens the list holding them
          (`screens/CitedBy.jsx`; readme item 55).

          IT IS NOT THE REFERENCES LINE GROWN A SECOND NUMBER. That line's count
          is the tags-and-references sheet's length — a law this leaves where it
          stands. Inbound citations are a different list, by different authors,
          in a different order, and folding them into one count would make
          neither number checkable.

          AT ZERO THERE IS NO ROW — a tap that can only open an empty list is a
          tap spent on nothing. The comment's door is its ⋮, where the row
          stands whatever the count is, and that is where the empty sheet
          lives. */}
      {!redacted && detail && citedBy > 0 && (
        <button
          type="button"
          className="w-full text-left text-body-small text-on-surface-variant"
          data-testid={`${testId}-cited-by`}
          aria-label="Cited by"
          onClick={onOpenCitedBy}
        >
          Cited by {citedBy}
        </button>
      )}
      {/* Shown in full, marked quietly (design.md §9) — a pending post is real
          content whose place in the order is not yet fixed. */}
      {isPending(post) && <PendingMarker testId={`${testId}-pending`} />}
      {/* THE AFFORDANCE ROW. Stance leads — it is the gesture the product lives
          on — then the Post Score, then comments, then share. ONE LINE, NEVER
          WRAPPING. */}
      <div
        data-testid={`${testId}-affordances`}
        className="flex min-w-0 flex-nowrap items-center gap-2"
      >
        <StanceControl
          target={{ id: post.id, kind: "post", label: "this post" }}
          testIdPrefix={stanceTestId}
        />
        <CommentCount
          count={comments}
          // THE SHEET WINS WHEREVER IT IS OFFERED. A card handed a door to the
          // thread opens the thread; the route is the fallback for a card
          // mounted where no sheet is (a link is still better than a control
          // that goes nowhere).
          href={
            detail || onOpenComments !== undefined ? undefined : (commentsHref ?? href)
          }
          onOpen={onOpenComments}
          testId={`${testId}-comments`}
        />
        <ShareButton href={href} onCopied={onLinkCopied} testId={`${testId}-share`} />
      </div>
    </Card>
  );
}
