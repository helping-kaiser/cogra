// What a kept pick's row names its target by (KeptPicksReview.md:9; copy-voice,
// *The kept picks' review*): the live name, or the removal mark in its place.

import { describe, expect, it } from "vitest";

import { commentPreview, postPreview, profilePreview, removalMark } from "./kept-preview";

const post = {
  title: { value: "The long way home", status: "NORMAL" },
  content: { value: "", status: "NORMAL" },
  attachments: [],
  author: { handle: "ada" },
};

describe("a kept pick's preview", () => {
  it("names a live post by its title and its author", () => {
    expect(postPreview({ ...post, removal: null })).toMatchObject({
      name: "The long way home — @ada",
      sub: "Post",
      removed: null,
    });
  });

  it("wears Removed by its author for an author's or an account's removal", () => {
    expect(postPreview({ ...post, removal: { by: "AUTHOR" } }).removed).toBe("Removed by its author");
    expect(commentPreview({ content: null, author: null, removal: { by: "ACCOUNT" } }).removed).toBe(
      "Removed by its author",
    );
  });

  it("wears Removed under the platform's rules for a moderation verdict", () => {
    expect(removalMark({ by: "MODERATION" })).toBe("Removed under the platform's rules");
  });

  it("names a deleted account by its mark", () => {
    expect(
      profilePreview({ handle: "mira", displayName: { value: null, status: "REDACTED" }, avatar: null }),
    ).toMatchObject({ kind: "person", removed: "Deleted account", src: null });
  });
});
