import React from "react";
import { Card } from "../core/Card.jsx";
import { ActorChip } from "../people/ActorChip.jsx";
import { PendingMarker, EditedMarker } from "../honesty/PendingMarker.jsx";
import { LICENSE_MENU_LABEL } from "../forms/LicenseChooser.jsx";
import { StanceControl } from "../stance/StanceControl.jsx";
import { ExplainableNumber } from "../proposed/ExplainableNumber.jsx";
import { MediaGallery } from "../media/MediaAttachment.jsx";
import { MediaViewer } from "../media/MediaViewer.jsx";
import { RedactedContent, SensitiveScope, SensitiveVeil } from "../honesty/SensitiveVeil.jsx";
import { OverflowMenu } from "./OverflowMenu.jsx";
import { ShareButton } from "./ShareButton.jsx";
import { Icon } from "../navigation/Icon.jsx";
import { TopicsLine } from "./TopicsLine.jsx";

/* The post card of design.md §6 — "author (avatar, display name, handle,
   timestamp), optional title, optional description, body, media gallery, stance
   control", with the text-only, single-image, gallery, with-title and
   without-title variants.

   Built here because the source's own rule demands it: "the moment a piece
   appears on a second surface it moves into the shared module — a copy is never
   the answer."

   PEOPLE FIRST (§1): the author leads. The chip sits ABOVE the content, never
   below it as a byline — including on a media post, where every other product
   would put the picture first.

   THE BODY IS WORDS XOR MEDIA. `docs/instances/post.md`: "A Post's body is words
   or media, never both — words that belong beside a picture are the
   description." So a media post carries NO `content`: the words beside the
   picture ARE the description, and the card draws them under it. A text post's
   body is `content`, with the description under it as its caption. One order for
   both kinds — TITLE · BODY · DESCRIPTION — so the two shapes read as one card
   re-proportioned rather than two layouts. Handed both (an impossible post), the
   card draws the documented media reading and the `content` never appears: the
   manifest is the body, and half a card is better than an invented one.

   A MEDIA POST IS THE SAME CARD, RE-PROPORTIONED. The media runs full-bleed to the
   card's edges and is the largest thing in it; the text around it is trimmed to
   what orients the reader. Order: author · title · media · description · markers ·
   affordance row. The title stays ABOVE the media because it titles the thing —
   below it, it reads as a caption and the caption reads as a second caption.

   The stance control sits OUTSIDE the link region: it acts, it does not navigate. */

const CLAMP = (lines) => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

/* THE DESCRIPTION IS TWO LINES in the feed, on both kinds of post. It is the
   caption, not the body: enough to say what the thing is, never enough to
   become the reading. */
const DESCRIPTION_CLAMP_LINES = 2;

/* THE TEXT BODY'S CEILING — a text post stands about as tall as a media post,
   never taller, so a feed of both keeps one rhythm. Derived from the tokens
   rather than chosen: the feed card fills the 390px phone frame and spends
   `--card-padding` (16px) on each side, leaving 358px of content; the tallest
   crop the composer allows is 4:5, so a media post's picture is 358 × 5/4 =
   447.5px of card; `--text-body-medium--line-height` is 1.25rem = 20px.
   floor(447.5 / 20) = 22 lines. Past that the body folds and `More` opens it.
   The detail view is the read surface and clamps nothing. */
const TEXT_BODY_CLAMP_LINES = 22;

/* A static render cannot measure a paragraph, so the opener is offered on an
   estimate from the same tokens: at `--text-body-medium` (0.875rem = 14px) the
   sans averages about half an em to the glyph, so 358 / 7 ≈ 51 characters to
   the line. A media post needs no estimate — its caption is clamped to two
   lines and the opener always stands under it. */
const CHARS_PER_LINE = 51;

