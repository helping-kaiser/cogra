import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { QuietNote } from "./QuietNote.jsx";

/* THE SETTINGS ROW AND ITS GROUP (the settings round) — one anatomy every
   setting follows, so a page of them reads as a page rather than as a stack of
   cards that each invented a layout.

   THE GROUP IS THE UNIT, not the row. A caption names it, a filled card holds
   its rows, and a footnote under the card carries whatever the group has to
   explain. That split is what keeps a row short: the row says what this setting
   is and where it stands, the footnote says the thing the reader needs once and
   never again. A sentence of explanation inside every row is how a settings
   page becomes a wall.

   THE CAPTION IS A REAL HEADING drawn quietly — `title-small` on
   `text-secondary`, sentence case, sitting above the card rather than inside
   it. `SectionLabel` is deliberately not reused: it says a surface whose
   sections need real headings has outgrown it, and this one has — these
   sections are the page's structure and an assistive reader navigates by them.

   ROWS ARE SEPARATED BY A HAIRLINE, INSET TO THE ROW'S OWN PADDING, and never
   after the last. Inside one container the rows need a boundary; between
   containers the gap already is one. The inset is what says the line divides
   rows rather than cutting the card.

   THE TRAILING EDGE IS THE VARIANT, and there are four:

   - a SWITCH, for something that is on or off and takes effect the moment it is
     pressed. The whole row is the switch — the label is its label, so the row
     is one target announced once, and the knob moves as well as changing
     colour, because colour alone is not a state.
   - a VALUE and a chevron, for a choice made somewhere else. The value is the
     current answer in the reader's own words and the chevron means one thing
     only: this opens another surface. A row that shows a value and opens
     nothing is a fact, not a setting.
   - a chevron ALONE, for a row that only goes somewhere.
   - a NODE, for a row that carries its own control — the sessions list, whose
     rows are things with an action each rather than settings. Such a row is
     `inert`: the row is not the target, the word at its end is.

   A ROW MAY ALSO BE A CHOICE — `selected` draws the leading radio one of a
   group wears. The dot is `ComposeLicense`'s, to the pixel, so the license
   sheet and a settings choice are visibly the same question asked twice.

   THE SECOND LINE SHOWS STATUS, NOT DESCRIPTION. "Last used 2 days ago" earns
   its line; "lets you choose how you take a stance" restates the label. The
   exception is a switch, where the line has to say what turning it on does,
   because the label alone cannot.

   A `bare` GROUP DROPS THE CARD, for the one case that earns it: a group whose
   whole content is a control that draws its own container. A segmented pill
   inside a filled card is a bordered box on a filled surface — two containers
   saying the same thing a few pixels apart. Only the fill goes: the heading and
   the footnote keep their inset, so a page of groups keeps one left edge for
   its words and another for its containers.

   AN ACTION ROW IS A ROW, NOT A BUTTON DROPPED IN A CARD. `action` puts the
   label on `primary` and drops the chevron: Sign out, Sign out everywhere else.
   It is not `error`-coloured — `error` is for failure only (readme §4), and
   leaving is not a failure. */

const LABEL_TYPE = {
  fontSize: "var(--text-label-large)",
  lineHeight: "var(--text-label-large--line-height)",
  fontWeight: "var(--text-label-large--font-weight)",
  letterSpacing: "var(--text-label-large--letter-spacing)",
};

const STATUS_TYPE = {
  fontSize: "var(--text-body-small)",
  lineHeight: "var(--text-body-small--line-height)",
  letterSpacing: "var(--text-body-small--letter-spacing)",
  color: "var(--text-secondary)",
};

const VALUE_TYPE = {
  fontSize: "var(--text-body-medium)",
  lineHeight: "var(--text-body-medium--line-height)",
  letterSpacing: "var(--text-body-medium--letter-spacing)",
  color: "var(--text-secondary)",
};

/* The house switch. Drawn once on the sensitive sheet and a component from the
   moment a second surface wanted one — the system's own rule about a piece
   appearing twice. 44×24 with an 18px knob, the sheet's geometry kept: M3's
   52×32 track carries a 2px outline, and §4 rules that nothing in this system
   does. Off is the hairline `outline` a pressable control wears; on is
   `primary`, and the knob travels, so the state is never colour alone. */
