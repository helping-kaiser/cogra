import React from "react";
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
      <span style={{ flex: "none", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
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
   changing it is a signed act and every earlier address stays witnessed. */

export function PayoutAddress({ address, label = "Payouts land at", onCopy, onChange, changeLabel = "Change", caption }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        borderRadius: "var(--radius-medium)",
        background: "var(--surface-card)",
        padding: "var(--space-3) var(--space-4)",
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
            aria-label="Copy the address"
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
        {onChange && (
          <button
            type="button"
            onClick={onChange}
            className="cg-state cg-focus cg-hit"
            style={{
              border: 0,
              background: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-label-large)",
              lineHeight: "var(--text-label-large--line-height)",
              fontWeight: "var(--text-label-large--font-weight)",
              letterSpacing: "var(--text-label-large--letter-spacing)",
              color: "var(--primary)",
              flex: "none",
            }}
          >
            {changeLabel}
          </button>
        )}
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
        <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
          {caption}
        </span>
      )}
    </div>
  );
}
