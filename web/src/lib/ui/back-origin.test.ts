import { describe, expect, it } from "vitest";

import { backFor, personOrigin } from "./back-origin";

// The origin-naming table (design/readme.md "Back labels"; ProfileOther.md:63;
// Profile.md: a chronicle card's post; ChatsComingSoon.md:15-17).
describe("backFor", () => {
  it("names the feed when nothing says otherwise", () => {
    expect(backFor(null)).toEqual({ href: "/feed", label: "Back to feed" });
    expect(backFor("nowhere")).toEqual({ href: "/feed", label: "Back to feed" });
  });

  it("names your own profile, and someone else's as the profile", () => {
    expect(backFor("profile")).toEqual({ href: "/profile", label: "Back to your profile" });
    expect(backFor(personOrigin("ada"))).toEqual({ href: "/u/ada", label: "Back to the profile" });
  });

  it("never builds a profile link from an empty handle", () => {
    expect(backFor("u:")).toEqual({ href: "/feed", label: "Back to feed" });
  });
});