export function Switch({ checked = false, ariaLabel, onChange, decorative = false }) {
  const Tag = decorative ? "span" : "button";
  return (
    <Tag
      type={decorative ? undefined : "button"}
      role={decorative ? undefined : "switch"}
      aria-checked={decorative ? undefined : checked ? "true" : "false"}
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={decorative ? "true" : undefined}
      onClick={decorative ? undefined : onChange}
      className={decorative ? undefined : "cg-state cg-focus cg-hit"}
      style={{
        position: "relative",
        width: 44,
        height: 24,
        flex: "none",
        border: checked ? 0 : "1px solid var(--border-field)",
        boxSizing: checked ? undefined : "border-box",
        padding: 0,
        borderRadius: "var(--radius-full)",
        background: checked ? "var(--primary)" : "transparent",
        cursor: decorative ? undefined : "pointer",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          [checked ? "right" : "left"]: 3,
          top: 3,
          width: 18,
          height: 18,
          borderRadius: "var(--radius-full)",
          background: checked ? "var(--on-primary)" : "var(--border-field)",
        }}
      />
    </Tag>
  );
}

/* The choice dot — `ComposeLicense`'s radio, drawn from the same values so the
   two surfaces cannot drift. */
function ChoiceDot({ selected }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 18,
        height: 18,
        flex: "none",
        boxSizing: "border-box",
        borderRadius: "var(--radius-full)",
        border: selected ? "5px solid var(--primary)" : "1px solid var(--border-field)",
      }}
    />
  );
}

const ROW_BOX = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
  width: "100%",
  minHeight: 56,
  padding: "var(--space-2) var(--space-4)",
  boxSizing: "border-box",
  border: 0,
  background: "transparent",
  textAlign: "left",
  fontFamily: "var(--font-sans)",
  color: "var(--on-surface)",
};

export function SettingsRow({
  label,
  status,
  value,
  trailing,
  checked,
  selected,
  name,
  action = false,
  chevron,
  inert = false,
  onOpen,
}) {
  const isSwitch = checked !== undefined;
  const isChoice = selected !== undefined;
  const showChevron = chevron ?? (!isSwitch && !isChoice && !action && !trailing && !inert);
  const words = (
    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ ...LABEL_TYPE, color: action ? "var(--primary)" : undefined }}>{label}</span>
      {status && (
        <span style={{ ...STATUS_TYPE, overflow: "hidden", textOverflow: "ellipsis" }}>{status}</span>
      )}
    </span>
  );
  const tail = (
    <>
      {value !== undefined && <span style={{ ...VALUE_TYPE, flex: "none" }}>{value}</span>}
      {trailing}
      {isSwitch && <Switch checked={checked} decorative />}
      {showChevron && (
        <span aria-hidden="true" style={{ flex: "none", display: "inline-flex", color: "var(--text-secondary)" }}>
          <Icon name="chevron_right" size={18} />
        </span>
      )}
    </>
  );

  /* A choice row is a real radio with the drawn dot beside it, the way
     `Checkbox` and the license sheet build theirs: the input carries the
     semantics and the group, the label carries the words and the target. */
  if (isChoice) {
    return (
      <label className="cg-state cg-focus" style={{ ...ROW_BOX, position: "relative", cursor: "pointer" }}>
        <input
          type="radio"
          name={name}
          defaultChecked={selected}
          style={{ position: "absolute", opacity: 0, width: "1px", height: "1px", margin: 0 }}
        />
        <ChoiceDot selected={selected} />
        {words}
      </label>
    );
  }

  if (isSwitch) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked ? "true" : "false"}
        onClick={onOpen}
        className="cg-state cg-focus"
        style={{ ...ROW_BOX, position: "relative", cursor: "pointer" }}
      >
        {words}
        {tail}
      </button>
    );
  }

  if (inert) {
    return (
      <div style={{ ...ROW_BOX, position: "relative" }}>
        {words}
        {tail}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="cg-state cg-focus"
      style={{ ...ROW_BOX, position: "relative", cursor: "pointer" }}
    >
      {words}
      {tail}
    </button>
  );
}

export function SettingsGroup({ label, footnote, children, ariaLabel, bare = false }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <section aria-label={label ? undefined : ariaLabel} style={{ display: "flex", flexDirection: "column" }}>
      {label && (
        <h2
          style={{
            margin: "0 0 8px",
            padding: "0 var(--space-4)",
            fontSize: "var(--text-title-small)",
            lineHeight: "var(--text-title-small--line-height)",
            fontWeight: "var(--text-title-small--font-weight)",
            letterSpacing: "var(--text-title-small--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </h2>
      )}
      <div
        style={
          bare
            ? { display: "flex", flexDirection: "column" }
            : {
                display: "flex",
                flexDirection: "column",
                borderRadius: "var(--radius-medium)",
                background: "var(--surface-card)",
                color: "var(--on-surface)",
                overflow: "hidden",
              }
        }
      >
        {rows.map((row, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <div
                aria-hidden="true"
                style={{ height: 1, marginLeft: "var(--space-4)", background: "var(--border-hairline)" }}
              />
            )}
            {row}
          </React.Fragment>
        ))}
      </div>
      {footnote && (
        <div style={{ padding: "8px var(--space-4) 0" }}>
          <QuietNote>{footnote}</QuietNote>
        </div>
      )}
    </section>
  );
}
