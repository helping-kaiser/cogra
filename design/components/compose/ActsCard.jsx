import React from "react";
import { InlineAction, BUTTON_CLASS } from "../core/Button.jsx";
import { SR_ONLY } from "../stance/StanceReadout.jsx";
import { UploadErrorLine } from "./UploadNotice.jsx";

/* The seal's acts card (media slice, 2026-08-31 — extracted the moment a
   second seal needed it: the profile-picture seal joined the post's and the
   reply's). The container-highest card listing what one signature commits:
   one row per act kind — quiet label, the value, the count — and the total as
   the footer row. The all-or-nothing sentence, when a seal carries more than
   one act, belongs to the screen below the card, not in it.

   TWO ROW KINDS, and the difference is what the row IS. A row with a `value` is
   a fact: the value slot ends a long one in an ellipsis, because a signed act's
   name can run past the card and the row still has to hold one line. A row with
   an `action` is a control — what could still be added, lined up with what has
   been — and there the whole row is the button. Truncation belongs to the value
   slot alone: an action row has no slot to clip, so the 48px target the word
   promises reaches the row's own edges instead of being cut back to the ink.

   A FACT ROW IS A DOOR WHEN THE FACT IS A COLLECTION (`onOpen`, jakob's ruling
   2026-09-14, backlog item 70). One staged citation reads back as itself; two
   or more read back as their count, and the count is only honest if the reader
   can go and see what it counts. So the row keeps its three slots — label,
   value, count — and the whole row becomes the control, `PickedRow`'s rule for
   the picked pictures said for the acts card: no chevron, no trailing word,
   the accessible name saying what opens. It stays a FACT row and not an action
   row, because what it opens is what it already says.

   THE COUNT IS SEEN BARE AND HEARD WHOLE (jakob's ruling 2026-09-14, backlog
   item 73). A trailing "3" beside "References" is unambiguous to an eye that
   has the label in the same line, and meaningless to an ear that gets the
   number alone. So the digit is `aria-hidden` and a paired sr reading says
   "3 citations" — the system's own law that visual compression never strips
   the accessible reading, in `StanceReadout`'s `SR_ONLY` and no other way.

   THE NOUN COMES FROM THE BOARD, never from the label. The References row
   counts CITATIONS, and no rule could derive that word from "References"; the
   row that knows what it staged is the row that names it. `countNoun` is the
   singular and the card adds the regular plural.

   THE DOOR'S NAME CARRIES THE COUNT (jakob's ruling 2026-09-14, ruling 8). An
   `aria-label` REPLACES the box it names, so on a door row the reading above
   never reaches a listener at all: the digit is hidden, its paired reading
   sits inside the button, and `openLabel` speaks over both. A name that drops
   the number therefore costs a listener the very fact the row was drawn to
   carry. `openLabel` folds it in — "Manage the 3 citations", and at one
   "Manage the 1 citation" — and it comes from the board, which knows the
   count and the noun, the same place `countNoun` comes from and for the same
   reason. The plural is the regular one this card adds, said again in the
   board's own words because the bundle hands screens components and
   constants, never a card's helpers.

   A REFUSED ACT IS SAID ON ITS OWN ROW (jakob, the failure pack: the seal's
   faults speak `NetworkError`'s grammar). When the signing is refused because
   of one staged act — a cited post that never landed (jakob 2026-10-01) — the
   fault sits where that act is read back, not at the foot: the refused-file
   line's shape, `UploadErrorLine`, with the fact in the failure voice and
   `Remove it` as the only way out, because signing again cannot change the
   answer. It stands under the row's value, aligned with it, inside the row's
   own hairline, so the row still reads as one act. `fault` on a fact row. */

const ROW = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  minHeight: "44px",
  borderBottom: "1px solid var(--border-hairline)",
};

const LABEL = {
  flex: "none",
  width: "76px",
  fontSize: "var(--text-label-small)",
  lineHeight: "var(--text-label-small--line-height)",
  fontWeight: "var(--text-label-small--font-weight)",
  letterSpacing: "var(--text-label-small--letter-spacing)",
  color: "var(--text-secondary)",
};

const COUNT = {
  flex: "none",
  fontSize: "var(--text-label-small)",
  fontWeight: "var(--text-label-small--font-weight)",
  lineHeight: "var(--text-label-small--line-height)",
  letterSpacing: "var(--text-label-small--letter-spacing)",
  color: "var(--text-secondary)",
};

