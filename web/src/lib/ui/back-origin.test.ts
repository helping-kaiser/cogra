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

  it("names History, the reader's seen-list (History.md:47-61)", () => {
    expect(backFor("history")).toEqual({ href: "/history", label: "Back to History" });
  });

  // Explore mid-query names the search, and a drill-in returns to it; the
  // two roots name themselves (ExplorePerson.md:23; ChatsComingSoon.md:15).
  it("names the search, Explore and the Wallet as the roots they are", () => {
    expect(backFor("search")).toEqual({ href: "/explore", label: "Back to the search" });
    expect(backFor("explore")).toEqual({ href: "/explore", label: "Back to Explore" });
    expect(backFor("wallet")).toEqual({ href: "/wallet", label: "Back to Wallet" });
  });

  it("never builds a profile link from an empty handle", () => {
    expect(backFor("u:")).toEqual({ href: "/feed", label: "Back to feed" });
  });
});
