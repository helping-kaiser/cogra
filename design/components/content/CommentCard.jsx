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
import { QuotedRow } from "../core/QuotedRow.jsx";
import { NodeMark } from "./ReferenceRow.jsx";

/* The comment of design.md §6 — "author, body, timestamp, media, nested replies,
   stance control", in its top-level and nested variants. Extracted from
   `post-view.tsx` for the same reason as PostCard: it is the product's own
   "second surface" rule, and the recursion was previously inline.

   THE THREAD IS TWO LEVELS DEEP ON SCREEN (readme §13, 2026-08-28): a comment,
   and its replies indented once. Anything deeper flattens into that one reply
   level and opens with the @handle it answers — the mention IS the structure,
   so the column never narrows to a word. Replies arrive COLLAPSED behind a
   "View n replies" line (`replyCount`); `replies` renders them expanded. */

const MAX_INDENT_DEPTH = 1;

/* The louder target shapes' door (option candidates, below): a bare button
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
  /* OPTION CANDIDATES — the feed-cards rework (2026-10-01), drawn only on the
     comment card's option board (`FeedCommentOptions`) for jakob to pick
     from; NO SCREEN WEARS THEM, and whichever he does not pick leaves the
     master. `targetShape` says how loudly the comment names what it answers:
     · "line" (the default, today's) — the one-line `On …` pointer.
     · "quote" — the thing answered held above the comment as `QuotedRow`
       holds it in a reply composer: its author's picture, its title and
       handle, its first words, on the quoted tone. Here it is a door.
     · "thread" — the post as a head row (its mark, its title, its author),
       and the comment hanging under it on a connector rule, the way a reply
       hangs under what it answers.
     `targetDetail` carries what the two louder shapes need — { title, author,
     snippet, authorSrc, cover }: the quote wears the author's picture, the
     head row the post's own mark — and `target`/`onOpenTarget` stay the
     door's label and its tap. */
  targetShape = "line",
  targetDetail,
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
     the timestamp and the thread position survive around it. First drawn for a
     removed VERSION in a comment's edit history, which wears the mark a
     removed post wears. */
  redacted,
  /* THE SCORE, WHERE THE COMMENT IS RANKED (the feed-cards rework, 2026-10-01).
     A comment met in the feed reached the reader by the same paths a post does,
     so it wears the same figure the post card wears — `graph_3` and the number,
     second in the row after the opinion — and opens the same trace. A thread
     passes none: inside the sheet a comment stands by the thread's order, not
     by a rank. Its spoken name is kind-neutral, because the figure is about the
     paths leading to the thing and not about the kind of thing it is (jakob).
     Additive: given none, the card renders exactly as before. */
  score,
  onOpenScore,
  scoreLabel = "Feed score",
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
  const body = (
    <>
      <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{withMentions(content)}</p>
      {/* A comment is words first and its pictures join them (readme §13) —
          below the words, INSET at the card's medium rung rather than
          full-bleed, and capped at a comment-scale height: the media joins the
          words, it must not turn the comment into a post. Comment pictures
          never crop (jakob 2026-08-31), so multiples share a fixed square frame
          and each whole frame fits inside it; at most four ride one comment. */}
      {Array.isArray(media) && media.length > 0 && (
        <MediaGallery items={media} ratio={media.length > 1 ? "square" : undefined} maxHeight="220px" />
      )}
    </>
  );
  /* An option shape needs its detail and its door; without either the card
     falls back to today's line, so a half-specified candidate never draws. */
  const shape = target && onOpenTarget && targetDetail ? targetShape : "line";
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
      {redacted ? (
        <RedactedContent {...(redacted === true ? {} : redacted)} />
      ) : sensitive ? (
        <SensitiveVeil kind="compact" reason={sensitive.reason} source={sensitive.source}>
          {body}
        </SensitiveVeil>
      ) : (
        body
      )}
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
      <Card style={attach ? { borderTopLeftRadius: 0 } : undefined}>
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
            className="cg-state cg-focus"
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
        {/* ON A CARD THE QUOTE TAKES A HAIRLINE. `QuotedRow`'s tone is the
            composer's contrast against the page; a card already stands on that
            tone, so here the box would vanish into it, and the outline is what
            keeps the quoted block contained. */}
        {shape === "quote" && (
          <button type="button" onClick={onOpenTarget} aria-label={`On ${target}`} className="cg-state cg-focus" style={{ ...TARGET_DOOR, border: "1px solid var(--border-hairline)", overflow: "hidden" }}>
            <QuotedRow title={targetDetail.title + " — @" + targetDetail.author.handle} snippet={targetDetail.snippet} name={targetDetail.author.displayName} src={targetDetail.authorSrc} />
          </button>
        )}
        {shape === "thread" ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <button type="button" onClick={onOpenTarget} aria-label={`On ${target}`} className="cg-state cg-focus" style={{ ...TARGET_DOOR, display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <NodeMark kind={targetKind} src={targetDetail.cover} />
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: "var(--text-label-large)", lineHeight: "var(--text-label-large--line-height)", fontWeight: "var(--text-label-large--font-weight)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{targetDetail.title}</span>
                <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>@{targetDetail.author.handle}</span>
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
        {(showStance || score !== undefined || (signedIn && (onReply || (own && onEdit))) || actions) && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: "var(--space-2)", rowGap: "var(--space-1)", width: "100%" }}>
          {/* Owned by the shell — see PostCard. */}
          {showStance && <StanceControl targetLabel={targetLabel} bundle={bundle ?? undefined} signedIn={signedIn} taught={taught} onCommit={onCommit} />}
          {score !== undefined && (
            <ExplainableNumber glyph="graph" label={scoreLabel} value={score} onOpenDetail={onOpenScore ?? (() => {})} />
          )}
          {signedIn && onReply && (
            <Button variant="text" size="sm" onClick={onReply}>
              Reply
            </Button>
          )}
          {signedIn && own && onEdit && (
            <Button variant="text" size="sm" onClick={onEdit}>
              Edit
            </Button>
          )}
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
            <CommentCard key={reply.id} {...reply} depth={depth + 1} signedIn={signedIn} />
          ))}
        </ul>
      )}
    </li>
  );
}
