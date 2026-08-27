import React from "react";
import { Icon } from "./Icon.jsx";

/* The app's frame (design.md §6). Five slots left to right — feed, search, create
   post, wallet, profile — each arriving with the slice that builds its surface.
   The product ships THREE today (feed, the compose action, profile); pass `slots`
   to render the full five, which is where the bar is going and what any new
   layout should be checked against.

   The centre slot is the compose ACTION, not a destination — a deliberate
   deviation from M3's destinations-only navigation-bar guidance, accepted for the
   reach of the one gesture the product lives on. It wears `primaryContainer`, the
   one loud surface per screen.

   Every viewer gets the same shell: the bar shows for signed-in, applicant, and
   anonymous viewers alike, and a slot that needs an account asks on an anonymous
   tap rather than yanking the read away.

   64px short navigation bar on `surfaceContainer`, hairline `outlineVariant` top
   border, safe-area padding at the bottom. Selection shows in COLOUR
   (`onSurfaceVariant` → `onSurface`) and in the filled icon cut — never an
   indicator pill. */

const DEFAULT_SLOTS = ["feed", "compose", "profile"];
/** Where the bar is going, once search and wallet have surfaces. */
export const ALL_SLOTS = ["feed", "search", "compose", "wallet", "profile"];

/* The bar's labels. The discovery slot is keyed `search` (its route, its glyph)
   but READS "Explore": `design.md` §7 keeps implementation vocabulary off the
   screen, and "Explore" says what the reader is doing — discovery through the
   people they're connected to, rather than a global index. */
const LABELS = { feed: "Feed", search: "Explore", compose: "New post", wallet: "Wallet", profile: "Profile" };
const GLYPHS = { feed: "dynamic_feed", search: "search", wallet: "wallet" };

export function BottomNav({ active = "feed", slots = DEFAULT_SLOTS, onSelect, inline = false, glyphs }) {
  const item = {
    display: "flex",
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    gap: "var(--space-1)",
    padding: "8px 2px",
    background: "none",
    border: 0,
    borderRadius: "var(--radius-medium)",
    minWidth: 0,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-label-medium)",
    lineHeight: "var(--text-label-medium--line-height)",
    letterSpacing: "var(--text-label-medium--letter-spacing)",
    fontWeight: "var(--text-label-medium--font-weight)",
    textDecoration: "none",
    // Five labelled slots on a narrow phone: the label shortens rather than
    // wrapping to a second line, which would push the bar past 64px.
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  const tone = (selected) => (selected ? "var(--on-surface)" : "var(--text-secondary)");
  return (
    <nav
      aria-label="Main"
      style={{
        position: inline ? "relative" : "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        display: "flex",
        minHeight: "var(--bottom-bar-height)",
        borderTop: "1px solid var(--border-hairline)",
        background: "var(--surface-bar)",
        paddingBottom: inline ? 0 : "env(safe-area-inset-bottom)",
      }}
    >
      {slots.map((slot) => {
        const selected = active === slot;
        if (slot === "compose") {
          return (
            <button
              key={slot}
              type="button"
              aria-label={LABELS.compose}
              onClick={() => onSelect && onSelect(slot)}
              className="cg-state cg-focus"
              style={item}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "flex",
                  height: "40px",
                  width: "40px",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "var(--radius-full)",
                  background: "var(--surface-loud)",
                  color: "var(--on-surface-loud)",
                }}
              >
                <Icon name="add" />
              </span>
            </button>
          );
        }
        const resolved = { ...GLYPHS, ...glyphs };
        const glyph =
          slot === "profile" && resolved.profile === undefined
            ? selected
              ? "person"
              : "person_outline"
            : resolved[slot] ?? "person_outline";
        return (
          <button
            key={slot}
            type="button"
            aria-current={selected ? "page" : undefined}
            onClick={() => onSelect && onSelect(slot)}
            className="cg-state cg-focus"
            style={{ ...item, color: tone(selected) }}
          >
            <Icon name={glyph} />
            {LABELS[slot]}
          </button>
        );
      })}
    </nav>
  );
}
