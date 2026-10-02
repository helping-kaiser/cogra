import React from "react";
import { BottomSheet } from "../core/BottomSheet.jsx";
import { Chip } from "../core/Chip.jsx";
import { Button } from "../core/Button.jsx";
import { FilterSection, OrderSection, FILTER_ORDER } from "./OrderSection.jsx";
import { HelpDot } from "../core/HelpDot.jsx";

/* The feed filter (backlog item 4, second pass; grown by item 19).

   THE SET IS FOUR KINDS THAT COMBINE, and an opinion is not one of them: it is
   not a thing that gets ranked. A segmented row cannot express a combination, so
   it is the wrong control for this job, not a badly drawn one. Sorting, forms of
   post, and what the feed also admits pile on top; none of it fits in a row of
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

   THE DEFAULT IS THE READER'S (jakob 2026-10-02, pass C 10). Every feed
   starts from the reader's default: the app's own (`FEED_FILTER_DEFAULT`)
   until they set theirs in Settings, theirs from then on. The trigger speaks
   deviations from THAT default, and the sheet's `Reset` restores it. Getting
   back to CoGra's own default happens only in Settings, whose sheet is the one
   place `Reset` means the app's default. The boards draw a reader who never
   set one, so the two coincide on every one of them.

   NO GLYPH ON THE TRIGGER. There is no filter icon in the product's inlined set
   and §5 forbids drawing one, so the trigger says its state in words — which is
   better anyway: an icon cannot tell you that Newest is on.

   IT STAGES, AND `Done` COMMITS (the sheet law, readme §4, *Sheets*; jakob
   2026-10-01). Chips, the order, the seen toggle and the foot's `Reset` change
   the sheet and nothing else: the feed behind it is visual only and does not
   move.
   `Done` commits the staged filter and the feed re-queries ONCE; the scrim, a
   swipe down and Back discard it, and the feed is what it was. The reason is
   the ranker's: once it ships, every refetch runs the whole personalized
   ranking, so five taps must never mean five rankings.

   TURNING EVERYTHING OFF IS ALLOWED. The control never prevents a choice (§8):
   a feed admitting nothing shows the empty state, which says what is switched off
   and offers to switch it back — it is not refused at the chip. */

/* Every kind the network ranks — ONE list, shared by the feed and search
   (ruled 2026-08-28: parity, and the word is "Profiles" everywhere).

   THE VALUE IS THE RECORD'S WORD, THE LABEL IS THE SCREEN'S (the naming law,
   readme §13, the tag round). `topics` keys the kind the graph carries and
   `Tags` is what the reader is shown. The two never have to agree, and this
   list is the one place the difference is assigned.

   ONLY THE KINDS V1.0 SERVES (readme §13, the V1.0 scope cut, 2026-09-25). A
   kind list follows the staging rule — a door belongs to a slot, never to a
   list — so it shows served kinds and never a dead chip. A kind joins this
   list in the round that ships its surface, and because the list is one,
   the feed and search gain it together. */
export const FEED_KINDS = [
  { value: "posts", label: "Posts" },
  { value: "comments", label: "Comments" },
  { value: "profiles", label: "Profiles" },
  { value: "topics", label: "Tags" },
];

export const FEED_FORMS = [
  { value: "text", label: "Text" },
  { value: "photos", label: "Photos" },
  { value: "video", label: "Video" },
];

export const FEED_ORDER = FILTER_ORDER;

/* WHAT THE FEED ALSO ADMITS. `Sensitive` and `Removed` are off until asked
   for. `Still settling` is ON by default (jakob, 2026-10-01; readme §13, the
   V1.0 scope cut): content authored and not yet landed reaches the feed
   wearing its pending marker, which is the feed every reader has always had.
   Switched off, the feed keeps to what has landed — the landed-only view. Its
   label is the pending marker's own words, so the chip names exactly what it
   lets in. */
export const FEED_ALSO = [
  { value: "sensitive", label: "Sensitive" },
  { value: "removed", label: "Removed" },
  { value: "settling", label: "Still settling" },
];

export const FEED_FILTER_DEFAULT = { kinds: ["posts"], forms: ["text", "photos", "video"], order: "ranked", seen: false, also: ["settling"], topic: null };

/* The trigger's word for the one default-on chip switched off — a deviation,
   so the trigger speaks it, in the landed-only view's own terms. */
