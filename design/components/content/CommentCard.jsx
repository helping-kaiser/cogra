import React from "react";
import { Card } from "../core/Card.jsx";
import { Button } from "../core/Button.jsx";
import { ActorChip } from "../people/ActorChip.jsx";
import { PendingMarker, EditedMarker } from "../honesty/PendingMarker.jsx";
import { LICENSE_MENU_LABEL } from "../forms/LicenseChooser.jsx";
import { StanceControl } from "../stance/StanceControl.jsx";
import { OverflowMenu } from "./OverflowMenu.jsx";
import { Icon, NODE_GLYPHS } from "../navigation/Icon.jsx";
import { TopicsLine } from "./TopicsLine.jsx";
import { MediaGallery } from "../media/MediaAttachment.jsx";
import { SensitiveVeil } from "../honesty/SensitiveVeil.jsx";

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
  onCommit,
  onReply,
  onEdit,
  own = false,
  targetLabel = "this comment",
  target,
  targetKind = "post",
  onOpenTarget,
  actions,
  menuItems = [],
  topics = [],
  references = 0,
  onOpenReferences,
  children,
}) {
  // Same rule as PostCard: the license is a rare read, so it arrives from the
  // menu rather than sitting on the comment, and it comes up in a sheet over
  // the thread rather than on the card.
  const items = license ? [{ label: LICENSE_MENU_LABEL, onSelect: () => {} }, ...menuItems] : menuItems;
  /* THE VEIL TAKES THE WHOLE BODY, words and pictures as one block. A comment
     has no title to leave outside it, so what carries the informed choice is
     the frame the card already wears — the author, the timestamp, the topics,
     and the stance the reader can still take. */
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
      <Card>
        {/* The comment's TARGET pointer (jakob 2026-09-01): where a comment
            shows OUT of its thread — the profile's comments view, a search
            result — the card leads with what it answers, one line, one tap to
            get there. Inside the thread the sheet's post is the context, so
            thread surfaces simply pass no target. The glyph names the
            TARGET's kind (the semantic-atoms rule) — a post unless the
            comment answers something else. */}
        {target && onOpenTarget && (
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
          {author && <ActorChip handle={author.handle} displayName={author.displayName} />}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flex: "none" }}>
            {timestamp && <span style={{ fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>{timestamp}</span>}
            <OverflowMenu items={items} ariaLabel="More on this comment" />
          </div>
        </div>
        {sensitive ? (
          <SensitiveVeil kind="compact" reason={sensitive.reason} source={sensitive.source}>
            {body}
          </SensitiveVeil>
        ) : (
          body
        )}
        {/* The same topics-and-citations line a post wears, one line, clipped —
            a comment is content like any other and signs the same acts. */}
        <TopicsLine topics={topics} references={references} onOpenReferences={onOpenReferences} />
        {edited && <EditedMarker />}
        {pending && <PendingMarker />}
        {/* One affordance row, as on PostCard: the stance leads, everything else
            the comment grows lands beside it. */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: "var(--space-2)", rowGap: "var(--space-1)" }}>
          {/* Owned by the shell — see PostCard. */}
          <StanceControl targetLabel={targetLabel} bundle={bundle ?? undefined} signedIn={signedIn} taught={taught} onCommit={onCommit} />
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
