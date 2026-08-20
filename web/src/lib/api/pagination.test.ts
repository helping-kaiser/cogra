import { describe, expect, it } from "vitest";

import { appendDeduped } from "./pagination";

const item = (id: string) => ({ id });

describe("appendDeduped", () => {
  it("appends a page that shares nothing with the held one", () => {
    expect(appendDeduped([item("a"), item("b")], [item("c")])).toEqual([
      item("a"),
      item("b"),
      item("c"),
    ]);
  });

  it("drops an entry the held page already carries", () => {
    // The landing case: 'a' was pending in the held page and has since
    // moved into landing order, below the cursor the walk resumed from.
    const held = [item("a"), item("b")];
    expect(appendDeduped(held, [item("a"), item("c")])).toEqual([
      item("a"),
      item("b"),
      item("c"),
    ]);
  });

  it("keeps the held copy rather than reconciling it against the newer one", () => {
    const held = [{ id: "a", body: "held" }];
    const appended = appendDeduped(held, [{ id: "a", body: "newer" }]);
    expect(appended).toEqual([{ id: "a", body: "held" }]);
  });

  it("drops repeats inside the incoming page too", () => {
    expect(appendDeduped([], [item("a"), item("a")])).toEqual([item("a")]);
  });

  it("returns the held list itself when the page adds nothing", () => {
    const held = [item("a")];
    expect(appendDeduped(held, [item("a")])).toBe(held);
    expect(appendDeduped(held, [])).toBe(held);
  });

  it("appends onto an empty held list", () => {
    expect(appendDeduped([], [item("a")])).toEqual([item("a")]);
  });
});
