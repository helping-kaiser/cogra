import React from "react";
import { BottomSheet } from "../core/BottomSheet.jsx";
import { Chip } from "../core/Chip.jsx";
import { Button } from "../core/Button.jsx";
import { FilterSection, OrderSection, FILTER_ORDER } from "./OrderSection.jsx";
import { HelpDot } from "../core/HelpDot.jsx";

/* The feed filter (backlog item 4, second pass; grown by item 19).

   WHAT THIS REPLACED. A three-segment row — Posts / Comments / Stances — which was
   wrong twice over: a stance is not a thing that gets ranked, and the real set is
   ten kinds that COMBINE. A segmented row cannot express a combination, so it
   was the wrong control for the job, not a badly drawn one. Sorting, forms of
   post, and what the feed also admits piled on top; none of it fits in a row of
   pills across the top of a screen.

   SO: A TRIGGER AND A SHEET. The trigger is one chip-shaped control that reads
   back the current view in a few words; everything else lives in a sheet a tap
   away. That is the whole point of the sheet (item 3) — the filter is not what the
   reader came for, and a feed that spends its top region on its own settings has
   less feed in it. The trigger sits on the right edge of the `CograBand` (ruled
   2026-08-28) and scrolls away and back with it. Search wears the same trigger
   under its field — the idiom is one.

   THE TRIGGER SPEAKS DEVIATIONS. At the default it says only the kinds; order
   and the seen toggle enter its words when flipped ("newest", "showing seen"),
   never when at rest. The filter you have forgotten about is the one that
   confuses you — the default is silence.

   NO GLYPH ON THE TRIGGER. There is no filter icon in the product's inlined set
   and §5 forbids drawing one, so the trigger says its state in words — which is
   better anyway: an icon cannot tell you that Newest is on.

   IT APPLIES LIVE. Every tap changes the feed behind the sheet, because nothing
   behind a sheet is inert and a filter with an Apply button makes the reader
   commit to a guess. `Reset` is the one action, and dismissal is not a decision.

   TURNING EVERYTHING OFF IS ALLOWED. The control never prevents a choice (§8):
   a feed admitting nothing shows the empty state, which says what is switched off
   and offers to switch it back — it is not refused at the chip. */

/* Every kind the network ranks — ONE list, shared by the feed and search
   (ruled 2026-08-28: parity, and the word is "Profiles" everywhere).

   THE VALUE IS THE RECORD'S WORD, THE LABEL IS THE SCREEN'S (the naming law,
   readme §13, the tag round). `topics` keys the kind the graph carries and
   `Tags` is what the reader is shown. The two never have to agree, and this
   list is the one place the difference is assigned. */
export const FEED_KINDS = [
  { value: "posts", label: "Posts" },
  { value: "comments", label: "Comments" },
  { value: "chats", label: "Chats" },
  { value: "messages", label: "Messages" },
  { value: "profiles", label: "Profiles" },
  { value: "proposals", label: "Proposals" },
  { value: "topics", label: "Tags" },
  { value: "items", label: "Items" },
  { value: "campaigns", label: "Campaigns" },
  { value: "offers", label: "Offers" },
];

export const FEED_FORMS = [
  { value: "text", label: "Text" },
  { value: "photos", label: "Photos" },
  { value: "video", label: "Video" },
];

export const FEED_ORDER = FILTER_ORDER;

export const FEED_ALSO = [
  { value: "sensitive", label: "Sensitive" },
  { value: "removed", label: "Removed" },
];

export const FEED_FILTER_DEFAULT = { kinds: ["posts"], forms: ["text", "photos", "video"], order: "ranked", seen: false, also: [] };

const labelOf = (set, value) => (set.find((entry) => entry.value === value) || {}).label;

/* THE BAND'S ROOM FOR THE TRIGGER. What overflows is a width, so the budget is
   one: 154px is what the `CograBand` actually leaves the pill's words. */
export const BAND_CEILING_PX = 154;

/* THE TRIGGER'S TYPE, MEASURED. Deciding what fits means measuring, and the
   summary is composed in the browser as well as in node's renderer — neither of
   which can open a TTF. So the font's advances ride along as data: per-character
   advance widths from `assets/fonts/figtree.ttf`, in font units, at the wght=500
   instance `--text-label-large` renders at. The file's own default instance is
   the Light 300 corner, which is narrower and would promise room that isn't
   there, so the table is instanced (avar + HVAR) rather than read off `hmtx`.

   `_build/report-summaries.mjs --print-metrics` writes this block; the same
   stage re-derives it from the font on every run and fails the pipeline if the
   two have drifted apart. One measurement, two readers. */
const TRIGGER_FONT_SIZE_PX = 14; // --text-label-large, 0.875rem
const TRIGGER_UNITS_PER_EM = 1000; // figtree.ttf, head.unitsPerEm
/* THE TRACKING TERM IS A MARGIN, NOT THE PAINT. The pill's words render at
   `letter-spacing: normal` — a form control's own UA rule drops the ground's
   tracking and the trigger sets none back — while the budget counts
   `--text-label-large`'s 0.00625rem per character anyway. A guard wants its
   error above what it guards: this term, plus the kerning an advance sum
   cannot see, holds the measurement ~1.7% wide of the real paint (checked
   against Chrome at wght 500), so a string the rule calls a fit is one. */