const SETTLED_ONLY = "settled only";

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
   one — "Comments · text + photos" and "Profiles · text + photos" run the same
   24 characters and 22px apart, one of them past the band — and what overflows
   is a width. So the summary measures itself in the type it renders in and
   collapses at the real edge — which makes the budget self-enforcing: a longer
   label or a new kind cannot quietly push the pill past its room. "Far from the
   default" is the useful fact at that point; which four ways is what the sheet
   is for.

   THE PILL SPEAKS DEVIATIONS FROM THE READER'S DEFAULT (jakob 2026-10-02, the
   fix-fix round's ruling 10), a deviation back toward the app's included,
   and it speaks the axis's STATE, never the direction (jakob 2026-10-02, the
   residue round's Q2): a state reads the same whichever default it departs
   from. The summary keys on the reader's default object; the function below
   is drawn against the app's, the one every drawn reader holds. The words,
   per axis (the back-deviations' new ones flagged for blessing, copy-voice
   *The filter pill's state words*):
   - kinds: the head, spoken always — one kind's name, `2 kinds`, `Nothing`;
   - forms: the forms it holds, `text + photos`; every form, `all forms`;
   - order: `newest`, `ranked`;
   - seen: `showing seen`; off, `hiding seen`;
   - also: a chip on past the default joins the `+` list (`+ sensitive`,
     `+ still settling`); `Sensitive` or `Removed` off under a default that
     admits it, `hiding sensitive`, `hiding removed`; `Still settling` off,
     `settled only`;
   - topic: the tag's own name. A default never holds one — the settings
     sheet draws no topic section — so it has no back word. */
export function feedFilterSummary(value = FEED_FILTER_DEFAULT, budgetPx = BAND_CEILING_PX) {
  const kinds = value.kinds || [];
  const forms = value.forms || [];
  const also = value.also ?? FEED_FILTER_DEFAULT.also;
  const head = kinds.length === 0 ? "Nothing" : kinds.length === 1 ? labelOf(FEED_KINDS, kinds[0]) : kinds.length === FEED_KINDS.length ? "All kinds" : kinds.length + " kinds";
  const extras = [];
  /* THE TOPIC LEADS THE EXTRAS, AND IT IS AN EXTRA (the topic round,
     2026-09-14). It leads because it is the loudest narrowing on the list — a
     reader who has one on wants to read it first — and it is an extra rather
     than the head because the head is the KINDS axis, spelling at most one kind
     by the collapse rule, and a topic is not a kind ("Tags" already is one, and
     means the Type as ranked content rather than a narrowing to it).

     THE HEAD IS ALSO THE HALF THAT CANNOT COLLAPSE, which is the load-bearing
     reason. A tag's name is the reader's, bounded only by the contract's 128
     ASCII bytes (hashtag.md §2), so a name the pill cannot hold has to be able
     to leave the pill — and the only thing that leaves is an extra. In the
     head, one long name would draw a summary nothing could shorten. */
  if (value.topic) extras.push(value.topic);
  if (forms.length > 0 && forms.length < FEED_FORMS.length) extras.push(forms.map((form) => labelOf(FEED_FORMS, form).toLowerCase()).join(" + "));
  if (value.order && value.order !== "ranked") extras.push(labelOf(FEED_ORDER, value.order).toLowerCase());
  if (value.seen === true) extras.push("showing seen");
  /* The also-group speaks deviations like every other axis: a chip switched ON
     past the default joins the `+` list, and the default-on chip switched OFF
     says so in its own words. */
  const added = also.filter((entry) => !FEED_FILTER_DEFAULT.also.includes(entry));
  if (added.length > 0) extras.push("+ " + added.map((entry) => labelOf(FEED_ALSO, entry).toLowerCase()).join(", "));
  if (!also.includes("settling")) extras.push(SETTLED_ONLY);
  if (extras.length === 0) return head;
  const spelled = [head, ...extras].join(" · ");
  if (measureTriggerText(spelled) <= budgetPx) return spelled;
  return head + " · " + extras.length + (extras.length === 1 ? " change" : " changes");
}

/* The worded trigger alone — for surfaces that own their sheet (search draws
   its own, with its own kind semantics) but must wear the same pill. */
export function FilterTrigger({ reading, onOpen, expanded = false, ariaLabel = "What this shows", node }) {
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
      data-node={node}
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

   `foot` IS THE COMMIT, AND EVERY FILTER SHEET HAS ONE (the sheet law). It is
   the Done row the license sheets take — a hairline, then `Reset` in the
   corner and `Done` at the end, inside the sheet's own inset — and
   `FilterFoot` draws it. `Reset` lives there and nowhere in the sections
   (jakob 2026-10-02): it stages the reader's default, and only `Done` commits.

   THE FIXED SECTIONS COME FIRST, THE TOPICS LAST (jakob 2026-10-02). The topic
   chips are the one section that grows — one per topic the reader holds for —
   so it closes the body, and a long list of them never pushes the kinds, the
   order or what else is admitted below the fold.

   A SHEET WITH A FOOT OWNS ITS HEIGHT. Four kinds and four sections already
   outrun 88% of the screen, so a commitment appended after them would sit
   below the fold — the one control that must always be reachable, reachable
   only by scrolling. So the sections scroll inside the sheet and the foot is
   pinned under them, which is the anatomy `BottomSheet`'s own `height` exists
   for. A sheet with no foot is sized by its content. */
export function FeedFilterSheet({ value = FEED_FILTER_DEFAULT, onChange, onHelp, open = false, onClose, ariaLabel = "What your feed shows", lead, foot, topics = [], onOpenTopics }) {
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
      {/* `Still settling` is the group's one chip on by default (`FEED_ALSO`):
          the default is the feed as it has always been, and off is the
          landed-only view. */}
      <FilterSection label="Also show" hint="Sensitive content stays veiled until you tap it. A removed post keeps its place — author, time, and where it sat in the thread — never the content.">
        {FEED_ALSO.map((entry) => (
          <Chip key={entry.value} label={entry.label} selected={(value.also || []).includes(entry.value)} onToggle={() => toggle("also", entry.value)} />
        ))}
      </FilterSection>
      {/* THE TOPIC FEED IS JUST ANOTHER FEED SETTING (jakob, 2026-09-14), so it
          is a section of this sheet and not a surface of its own. What it
          narrows to is one topic's feed: content reaching the viewer over Tag
          records toward that Type (hashtag.md §5), ranked by the same primitive
          as everything else.

          ONE AT A TIME, unlike the kinds. Every other axis here combines because
          combining is what those axes mean — three kinds admit three kinds. Two
          topics do not make a narrower feed, they make a wider one, which is the
          opposite of what a reader reaching for this wants; and the read itself
          is one Type's. So a second pick replaces the first, and tapping the
          held one clears it.

          ONLY THE ONES HELD *FOR* (jakob's predicate). Held is a netted bundle
          that is not (0, 0), and that includes a topic held AGAINST — a public
          record like any other, and listed as such on Your topics. It is absent
          here because an association below nothing is not something to read
          more of, and the hint says so rather than leaving a reader to wonder
          why one of their own topics is missing.

          AND THE DOOR OUT IS THE FULL LIST. This section holds what can narrow
          the feed; Your topics holds everything held, and the page a row opens
          is where a topic is walked back.

          LAST IN THE BODY, because it is the section that grows. */}
      {topics.length > 0 && (
        <FilterSection label="One topic" hint="Topics you hold and are for. A topic you hold against stays a record — it just never narrows a feed.">
          {topics.map((topic) => (
            <Chip
              key={topic}
              label={topic}
              selected={value.topic === topic}
              onToggle={() => set({ topic: value.topic === topic ? null : topic })}
            />
          ))}
          <div style={{ flexBasis: "100%" }}>
            <Button variant="text" size="sm" selfStart onClick={onOpenTopics}>All your topics</Button>
          </div>
        </FilterSection>
      )}
    </>
  );

  return (
    /* Four kinds plus four sections outgrow the sheet's 62% default — the
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
          {/* The last section keeps its own gap between itself and the
              hairline below it. */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: "var(--space-4)" }}>{sections}</div>
          {foot}
        </>
      ) : (
        sections
      )}
    </BottomSheet>
  );
}

