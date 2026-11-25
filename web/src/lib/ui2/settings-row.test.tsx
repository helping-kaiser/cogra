// A VALUE TOO LONG FOR THE ROW IS CUT, THE LABEL KEEPS ITS ROOM
// (SettingsRow.jsx, round 62; jakob 2026-11-23, E10 (a)): the value is a
// one-line place that never wraps and ends in "…", and beside a value the
// label holds its whole width. jsdom lays nothing out: these pin the classes
// that make the value the row's one shrinking part; the phone-fit harness
// measures the boxes.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingsRow } from "./settings-row";

const EMAIL = "a.very.long.address.for.the.settings.row@example.com";
const classes = (id: string) => screen.getByTestId(id).className.split(/\s+/);

describe("SettingsRow's value", () => {
  it("is the one shrinking part: one line, cut with an ellipsis", () => {
    render(<SettingsRow label="Email" value={EMAIL} node={{ path: "settings.row" }} />);
    const value = classes("settings.row.value");
    // flex: 0 1 auto with min-width 0 — it may shrink below its text
    expect(value).toEqual(expect.arrayContaining(["flex-initial", "min-w-0", "truncate"]));
    expect(value).not.toContain("flex-none");
    expect(screen.getByTestId("settings.row.value")).toHaveTextContent(EMAIL);
  });

  it("leaves the label its whole width beside a value", () => {
    render(<SettingsRow label="Email" value={EMAIL} node={{ path: "settings.row" }} />);
    expect(classes("settings.row.label")).toContain("min-w-max");
    // the words' column keeps its min-content (the label's whole width)
    expect(screen.getByTestId("settings.row.label").parentElement?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["flex-1", "min-w-min"]),
    );
    expect(classes("settings.row.chevron")).toContain("flex-none");
  });

  it("lets a row without a value shrink its words as before", () => {
    render(<SettingsRow label="Sign out" action node={{ path: "settings.row" }} />);
    expect(classes("settings.row.label")).not.toContain("min-w-max");
    expect(screen.getByTestId("settings.row.label").parentElement?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["flex-1", "min-w-0"]),
    );
  });
});