export function PostCard({
  author,
  title,
  description,
  content,
  timestamp,
  license,
  pending = false,
  edited = false,
  bundle,
  signedIn = true,
  taught = true,
  onCommit,
  variant = "summary",
  href,
  onOpen,
  targetLabel = "this post",
  showStance = true,
  score,
  onOpenScore,
  comments,
  onOpenComments,
  showShare = true,
  onShare,
  onOpenReferences,
  media,
  actions,
  onOpenMedia,
  redacted,
  sensitive,
  topics = [],
  references = 0,
  menuItems = [],
}) {
  const detail = variant === "detail";
  // THE SENSITIVE MARK (readme §13): one flag veils the BODY and the
  // DESCRIPTION while the title stays readable, and the veil names whose mark it
  // is — the author's warning or the platform's verdict — with the reason after
  // it. One reveal answers for the whole card (SensitiveScope).
  const veil = !redacted && sensitive ? { reason: sensitive.reason ?? sensitive.label, source: sensitive.source } : null;
  // REDACTION IS RECORD-GRANULAR. An illegal verdict removes the payload, so
  // every authored field goes at once — there is no redacted title beside a
  // surviving body. The card renders its skeleton instead: author, timestamp,
  // thread position, and the stance a reader can still take all survive, because
  // no record leaves the graph and no removal is silent.
  const hasMedia = !redacted && Array.isArray(media) && media.length > 0;
  // A media post's caption is clamped and openable in place. The SUMMARY title
  // clamps to one line (readme §13's collapse order: the title gives way before
  // media or the affordance row ever shrink); the detail title never clamps.
  const [open, setOpen] = React.useState(false);
  // The detail view's media opens full-size in place. In the feed the same tap
  // opens the post instead: a reader scrolling is choosing between posts, not
  // looking at one picture.
  const [viewing, setViewing] = React.useState(null);

  // The license is a term over downstream reuse, checked once in a hundred
  // readings — so it is not on the card at all. The menu's row opens it in a
  // sheet over whatever surface the reader asked from (readme §13, the menus
  // round), and the card's only part in it is carrying the row. The license
  // rode the payload, so a redacted record has none to show.
  const items = license && !redacted
    ? [{ label: LICENSE_MENU_LABEL, onSelect: () => {} }, ...menuItems]
    : menuItems;

  const heading = title ? (
    <h2
      style={{
        margin: 0,
        fontSize: detail ? "var(--text-headline-small)" : "var(--text-title-medium)",
        lineHeight: detail ? "var(--text-headline-small--line-height)" : "var(--text-title-medium--line-height)",
        fontWeight: detail ? "var(--text-headline-small--font-weight)" : "var(--text-title-medium--font-weight)",
        ...(detail ? {} : { ...CLAMP(1), wordBreak: "break-word" }),
      }}
    >
      {title}
    </h2>
  ) : null;

  // WORDS XOR MEDIA: the picture is the body, so a media post draws no
  // `content` even when a caller hands it one.
  const words = hasMedia ? null : content;
  const descriptionStyle = {
    margin: 0,
    fontSize: "var(--text-body-medium)",
    // The page ground sets `body-large` leading on everything unclassed, which
    // on a two-line caption at body-medium reads as a gap, not a paragraph. The
    // role's own line-height comes with the role.
    lineHeight: "var(--text-body-medium--line-height)",
    color: "var(--text-secondary)",
    ...(!open && !detail ? CLAMP(DESCRIPTION_CLAMP_LINES) : null),
  };
  const contentStyle = {
    margin: 0,
    fontSize: detail ? "var(--text-body-large)" : "var(--text-body-medium)",
    lineHeight: detail ? "var(--text-body-large--line-height)" : "var(--text-body-medium--line-height)",
    ...(detail ? { whiteSpace: "pre-wrap" } : open ? null : CLAMP(TEXT_BODY_CLAMP_LINES)),
  };
  // THE VEIL WRAPS THE PARAGRAPH, never the text inside it: the clamp's
  // `overflow: hidden` then clips the TEXT before the blur applies, so the halo
  // stays soft on every side instead of being cut at the box's edge.
  const veiledParagraph = (node) => (veil ? <SensitiveVeil kind="text">{node}</SensitiveVeil> : node);
  // BODY FIRST, DESCRIPTION UNDER IT, on both kinds. The 4px seam between them
  // is the card's own gap: two fields, one visible join.
  const caption = (
    <>
      {words && veiledParagraph(<p style={contentStyle}>{words}</p>)}
      {description && veiledParagraph(<p style={descriptionStyle}>{description}</p>)}
    </>
  );

  // Only where there is something folded away. "More" is a text control, not a
  // link: it opens the text in place and never navigates. A media post's caption
  // is clamped to two lines and always carries it; a text post's body has 22
  // lines to fill first, so there the opener waits on the estimate above.
  const folded = hasMedia
    ? Boolean(description)
    : (words && words.length > TEXT_BODY_CLAMP_LINES * CHARS_PER_LINE) ||
      (description && description.length > DESCRIPTION_CLAMP_LINES * CHARS_PER_LINE);
  const opener =
    !detail && folded ? (
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((shown) => !shown)}
        className="cg-state cg-focus"
        style={{
          alignSelf: "flex-start",
          border: 0,
          background: "none",
          padding: "4px 0",
          margin: 0,
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-label-medium)",
          fontWeight: "var(--text-label-medium--font-weight)",
          color: "var(--text-secondary)",
        }}
      >
        {open ? "Less" : "More"}
      </button>
    ) : null;

  const textBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      {!hasMedia && heading}
      {caption}
    </div>
  );

  const linkedText =
    detail || !onOpen ? (
      textBlock
    ) : (
      <a
        href={href ?? "#"}
        onClick={(event) => {
          event.preventDefault();
          onOpen();
        }}
        className="cg-focus"
        style={{ display: "block", color: "inherit", textDecoration: "none" }}
      >
        {textBlock}
      </a>
    );

  const body = (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
        {author && <ActorChip handle={author.handle} displayName={author.displayName} />}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flex: "none" }}>
          {timestamp && <span style={{ fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>{timestamp}</span>}
          {/* ON A DETAIL SURFACE THE PAGE HEADER OWNS THE ONE OVERFLOW — a dot in
              the header and another in the card would be two menus for one post.
              The summary card keeps its own: in a feed there is no header to
              carry it. */}
          {!detail && <OverflowMenu items={items} ariaLabel="More on this post" />}
        </div>
      </div>
      {hasMedia && heading}
      {hasMedia && (
        // FULL-BLEED. The media cancels the card's own 16px padding so it runs to
        // the card's edges, and drops its side radii — it meets the card's straight
        // sides, never its corners, so nothing needs clipping. It is the largest
        // thing in the card by a wide margin, which is the point.
        <div
          style={{ margin: "0 calc(-1 * var(--card-padding))" }}
          onClick={(event) => {
            if (!detail && onOpen) {
              event.preventDefault();
              onOpen();
            } else if (detail) {
              event.preventDefault();
              if (onOpenMedia) onOpenMedia(0);
              else setViewing(0);
            }
          }}
        >
          {veil ? (
            <SensitiveVeil kind="media" reason={veil.reason} source={veil.source} radius="0px">
              <MediaGallery items={media} radius="0px" />
            </SensitiveVeil>
          ) : (
            <MediaGallery items={media} radius="0px" />
          )}
        </div>
      )}
      {viewing !== null && <MediaViewer items={media} index={viewing} onClose={() => setViewing(null)} />}
      {redacted ? <RedactedContent {...(redacted === true ? {} : redacted)} /> : linkedText}
      {!redacted && opener}
      {/* ONE LINE on both variants — the sheet is the full set's home. On
          detail the whole line is the sheet's opener; in the feed the chips
          navigate and only the count opens it. */}
      {!redacted && (
        <TopicsLine
          topics={topics}
          references={references}
          onOpen={detail ? (onOpenReferences ?? (() => {})) : undefined}
          onOpenReferences={onOpenReferences}
        />
      )}
      {edited && <EditedMarker />}
      {pending && <PendingMarker />}
      {/* THE AFFORDANCE ROW. The stance control leads — it is the gesture the
          product lives on — then the Post Score, then comments, then anything
          else a post grows. ONE LINE, NEVER WRAPPING: a second row of
          affordances reads as a second kind of thing, and it costs the height a
          post does not have (see `--media-max-height`). That is the constraint
          that keeps every affordance here glyph-plus-number — words would not
          fit, which is a feature. Nothing in here may take `primaryContainer`:
          the stance knob already spends it. */}
      {(showStance || score !== undefined || comments !== undefined || actions) && (
        <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
          {/* `taught` and `onCommit` belong to the SHELL, not the card: "the first
              tap ever" is a fact about the reader, and a card in a feed of twenty
              cannot know it. Default true so a lone card teaches nothing. */}
          {showStance && <StanceControl targetLabel={targetLabel} bundle={bundle ?? undefined} signedIn={signedIn} taught={taught} onCommit={onCommit} />}
          {score !== undefined && (
            <ExplainableNumber glyph="graph" label="Post Score" value={score} onOpenDetail={onOpenScore ?? (() => {})} />
          )}
          {/* COMMENTS get their own affordance rather than living behind a tap on
              the card, because "read the replies" is a different intent from
              "read the post" and the count is information in itself. It opens
              THE COMMENTS SHEET (readme §13, 2026-08-28) — the thread lives in a
              near-full-height bottom sheet, never a separate screen — and it
              does so from the feed and the detail view alike, because the detail
              view is just about the post. Glyph plus number, exactly like the
              score beside it; the count is spoken by the accessible name. */}
          {comments !== undefined && (
            <button
              type="button"
              onClick={onOpenComments ?? onOpen}
              aria-label={comments === 1 ? "1 comment" : `${comments} comments`}
              className="cg-state cg-focus cg-hit"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                border: "none",
                background: "transparent",
                borderRadius: "var(--radius-full)",
                padding: "6px 8px",
                color: "var(--text-secondary)",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-label-large)",
                fontWeight: "var(--text-label-large--font-weight)",
                cursor: "pointer",
              }}
            >
              <Icon name="chat_bubble" size={18} />
              {comments > 0 && <span aria-hidden="true">{comments}</span>}
            </button>
          )}
          {/* SHARE CLOSES THE ROW. The order here is the order of importance —
              stance, score, comment, share — and it is also the queue: on a
              phone too narrow to hold all four, share is the first to move into
              the ⋮ menu, and the row gives way from its end. Anything added
              later is ranked against what is already reachable before it earns a
              slot; a row that grows by arrival order stops meaning anything. */}
          {showShare && <ShareButton targetLabel={targetLabel} onShare={onShare} />}
          {actions}
        </div>
      )}
    </>
  );

  return <Card>{veil ? <SensitiveScope>{body}</SensitiveScope> : body}</Card>;
}