/* The Done row every filter sheet ends on: a hairline, `Reset` in the corner,
   and the commit at the end (jakob 2026-10-02).

   NO READING OF THE STAGED FILTER. A read-back in the pill's words works for
   a change or two and cannot hold more — a reader who changed six things
   would need a second sheet to see them (jakob). The sections above are the
   staged filter, already in view.

   `Reset` STAGES, `Done` COMMITS. `Reset` puts the reader's default back into
   the sheet — the app's until they set their own in Settings, theirs after
   (pass C 10) — and nothing applies until `Done`, the sheet law's one commit.
   On the settings sheet the default being edited is the reader's own, so
   there `Reset` stages CoGra's default: the one place a reader gets back to
   it. Plain `Reset` (jakob, N3): the "?" is where a reader learns what it
   restores. A text button, the quiet half of the row; `Done` keeps its seat. */
export function FilterFoot({ onReset, onDone }) {
  return (
    <div style={{ padding: "0 var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", borderTop: "1px solid var(--border-hairline)", paddingTop: 10 }}>
        <Button variant="text" onClick={onReset}>Reset</Button>
        <span style={{ flex: 1 }} />
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

/* `value` is the COMMITTED filter — what the feed shows and the pill reads.
   The sheet works on a staged copy taken when it opens; `onChange` fires once,
   on Done, with the staged filter, and every other way out drops the copy.
   `readerDefault` is what the foot's `Reset` stages: the reader's own default,
   the app's until they set one in Settings. */
export function FeedFilter({ value = FEED_FILTER_DEFAULT, readerDefault = FEED_FILTER_DEFAULT, onChange, onHelp, defaultOpen = false, ariaLabel = "What your feed shows", topics = [], onOpenTopics, node }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [staged, setStaged] = React.useState(value);
  const openSheet = () => {
    setStaged(value);
    setOpen(true);
  };
  const commit = () => {
    setOpen(false);
    if (onChange) onChange(staged);
  };

  return (
    <>
      <FilterTrigger reading={feedFilterSummary(value)} onOpen={openSheet} expanded={open} ariaLabel={ariaLabel} node={node} />
      <FeedFilterSheet
        value={staged}
        onChange={setStaged}
        onHelp={onHelp}
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel={ariaLabel}
        topics={topics}
        onOpenTopics={onOpenTopics}
        foot={<FilterFoot onReset={() => setStaged(readerDefault)} onDone={commit} />}
      />
    </>
  );
}
