import React from "react";
import { Card } from "../core/Card.jsx";
import { Button } from "../core/Button.jsx";
import { ActorChip } from "../people/ActorChip.jsx";
import { PendingMarker, EditedMarker } from "../honesty/PendingMarker.jsx";
import { LicenseTerms } from "../forms/LicenseChooser.jsx";
import { StanceControl } from "../stance/StanceControl.jsx";
import { OverflowMenu } from "./OverflowMenu.jsx";

/* The comment of design.md §6 — "author, body, timestamp, media, nested replies,
   stance control", in its top-level and nested variants. Extracted from
   `post-view.tsx` for the same reason as PostCard: it is the product's own
   "second surface" rule, and the recursion was previously inline.

   Nesting indents 12px per level up to three levels, then flattens — a thread
   that indents forever ends up a column one word wide. */

const MAX_INDENT_DEPTH = 3;

export function CommentCard({
  author,
  content,
  timestamp,
  license,
  pending = false,
  edited = false,
  bundle,
  depth = 0,
  replies = [],
  signedIn = true,
  taught = true,
  onCommit,
  onReply,
  onEdit,
  own = false,
  targetLabel = "this comment",
  actions,
  menuItems = [],
  children,
}) {
  // Same rule as PostCard: the licence is a rare read, so it arrives from the
  // menu rather than sitting on the comment.
  const [showLicense, setShowLicense] = React.useState(false);
  const items = license
    ? [{ label: showLicense ? "Hide licence" : "Licence terms", onSelect: () => setShowLicense((shown) => !shown) }, ...menuItems]
    : menuItems;
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
          {author && <ActorChip handle={author.handle} displayName={author.displayName} />}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flex: "none" }}>
            {timestamp && <span style={{ fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>{timestamp}</span>}
            <OverflowMenu items={items} ariaLabel="More on this comment" />
          </div>
        </div>
        <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>{content}</p>
        {license && showLicense && <LicenseTerms license={license} />}
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
