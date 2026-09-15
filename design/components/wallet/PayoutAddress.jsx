import React from "react";
import { InlineAction } from "../core/Button.jsx";
import { Icon } from "../navigation/Icon.jsx";

/* The at-rest form (round 3): ONE line near the top of the wallet — an entry
   point, not a checking surface, so this is the single place the address may
   shorten (head…tail). Tapping opens the full card, where the whole address,
   the copy, and Change live; the never-truncate rule holds everywhere
   checking happens. */
export function PayoutAddressRow({ address, onOpen }) {
  const short = address.length > 22 ? `${address.slice(0, 12)}…${address.slice(-6)}` : address;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="cg-state cg-focus"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        width: "100%",
        minHeight: "44px",
        border: 0,
        borderRadius: "var(--radius-medium)",
        background: "var(--surface-card)",
        padding: "var(--space-2) var(--space-4)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        color: "var(--on-surface)",
        textAlign: "left",
        boxSizing: "border-box",
      }}
    >
      <span style={{ flex: "none", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
        Payouts land at
      </span>
      <code style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {short}
      </code>
      <span style={{ flex: "none", display: "inline-flex", color: "var(--text-secondary)" }} aria-hidden="true">
        <Icon name="chevron_right" size={18} />
      </span>
    </button>
  );
}

/* The witnessed payout address (item 12 round 2): a proper HOME, not text
   thrown on the page — a quiet container with the label, the copy button,
   and Change as real affordances, the address whole inside. Mono, wrapped,
   never truncated: checking it against a wallet is the point of showing it.
   The address is the Registration guild-key field — public, actor-attributed;
   changing it is a signed act and every earlier address stays witnessed.

   IT IS THE HOUSE'S LONG-OPAQUE-STRING CARD (the invites round, 2026-09-15).
   The invite link wants exactly this and nothing else: a string no reader can
   check by eye, held whole rather than truncated, with a copy control and one
   inline act beside its name. Every part of the anatomy that could be
   wallet-specific was already a prop — `label`, `caption`, `changeLabel` — and
   the one that was not is now `copyLabel`, because a button announcing "Copy
   the address" over an invite link is the drawing lying to the only reader who
   depends on it. The default keeps the wallet's own word, so nothing there
   moves; a second kind of string passes its own.

   `bare` DROPS THE CONTAINER AND KEEPS THE ANATOMY, the shape `SettingsGroup`
   already has and for the same reason: a card on a surface of the card's own
   tonal rung is two containers saying one thing a few pixels apart. It is for
   the string that is a RESTATEMENT rather than a thing of its own — the invite
   code beneath the invite link it was cut from, the ask link inside the card
   that explains it. Only the fill and the inset go; the label, the copy
   control, the mono block and the caption are unchanged, because the reason
   they are shaped that way does not depend on what is behind them. */

export function PayoutAddress({ address, label = "Payouts land at", onCopy, copyLabel = "Copy the address", onChange, changeLabel = "Change", caption, bare = false }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        ...(bare
          ? null
          : {
              borderRadius: "var(--radius-medium)",
              background: "var(--surface-card)",
              padding: "var(--space-3) var(--space-4)",
            }),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span
          style={{
            flex: 1,
            fontSize: "var(--text-label-medium)",
            lineHeight: "var(--text-label-medium--line-height)",
            fontWeight: "var(--text-label-medium--font-weight)",
            letterSpacing: "var(--text-label-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </span>
        {onCopy && (
          <button
            type="button"
            aria-label={copyLabel}
            onClick={onCopy}
            className="cg-state cg-focus cg-hit"
            style={{
              width: "32px",
              height: "32px",
              display: "grid",
              placeItems: "center",
              border: 0,
              background: "none",
              borderRadius: "var(--radius-full)",
              color: "var(--text-secondary)",
              padding: 0,
              cursor: "pointer",
              flex: "none",
            }}
          >
            <Icon name="content_copy" size={18} />
          </button>
        )}
        {onChange && <InlineAction onClick={onChange}>{changeLabel}</InlineAction>}
      </div>
      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-body-small)",
          lineHeight: "var(--text-body-small--line-height)",
          overflowWrap: "anywhere",
          wordBreak: "break-all",
          color: "var(--on-surface)",
        }}
      >
        {address}
      </code>
      {caption && (
        <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }}>
          {caption}
        </span>
      )}
    </div>
  );
}
