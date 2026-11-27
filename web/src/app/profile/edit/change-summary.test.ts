import { describe, expect, it } from "vitest";

import { CENTERED } from "@/lib/ui2/media/crop";
import { anythingStaged, changeSummary, NOTHING_STAGED } from "./change-summary";
import { UNCHANGED, type ProfileMediaChoice } from "./profile-media-field";

const PICKED: ProfileMediaChoice = { kind: "picked", file: new Blob(), crop: CENTERED };

// ProfileEditSeal.md:5 — the row reads `A new` and the changed parts in the
// edit's order; the board's sample (copy-voice, *The profile's seal*) is
// `A new picture, bio and website`. The parts are the STAGED ones
// (ProfileEdit.md:39), never a byte comparison.
describe("what a profile change holds", () => {
  it("reads the board's own sample for its own change", () => {
    expect(changeSummary({ displayName: false, bio: true, websiteUrl: true }, PICKED)).toBe(
      "A new picture, bio and website",
    );
  });

  it("names one part alone, and two with and", () => {
    expect(changeSummary({ ...NOTHING_STAGED, bio: true }, UNCHANGED)).toBe("A new bio");
    expect(changeSummary({ ...NOTHING_STAGED, displayName: true }, PICKED)).toBe("A new picture and display name");
  });

  it("says a removed picture after any new parts", () => {
    expect(changeSummary(NOTHING_STAGED, { kind: "cleared" })).toBe("The picture removed");
    expect(changeSummary({ ...NOTHING_STAGED, bio: true }, { kind: "cleared" })).toBe("A new bio, the picture removed");
  });

  it("knows no Nothing changed: an empty staging has no reading", () => {
    expect(changeSummary(NOTHING_STAGED, UNCHANGED)).toBe("");
  });
});

// ProfileEdit.md:41, :47: Save answers only once something is staged.
describe("whether anything is staged", () => {
  it("is nothing at the edit's opening", () => {
    expect(anythingStaged(NOTHING_STAGED, UNCHANGED)).toBe(false);
  });

  it("is a field typed in, or the picture changed or removed", () => {
    expect(anythingStaged({ ...NOTHING_STAGED, websiteUrl: true }, UNCHANGED)).toBe(true);
    expect(anythingStaged(NOTHING_STAGED, PICKED)).toBe(true);
    expect(anythingStaged(NOTHING_STAGED, { kind: "cleared" })).toBe(true);
  });
});
