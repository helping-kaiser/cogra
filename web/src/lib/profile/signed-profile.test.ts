import { beforeEach, describe, expect, it } from "vitest";

import { tokenStore } from "@/lib/session/token-store";
import {
  layChangedHandle,
  laySignedProfile,
  readSignedProfile,
  resetSignedProfileForTests,
  signedProfileAsked,
  signedProfileRead,
  withSigned,
} from "./signed-profile";

const signInAs = (accountId: string) =>
  tokenStore.save({ accessToken: `access-${accountId}`, refreshToken: `refresh-${accountId}`, accountId });

beforeEach(() => {
  window.localStorage.clear();
  resetSignedProfileForTests();
  signInAs("a");
});

// What the device signed into its own profile, laid over the head until a read
// asked after it answers (ProfileEditSeal.md:45, Profile.md:97).
describe("the signed profile laid over the head", () => {
  it("stands for the signing account on its own profile, and nowhere else", () => {
    laySignedProfile("a", { profileId: "pa", fields: { bio: "New." } }, 1);
    expect(readSignedProfile("pa")).toEqual({ bio: "New." });
    expect(readSignedProfile("pb")).toBeNull();
    expect(readSignedProfile(null)).toBeNull();
  });

  // auth.md "Multi-account device custody": nothing of account A reaches B.
  it("is let go when the tab's account changes, and never comes back for the first account", () => {
    laySignedProfile("a", { profileId: "pa", fields: { bio: "New." } }, 1);
    signInAs("b");
    expect(readSignedProfile("pa")).toBeNull();
    signInAs("a");
    expect(readSignedProfile("pa")).toBeNull();
  });

  it("is let go at sign-out", () => {
    laySignedProfile("a", { profileId: "pa", fields: { bio: "New." } }, 1);
    tokenStore.clear();
    signInAs("a");
    expect(readSignedProfile("pa")).toBeNull();
  });

  it("binds nothing without the profile's id", () => {
    laySignedProfile("a", { profileId: null, fields: { bio: "New." } }, 1);
    expect(readSignedProfile("pa")).toBeNull();
  });

  it("is confirmed only by a read asked after it was laid", () => {
    const before = signedProfileAsked();
    laySignedProfile("a", { profileId: "pa", fields: { bio: "New." } }, 1);
    signedProfileRead(before, "pa");
    expect(readSignedProfile("pa")).toEqual({ bio: "New." });
    // Another profile's read says nothing about this one.
    signedProfileRead(signedProfileAsked(), "pb");
    expect(readSignedProfile("pa")).toEqual({ bio: "New." });
    signedProfileRead(signedProfileAsked(), "pa");
    expect(readSignedProfile("pa")).toBeNull();
  });

  it("keeps a second change's fields over the first's, the first's untouched ones standing, until a read after both", () => {
    laySignedProfile("a", { profileId: "pa", fields: { displayName: "One", bio: "First." } }, 1);
    const between = signedProfileAsked();
    laySignedProfile("a", { profileId: "pa", fields: { avatar: { id: "m2", url: "https://m/2" } } }, 2);
    expect(readSignedProfile("pa")).toEqual({
      displayName: "One",
      bio: "First.",
      avatar: { id: "m2", url: "https://m/2" },
    });
    // The read asked between the two confirms neither.
    signedProfileRead(between, "pa");
    expect(readSignedProfile("pa")).not.toBeNull();
    signedProfileRead(signedProfileAsked(), "pa");
    expect(readSignedProfile("pa")).toBeNull();
  });

  it("never lets a change signed earlier but taken later override a later one's fields", () => {
    laySignedProfile("a", { profileId: "pa", fields: { bio: "Later." } }, 2);
    laySignedProfile("a", { profileId: "pa", fields: { bio: "Earlier.", websiteUrl: null } }, 1);
    expect(readSignedProfile("pa")).toEqual({ bio: "Later.", websiteUrl: null });
  });
});

describe("withSigned", () => {
  const read = {
    id: "pa",
    handle: "ada",
    displayName: { value: "Ada", status: "NORMAL" },
    bio: { value: "Old.", status: "NORMAL" },
    websiteUrl: { value: "https://old.example", status: "NORMAL" },
    avatar: { id: "m1", url: "https://m/1", altText: "old face", status: "NORMAL" },
  };

  it("leaves the read alone with nothing laid", () => {
    expect(withSigned(read, null)).toBe(read);
  });

  it("wears each field the change set and keeps the rest as read", () => {
    const shown = withSigned(read, { bio: null, avatar: { id: "m2", url: "https://m/2" } });
    expect(shown.bio).toEqual({ value: null, status: "NORMAL" });
    expect(shown.displayName).toBe(read.displayName);
    expect(shown.websiteUrl).toBe(read.websiteUrl);
    // A new asset: none of the old picture's facts carry over.
    expect(shown.avatar).toEqual({ id: "m2", url: "https://m/2", altText: null, status: "NORMAL" });
  });

  it("removes the picture where the change removed it", () => {
    expect(withSigned(read, { avatar: null }).avatar).toBeNull();
  });
});

// A handle Settings changed is laid like a signed edit (Profile.md:97).
describe("a changed handle laid over the head", () => {
  it("stands for the account on its profile until a read asked after it answers", () => {
    const before = signedProfileAsked();
    layChangedHandle("a", "pa", "ada_l");
    expect(readSignedProfile("pa")).toEqual({ handle: "ada_l" });
    signedProfileRead(before, "pa");
    expect(readSignedProfile("pa")).toEqual({ handle: "ada_l" });
    signedProfileRead(signedProfileAsked(), "pa");
    expect(readSignedProfile("pa")).toBeNull();
  });

  it("joins a signed change still laid, which keeps its fields and its order", () => {
    laySignedProfile("a", { profileId: "pa", fields: { bio: "New." } }, 2);
    layChangedHandle("a", "pa", "ada_l");
    expect(readSignedProfile("pa")).toEqual({ bio: "New.", handle: "ada_l" });
    // A change signed before the one laid still never overrides it.
    laySignedProfile("a", { profileId: "pa", fields: { bio: "Older." } }, 1);
    expect(readSignedProfile("pa")).toEqual({ bio: "New.", handle: "ada_l" });
  });

  it("is let go when the tab's account changes", () => {
    layChangedHandle("a", "pa", "ada_l");
    signInAs("b");
    expect(readSignedProfile("pa")).toBeNull();
    signInAs("a");
    expect(readSignedProfile("pa")).toBeNull();
  });

  it("is worn by the head", () => {
    const read = { handle: "ada", displayName: { value: "Ada" }, bio: { value: null }, websiteUrl: { value: null } };
    expect(withSigned(read, { handle: "ada_l" }).handle).toBe("ada_l");
  });
});
