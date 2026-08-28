import React from "react";
import { SegmentedFilter } from "./SegmentedFilter.jsx";
import { Checkbox } from "../forms/Checkbox.jsx";

/* The ordering section of a filter sheet — ruled identical on the feed and on
   search (backlog item 19, the search rulings): the one order that does not
   combine, and the seen toggle riding under it in the same section, because
   both answer "how is this list arranged".

   SEEN, PRECISELY. Seen means the card's impression entered the viewport —
   device-local, never signed, shared transiently with the viewer's chosen
   ranker. Default OFF (ruled 2026-08-28, flipping the search session's first
   call): what you've seen stays out until you ask for it back, so the box
   arrives unticked and "showing seen" is the deviation the trigger speaks.

   ONE SECTION CHROME. `FilterSection` is the sheet-section shape every filter
   sheet uses — label, an optional hint in the secondary colour, then the
   controls. The feed's sheet and the search sheet had each drawn their own;
   this is the one they now share. */

export const FILTER_ORDER = [
  { value: "ranked", label: "Ranked" },
  { value: "newest", label: "Newest" },
];

export function FilterSection({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", padding: "0 var(--space-6) var(--space-4)" }}>
      <span style={{ fontSize: "var(--text-label-large)", fontWeight: 500 }}>{label}</span>
      {hint && <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>{hint}</span>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>{children}</div>
    </div>
  );
}

export function OrderSection({ order = "ranked", onOrder, seen = false, onSeen }) {
  return (
    <FilterSection label="Order" hint="Ranked puts what's closest to you first — your view, no one else's. Newest ignores it and lists by time.">
      <SegmentedFilter ariaLabel="Order" options={FILTER_ORDER} value={order} onChange={onOrder} />
      <div style={{ flexBasis: "100%" }}>
        <Checkbox label="Show what you've already seen" checked={seen} onChange={onSeen} />
      </div>
    </FilterSection>
  );
}
