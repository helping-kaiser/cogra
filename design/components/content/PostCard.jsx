import React from "react";
import { Card } from "../core/Card.jsx";
import { ActorChip } from "../people/ActorChip.jsx";
import { PendingMarker, EditedMarker } from "../honesty/PendingMarker.jsx";
import { LicenseTerms } from "../forms/LicenseChooser.jsx";
import { StanceControl } from "../stance/StanceControl.jsx";
import { ExplainableNumber } from "../proposed/ExplainableNumber.jsx";
import { MediaGallery } from "../proposed/MediaAttachment.jsx";
import { MediaViewer } from "../proposed/MediaViewer.jsx";
import { RedactedContent, SensitiveScope, SensitiveVeil } from "../honesty/SensitiveVeil.jsx";
import { OverflowMenu } from "./OverflowMenu.jsx";
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

   A MEDIA POST IS THE SAME CARD, RE-PROPORTIONED. The media runs full-bleed to the
   card's edges and is the largest thing in it; the text around it is trimmed to
   what orients the reader. Order: author · title · media · caption · markers ·
   affordance row. The title stays ABOVE the media because it titles the thing —
   below it, it reads as a caption and the caption reads as a second caption. The
   body sits below, clamped, with an explicit opener.

   The stance control sits OUTSIDE the link region: it acts, it does not navigate. */

const CLAMP = (lines) => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

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
  // The licence is a term over downstream reuse, checked once in a hundred
  // readings — so it is not on the initial view. It arrives when asked for, from
  // the overflow menu, and stays until the reader is done with it.
  const [showLicense, setShowLicense] = React.useState(false);
  // A media post's caption is clamped and openable in place. The SUMMARY title
  // clamps to one line (readme §13's collapse order: the title gives way before
  // media or the affordance row ever shrink); the detail title never clamps.
  const [open, setOpen] = React.useState(false);
  // The detail view's media opens full-size in place. In the feed the same tap
  // opens the post instead: a reader scrolling is choosing between posts, not
  // looking at one picture.
  const [viewing, setViewing] = React.useState(null);

  // The licence rode the payload, so a redacted record has none to show.
  const items = license && !redacted
    ? [{ label: showLicense ? "Hide licence" : "Licence terms", onSelect: () => setShowLicense((shown) => !shown) }, ...menuItems]
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

  const descriptionStyle = {
    margin: 0,
    fontSize: "var(--text-body-medium)",
    color: "var(--text-secondary)",
    ...(hasMedia && !open && !detail ? CLAMP(1) : null),
  };
  const contentStyle = {
    margin: 0,
    fontSize: detail ? "var(--text-body-large)" : "var(--text-body-medium)",
    lineHeight: detail ? "var(--text-body-large--line-height)" : "var(--text-body-medium--line-height)",
    ...(detail ? { whiteSpace: "pre-wrap" } : CLAMP(hasMedia && !open ? 2 : 4)),
  };
  // THE VEIL WRAPS THE PARAGRAPH, never the text inside it: the clamp's
  // `overflow: hidden` then clips the TEXT before the blur applies, so the halo
  // stays soft on every side instead of being cut at the box's edge.
  const veiledParagraph = (node) => (veil ? <SensitiveVeil kind="text">{node}</SensitiveVeil> : node);
  const caption = (
    <>
      {description && veiledParagraph(<p style={descriptionStyle}>{description}</p>)}
      {content && veiledParagraph(<p style={contentStyle}>{content}</p>)}
    </>
  );

  // Only where there is something folded away. "More" is a text control, not a
  // link: it opens the text in place and never navigates.
  const opener =
    hasMedia && !detail && (content || description) ? (
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
      {license && showLicense && !redacted && <LicenseTerms license={license} />}
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
          {actions}
        </div>
      )}
    </>
  );

  return <Card>{veil ? <SensitiveScope>{body}</SensitiveScope> : body}</Card>;
}
