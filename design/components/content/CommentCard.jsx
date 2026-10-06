import React from "react";
import { Card } from "../core/Card.jsx";
import { Button } from "../core/Button.jsx";
import { ActorChip } from "../people/ActorChip.jsx";
import { PendingMarker, EditedMarker } from "../honesty/PendingMarker.jsx";
import { LICENSE_MENU_LABEL } from "../forms/LicenseChooser.jsx";
import { StanceControl } from "../stance/StanceControl.jsx";
import { ExplainableNumber } from "../proposed/ExplainableNumber.jsx";
import { OverflowMenu } from "./OverflowMenu.jsx";
import { Icon, NODE_GLYPHS } from "../navigation/Icon.jsx";
import { TopicsLine } from "./TopicsLine.jsx";
import { MediaGallery } from "../media/MediaAttachment.jsx";
import { RedactedContent, SensitiveVeil } from "../honesty/SensitiveVeil.jsx";
import { ShareButton } from "./ShareButton.jsx";
import { GlyphAction } from "./GlyphAction.jsx";
import { NodeMark } from "./ReferenceRow.jsx";

/* The comment (readme §7, *Intentional additions*) — author, body, timestamp,
   media, nested replies, stance control, in its top-level and nested variants. Extracted from
   `post-view.tsx` for the same reason as PostCard: it is the product's own
   "second surface" rule, and the recursion was previously inline.

   THE THREAD IS TWO LEVELS DEEP ON SCREEN (readme §13, 2026-08-28): a comment,
   and its replies indented once. Anything deeper flattens into that one reply
   level and opens with the @handle it answers — the mention IS the structure,
   so the column never narrows to a word. Replies arrive COLLAPSED behind a
   "View n replies" line (`replyCount`); `replies` renders them expanded. */

const MAX_INDENT_DEPTH = 1;

/* The thread shape's head-row door: a bare button
   around what it names, the state layer on the whole block. */
const TARGET_DOOR = {
  display: "block",
  width: "100%",
  border: 0,
  background: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  color: "var(--on-surface)",
  textAlign: "left",
  borderRadius: "var(--radius-small)",
};

/* @handle tokens read as the person they name. Colour is ALL this is: a handle
   typed into a body is text, never a record — the mention that binds is the
   structured reference the composer stages (readme §13, the menus round). */
function withMentions(text) {
  const parts = String(text).split(/(@[a-z0-9_]+)/gi);
  if (parts.length === 1) return text;
  return parts.map((part, index) =>
    part.startsWith("@") ? (
      <span key={index} style={{ color: "var(--primary)", fontWeight: "var(--text-label-large--font-weight)" }}>
        {part}
      </span>
    ) : (
      part
    )
  );
}

