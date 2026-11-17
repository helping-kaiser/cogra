import { describe, expect, it } from "vitest";

import { CENTERED } from "@/lib/ui2/media/crop";
import { changeSummary } from "./change-summary";
import { UNCHANGED, type ProfileMediaChoice } from "./profile-media-field";

const BEFORE = { displayName: "Sol", bio: "Old", websiteUrl: "" };
const PICKED: ProfileMediaChoice = { kind: "picked", file: new Blob(), crop: CENTERED };

// ProfileEditSeal.md:3 — the row says what the change holds; the board's
// sample (copy-voice, *The profile's seal*) is `A new picture, bio and website`.
describe("what a profile change holds", () => {
  it("reads the board's own sample for its own change", () => {
    expect(changeSummary(BEFORE, { displayName: "Sol", bio: "New", websiteUrl: "sol.art" }, PICKED)).toBe(
      "A new picture, bio and website",
    );
  });

  it("names one part alone, and two with and", () => {
    expect(changeSummary(BEFORE, { ...BEFORE, bio: "New" }, UNCHANGED)).toBe("A new bio");
    expect(changeSummary(BEFORE, { ...BEFORE, displayName: "Sol F" }, PICKED)).toBe("A new picture and display name");
  });

  it("ignores whitespace the server trims", () => {
    expect(changeSummary(BEFORE, { ...BEFORE, displayName: " Sol " }, UNCHANGED)).toBe("Nothing changed");
  });

  it("says a removed picture after any new parts", () => {
    expect(changeSummary(BEFORE, BEFORE, { kind: "cleared" })).toBe("The picture removed");
    expect(changeSummary(BEFORE, { ...BEFORE, bio: "New" }, { kind: "cleared" })).toBe("A new bio, the picture removed");
  });
});
