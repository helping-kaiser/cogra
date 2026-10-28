"use client";

// THE FEED FILTER SHEET (design/components/navigation/FeedFilter.jsx
// `FeedFilterSheet`, `FeedPeopleRows`; FeedSheet.md, SettingsReading.md): the
// whole filter — four kinds that combine, forms of post, the one order with
// the seen toggle, what else is admitted, whose people, and the one topic
// that does not combine — with `Reset` and `Done` in its foot.
//
// ONE SHEET, TWO HOSTS. The feed opens it from the band's trigger; Settings'
// What your feed shows row opens it to set the reader's default, titled,
// with no topic section (a default never holds one). The sections, hints and
// foot are the same on both (SettingsReading.md: "the sheet is the feed's own
// filter sheet, its sections and hints the feed's"); only the host decides
// what `Reset` stages and what `Done` does.
//
// IT STAGES, AND ONLY THE HOST COMMITS (the sheet law, readme §4, *Sheets*):
// every control here changes the staged value the host holds, and nothing
// behind the sheet moves. The scrim, a swipe down, Back and Escape close it
// through `onClose`, which the host reads as "drop what is staged".
//
// IT STANDS AT 88% WITH ITS FOOT PINNED (FeedSheet.md:3; SettingsReading.md):
// four kinds and four sections outrun the sheet, so the sections scroll and
// the one control that must always be reachable stays under them.

import { Fragment } from "react";

import {
  FEED_ALSO,
  FEED_FORMS,
  FEED_KINDS,
  FEED_ORDERS,
  FEED_PEOPLE_SIGN,
  toggled,
  type FeedFilterValue,
  type FeedTopic,
} from "@/lib/feed/feed-filter";
import type { FeedPeople, FeedPeopleSign } from "@/lib/feed/derive";
import { Button } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { BottomSheet } from "./bottom-sheet";
import { Chip } from "./chip";
import { FilterFoot, FilterSection, OrderSection } from "./filter-sheet";
import { HelpDot } from "./help-dot";
import { QuietNote } from "./quiet-note";

/** The sheet's accessible name, and the trigger's purpose (copy-voice *Reading*). */
export const WHAT_YOUR_FEED_SHOWS = "What your feed shows";

/** The "?"'s name: the dialog it opens (copy-voice, *A "?" is named by the dialog it opens*). */
export const HOW_THE_FILTER_WORKS = "How the filter works";

/** The settings sheet's note under its title (SettingsReading.jsx; copy-voice *Reading*). */
export const EVERY_FEED_STARTS_FROM_THIS = "Every feed starts from this.";

const KINDS_HINT = "Everything that can reach your feed. Combine as many as you like.";
const FORMS_HINT_ON = "Combine them: photos and video with no text posts is a legitimate feed.";
const FORMS_HINT_OFF = "Applies once posts or comments are in.";
const ALSO_HINT = "How sensitive content is veiled is set in Settings.";
const PEOPLE_HINT = "Whose things reach this feed.";
const TOPIC_LABEL = "One topic";
const ALL_YOUR_TOPICS = "All your topics";

/**
 * Whose words the people rows, the order hint and the topic hint speak in:
 * the reader's own, or — on a feed that borrows a view — the borrowed
 * account's (FeedSheet.md, "GIVEN the feed borrows a view"). Show what
 * you've already seen, the kinds, the forms, Also show, Reset and the "?"
 * keep the reader's own first person either way.
 */
