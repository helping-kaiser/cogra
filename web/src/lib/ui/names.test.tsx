// The long-name helpers against their masters (`nameInLine`, `nameInText` in
// design/components/people/ActorChip.jsx) and the NamesLong sidecar. jsdom lays
// nothing out, so these pin the structure that makes the CSS do the work; the
// conformance harness measures the boxes.

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { nameInLine, nameInText, NameInText } from "./names";

/** The board's longest legal handle (NamesLong.jsx: `@` and 30 characters). */
const H = "@maximiliana_featherstone_haugh";

function mount(node: React.ReactNode) {
  const { container } = render(<div data-testid="host">{node}</div>);
  return container.firstElementChild as HTMLElement;
}

const units = (host: HTMLElement) => [...host.querySelectorAll("[data-name-unit]")] as HTMLElement[];

describe("nameInLine — a one-line place", () => {
  it("returns text naming nobody untouched", () => {
    expect(nameInLine("Save")).toBe("Save");
  });

  // NamesLong.md:9 — a one-line place whose handle ends the line clips at its
  // end, which cuts the handle and keeps the words.
  it("returns a line the handle ends untouched, for the place's own end clip", () => {
    expect(nameInLine(`Hide ${H}`)).toBe(`Hide ${H}`);
    expect(nameInLine(H)).toBe(H);
    expect(nameInLine(`on ${H}  `)).toBe(`on ${H}  `);
  });

  // NamesLong.md:7 — the handle is the part cut, the words around it keep their room.
  it("makes the handle the one yielding part when words follow it", () => {
    const host = mount(nameInLine(`Seen by ${H} commented on your post`));
    const line = host.querySelector("[data-name-line]") as HTMLElement;
    expect(line).toHaveClass("flex", "min-w-0", "whitespace-nowrap");
    const [before, handle, after] = [...line.children] as HTMLElement[];
    expect(before).toHaveTextContent("Seen by");
    expect(before).toHaveClass("flex-none", "whitespace-pre");
    expect(handle.textContent).toBe(H);
    expect(handle).toHaveClass("min-w-0", "overflow-hidden", "text-ellipsis", "whitespace-nowrap");
    expect(after.textContent).toBe(" commented on your post");
    expect(after).toHaveClass("flex-none", "whitespace-pre");
    expect(host).toHaveTextContent(`Seen by ${H} commented on your post`);
  });

  it("yields the first handle only", () => {
    const host = mount(nameInLine("@ada and @mira"));
    // No words before the handle, so no leading part.
    const [handle, after] = [...(host.querySelector("[data-name-line]") as HTMLElement).children];
    expect(handle.textContent).toBe("@ada");
    expect(after.textContent).toBe(" and @mira");
  });

  it("does not take an email's at-sign for a handle", () => {
    expect(nameInLine("ada@example.com is yours")).toBe("ada@example.com is yours");
  });

  it("passes a node through", () => {
    const node = <b>x</b>;
    expect(nameInLine(node)).toBe(node);
  });
});

describe("nameInText — text that wraps", () => {
  it("returns text naming nobody untouched", () => {
    expect(nameInText("Nothing here yet.")).toBe("Nothing here yet.");
  });

  // NamesLong.md:13 and :15 — one unit, never on two lines; past a full line it
  // is cut at its end, its trailing punctuation kept whole beside it.
  it("makes every handle one no-break unit that end-cuts past a full line", () => {
    const host = mount(nameInText(`Change your handle to ${H}?`));
    const [unit] = units(host);
    expect(unit).toHaveClass("inline-flex", "max-w-full", "whitespace-nowrap", "align-top");
    const [name, tail] = [...unit.children] as HTMLElement[];
    expect(name.textContent).toBe(H);
    expect(name).toHaveClass("min-w-0", "overflow-hidden", "text-ellipsis");
    expect(tail.textContent).toBe("?");
    expect(tail).toHaveClass("flex-none");
    expect(host).toHaveTextContent(`Change your handle to ${H}?`);
  });

  it.each([
    ["'s view", "'s"],
    ["’s view", "’s"],
    [". Then", "."],
    [", and", ","],
    // The master's tail takes the run of closers: `),` rides whole.
    ["), so", "),"],
    ["!?", "!?"],
  ])("keeps %j's punctuation with the unit", (after, tail) => {
    const [unit] = units(mount(nameInText(`From ${H}${after}`)));
    expect(unit.lastElementChild?.textContent).toBe(tail);
  });

  it("gives a unit with nothing after it no punctuation part", () => {
    const [unit] = units(mount(nameInText(`waiting on ${H}`)));
    expect(unit.children).toHaveLength(1);
  });

  it("makes each of several handles its own unit", () => {
    const found = units(mount(nameInText(`Links to ${H} stop working, and anyone can claim ${H} afterwards.`)));
    expect(found.map((unit) => unit.textContent)).toEqual([H, H]);
  });

  it("takes a person's name, spaces and all, as one unit when given", () => {
    const name = "Max Wilhelmina Featherstonehaugh Okonkwo-Lindqvist";
    const [unit] = units(mount(nameInText(`You were invited by ${name}.`, [name])));
    expect(unit.textContent).toBe(`${name}.`);
  });

  it("maps an array part by part and passes a node through", () => {
    const host = mount(nameInText(["by ", H, <i key="i">x</i>]));
    expect(units(host)).toHaveLength(1);
    expect(host).toHaveTextContent(`by ${H}x`);
  });

  it("renders as an element", () => {
    expect(units(mount(<NameInText text={`${H} is hidden.`} />))).toHaveLength(1);
  });
});
