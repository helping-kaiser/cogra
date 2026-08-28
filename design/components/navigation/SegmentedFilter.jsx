import React from "react";

/* The segmented filter (backlog item 4).

   WHAT IT REPLACES. The chronicle filter swapped an outlined button for a filled
   one to show which view was on. That works for two options and stops working at
   three: the reader has to compare fills across a row to find the current one,
   and there is no boundary saying the options are alternatives to each other.

   THE RULE FOR WHICH CONTROL. Two to four short, mutually exclusive options that
   partition one list — a segmented filter. A set that COMBINES, or one that grows
   (the seven kinds of ranked content, an open list of topics) — chips, and where
   there are several such sets, the sheet they belong in is `FeedFilter`. Options
   that lead somewhere rather than filter — not this: that is navigation.

   EQUAL SEGMENTS. Every segment takes the same width, so the row reads as one
   control with a position in it rather than a line of differently sized buttons.
   Labels are one or two words for exactly this reason.

   Selection is COLOUR ONLY (`readme.md`, Interaction states): the selected segment
   takes `secondaryContainer` on `onSecondaryContainer`. No underline, no indicator
   pill, no weight change — `secondaryContainer` is already the system's "this one"
   and a second signal on top of it reads as two states.

   `primaryContainer` is not available here: a filter is not the loudest thing on
   any screen it appears on, and the stance knob has already spent it.

   DRAWN AT 32PX, border-box — the chips' rung, because this control lives among
   chips (the filter sheets) and a taller pill beside 32px chips read as swollen
   twice over (first at 48, then again at 40). The 48px hit minimum is a target
   rule, not a drawn height — the same drawn-vs-tapped split the chips keep. */

export function SegmentedFilter({ options = [], value, onChange, ariaLabel }) {
  if (options.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        height: "32px",
        boxSizing: "border-box",
        borderRadius: "var(--radius-full)",
        border: "1px solid var(--border-field)",
        overflow: "hidden",
        maxWidth: "100%",
        width: "fit-content",
      }}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange && onChange(option.value)}
            className="cg-state cg-focus cg-hit"
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 var(--space-4)",
              flex: "1 1 0",
              border: 0,
              borderLeft: index === 0 ? undefined : "1px solid var(--border-field)",
              background: selected ? "var(--secondary-container)" : "transparent",
              color: selected ? "var(--on-secondary-container)" : "var(--text-body)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-label-large)",
              lineHeight: "var(--text-label-large--line-height)",
              letterSpacing: "var(--text-label-large--letter-spacing)",
              fontWeight: "var(--text-label-large--font-weight)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
