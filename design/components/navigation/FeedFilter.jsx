import React from "react";
import { BottomSheet } from "../core/BottomSheet.jsx";
import { Chip } from "../core/Chip.jsx";
import { Button } from "../core/Button.jsx";
import { FilterSection, OrderSection, FILTER_ORDER } from "./OrderSection.jsx";

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
   and the seen toggle enter its words when flipped ("newest", "hiding seen"),
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
   (ruled 2026-08-28: parity, and the word is "Profiles" everywhere). */
export const FEED_KINDS = [
  { value: "posts", label: "Posts" },
  { value: "comments", label: "Comments" },
  { value: "chats", label: "Chats" },
  { value: "messages", label: "Messages" },
  { value: "profiles", label: "Profiles" },
  { value: "proposals", label: "Proposals" },
  { value: "topics", label: "Topics" },
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

export const FEED_FILTER_DEFAULT = { kinds: ["posts"], forms: ["text", "photos", "video"], order: "ranked", seen: true, also: [] };

const labelOf = (set, value) => (set.find((entry) => entry.value === value) || {}).label;

/* The trigger's own words, AND ITS BUDGET. One kind names itself, two are worth
   spelling out, and past that a count is more useful than a truncated list. The
   exceptions matter more than the detail — a filter you have forgotten about is the
   one that confuses you — but four of them do not fit in a pill, and a pill that
   overflows has told the reader nothing.

   So the kinds always show, and everything else collapses to a count of changes
   once it stops fitting. "Far from the default" is the useful fact at that point;
   which four ways is what the sheet is for. */
export function feedFilterSummary(value = FEED_FILTER_DEFAULT, budget = 26) {
  const kinds = value.kinds || [];
  const forms = value.forms || [];
  const also = value.also || [];
  const head =
    kinds.length === 0
      ? "Nothing"
      : kinds.length <= 2
        ? kinds.map((kind, index) => (index === 0 ? labelOf(FEED_KINDS, kind) : labelOf(FEED_KINDS, kind).toLowerCase())).join(", ")
        : kinds.length + " kinds";
  const extras = [];
  if (forms.length > 0 && forms.length < FEED_FORMS.length) extras.push(forms.map((form) => labelOf(FEED_FORMS, form).toLowerCase()).join(" + "));
  if (value.order && value.order !== "ranked") extras.push(labelOf(FEED_ORDER, value.order).toLowerCase());
  if (value.seen === false) extras.push("hiding seen");
  if (also.length > 0) extras.push("+ " + also.map((entry) => labelOf(FEED_ALSO, entry).toLowerCase()).join(", "));
  if (extras.length === 0) return head;
  const spelled = [head, ...extras].join(" · ");
  if (spelled.length <= budget) return spelled;
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

export function FeedFilter({ value = FEED_FILTER_DEFAULT, onChange, defaultOpen = false, ariaLabel = "What your feed shows" }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const set = (patch) => onChange && onChange({ ...value, ...patch });
  const toggle = (key, entry) => {
    const list = value[key] || [];
    set({ [key]: list.includes(entry) ? list.filter((item) => item !== entry) : [...list, entry] });
  };
  const postsish = (value.kinds || []).some((kind) => kind === "posts" || kind === "comments");

  return (
    <>
      <FilterTrigger reading={feedFilterSummary(value)} onOpen={() => setOpen(true)} expanded={open} ariaLabel={ariaLabel} />
      {/* Ten kinds plus four sections outgrow the sheet's 62% default — the
          filter opens taller so the whole control is present; it still scrolls
          on shorter screens. */}
      <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel={ariaLabel} maxHeight="88%">
        <FilterSection label="What gets ranked" hint="Anything the network ranks can be in your feed. Combine as many as you like.">
          {FEED_KINDS.map((kind) => (
            <Chip key={kind.value} label={kind.label} selected={(value.kinds || []).includes(kind.value)} onToggle={() => toggle("kinds", kind.value)} />
          ))}
        </FilterSection>
        <FilterSection label="Kinds of post" hint={postsish ? "Combine them: photos and video with no text posts is a legitimate feed." : "Applies once posts or comments are in."}>
          {FEED_FORMS.map((form) => (
            <Chip key={form.value} label={form.label} selected={(value.forms || []).includes(form.value)} onToggle={() => toggle("forms", form.value)} disabled={!postsish} />
          ))}
        </FilterSection>
        <OrderSection order={value.order} onOrder={(order) => set({ order })} seen={value.seen !== false} onSeen={(seen) => set({ seen })} />
        <FilterSection label="Also show" hint="Sensitive content stays veiled until you tap it. A removed record shows its skeleton — author, time, and place in the thread — never the content.">
          {FEED_ALSO.map((entry) => (
            <Chip key={entry.value} label={entry.label} selected={(value.also || []).includes(entry.value)} onToggle={() => toggle("also", entry.value)} />
          ))}
        </FilterSection>
        <div style={{ padding: "0 var(--space-6)" }}>
          <Button variant="text" size="sm" selfStart onClick={() => onChange && onChange(FEED_FILTER_DEFAULT)}>Reset</Button>
        </div>
      </BottomSheet>
    </>
  );
}
