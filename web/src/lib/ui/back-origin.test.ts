import { describe, expect, it } from "vitest";

import {
  backFor,
  carriedOrigin,
  EXPLORE_COLD,
  letInOrigin,
  parseInvitesOrigin,
  personOrigin,
  postOrigin,
  tagOrigin,
} from "./back-origin";

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

  // A CHAINED ORIGIN hands its page the origin it was opened with on the way
  // back, and names the page by its noun (readme §13's origin-noun tables;
  // ProfileOther.md:73: `Back to #<thattag>` from a tag's page).
  it("returns to someone's profile opened as it was, naming the profile", () => {
    expect(backFor(personOrigin("ada", "saved"))).toEqual({ href: "/u/ada?from=saved", label: "Back to the profile" });
    expect(backFor("u:ada/opinions:tobias/history")).toEqual({
      href: "/u/ada?from=opinions%3Atobias%2Fhistory",
      label: "Back to the profile",
    });
  });

  // Invites.md:23, :27 — a person let in, or a deleted account's page, reads
  // Back to Invites; ProfileOther.md:73 the same, from the people you let in.
  it("names Invites Back to Invites, returning to it opened as it was", () => {
    expect(backFor(letInOrigin())).toEqual({ href: "/invites", label: "Back to Invites" });
    expect(backFor(letInOrigin("notifications"))).toEqual({
      href: "/invites?from=notifications",
      label: "Back to Invites",
    });
    // A door out of that profile chains it, and the profile's own way back
    // still names Invites.
    expect(backFor(personOrigin("ada", letInOrigin("kept-picks")))).toEqual({
      href: "/u/ada?from=invites%2Fkept-picks",
      label: "Back to the profile",
    });
    expect(parseInvitesOrigin("invitesx")).toBeNull();
  });

  it("names a tag's page Back to #<thattag>, returning to it opened as it was", () => {
    expect(backFor(tagOrigin("coast"))).toEqual({ href: "/topics/coast", label: "Back to #coast" });
    expect(backFor(tagOrigin("coast", "search"))).toEqual({
      href: "/topics/coast?from=search",
      label: "Back to #coast",
    });
  });

  it("names the stream whatever list it narrowed, returning into it at the clip", () => {
    expect(backFor("stream:v2")).toEqual({ href: "/reel/v2", label: "Back to the stream" });
    expect(backFor("stream:v2/u:ada/saved")).toEqual({ href: "/reel/v2", label: "Back to the stream" });
  });

  it("reads the origin a chained token carries, and nothing from a plain one", () => {
    expect(carriedOrigin("u:ada")).toBeNull();
    expect(carriedOrigin("u:ada/opinions:tobias/saved")).toBe("opinions:tobias/saved");
    expect(carriedOrigin("tag:coast/search")).toBe("search");
    expect(carriedOrigin("post:p1:u:ada/saved")).toBe("u:ada/saved");
    expect(carriedOrigin("stream:v2/saved")).toBe("saved");
    expect(carriedOrigin("saved")).toBeUndefined();
    expect(carriedOrigin(null)).toBeUndefined();
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

  // A row on a profile's opinions page (ProfileStances.md:19; copy-voice: `Back
  // to the opinions`, the list named by what it holds) — back to the page, on
  // the tab it was left on.
  it("names the opinions page, returning to the tab it was left on", () => {
    expect(backFor("opinions")).toEqual({ href: "/profile/opinions", label: "Back to the opinions" });
    expect(backFor("opinions.by")).toEqual({ href: "/profile/opinions?tab=by", label: "Back to the opinions" });
    expect(backFor("opinions:ada")).toEqual({ href: "/u/ada/opinions", label: "Back to the opinions" });
    expect(backFor("opinions.by:ada")).toEqual({ href: "/u/ada/opinions?tab=by", label: "Back to the opinions" });
    // The page comes back as it was opened, its own origin and all (round 26).
    expect(backFor("opinions:ada/saved")).toEqual({ href: "/u/ada/opinions?from=saved", label: "Back to the opinions" });
    expect(backFor("opinions.by:mira/opinions:ada/search")).toEqual({
      href: "/u/mira/opinions?tab=by&from=opinions%3Aada%2Fsearch",
      label: "Back to the opinions",
    });
  });

  // TagPage.md:39: Back to Your tags from Your tags.
  it("names Your tags, the list a tag row opens from", () => {
    expect(backFor("yourTopics")).toEqual({ href: "/explore/topics", label: "Back to Your tags" });
  });

  it("never builds a profile link from an empty handle", () => {
    expect(backFor("u:")).toEqual({ href: "/feed", label: "Back to feed" });
  });

  // TagPage.md:37: a tag page entered with no history reads Back to Explore.
  it("wears the cold label a screen names when nothing is behind it", () => {
    expect(backFor(null, EXPLORE_COLD)).toEqual({ href: "/explore", label: "Back to Explore" });
    expect(backFor("nowhere", EXPLORE_COLD)).toEqual({ href: "/explore", label: "Back to Explore" });
    expect(backFor("feed", EXPLORE_COLD)).toEqual({ href: "/feed", label: "Back to feed" });
  });

  // ProfileOther.md:73 and TagPage.md:35: Back to the post, from its author
  // chip, opinions, references and tags-and-references sheet.
  it("names a post's detail, returning to it opened as it was", () => {
    expect(backFor(postOrigin("p1"))).toEqual({ href: "/posts/p1", label: "Back to the post" });
    expect(backFor(postOrigin("p1", "saved"))).toEqual({ href: "/posts/p1?from=saved", label: "Back to the post" });
    expect(backFor(postOrigin("p1", tagOrigin("coast", "search")))).toEqual({
      href: "/posts/p1?from=tag%3Acoast%2Fsearch",
      label: "Back to the post",
    });
    expect(carriedOrigin(personOrigin("ada", postOrigin("p1", "saved")))).toBe("post:p1:saved");
  });
});
