// REPORT A PROBLEM, THE PARTS THAT ARE NOT THE PAGE (ReportProblem.md,
// ReportProblemEmpty.md): where a report goes, the four facts that travel with
// the reader's words, the `mailto:` draft the press hands to the reader's own
// mail, and the words kept between visits.
//
// NOTHING IS SENT FROM COGRA (ReportProblem.md: "NEVER the report is sent from
// CoGra"). The press only builds a `mailto:` URL (RFC 6068) and hands it to the
// browser, which opens the reader's own mail with the draft filled in; there
// is no server call and no API behind this page.

import { dateline } from "@/lib/ui/timestamp";

/**
 * Where a report goes. A PLACEHOLDER until CoGra is on a server
 * (design/staged-surfaces.md, *Placeholders swapped at publication*): the real
 * address is this one line.
 */
export const REPORT_ADDRESS = "reports@cogra.local";

/** The page's title, and the draft's subject. */
export const REPORT_TITLE = "Report a problem";

export const REPORT_LEAD =
  "Sending opens your email with everything below filled in — nothing goes until you send it there.";
export const REPORT_FIELD_LABEL = "What happened";
export const REPORT_NOTE = "That's all that goes with your words — no account, no key, nothing you've posted.";
export const REPORT_SEND = "Send by email";

/** The facts that travel with the words, read back on the page in this order. */
export type ReportFacts = {
  readonly to: string;
  readonly version: string;
  readonly runningOn: string;
  readonly time: string;
};

/** `01.10.2026, 14:32` — the house date, then the minute (the board's `Time`). */
export function reportTime(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dateline(at.toISOString())}, ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/**
 * The draft the press hands to the reader's mail: the report address as the
 * recipient, the page's title as the subject, and the words followed by the
 * three facts the address does not already carry. Empty or blank words still
 * make a draft (ReportProblemEmpty.md): the facts travel whatever the field
 * holds.
 */
export function reportMailto(words: string, facts: ReportFacts): string {
  const lines = [`Version: ${facts.version}`, `Running on: ${facts.runningOn}`, `Time: ${facts.time}`];
  const body = words.trim() === "" ? lines.join("\r\n") : `${words}\r\n\r\n${lines.join("\r\n")}`;
  return `mailto:${facts.to}?subject=${encodeURIComponent(REPORT_TITLE)}&body=${encodeURIComponent(body)}`;
}

/**
 * THE KEPT WORDS (ReportProblem.md:29,31: kept by Back and by the handoff;
 * ReportProblem.jsx: "as a post's draft is kept, until the reader clears it"). Device-local, read and
 * written behind try/catch: a browser that refuses storage keeps nothing and
 * the page still works.
 */
const WORDS_KEY = "cogra.reportWords";

export function readKeptWords(): string {
  try {
    return window.localStorage.getItem(WORDS_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Keeps the words; an empty field keeps nothing (ReportProblemEmpty.md: "NEVER words are kept"). */
export function keepWords(words: string): void {
  try {
    if (words === "") window.localStorage.removeItem(WORDS_KEY);
    else window.localStorage.setItem(WORDS_KEY, words);
  } catch {
    // Storage refused: nothing is kept, which the page survives.
  }
}