const VALUE = {
  flex: 1,
  minWidth: 0,
  fontSize: "var(--text-body-medium)",
  letterSpacing: "var(--text-body-medium--letter-spacing)",
  fontWeight: "var(--text-body-medium--font-weight)",
  lineHeight: "var(--text-body-medium--line-height)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/* The door's own box is the row's box: no border, no background, no padding,
   the page's ink — so the card reads as the card it always was and only the
   state layer, the focus ring and the 48px target arrive with `BUTTON_CLASS`. */
const DOOR = {
  /* `border: 0` leads, so the row's own hairline — spread in after it — is not
     wiped by the shorthand it would otherwise follow. */
  border: 0,
  ...ROW,
  width: "100%",
  background: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  color: "var(--on-surface)",
  textAlign: "left",
};

/* The count slot. Without a noun it is what it always was — an action row's
   "1 more" is already words, and says itself. */
function Count({ count, noun, node }) {
  if (!noun) return <span style={COUNT} data-node={node}>{count}</span>;
  return (
    <span style={COUNT} data-node={node}>
      <span aria-hidden="true">{count}</span>
      <span style={SR_ONLY}>{`${count} ${count === "1" ? noun : `${noun}s`}`}</span>
    </span>
  );
}

/* `node` is the data-node name its placer gives the card (seam 248). Given one,
   every row is an `actRow` keyed by its place in the card, counted from 1, with
   its `label`, `value` (an action row's `action`) and `count`; the closing
   line is `total` and its subline `note`. Given none, the card renders exactly
   as before. */
export function ActsCard({ rows = [], total, note, noteTone = "quiet", node }) {
  const named = (index) => (node ? { "data-node": "actRow", "data-node-key": String(index + 1) } : null);
  const part = (name) => node && name;
  /* A LINE SEPARATES, SO THE LAST ROW CARRIES NONE WHERE NOTHING FOLLOWS IT
     (jakob 2026-11-13, on `Edit · the actions`: "lines are seperators and
     there is nothing below it in this container to separate from"). With a
     total row the last act's hairline divides the acts from it; with none
     the card ends on its last act, unlined, over the card's own 4px. */
  const bare = !(total || note);
  const unlined = (index) => (bare && index === rows.length - 1 ? { borderBottom: 0 } : null);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--radius-medium)",
        background: "var(--surface-container-highest)",
        padding: "4px var(--space-4)",
      }}
      data-node={node}
    >
      {rows.map((row, index) =>
        row.action ? (
          <InlineAction key={index} size="sm" onClick={row.onAct} style={{ ...ROW, textAlign: "left", ...unlined(index) }} node={node && "actRow"} nodeKey={node && String(index + 1)}>
            <span style={LABEL} data-node={part("label")}>{row.label}</span>
            <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap" }} data-node={part("action")}>{row.action}</span>
            <Count count={row.count} noun={row.countNoun} node={part("count")} />
          </InlineAction>
        ) : row.onOpen ? (
          <button key={index} type="button" onClick={row.onOpen} aria-label={row.openLabel} className={BUTTON_CLASS} style={{ ...DOOR, ...unlined(index) }} {...named(index)}>
            <span style={LABEL} data-node={part("label")}>{row.label}</span>
            <span style={VALUE} data-node={part("value")}>{row.value}</span>
            <Count count={row.count} noun={row.countNoun} node={part("count")} />
          </button>
        ) : row.fault ? (
          <div key={index} style={{ borderBottom: ROW.borderBottom, paddingBottom: "var(--space-2)", ...unlined(index) }} {...named(index)}>
            <div style={{ ...ROW, borderBottom: 0 }}>
              <span style={LABEL} data-node={part("label")}>{row.label}</span>
              <span style={VALUE} data-node={part("value")}>{row.value}</span>
              <Count count={row.count} noun={row.countNoun} node={part("count")} />
            </div>
            <div style={{ paddingLeft: `calc(${LABEL.width} + var(--space-2))` }}>
              <UploadErrorLine message={row.fault.message} onRemove={row.fault.onRemove} />
            </div>
          </div>
        ) : (
          <div key={index} style={{ ...ROW, ...unlined(index) }} {...named(index)}>
            <span style={LABEL} data-node={part("label")}>{row.label}</span>
            <span style={VALUE} data-node={part("value")}>{row.value}</span>
            <Count count={row.count} noun={row.countNoun} node={part("count")} />
          </div>
        )
      )}
      {/* THE TOTAL'S ROW STANDS ONLY WHERE IT HAS SOMETHING TO SAY (jakob
          2026-11-13, on `Edit · the actions`: "looks like a line is missing").
          A sheet whose title carries the count passes no `total`, and with no
          note either the row would be 60px of nothing under the last act —
          so it is not drawn, and the card ends after its last row with its
          own 4px. */}
      {!bare && (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "2px", minHeight: "48px", padding: "6px 0" }}>
        <span
          data-node={part("total")}
          style={{
            fontSize: "var(--text-body-medium)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            lineHeight: "var(--text-body-medium--line-height)",
            fontWeight: "var(--text-label-large--font-weight)",
          }}
        >
          {total}
        </span>
        {/* The subline under the total. No surface draws one at rest — the
            seals' and the edit sheets' "?" (`How signing works`) says the
            all-or-nothing (jakob 2026-11-12). Past 5s
            of signing the slow line takes the place in the olive `--tertiary`
            (`noteTone="slow"`, jakob 2026-10-01): the wait said honestly in
            words, no progress the signing cannot measure. */}
        {note && (
          <span
            data-node={part("note")}
            role={noteTone === "slow" ? "status" : undefined}
            style={{
              fontSize: "var(--text-label-small)",
              fontWeight: "var(--text-label-small--font-weight)",
              lineHeight: "var(--text-label-small--line-height)",
              letterSpacing: "var(--text-label-small--letter-spacing)",
              color: noteTone === "slow" ? "var(--tertiary)" : "var(--text-secondary)",
            }}
          >
            {note}
          </span>
        )}
      </div>
      )}
    </div>
  );
}
