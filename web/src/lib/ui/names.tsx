// A LONG NAME OR HANDLE TAKES ONE OF THREE CASES, BY ITS PLACE (design/readme.md
// §13; jakob 2026-11-11, round 40; NamesLong.md). The person row is
// `ActorChip`'s own law; the other two are these helpers, the web twins of
// `nameInLine` and `nameInText` in design/components/people/ActorChip.jsx.
// Both are plain CSS — `text-overflow: ellipsis` on a box that may shrink
// (`min-width: 0`, `overflow: hidden`) and `white-space: nowrap` to keep a
// unit on one line — so they measure nothing and run identically on the
// server and the client.
//
// ONE-LINE PLACES (`nameInLine`): a page title, a menu row, a row's title and
// aside never wrap and clip at their end. Where the handle ENDS the line
// (`Hide @ada`, `on @mira`, a title that is only `@ada`) that end clip already
// cuts the handle and keeps the words, so the text returns untouched; where
// words FOLLOW it (`@ada commented on your post`) the line splits into
// [words: never shrink][the handle: the one part that yields][words], so the
// handle is cut and the sentence stays readable. The first handle yields.
//
// TEXT THAT WRAPS (`nameInText`): the sentence wraps at its spaces and is never
// cut as a whole, but a handle — or a person's name passed in `names` — never
// stands on two lines: it is one inline-flex unit, so it moves whole to the
// next line, and a unit longer than a full line is cut at its end with "…"
// (`max-width: 100%`). Punctuation right after it (`?`, `.`, `,`, `'s`) rides
// with it, whole and never swallowed by the cut.

import { Fragment, type ReactNode } from "react";

const HANDLE = "(?<![\\w@])@[A-Za-z0-9_]+";
const HANDLE_IN_LINE = new RegExp(HANDLE);
const UNIT_TAIL = /^(?:['’]s\b|[?.,!:;)’]+)/;

/** Marks a wrapping-text unit, for tests and the conformance harness. */
export const NAME_UNIT_ATTRIBUTE = "data-name-unit";
/** Marks a one-line place that `nameInLine` split. */
export const NAME_LINE_ATTRIBUTE = "data-name-line";

const escapeName = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A one-line place's text with its first `@handle` made the one part that
 * yields: the words keep their room, the handle is cut with "…". Text with no
 * handle, a handle that ends the line, or anything not a string returns
 * untouched — the place's own end clip then does the cutting.
 */
export function nameInLine(text: ReactNode): ReactNode {
  if (typeof text !== "string") return text;
  const found = HANDLE_IN_LINE.exec(text);
  if (found === null) return text;
  const before = text.slice(0, found.index);
  const after = text.slice(found.index + found[0].length);
  if (after.trim() === "") return text;
  return (
    <span className="flex min-w-0 whitespace-nowrap" {...{ [NAME_LINE_ATTRIBUTE]: "" }}>
      {before !== "" && <span className="flex-none whitespace-pre">{before}</span>}
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{found[0]}</span>
      <span className="flex-none whitespace-pre">{after}</span>
    </span>
  );
}

/**
 * Wrapping text whose every `@handle` — and every name given in `names` — is
 * one unit that never stands on two lines: whole on the next line when it does
 * not fit the rest of this one, end-cut with "…" past a full line, its
 * trailing punctuation kept beside it. Text naming nobody, or anything not a
 * string (an array maps part by part), returns untouched.
 */
export function nameInText(text: ReactNode, names: readonly string[] = []): ReactNode {
  if (Array.isArray(text)) {
    return text.map((piece: ReactNode, index) => <Fragment key={index}>{nameInText(piece, names)}</Fragment>);
  }
  if (typeof text !== "string") return text;
  const given = names.filter((name) => name.trim() !== "").map(escapeName);
  const pattern = new RegExp(given.length > 0 ? `${HANDLE}|${given.join("|")}` : HANDLE, "g");
  const out: ReactNode[] = [];
  let last = 0;
  for (let found = pattern.exec(text); found !== null; found = pattern.exec(text)) {
    const end = found.index + found[0].length;
    const tail = UNIT_TAIL.exec(text.slice(end))?.[0] ?? "";
    out.push(text.slice(last, found.index));
    out.push(
      <span
        key={found.index}
        className="inline-flex max-w-full whitespace-nowrap align-top"
        {...{ [NAME_UNIT_ATTRIBUTE]: "" }}
      >
        <span className="min-w-0 overflow-hidden text-ellipsis">{found[0]}</span>
        {tail !== "" && <span className="flex-none">{tail}</span>}
      </span>,
    );
    last = end + tail.length;
  }
  if (out.length === 0) return text;
  out.push(text.slice(last));
  return out;
}

/** `nameInText` as an element, for the screens. */
export function NameInText({ text, names }: { text: ReactNode; names?: readonly string[] }) {
  return <>{nameInText(text, names)}</>;
}
