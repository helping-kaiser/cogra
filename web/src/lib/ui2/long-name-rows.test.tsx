// The rows' second lines at the longest legal handle (NamesLong.md:5-9): one
// line, clipped at its end; where words follow the handle (`@x · 3d`) the
// handle is the part cut and the words keep their room. jsdom lays nothing
// out; the harness measures the boxes.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectLineYieldsHandle, LONG_HANDLE } from "@/test/names";
import { PickerRow } from "./compose/picker-rows";
import { StagedRow } from "./compose/staged-reference";
import { ReferenceRow } from "./reference-row";

const H = `@${LONG_HANDLE}`;

describe("a long handle in a row's sub line", () => {
  it("ReferenceRow (search, cited-by) cuts the handle and keeps ` · 3d`", () => {
    render(<ReferenceRow kind="post" name="The long way home" sub={`${H} · 3d`} href={null} node={{ path: "explore.result", key: "1" }} />);
    const sub = screen.getByTestId("explore.result.sub");
    expect(sub).toHaveTextContent(`${H} · 3d`);
    expectLineYieldsHandle(sub, H, " · 3d");
  });

  it("ReferenceRow leaves a sub the handle ends to the line's own end clip", () => {
    render(<ReferenceRow kind="topic" name="saltmaps" sub={`tagged by ${H}`} href={null} node={{ path: "explore.result", key: "1" }} />);
    const sub = screen.getByTestId("explore.result.sub");
    expect(sub.querySelector("[data-name-line]")).toBeNull();
    expect(sub.className.split(" ")).toEqual(expect.arrayContaining(["overflow-hidden", "text-ellipsis", "whitespace-nowrap"]));
  });

  it("PickerRow (the reference picker) cuts the handle and keeps ` · 3d`", () => {
    render(<PickerRow kind="post" name="The long way home" sub={`${H} · 3d`} onPick={() => {}} node={{ path: "picker.result", key: "1" }} />);
    const sub = screen.getByTestId("picker.result.sub");
    expect(sub.className).toContain("truncate");
    expectLineYieldsHandle(sub, H, " · 3d");
  });

  it("StagedRow's second line is one line, clipped at its end", () => {
    render(
      <StagedRow
        kind="person"
        name="Max Wilhelmina Featherstonehaugh Okonkwo-Lindqvist"
        sub={H}
        pair={{ pDirected: 0.1, pInterest: 0.1 }}
        onRemove={() => {}}
        node={{ path: "keptPicks.pick", key: "1" }}
      />,
    );
    const sub = screen.getByTestId("keptPicks.pick.kind");
    expect(sub).toHaveTextContent(H);
    expect(sub.className.split(" ")).toEqual(expect.arrayContaining(["min-w-0", "truncate"]));
  });
});
