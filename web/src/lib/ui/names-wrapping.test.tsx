// TEXT THAT WRAPS (NamesLong.md:11-17) on every wrapping master that carries
// it, at the board's longest legal handle (NamesLong.jsx). jsdom lays nothing
// out: these pin that each master hands its words to `nameInText` and lets
// other tokens break (`overflow-wrap: anywhere`); the harness measures the
// boxes.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BorrowedViewBand, borrowedViewLine } from "@/lib/ui/borrowed-view-band";
import { EmptyState } from "@/lib/ui/empty-state";
import { Snackbar } from "@/lib/ui/snackbar";
import { DialogSurface } from "@/lib/ui2/dialog-surface";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { QuotedRow } from "@/lib/ui2/quoted-row";
import { SettingsRow } from "@/lib/ui2/settings-row";
import { TaskCard } from "@/lib/ui2/task-card";

const HANDLE = "maximiliana_featherstone_haugh";
const H = `@${HANDLE}`;

/** The one unit inside `box` and its parts: the name, then any punctuation. */
function unitIn(box: HTMLElement) {
  const unit = box.querySelector("[data-name-unit]") as HTMLElement | null;
  expect(unit).not.toBeNull();
  const [name, tail] = [...(unit as HTMLElement).children] as HTMLElement[];
  return { unit: unit as HTMLElement, name, tail };
}

function expectWraps(box: HTMLElement, sentence: string, tail?: string) {
  // NamesLong.md:17 — wrapping text is never ellipsized as a whole.
  expect(box.className).not.toMatch(/\b(truncate|line-clamp-\d|whitespace-nowrap)\b/);
  expect(box.className).toContain("[overflow-wrap:anywhere]");
  expect(box).toHaveTextContent(sentence);
  const { unit, name, tail: kept } = unitIn(box);
  // NamesLong.md:13 — one unit, never on two lines.
  expect(unit.className.split(" ")).toEqual(
    expect.arrayContaining(["inline-flex", "max-w-full", "whitespace-nowrap"]),
  );
  // NamesLong.md:15 — past a full line it is cut at its end, the punctuation kept.
  expect(name.textContent).toBe(H);
  expect(name.className.split(" ")).toEqual(expect.arrayContaining(["min-w-0", "overflow-hidden", "text-ellipsis"]));
  if (tail !== undefined) {
    expect(kept.textContent).toBe(tail);
    expect(kept.className).toContain("flex-none");
  }
}

describe("a long handle in text that wraps", () => {
  it("Snackbar's message (FeedHidden's line)", () => {
    const message = `${H} is hidden.`;
    render(<Snackbar testId="snack" node={{ path: "feed.snackbar" }} message={message} onDismiss={() => {}} />);
    expectWraps(screen.getByTestId("feed.snackbar.message"), message);
  });

  it("DialogSurface's title and body (ChangeHandleConfirm)", () => {
    const body = `Links to ${H} stop working the moment it changes, and anyone can claim ${H} afterwards.`;
    render(
      <DialogSurface
        title={`Change your handle to ${H}?`}
        body={[body]}
        actions={<button type="button">Keep it</button>}
        onDismiss={() => {}}
        node={{ path: "changeHandleConfirm.dialog" }}
      />,
    );
    expectWraps(screen.getByTestId("changeHandleConfirm.dialog.title"), `Change your handle to ${H}?`, "?");
    const paragraph = screen.getByTestId("changeHandleConfirm.dialog.body");
    expect(paragraph.className).toContain("[overflow-wrap:anywhere]");
    expect(paragraph.querySelectorAll("[data-name-unit]")).toHaveLength(2);
  });

  it("BorrowedViewBand's line, its 's kept with the handle", () => {
    render(<BorrowedViewBand handle={HANDLE} line={borrowedViewLine.join(HANDLE)} />);
    const line = screen.getByTestId("borrowed-view-line");
    expect(line.className).toContain("min-w-0");
    expectWraps(line, borrowedViewLine.join(HANDLE), "'s");
  });

  it("TaskCard's title (ApplicantWaiting)", () => {
    render(
      <TaskCard
        title={`All set — waiting on ${H}`}
        body="Their approval brings you in. Nothing else is needed from you."
        node={{ path: "feed.application" }}
      />,
    );
    const title = screen.getByTestId("feed.application.title");
    expect(title.className).toContain("min-w-0");
    expectWraps(title, `All set — waiting on ${H}`);
  });

  it("TaskCard's body", () => {
    const body = `${H} approved your application. Nothing is needed from you while it lands.`;
    render(<TaskCard title="Approved" body={body} node={{ path: "feed.landing" }} />);
    expectWraps(screen.getByTestId("feed.landing.body"), body);
  });

  it("QuotedRow's title", () => {
    render(<QuotedRow title={`The long way home — ${H}`} node={{ path: "trace.cover" }} />);
    expectWraps(screen.getByTestId("trace.cover.title"), `The long way home — ${H}`);
  });

  it("SettingsRow's status", () => {
    render(<SettingsRow label="Handle" status={`Reserved for ${H}.`} node={{ path: "settings.row" }} />);
    expectWraps(screen.getByTestId("settings.row.status"), `Reserved for ${H}.`, ".");
  });

  it("EmptyState's line (the opinions page)", () => {
    render(<EmptyState title={`No opinions by ${H} yet.`} testId="empty" node={{ path: "stances.empty" }} />);
    expectWraps(screen.getByTestId("stances.empty.title"), `No opinions by ${H} yet.`);
  });

  it("QuietNote (the trace's level-one note)", () => {
    render(<QuietNote testId="note">{`Every path here starts with an opinion ${H} gave.`}</QuietNote>);
    expectWraps(screen.getByTestId("note"), `Every path here starts with an opinion ${H} gave.`);
  });
});