const TRIGGER_LETTER_SPACING_PX = 0.1;
const TRIGGER_ALPHABET =
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·";
const TRIGGER_ADVANCES = [
  244.27, 301.75, 345.07, 629.43, 560.98, 793.06, 644.58, 212.1, 360.07, 360.07,
  482.59, 625.73, 234.64, 414.27, 218.95, 400.67, 642.87, 415.73, 564.19, 547.03,
  624.31, 576.3, 569.46, 542.33, 613.57, 569.46, 266.11, 271.39, 625.73, 625.73,
  625.73, 506.31, 989.72, 686.94, 611.15, 721.87, 691.03, 590.99, 546.17, 755.53,
  750.85, 275.75, 524.94, 625.27, 524.47, 848.74, 773.71, 779.17, 585.77, 782.02,
  630.9, 612.13, 561.22, 706.42, 700.78, 966.63, 632.0, 616.1, 638.27, 329.19,
  400.67, 329.19, 559.07, 437.13, 232.81, 516.29, 588.59, 542.15, 588.31, 548.26,
  375.77, 591.17, 561.45, 240.07, 274.62, 499.69, 227.2, 856.76, 560.88, 580.15,
  593.59, 581.46, 349.24, 466.0, 384.34, 560.88, 530.08, 798.12, 492.14, 539.97,
  487.54, 387.73, 257.14, 387.73, 594.94, 256.01,
];
const TRIGGER_ADVANCE = new Map([...TRIGGER_ALPHABET].map((character, index) => [character, TRIGGER_ADVANCES[index]]));
const TRIGGER_ADVANCE_WIDEST = Math.max(...TRIGGER_ADVANCES);

/* A character the table doesn't carry measures as its widest one: an unfamiliar
   glyph makes the summary collapse a word early, never overflow the band. */
export function measureTriggerText(text) {
  let units = 0;
  let characters = 0;
  for (const character of text) {
    const advance = TRIGGER_ADVANCE.get(character);
    units += advance === undefined ? TRIGGER_ADVANCE_WIDEST : advance;
    characters += 1;
  }
  return (units / TRIGGER_UNITS_PER_EM) * TRIGGER_FONT_SIZE_PX + characters * TRIGGER_LETTER_SPACING_PX;
}

/* The trigger's own words, AND ITS BUDGET. The head spells one kind or counts
   them: alone, a kind says its name; past one, a count is more useful than a
   list the pill cannot finish. The exceptions matter more than the detail — a
   filter you have forgotten about is the one that confuses you — so they are
   spelled while they fit and collapse to a count of changes when they stop.

   THE BUDGET IS PIXELS. A character count cannot tell a wide word from a narrow
   one — "Campaigns · showing seen" and "Proposals · text + video" run the same
   24 characters and 20px apart, one of them past the band — and what overflows
   is a width. So the summary measures itself in the type it renders in and
   collapses at the real edge — which makes the budget self-enforcing: a longer
   label or a new kind cannot quietly push the pill past its room. "Far from the
   default" is the useful fact at that point; which four ways is what the sheet
   is for. */
export function feedFilterSummary(value = FEED_FILTER_DEFAULT, budgetPx = BAND_CEILING_PX) {
  const kinds = value.kinds || [];
  const forms = value.forms || [];
  const also = value.also || [];
  const head = kinds.length === 0 ? "Nothing" : kinds.length === 1 ? labelOf(FEED_KINDS, kinds[0]) : kinds.length + " kinds";
  const extras = [];
  if (forms.length > 0 && forms.length < FEED_FORMS.length) extras.push(forms.map((form) => labelOf(FEED_FORMS, form).toLowerCase()).join(" + "));
  if (value.order && value.order !== "ranked") extras.push(labelOf(FEED_ORDER, value.order).toLowerCase());
  if (value.seen === true) extras.push("showing seen");
  if (also.length > 0) extras.push("+ " + also.map((entry) => labelOf(FEED_ALSO, entry).toLowerCase()).join(", "));
  if (extras.length === 0) return head;
  const spelled = [head, ...extras].join(" · ");
  if (measureTriggerText(spelled) <= budgetPx) return spelled;
  return head + " · " + extras.length + (extras.length === 1 ? " change" : " changes");
}

/* The worded trigger alone — for surfaces that own their sheet (search draws
   its own, with its own kind semantics) but must wear the same pill. */
export function FilterTrigger({ reading, onOpen, expanded = false, ariaLabel = "What this shows" }) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={ariaLabel}
      onClick={onOpen}
      className="cg-state cg-focus cg-hit"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        maxWidth: "14rem",
        minWidth: 0,
        height: "32px",
        padding: "0 var(--space-3)",
        border: "1px solid var(--border-field)",
        borderRadius: "var(--radius-full)",
        background: "transparent",
        color: "var(--text-body)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-label-large)",
        fontWeight: "var(--text-label-large--font-weight)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {reading}
    </button>
  );
}

