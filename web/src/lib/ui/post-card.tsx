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
// STRICTLY BELOW 360px OF VIEWPORT WIDTH, SHARE LEAVES THE ROW (design/readme.md,
// jakob 2026-09-17, sharpened 2026-09-22 — PR #794): the row gives way from
// its end, and the reader's overflow menu holds what it lost, leading the
// sheet (`post-menu.ts`). AT 360 the wide row stands — 360dp is mainstream
// android, so the narrow treatment is for the genuinely small.
//
// THE FEED SCORE stands second (`ScoreSlot`): the figure the latest fetch of
// the post found, and the door to its trace — every number is explainable
// (`ExplainableNumber`). A surface hands the card its `scoreOrigin`, which
// names the trace's back arrow; a card mounted where no score is drawn (a
// composer's preview) is handed none and draws no slot.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, ViewTransition } from "react";

import { isPending, type PostView } from "@/lib/api/content-api";
import { postCover } from "@/lib/score/cover";
import { isStreamClip } from "@/lib/reel/stream-clip";
import { reelClipName } from "@/lib/reel/squish";
import { ScoreSlot } from "@/lib/score/score-slot";
import type { TraceOrigin } from "@/lib/score/trace-session";
import { withRemoval, type Removal } from "@/lib/api/removal-api";
import type { License } from "@/lib/license";
import { useActiveAccountId } from "@/lib/session/provider";
import { LicenseSheet } from "@/lib/ui2/license-sheet";
import { RemovedPlaceholder } from "@/lib/ui2/media/removed-placeholder";
import { OverflowMenu, OverflowTrigger } from "@/lib/ui2/overflow-menu";
import { postMenuItems } from "@/lib/ui2/post-menu";
import { RefsSheet } from "@/lib/ui2/refs-sheet";
import { RemoveConfirm } from "@/lib/ui2/remove-confirm";
import { ActorChip } from "./actor-chip";
import { Card } from "./card";
import { part, testAttributes, type DataNode } from "./data-node";
import { Icon } from "./icons";
import { useNarrowShare } from "./narrow-share";
import { PendingMarker } from "./pending-marker";
import { RowLine } from "./row-line";
import { useComfortLine } from "@/lib/saved/comfort-line";
import { useSavedWrites } from "@/lib/saved/provider";
import { saveRow, type Notify } from "@/lib/saved/save-row";
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
import { ShareButton, useShareCapable } from "./share-button";
import { shareLink } from "./share";
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
  node,
}: {
  count: number;
  href?: string;
  onOpen?: () => void;
  testId: string;
  /** The registered node (`….actionRow.comments`); the number is its `count`. */
  node?: DataNode;
}) {
  const label = count === 1 ? "1 comment" : `${count} comments`;
  const className =
    "cg-state cg-focus cg-hit flex flex-none items-center gap-1.5 rounded-full px-2 py-1.5 text-label-large text-on-surface-variant";
  const ids = testAttributes(node, testId);
  const inside = (
    <>
      <Icon name="chat_bubble" size={18} />
      {count > 0 && (
        // The count takes the row's size at the normal leading (PostCard.jsx).
        <span aria-hidden="true" className="[line-height:normal]" {...testAttributes(part(node, "count"))}>
          {count}
        </span>
      )}
    </>
  );
  if (href !== undefined) {
    return (
      <Link href={href} aria-label={label} {...ids} className={className}>
        {inside}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} {...ids} onClick={onOpen} className={className}>
      {inside}
    </button>
  );
}