export function viewWords(borrowedHandle: string | null) {
  if (borrowedHandle === null) {
    return {
      yourPeople: "Your people",
      everyoneHint: "The whole feed, as far as your eyes reach.",
      yourPeopleHint: "Only the people you hold an opinion of — the same rank, narrowed to them.",
      signName: "Which of your people",
      orderHint:
        "Ranked puts what's closest to you first — your view, no one else's. Newest ignores it and lists by time.",
      topicHint: "Topics you hold and are for. A topic you hold against stays a record — it just never narrows a feed.",
    };
  }
  const at = `@${borrowedHandle}`;
  return {
    yourPeople: `${at}'s people`,
    everyoneHint: `The whole feed, as far as ${at}'s eyes reach.`,
    yourPeopleHint: `Only the people ${at} holds an opinion of — the same rank, narrowed to them.`,
    signName: `Which of ${at}'s people`,
    orderHint: `Ranked puts what's closest to ${at} first — the view you're browsing from. Newest ignores it and lists by time.`,
    topicHint: `Topics ${at} holds and is for. A topic ${at} holds against stays a record — it just never narrows a feed.`,
  };
}

/**
 * THE PEOPLE SECTION'S BODY (`FeedPeopleRows`): Everyone and Your people as
 * ROWS — the license sheets' radio-row anatomy, never a segmented pill — and,
 * under Your people while it is on, the sign as ONE LINE OF THREE WORDS,
 * `For · Against · Either`, the chosen word in primary ink and at the label's
 * weight, so the choice never rests on colour alone (WCAG 1.4.1). Choosing
 * Everyone hides the sign row and keeps its word (FeedSheet.md:27).
 *
 * The rows are keyed by the state the section draws (`everyone`,
 * `your-people`) — the registry keys these paths by the board's `people`
 * chip, one drawing per value (nodes.json SettingsReading `keys`).
 */