export function CommentCard({
  author,
  content,
  timestamp,
  media,
  license,
  pending = false,
  edited = false,
  bundle,
  sensitive,
  depth = 0,
  replies = [],
  replyCount = 0,
  onOpenReplies,
  signedIn = true,
  taught = true,
  /* Off only where a surface deliberately carries no stance affordance —
     `PostCard`'s own prop, spelled here for the same reason it exists there.
     The change-histories round is the case: an opinion is held on the comment,
     never on one of its versions, so a chronicle of three versions drawing
     three opinion faces would be drawing one fact three times. */
  showStance = true,
  onCommit,
  onReply,
  onEdit,
  own = false,
  attach = false,
  targetLabel = "this comment",
  target,
  targetKind = "post",
  onOpenTarget,
  /* HOW THE COMMENT NAMES WHAT IT ANSWERS (the feed cards, ruled 2026-10-01).
     · "line" (the default) — the one-line `On …` pointer, where a comment is
       listed away from its thread: a profile's comments, a tag's page.
     · "thread" — the FEED's shape: the post as a head row (its own mark, its
       title, its author) and the comment hung under it on a connector rule,
       the way a reply hangs under what it answers. A comment is the one feed
       card whose meaning depends on something else, and this is the shape
       that says so before a word of it is read.
     `targetDetail` carries what the head row draws — { title, sub, cover }: a
     post's title over its author's handle, or a comment's author over its
     first words, `QuotedRow`'s rule — and `onOpenTarget` is its door. */
  targetShape = "line",
  targetDetail,
  /* A LONG COMMENT FOLDS WHERE IT IS RANKED (the closing batch, jakob
     2026-10-01: the caption's precedent). In the feed the words fold at
     `clampLines` with `More` under them, a text control that opens them in
     place and never navigates — the card itself is the door to the thread.
     A static render cannot measure, so the opener is offered on an estimate
     from the same tokens as `PostCard`'s: about half an em to the glyph at
     `body-medium`, so 51 characters to the card's line and 45 to the
     thread shape's, which hangs 44px in. Off by default: a thread, a
     profile's list and a tag's page draw the words whole, as before. */
  clampLines,
  /* THE CARD'S OWN DOOR (`PostCard`'s `onOpen`, the comment's twin). Where it
     is given, the comment's words are a door: in the feed, to its thread,
     scrolled to it. Everything with its own meaning keeps it — the head row
     opens the post, the author chip the person, the chips their tags. */
  onOpen,
  /* THE REPLY AS THE COMMENT GLYPH, in the feed card's third slot (opinion ·
     score · the kind's own act · share). The act is `onReply`'s; only its
     drawing changes from the thread's text button to `GlyphAction`. */
  replyGlyph = false,
  /* AN APPLICANT'S REPLY IS LOCKED, NOT GONE (jakob 2026-10-02; auth.md's
     locked look, the comment foot's twin): the text `Reply` stands at the
     disabled opacity and stays tappable, the tap answering `You can comment
     once you're in.` The value is the opacity itself — `var(--state-disabled)`
     — so a board's reader chip can pass it as a hole, exactly as the foot's
     `fieldOpacity`; it carries down to the replies, as `signedIn` does. */
  replyOpacity,
  /* SHARE CLOSES THE ROW where it is given — the feed card's — exactly as
     `PostCard`'s does. A thread passes none. */
  onShare,
  actions,
  menuItems = [],
  topics = [],
  references = 0,
  onOpenReferences,
  /* THE RECORD'S SKELETON, exactly as `PostCard` draws it (the change-histories
     round, 2026-09-23): redaction is record-granular, so the words, the
     pictures, the topics line and the license all go at once and the mark
     stands in their place — `true` for the default wording, or
     `RedactedContentProps` for the reason, the date and a note. The author,
     the timestamp and the thread position survive around it. Drawn for a
     removed VERSION in a comment's edit history, and for a removed comment in
     its thread (`CommentRemoved`), both wearing the mark a removed post
     wears. */
  redacted,
  /* THE SCORE, WHERE THE COMMENT IS RANKED (the feed-cards rework, 2026-10-01).
     A comment met in the feed reached the reader by the same paths a post does,
     so it wears the same figure the post card wears — `graph_3` and the number,
     second in the row after the opinion — and opens the same trace. A thread
     passes none: inside the sheet a comment stands by the thread's order, not
     by a rank. Additive: given none, the card renders exactly as before. */
  score,
  onOpenScore,
  /* THE DATA-NODE NAME its placer gives this card (design ⇄ impl seam 002),
     keyed by the author's handle — `PostCard`'s rule. Given one, it names the
     card's media too: `media`, `frame` per item, and a clip's `soundDisc`.
     Given none, the card renders exactly as before. */
  node,
  children,
}) {
  // Same rule as PostCard: the license is a rare read, so it arrives from the
  // menu rather than sitting on the comment, and it comes up in a sheet over
  // the thread rather than on the card. It rode the payload, so a redacted
  // record has none to show.
  const items = license && !redacted ? [...menuItems, { label: LICENSE_MENU_LABEL, onSelect: () => {} }] : menuItems;
  /* THE VEIL TAKES THE WHOLE BODY, words and pictures as one block. A comment
     has no title to leave outside it, so what carries the informed choice is
     the frame the card already wears — the author, the timestamp, the topics,
     and the opinion the reader can still give. */
  /* The thread shape needs its detail and its door; without either the card
     falls back to the line, so a half-specified head row never draws. */
  const shape = target && onOpenTarget && targetDetail ? targetShape : "line";
  const [unfolded, setUnfolded] = React.useState(false);
  const folds = Boolean(clampLines) && String(content ?? "").length > clampLines * (shape === "thread" ? 45 : 51);
  const words = (
    <p
      style={{
        margin: 0,
        fontSize: "var(--text-body-medium)",
        lineHeight: "var(--text-body-medium--line-height)",
        ...(folds && !unfolded ? { display: "-webkit-box", WebkitLineClamp: clampLines, WebkitBoxOrient: "vertical", overflow: "hidden" } : null),
      }}
    >
      {withMentions(content)}
    </p>
  );
  const opener = folds ? (
    <button
      type="button"
      aria-expanded={unfolded}
      onClick={() => setUnfolded((shown) => !shown)}
      className="cg-state cg-focus cg-hit"
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
      {unfolded ? "Less" : "More"}
    </button>
  ) : null;
  /* With a door (`onOpen`) the words are a link and the pictures take the
     same tap, `PostCard`'s rule for its media in the feed — one door, no
     control nested in another. Both carry `cg-door`, and the card takes the
     pressed layer across its whole surface while either is pressed
     (`PostCard`'s rule; readme §4, *Interaction states*). */
  const open = (event) => {
    event.preventDefault();
    onOpen();
  };
  const body = (
    <>
      {onOpen ? (
        <a href="#" onClick={open} className="cg-focus cg-door" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
          {words}
        </a>
      ) : (
        words
      )}
      {opener}
      {/* A comment is words first and its pictures join them (readme §13) —
          below the words, INSET at the card's medium rung rather than
          full-bleed, and capped at a comment-scale height: the media joins the
          words, it must not turn the comment into a post. Square is the
          comment scale's shape (readme §13, the reel round): a comment's
          pictures and clips fill it, display-cropped and centred, while the
          bytes travel uncropped; at most four ride one comment. */}
      {Array.isArray(media) && media.length > 0 && (onOpen ? (
        <div onClick={open} className="cg-door" data-node={node && "media"}>
          <MediaGallery items={media} ratio={media.length > 1 ? "square" : undefined} maxHeight="220px" node={node && "media"} />
        </div>
      ) : node ? (
        <div data-node="media">
          <MediaGallery items={media} ratio={media.length > 1 ? "square" : undefined} maxHeight="220px" node="media" />
        </div>
      ) : (
        <MediaGallery items={media} ratio={media.length > 1 ? "square" : undefined} maxHeight="220px" />
      ))}
    </>
  );
  const shown = redacted ? (
    <RedactedContent {...(redacted === true ? {} : redacted)} />
  ) : sensitive ? (
    <SensitiveVeil kind="compact" reason={sensitive.reason} source={sensitive.source}>
      {body}
    </SensitiveVeil>
  ) : (
    body
  );
  /* The comment's own part — who, what, its topics — drawn once, standing
     straight in the card or hung on the thread shape's connector. */
  const ownPart = (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
        {author && <ActorChip handle={author.handle} displayName={author.displayName} />}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flex: "none" }}>
          {timestamp && <span style={{ fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>{timestamp}</span>}
          <OverflowMenu items={items} ariaLabel="More on this comment" />
        </div>
      </div>
      {shown}
      {/* The same topics-and-citations line a post wears, one line —
          a comment is content like any other and signs the same acts. */}
      {!redacted && <TopicsLine topics={topics} references={references} onOpenReferences={onOpenReferences} />}
    </>
  );
  return (
    <li
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        marginLeft: `${Math.min(depth, MAX_INDENT_DEPTH) * 12}px`,
        listStyle: "none",
      }}
    >
      {/* `attach` squares the top-left corner so a row flag (TaggedRow) fuses
          with the card (jakob's review, the tag round). */}
      <Card style={attach ? { borderTopLeftRadius: 0 } : undefined} door={Boolean(onOpen)} node={node} nodeKey={node && author?.handle}>
        {/* The comment's TARGET pointer (jakob 2026-09-01): where a comment
            shows OUT of its thread — the profile's comments view, a search
            result — the card leads with what it answers, one line, one tap to
            get there. Inside the thread the sheet's post is the context, so
            thread surfaces simply pass no target. The glyph names the
            TARGET's kind (the semantic-atoms rule) — a post unless the
            comment answers something else. */}
        {target && onOpenTarget && shape === "line" && (
          <button
            type="button"
            onClick={onOpenTarget}
            className="cg-state cg-focus cg-hit"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              border: 0,
              background: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              color: "var(--text-secondary)",
              textAlign: "left",
              maxWidth: "100%",
              borderRadius: "var(--radius-small)",
            }}
          >
            <Icon name={targetKind === "post" ? "dynamic_feed" : NODE_GLYPHS[targetKind] ?? "dynamic_feed"} size={14} style={{ flex: "none" }} />
            <span
              style={{
                fontSize: "var(--text-label-small)",
                lineHeight: "var(--text-label-small--line-height)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              On {target}
            </span>
          </button>
        )}
        {shape === "thread" ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* THE HEAD ROW — its own door, to what it names (in the feed, the
                post's detail). Its mark sits on the card, so it takes the
                card's tile tone (`NodeMark`'s `onCard`). A REMOVED TARGET
                (`targetDetail.removed`) keeps its row: the payload went, so
                the mark keeps its space empty and the title's place reads the
                removal mark's line in the system's voice — `text-secondary`
                at the body's weight, the register `Deleted account` takes —
                over the author, who stays. The comment stays readable under
                it; a node is never deleted, and neither is what answers it. */}
            <button type="button" onClick={onOpenTarget} aria-label={`On ${target}`} className="cg-state cg-focus" style={{ ...TARGET_DOOR, display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <NodeMark kind={targetKind} src={targetDetail.cover} redacted={targetDetail.removed} onCard />
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span
                  style={{
                    fontSize: "var(--text-label-large)",
                    lineHeight: "var(--text-label-large--line-height)",
                    fontWeight: targetDetail.removed ? 400 : "var(--text-label-large--font-weight)",
                    ...(targetDetail.removed ? { color: "var(--text-secondary)" } : null),
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {targetDetail.title}
                </span>
                <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{targetDetail.sub}</span>
              </span>
            </button>
            {/* THE CONNECTOR. A rule down from the head's mark — centred on its
                32px tile — to the comment, which hangs inset beside it the way
                a reply hangs under what it answers. Hairline-quiet: it draws a
                relation, not a frame. */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--card-gap)", marginLeft: "15px", paddingLeft: "27px", paddingTop: "var(--space-3)", borderLeft: "2px solid var(--border-hairline)" }}>
              {ownPart}
            </div>
          </div>
        ) : (
          ownPart
        )}
        {edited && <EditedMarker />}
        {pending && <PendingMarker />}
        {/* One affordance row, as on PostCard: the opinion leads, everything else
            the comment grows lands beside it — and it spreads across the card
            the same way, every control on a 48px target (jakob's ruling, the
            geek round). */}
        {(showStance || score !== undefined || (signedIn && (onReply || (own && onEdit))) || onShare || actions) && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: "var(--space-2)", rowGap: "var(--space-1)", width: "100%" }}>
          {/* Owned by the shell — see PostCard. */}
          {showStance && <StanceControl targetLabel={targetLabel} bundle={bundle ?? undefined} signedIn={signedIn} taught={taught} onCommit={onCommit} />}
          {score !== undefined && (
            <ExplainableNumber glyph="graph" label="Feed score" value={score} onOpenDetail={onOpenScore ?? (() => {})} />
          )}
          {signedIn && onReply && replyGlyph && (
            <GlyphAction glyph="chat_bubble" label={author ? `Reply to @${author.handle}` : "Reply"} onPress={onReply} />
          )}
          {signedIn && onReply && !replyGlyph && (
            <Button variant="text" size="sm" onClick={onReply} style={replyOpacity !== undefined ? { opacity: replyOpacity } : undefined}>
              Reply
            </Button>
          )}
          {signedIn && own && onEdit && (
            <Button variant="text" size="sm" onClick={onEdit}>
              Edit
            </Button>
          )}
          {onShare && <ShareButton targetLabel={targetLabel} onShare={onShare} />}
          {actions}
        </div>
        )}
      </Card>
      {children}
      {/* The collapsed form: a short rule and the count, indented under the
          comment — the thread stays scannable and a reader opens only the
          branches they mean to read. */}
      {replyCount > 0 && replies.length === 0 && (
        <button
          type="button"
          onClick={onOpenReplies}
          className="cg-state cg-focus cg-hit"
          style={{
            alignSelf: "flex-start",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            border: 0,
            background: "none",
            padding: "4px 8px 4px 0",
            marginLeft: "28px",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-label-medium)",
            fontWeight: "var(--text-label-medium--font-weight)",
            color: "var(--text-secondary)",
          }}
        >
          <span aria-hidden="true" style={{ width: "24px", height: "1px", background: "var(--border-hairline)" }} />
          View {replyCount === 1 ? "1 reply" : `${replyCount} replies`}
        </button>
      )}
      {replies.length > 0 && (
        <ul style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", margin: 0, padding: 0 }}>
          {replies.map((reply) => (
            <CommentCard key={reply.id} {...reply} depth={depth + 1} signedIn={signedIn} replyOpacity={replyOpacity} />
          ))}
        </ul>
      )}
    </li>
  );
}