/* THE SHEET ALONE — for a surface that owns its trigger. `FilterTrigger` is
   already the half search takes; this is the other half, and the settings
   page is what asked for it: its Reading row IS the trigger, so the row opens
   this sheet directly and the filter is one control rather than two drawings
   of one.

   `lead` IS WHAT A TITLED SHEET SAYS FIRST. The feed's sheet needs no heading
   — the pill that opened it is a thumb away, still on screen — so its "?"
   sits in the corner the trigger left it in. A sheet that covers the surface
   it was opened from does need one, and `SheetTitle` already rules where the
   "?" goes then: on the heading's own row. The slot carries both, so the two
   readings differ where they must and nowhere else.

   `foot` IS THE OTHER HALF OF THAT DIFFERENCE. Over a feed the filter applies
   live and there is nothing to commit — the list behind it rearranges and the
   reader watches it happen. Over settings nothing reacts, so the choice is
   committed, and the sheet takes the Done row the license sheets take: a
   hairline, the reading, the button, inside the sheet's own inset.

   A SHEET WITH A FOOT OWNS ITS HEIGHT. Ten kinds and four sections already
   outrun 88% of the screen, so a commitment appended after them would sit
   below the fold — the one control that must always be reachable, reachable
   only by scrolling. So the sections scroll inside the sheet and the foot is
   pinned under them, which is the anatomy `BottomSheet`'s own `height` exists
   for. A sheet with no foot is sized by its content, exactly as before. */
export function FeedFilterSheet({ value = FEED_FILTER_DEFAULT, onChange, onHelp, open = false, onClose, ariaLabel = "What your feed shows", lead, foot }) {
  const set = (patch) => onChange && onChange({ ...value, ...patch });
  const toggle = (key, entry) => {
    const list = value[key] || [];
    set({ [key]: list.includes(entry) ? list.filter((item) => item !== entry) : [...list, entry] });
  };
  const postsish = (value.kinds || []).some((kind) => kind === "posts" || kind === "comments");

  const sections = (
    <>
      <FilterSection label="Kinds" hint="Everything that can reach your feed. Combine as many as you like.">
        {FEED_KINDS.map((kind) => (
          <Chip key={kind.value} label={kind.label} selected={(value.kinds || []).includes(kind.value)} onToggle={() => toggle("kinds", kind.value)} />
        ))}
      </FilterSection>
      <FilterSection label="Kinds of post" hint={postsish ? "Combine them: photos and video with no text posts is a legitimate feed." : "Applies once posts or comments are in."}>
        {FEED_FORMS.map((form) => (
          <Chip key={form.value} label={form.label} selected={(value.forms || []).includes(form.value)} onToggle={() => toggle("forms", form.value)} disabled={!postsish} />
        ))}
      </FilterSection>
      <OrderSection order={value.order} onOrder={(order) => set({ order })} seen={value.seen === true} onSeen={(seen) => set({ seen })} />
      <FilterSection label="Also show" hint="Sensitive content stays veiled until you tap it. A removed post keeps its place — author, time, and where it sat in the thread — never the content.">
        {FEED_ALSO.map((entry) => (
          <Chip key={entry.value} label={entry.label} selected={(value.also || []).includes(entry.value)} onToggle={() => toggle("also", entry.value)} />
        ))}
      </FilterSection>
      <div style={{ padding: "0 var(--space-6)" }}>
        <Button variant="text" size="sm" selfStart onClick={() => onChange && onChange(FEED_FILTER_DEFAULT)}>Reset</Button>
      </div>
    </>
  );

  return (
    /* Ten kinds plus four sections outgrow the sheet's 62% default — the
       filter opens taller so the whole control is present; it still scrolls
       on shorter screens. The sheet carries its own "?" (like the pads):
       the dialog explains the filter and names the settings default. */
    <BottomSheet open={open} onClose={onClose} ariaLabel={ariaLabel} {...(foot ? { height: "88%" } : { maxHeight: "88%" })}>
      {lead ?? (
        <div style={{ position: "absolute", top: "var(--space-1)", right: "var(--space-2)" }}>
          <HelpDot ariaLabel="How the filter works" onOpen={onHelp} />
        </div>
      )}
      {foot ? (
        <>
          {/* `Reset` ends the scroll rather than the sheet, and keeps a section's
              own gap between itself and the hairline below it. */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: "var(--space-4)" }}>{sections}</div>
          {foot}
        </>
      ) : (
        sections
      )}
    </BottomSheet>
  );
}

export function FeedFilter({ value = FEED_FILTER_DEFAULT, onChange, onHelp, defaultOpen = false, ariaLabel = "What your feed shows" }) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <>
      <FilterTrigger reading={feedFilterSummary(value)} onOpen={() => setOpen(true)} expanded={open} ariaLabel={ariaLabel} />
      <FeedFilterSheet value={value} onChange={onChange} onHelp={onHelp} open={open} onClose={() => setOpen(false)} ariaLabel={ariaLabel} />
    </>
  );
}