function PeopleRows({
  people,
  sign,
  onPeople,
  onSign,
  node,
  borrowedHandle,
  radioName,
}: {
  people: FeedPeople;
  sign: FeedPeopleSign;
  onPeople: (people: FeedPeople) => void;
  onSign: (sign: FeedPeopleSign) => void;
  node?: DataNode;
  borrowedHandle: string | null;
  radioName: string;
}) {
  const words = viewWords(borrowedHandle);
  const state = people === "everyone" ? "everyone" : "your-people";
  const rows: readonly { value: FeedPeople; tail: string; label: string; hint: string }[] = [
    { value: "everyone", tail: "everyone", label: "Everyone", hint: words.everyoneHint },
    { value: "yourPeople", tail: "yourPeople", label: words.yourPeople, hint: words.yourPeopleHint },
  ];
  const keyed = (tail: string): DataNode | undefined =>
    node === undefined ? undefined : { path: `${node.path}.${tail}`, key: state };
  // ONE BLOCK, AS THE BOARD DRAWS IT (`_shared.jsx` PeopleCopies wraps the
  // rows and the sign row in one box): the sign row stands 6px under the rows,
  // never the section's 8px chip gap plus its own 6.
  return (
    <div className="basis-full">
      <div role="radiogroup" aria-label="People" className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const chosen = people === row.value;
          const rowNode = keyed(row.tail);
          return (
            <label
              key={row.value}
              {...testAttributes(rowNode)}
              className="cg-state cg-focus relative flex min-h-6 cursor-pointer items-start gap-2.5 rounded-small"
            >
              <input
                type="radio"
                name={radioName}
                checked={chosen}
                onChange={() => onPeople(row.value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                {...testAttributes(part(rowNode, "dot"))}
                className={`mt-px box-border size-[18px] flex-none rounded-full border ${
                  chosen ? "border-[5px] border-primary" : "border-outline"
                }`}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span {...testAttributes(part(rowNode, "label"))} className="text-body-medium">
                  {row.label}
                </span>
                <span {...testAttributes(part(rowNode, "hint"))} className="text-body-small text-on-surface-variant">
                  {row.hint}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {people === "yourPeople" && (
        <div
          role="radiogroup"
          aria-label={words.signName}
          {...testAttributes(keyed("sign"))}
          // Aligned with the rows' words, past the dot's column (18 + 10), and
          // 14px under the row above so each word's 48px target grows
          // invisibly without reaching it (ruling 92).
          className="mt-1.5 flex basis-full items-center gap-1.5 whitespace-nowrap pl-7 text-body-medium"
        >
          {FEED_PEOPLE_SIGN.map((option, index) => {
            const chosen = sign === option.value;
            return (
              <Fragment key={option.value}>
                {index > 0 && (
                  <span aria-hidden="true" className="text-on-surface-variant">
                    ·
                  </span>
                )}
                <label
                  {...testAttributes(keyed(`sign.${option.value}`))}
                  className={`cg-state cg-focus cg-hit relative cursor-pointer rounded-small ${
                    chosen ? "text-primary" : "text-on-surface-variant"
                  }`}
                  // The chosen word sits at the label's weight (FeedFilter.jsx: 500).
                  style={{ fontWeight: chosen ? 500 : 400 }}
                >
                  <input
                    type="radio"
                    name={`${radioName}-sign`}
                    checked={chosen}
                    onChange={() => onSign(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FeedFilterSheet({
  open,
  staged,
  onStage,
  onReset,
  onDone,
  onClose,
  onHelp,
  topics = [],
  onOpenTopics,
  borrowedHandle = null,
  titled = false,
  node,
  testId,
}: {
  open: boolean;
  /** The staged filter — the sheet draws it and nothing else. */
  staged: FeedFilterValue;
  onStage: (next: FeedFilterValue) => void;
  /** Stages the host's default: the reader's on a feed, CoGra's in Settings. */
  onReset: () => void;
  onDone: () => void;
  /** The scrim, a swipe down, Back or Escape: the host drops what is staged. */
  onClose: () => void;
  onHelp: () => void;
  /** The topics the reader holds and is for; none draws no topic section. */
  topics?: readonly FeedTopic[];
  /** `All your topics`, the door to everything held; absent stands it inert. */
  onOpenTopics?: () => void;
  borrowedHandle?: string | null;
  /**
   * The settings host's reading: titled `What your feed shows` with its "?"
   * on the title's row and the note under it, focus on the title at opening
   * (SettingsReading.md). The feed's sheet is untitled — its trigger is a
   * thumb away, still on screen — and wears its "?" in the corner.
   */
  titled?: boolean;
  node?: DataNode;
  testId: string;
}) {
  const words = viewWords(borrowedHandle);
  const set = (patch: Partial<FeedFilterValue>) => onStage({ ...staged, ...patch });
  const postsish = staged.kinds.some((kind) => kind === "posts" || kind === "comments");
  const help = (
    <HelpDot ariaLabel={HOW_THE_FILTER_WORKS} onOpen={onHelp} node={titled ? part(part(node, "title"), "help") : part(node, "help")} />
  );
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={WHAT_YOUR_FEED_SHOWS}
      titleHidden={!titled}
      titleTrailing={titled ? help : undefined}
      focusTitle={titled}
      // 88% OF THE SCREEN, AS THE BUILT BOARD MEASURES IT (FeedSheet.md:3): the
      // master's surface takes `height: 88%` and lays its 8px top and 24px
      // bottom padding OUTSIDE it, so the drawn sheet stands 32px taller than
      // 88% (837 of 915 at the harness's viewport). This sheet's grip margin
      // and foot padding sit inside its height, so they are added back here.
      height="calc(88dvh + 32px)"
      rows
      node={node}
      testId={testId}
      foot={<FilterFoot node={part(node, "foot")} testId={`${testId}-foot`} onReset={onReset} onDone={onDone} />}
    >
      {titled ? (
        <div className="px-6 pb-4">
          <QuietNote node={part(node, "note")}>{EVERY_FEED_STARTS_FROM_THIS}</QuietNote>
        </div>
      ) : (
        // THE "?" RIDES THE SHEET'S CORNER (FeedFilter.jsx: absolute at
        // `--space-1` / `--space-2`): the dialog is the box it measures from.
        <div className="absolute top-1 right-2">{help}</div>
      )}
      <FilterSection label="Kinds" hint={KINDS_HINT} node={part(node, "kinds")}>
        {FEED_KINDS.map((kind) => (
          <Chip
            key={kind.value}
            testId={`${testId}-kind-${kind.value}`}
            node={part(node, `kinds.${kind.value}Chip`)}
            selected={staged.kinds.includes(kind.value)}
            // The last kind chip never refuses (FeedSheet.md:75): nothing is
            // what a feed with every kind off shows, and it says so.
            onClick={() => set({ kinds: toggled(FEED_KINDS, staged.kinds, kind.value) })}
          >
            {kind.label}
          </Chip>
        ))}
      </FilterSection>
      <FilterSection label="Kinds of post" hint={postsish ? FORMS_HINT_ON : FORMS_HINT_OFF} node={part(node, "forms")}>
        {FEED_FORMS.map((form) => (
          <Chip
            key={form.value}
            testId={`${testId}-form-${form.value}`}
            node={part(node, `forms.${form.value}Chip`)}
            selected={staged.forms.includes(form.value)}
            disabled={!postsish}
            onClick={() => set({ forms: toggled(FEED_FORMS, staged.forms, form.value) })}
          >
            {form.label}
          </Chip>
        ))}
      </FilterSection>
      <OrderSection
        options={FEED_ORDERS}
        order={staged.order}
        onOrder={(order) => set({ order })}
        seen={staged.seen}
        onSeen={(seen) => set({ seen })}
        hint={words.orderHint}
        node={part(node, "order")}
      />
      <FilterSection label="Also show" hint={ALSO_HINT} node={part(node, "also")}>
        {FEED_ALSO.map((entry) => (
          <Chip
            key={entry.value}
            testId={`${testId}-also-${entry.value}`}
            node={part(node, `also.${entry.value}Chip`)}
            selected={staged.also.includes(entry.value)}
            onClick={() => set({ also: toggled(FEED_ALSO, staged.also, entry.value) })}
          >
            {entry.label}
          </Chip>
        ))}
      </FilterSection>
      {/* WHO THE FEED READS FROM (ruling 77; the sign row, item 7): with the
          scope narrowers at the body's tail, the topic section staying last. */}
      <FilterSection label="People" hint={PEOPLE_HINT} node={part(node, "people")}>
        <PeopleRows
          people={staged.people}
          sign={staged.peopleSign}
          onPeople={(people) => set({ people })}
          onSign={(peopleSign) => set({ peopleSign })}
          node={part(node, "people")}
          borrowedHandle={borrowedHandle}
          radioName={`${testId}-people`}
        />
      </FilterSection>
      {/* ONE TOPIC, LAST (FeedSheet.md:29-35, :53): only the topics held FOR,
          at most one on — a second pick replaces the first, the held one's
          tap clears it — and the door out to everything held under them. */}
      {topics.length > 0 && (
        <FilterSection label={TOPIC_LABEL} hint={words.topicHint} node={part(node, "topic")}>
          {topics.map((topic) => (
            <Chip
              key={topic.id}
              testId={`${testId}-topic-${topic.name}`}
              node={node === undefined ? undefined : { path: `${node.path}.topic.chip`, key: topic.name }}
              selected={staged.topic?.id === topic.id}
              onClick={() => set({ topic: staged.topic?.id === topic.id ? null : topic })}
            >
              {`#${topic.name}`}
            </Chip>
          ))}
          <div className="basis-full">
            {/* DRIFT (feed-filter lane w-f): `All your topics` opens
                YourTopics, which the web does not draw yet — the door
                stands, inert, until it does (introduced-but-inert law). */}
            <Button
              testId={`${testId}-all-topics`}
              node={part(node, "topic.allTopics")}
              variant="text"
              size="sm"
              onClick={onOpenTopics ?? (() => {})}
            >
              {ALL_YOUR_TOPICS}
            </Button>
          </div>
        </FilterSection>
      )}
    </BottomSheet>
  );
}