export function PostCard({
  post: given,
  variant = "summary",
  href,
  shareHref = href,
  testId,
  authorTestId,
  stanceTestId,
  comments,
  commentsHref,
  onOpenComments,
  onLinkCopied,
  opinions = 0,
  onOpenOpinions,
  citedBy = 0,
  onOpenCitedBy,
  mediaAbove = false,
  onOpenMedia,
  stream,
  onOpenMenu,
  menuOpen = false,
  node,
  onNotify,
  scoreOrigin,
}: {
  post: PostView;
  /**
   * Where this card stands, for its score slot: the slot opens the trace and
   * this names the trace's back arrow (`Back to feed`, `Back to the post`,
   * `Back to History`…). Absent, the card draws no score.
   */
  scoreOrigin?: TraceOrigin;
  /**
   * The host's snackbar, for the card's own menu (`Saved.`, `Removed from
   * Saved.` with `Undo`). A surface hosting the menu itself never needs it.
   */
  onNotify?: Notify;
  /**
   * THE SURFACE HOSTS THE MENU (ruling 84; `PostMenuHost`): the card draws its
   * ⋮ and the tap asks the host to raise the one sheet it keeps for every
   * card, instead of the card keeping a sheet of its own. Absent, the card is
   * its own menu's host.
   */
  onOpenMenu?: () => void;
  /** The host's sheet is up for this card — what the hosted ⋮ says it is. */
  menuOpen?: boolean;
  /**
   * The registered card node on a registered screen (`feed.card`,
   * `postDetail.card`), keyed by the post's id. The card's drawn parts then
   * carry the design's node ids (`data-node.ts`) instead of the ones derived
   * from `testId`, `authorTestId` and `stanceTestId`; everything that is not
   * a registered node — the sheets, the menu's rows, the veil — keeps those.
   */
  node?: DataNode;
  /** `detail` is the read surface: nothing clamps, and the title leads at `headline-small`. */
  variant?: "summary" | "detail";
  /** The post's own route — the summary card's link, and what share hands over. */
  href: string;
  /**
   * What share hands over, where the card's link carries an origin the shared
   * link must not (`?from=saved` names a back arrow, never a recipient's).
   */
  shareHref?: string;
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
   * How many PEOPLE hold an opinion on this post — the rows of the opinions
   * sheet the line opens, never a count of their records. DETAIL VARIANT
   * ONLY, and only above zero.
   */
  opinions?: number;
  /** Opens the opinions sheet. */
  onOpenOpinions?: () => void;
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
   * card draws none — the video detail, where "THE CLIP STANDS ABOVE THE
   * CARD, not inside it — which is why the author chip leads the card rather
   * than the screen" (`screens/PostDetailVideo.jsx:7-10`).
   *
   * It moves the GALLERY only. Whether the post bears media is still what
   * decides everything else the card reads off it — words xor media above all:
   * the clip is the body wherever it is drawn, so standing it above the card
   * cannot turn a caption into one.
   */
  mediaAbove?: boolean;
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
  /**
   * THE STREAM THIS CARD'S SURFACE OPENS (Reel.md:3): where the card stands in
   * a list the stream narrows — the feed, Saved, History — a portrait clip's
   * tap opens the stream on it, `onOpen` handing the session the surface's
   * list first. Absent, every media tap opens the post, as on surfaces that
   * draw no stream case (TagPage's; graph.json).
   */
  stream?: { readonly href: string; readonly onOpen: () => void };
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
  // A CARD THAT IS ITS OWN MENU'S HOST (the topic page) has no surface above
  // it holding the post, so a removal taken from its menu is kept here: the
  // card stands as its mark in place the moment the removal is taken (RM-G9's
  // build word), and the cache it was patched into carries it to every later
  // read.
  const [taken, setTaken] = useState<Removal | null>(null);
  const post = taken === null ? given : withRemoval(given, taken);
  // THE NARROW-SHARE FOLD (design/readme.md, jakob 2026-09-17, sharpened
  // 2026-09-22 — PR #794): strictly below 360px the row sheds Share and the
  // menu leads with it instead; at 360 the wide layout stands. Capability
  // gated the same way the button itself is — a browser with no share door
  // never grows a dead row (`share.ts`).
  const narrow = useNarrowShare();
  const shareCapable = useShareCapable();
  const comfort = useComfortLine(post.id);
  const writes = useSavedWrites();

  const redacted = payloadIsRedacted(post);
  const media = !redacted && hasMedia(post);
  // What the card DRAWS, as distinct from what the post bears.
  const drawsMedia = media && !mediaAbove;
  // The one predicate the stream narrows by (`stream-clip.ts`), so a clip
  // whose tap opens the stream is always a clip the stream carries.
  const streamsOnTap = !detail && drawsMedia && stream !== undefined && isStreamClip(post);
  const streamClipId = post.attachments[0]?.id ?? post.id;
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
    shareRow:
      narrow && shareCapable
        ? {
            label: "Share",
            onSelect: () => {
              void shareLink(new URL(shareHref, window.location.href).toString()).then((outcome) => {
                if (outcome === "copied") onLinkCopied();
              });
            },
            testId: `${testId}-menu-share`,
          }
        : null,
    // The card's own menu serves the surfaces that host none of their own; it
    // saves the same way, and says so on the host's snackbar where there is
    // one (`onNotify`).
    save: saveRow({
      writes,
      node: post.id,
      server: post.viewerBookmarkedAt ?? null,
      notify: onNotify ?? (() => {}),
      onGuest: null,
      testId: `${testId}-menu-save`,
    }),
    testIdPrefix: `${testId}-menu`,
  });

  // The SUMMARY title clamps to one line — readme §13's collapse order has the
  // title give way before media or the affordance row ever shrink. The detail
  // title never clamps and stands at `headline-small`.
  const heading =
    title === null ? null : detail ? (
      <h1 className="text-headline-small" {...testAttributes(part(node, "title"), `${testId}-title`)}>
        {title}
      </h1>
    ) : (
      <h2
        className="line-clamp-1 break-words text-title-medium"
        {...testAttributes(part(node, "title"), `${testId}-title`)}
      >
        {title}
      </h2>
    );

  const bodyText = (
    <>
      {!media && heading}
      {words !== null && words !== "" && (
        <p
          {...testAttributes(part(node, "body"), `${testId}-body`)}
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
          {...testAttributes(part(node, "description"), `${testId}-description`)}
          className={`text-body-medium text-on-surface-variant ${
            detail || open ? "" : "line-clamp-2"
          }`}
        >
          {description}
        </p>
      )}
    </>
  );
  // TITLE · BODY · DESCRIPTION STAND 4px APART (`PostCard.jsx` `textBlock`,
  // `--space-1`: "two fields, one visible join"), and the block stands the
  // card's 12px under the media, as its own child of the card does on the
  // board. With nothing in it, nothing is drawn — an empty block would still
  // spend that 12px.
  const hasText =
    (!media && heading !== null) ||
    (words !== null && words !== "") ||
    (description !== null && description !== "");
  const textBlock = hasText ? <div className="flex flex-col gap-1">{bodyText}</div> : null;

  return (
    <Card testId={testId} node={node} door={!detail && !redacted}>
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
            node={part(node, "authorChip")}
          />
        )}
        <div className="flex flex-none items-center gap-3">
          {stamp !== "" && (
            <time
              dateTime={post.createdAt}
              {...testAttributes(part(node, "timestamp"), `${testId}-timestamp`)}
              // The body-small SIZE on the header line's own 24px leading
              // (PostCard.jsx: the timestamp sets its size alone).
              className="flex-none text-[length:var(--text-body-small)] [line-height:1.5rem] text-on-surface-variant"
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
          {!detail && !redacted && onOpenMenu !== undefined && (
            <OverflowTrigger
              ariaLabel="More on this post"
              testId={`${testId}-menu`}
              node={part(node, "menu")}
              expanded={menuOpen}
              onOpen={onOpenMenu}
            />
          )}
          {!detail && !redacted && onOpenMenu === undefined && (
            <OverflowMenu
              items={menuItems}
              ariaLabel="More on this post"
              sheetLabel="Post actions"
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
                  {removeOpen && (
                    <RemoveConfirm
                      kind="post"
                      nodeId={post.id}
                      record={post.genesisRecordId}
                      onClose={() => setRemoveOpen(false)}
                      onRemoved={setTaken}
                      testId={`${testId}-remove-confirm`}
                    />
                  )}
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
        // THE MARK DATES ITSELF (`Removed.jsx`: `redacted={{ reason, when }}`):
        // `when` is the removal's own moment, read off the node's mark. Its
        // node is the board's evident path — `<card>.removed`, with the mark's
        // own `line`, `detail` and `when` — until the Removed board registers.
        <RemovedPlaceholder
          reason={removalReason(post)}
          when={removalWhen(post)}
          node={part(node, "removed")}
          testId={`${testId}-removed`}
        />
      ) : (
        <BodyRegion
          veiled={veiled}
          testId={testId}
          nodeId={post.id}
          signature={sensitiveSignature(post)}
        >
          {detail ? (
            <div className="flex flex-col gap-3">
              {drawsMedia && (
                <PostMedia
                  node={post}
                  testId={`${testId}-media`}
                  dataNode={part(node, "media")}
                  preloadLead
                  // THE POST'S TAP OPENS THE FRAME (`ViewerPicture.jsx:2-3`).
                  onOpen={onOpenMedia}
                />
              )}
              {textBlock}
            </div>
          ) : (
            /* TAPPING THE CARD OPENS THE POST — one link over the whole body,
               media included, so there is one tab stop rather than two to the
               same destination. Anything with its own meaning (the author chip,
               the affordance row, the opener) stands outside it. It is the
               card's DOOR (`cg-door`): hovered or pressed, the whole card takes
               the layer (`Card.jsx`, the K13 round). */
            streamsOnTap ? (
              /* A PORTRAIT CLIP'S TAP OPENS THE STREAM; any other media's tap
                 opens the post (graph.json «post media»: "a portrait clip — the
                 stream opens"; readme §13, the reel round). So the clip is its
                 own door, to the stream, and the words below it keep the
                 card's door to the post — two destinations, two tab stops.
                 The clip is the shape the stream's entrance carries over
                 (`squish.ts`; the packet's RL-G15 reading). */
              <div className="flex flex-col gap-3">
                <Link
                  href={stream.href}
                  onClick={stream.onOpen}
                  data-testid={`${testId}-stream-link`}
                  className="cg-focus cg-door block"
                >
                  <ViewTransition name={reelClipName(streamClipId)} share="cg-squish" default="none">
                    <div>
                      <PostMedia node={post} testId={`${testId}-media`} dataNode={part(node, "media")} />
                    </div>
                  </ViewTransition>
                </Link>
                {textBlock !== null && (
                  <Link href={href} data-testid={`${testId}-link`} className="cg-focus cg-door flex flex-col gap-3">
                    {textBlock}
                  </Link>
                )}
              </div>
            ) : (
              <Link
                href={href}
                data-testid={`${testId}-link`}
                className="cg-focus cg-door flex flex-col gap-3"
              >
                {drawsMedia && (
                  <PostMedia node={post} testId={`${testId}-media`} dataNode={part(node, "media")} />
                )}
                {textBlock}
              </Link>
            )
          )}
        </BodyRegion>
      )}
      {/* `More` is a text control, not a link: it opens the text in place and
          never navigates, so it stands outside the link region. */}
      {!detail && !redacted && folded && (
        <button
          type="button"
          aria-expanded={open}
          {...testAttributes(part(node, "opener"), `${testId}-opener`)}
          onClick={() => setOpen((shown) => !shown)}
          className="cg-state cg-focus cg-hit self-start border-0 bg-transparent px-0 py-1 text-label-medium text-on-surface-variant"
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
            node={part(node, "tagsLine")}
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
      {/* WHO HOLDS AN OPINION ON THIS, on the detail surface only
          (`PostCard.jsx`; readme item 55): a quiet count line under the tags
          line, in `TopicsLine`'s register — the affordance row is closed and
          nothing joins it. IT CARRIES NO FACE: a face on a post card already
          means "your opinion" (PostDetail.md). The count is the sheet's
          length — people, not records — and at zero there is no line. The
          count rides inside the name, `8 opinions on this post`, as the line
          under it does. */}
      {!redacted && detail && opinions > 0 && (
        <button
          type="button"
          className="cg-state cg-focus cg-hit flex w-full items-center border-0 bg-transparent p-0 text-left text-body-small text-on-surface-variant"
          {...testAttributes(part(node, "opinions"), `${testId}-opinions`)}
          onClick={onOpenOpinions}
        >
          <span>{opinions === 1 ? "1 opinion on this post" : `${opinions} opinions on this post`}</span>
        </button>
      )}
      {/* WHAT CITES THIS, as a count that opens the list holding them
          (`screens/CitedBy.jsx`; readme item 55), directly under the opinions
          line and in its register.

          IT IS NOT THE REFERENCES LINE GROWN A SECOND NUMBER. That line's count
          is the tags-and-references sheet's length — a law this leaves where it
          stands. Inbound citations are a different list, by different authors,
          in a different order, and folding them into one count would make
          neither number checkable.

          AT ZERO THERE IS NO ROW — a tap that can only open an empty list is a
          tap spent on nothing. The comment's door is its ⋮, where the row
          stands whatever the count is, and that is where the empty sheet
          lives. */}
      {/* THE COUNT RIDES INSIDE THE NAME (copy-voice, *The opinions list*;
          `PostCard.jsx`, the K13 round): the line's own words are its
          accessible name — `Cited by 4` — because a door's name replaces
          everything in it and the number is why the line exists. Drawn at
          body-small, it answers to 48px through `cg-hit`, its ink unchanged. */}
      {!redacted && detail && citedBy > 0 && (
        <button
          type="button"
          className="cg-state cg-focus cg-hit flex w-full items-center border-0 bg-transparent p-0 text-left text-body-small text-on-surface-variant"
          {...testAttributes(part(node, "citedBy"), `${testId}-cited-by`)}
          onClick={onOpenCitedBy}
        >
          <span>Cited by {citedBy}</span>
        </button>
      )}
      {/* Shown in full, marked quietly (design.md §9) — a pending post is real
          content whose place in the order is not yet fixed. */}
      {isPending(post) && <PendingMarker testId={`${testId}-pending`} />}
      {/* THE AFFORDANCE ROW. Stance leads — it is the gesture the product lives
          on — then the Post Score, then comments, then share. ONE LINE, NEVER
          WRAPPING. IT SPREADS ACROSS THE CARD (`PostCard.jsx`, jakob's ruling,
          the geek round): the controls sit at even intervals over the full
          width, share closing the row at its right edge — the thumb habit
          every reader has, and the last affordance reachable without crossing
          the first. Spreading is a distribution, not a re-ranking. */}
      <div
        {...testAttributes(part(node, "actionRow"), `${testId}-affordances`)}
        className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2"
      >
        <StanceControl
          target={{ id: post.id, kind: "post", label: "this post" }}
          testIdPrefix={stanceTestId}
          node={part(node, "actionRow.stance")}
        />
        {scoreOrigin !== undefined && (
          <ScoreSlot
            targetId={post.id}
            kind="post"
            pending={isPending(post)}
            cover={() => postCover(post)}
            origin={scoreOrigin}
            dashWhileSettling={detail}
            node={part(node, "actionRow.score")}
            testId={`${testId}-score`}
          />
        )}
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
          node={part(node, "actionRow.comments")}
        />
        {/* SHARE LEAVES THE ROW STRICTLY BELOW 360px — the fold queue's first
            move (design/readme.md, jakob 2026-09-17, sharpened 2026-09-22 —
            PR #794). The reader's overflow menu holds it instead, leading
            the sheet. */}
        {!narrow && (
          <ShareButton
            href={shareHref}
            onCopied={onLinkCopied}
            testId={`${testId}-share`}
            node={part(node, "actionRow.share")}
          />
        )}
      </div>
      {/* THE ROW LINE, under the face (RowSigning.md): here, a read-side
          comfort on this post that did not go through — its save or unsave
          reverted. The hold's two states ride the same master once the stance
          lanes wire them. */}
      {comfort !== null && <RowLine state={comfort} testId={`${testId}-row-line`} />}
    </Card>
  );
}
