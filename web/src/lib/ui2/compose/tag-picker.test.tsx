// The tag picker's behaviour, compiled line by line from its sidecars
// (design/designs/canonical/behavior/TagPicker.md, TagPickerTyping.md,
// TagPickerRefused.md).

import { describe, it } from "vitest";

describe("TagPicker", () => {
  it.todo("puts the canonicalized typed name first while it is a legal name");
  it.todo("stands a staged tag only in the staged section above the list");
  it.todo("stages the first row on the action key, announces it, and stays open");
  it.todo("stages nothing on the action key while the name is refused");
  it.todo("stages a tapped row, moves it into the staged section, and stays open");
  it.todo("unstages a staged row on its ×, announces it, and stays open");
  it.todo("closes on Done and on the header back, keeping every staged tag");
  it.todo("names the arrow for the composer it returns to");
  it.todo("focuses the name field when it opens");
});
