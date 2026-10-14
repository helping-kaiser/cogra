// What a Saved row says (Saved.md; design digest items 49 and 50; B11).

import { describe, expect, it } from "vitest";

import type { SavedNode } from "@/lib/api/saved-api";
import { REMOVED_BY_AUTHOR, mediaStandIn, savedRow, slug } from "./row-content";

const moderated = (value: string | null, status = "NORMAL") => ({
  __typename: "ModeratedText" as const,
  value,
  status,
});

function post(overrides: Record<string, unknown> = {}): SavedNode {
  return {
    __typename: "Post",
    id: "p1",
    title: moderated("The long way home"),
    description: moderated(null),
    content: moderated("Took the coast road instead of the tunnel."),
    attachments: [],
    moderationStatus: "NORMAL",
    sensitiveReason: null,
    author: { __typename: "User", id: "u1", handle: "ada" },
    ...overrides,
  } as unknown as SavedNode;
}

function comment(overrides: Record<string, unknown> = {}): SavedNode {
  return {
    __typename: "Comment",
    id: "c1",
    content: moderated("The third headland light is real\nI walked there."),
    attachments: [],
    moderationStatus: "NORMAL",
    sensitiveReason: null,
    author: { __typename: "User", id: "u2", handle: "tobias" },
    post: {
      __typename: "Post",
      id: "p1",
      title: moderated("The long way home"),
      content: moderated("words"),
      attachments: [],
      author: { __typename: "User", id: "u1", handle: "ada" },
    },
    ...overrides,
  } as unknown as SavedNode;
}

function person(overrides: Record<string, unknown> = {}): SavedNode {
  return {
    __typename: "User",
    id: "u3",
    handle: "mira",
    displayName: moderated("Mira Voss"),
    bio: moderated("Runs the stand by the sea wall."),
    avatar: null,
    ...overrides,
  } as unknown as SavedNode;
}

const video = [{ __typename: "MediaAttachment", mimeType: "video/mp4" }];
const pictures = [{ __typename: "MediaAttachment", mimeType: "image/webp" }];

describe("savedRow", () => {
  it("a_titled_words_post_reads_its_title_handle_and_words", () => {
    const row = savedRow(post())!;
    expect(row.title).toBe("The long way home");
    expect(row.aside).toBe("@ada");
    expect(row.second).toBe("Took the coast road instead of the tunnel.");
    expect(row.disc).toEqual({ kind: "glyph", glyph: "dynamic_feed" });
    expect(row.key).toBe("the-long-way-home");
    expect(row.href).toBe("/posts/p1?from=saved");
  });

  it("a_titled_media_posts_second_line_is_its_description_else_drops", () => {
    expect(savedRow(post({ attachments: pictures, description: moderated("All of it.") }))!.second).toBe(
      "All of it.",
    );
    expect(savedRow(post({ attachments: pictures }))!.second).toBeUndefined();
  });

  it("an_untitled_words_post_takes_its_first_line_and_the_rest_below", () => {
    const row = savedRow(post({ title: moderated(null), content: moderated("Hello there\nand more\nwords") }))!;
    expect(row.title).toBe("Hello there");
    expect(row.second).toBe("and more words");
    expect(row.key).toBe("hello-there");
  });

  it("an_untitled_media_post_is_named_by_b11_with_no_second_line_and_no_aside", () => {
    const row = savedRow(post({ title: moderated(null), content: moderated(null), attachments: video }))!;
    expect(row.title).toBe("A video by @ada");
    expect(row.second).toBeUndefined();
    // The title already names the handle.
    expect(row.aside).toBeUndefined();
    expect(savedRow(post({ title: moderated(null), content: moderated(null), attachments: pictures }))!.title).toBe(
      "Pictures by @ada",
    );
  });

  it("a_comment_takes_its_first_line_and_names_its_threads_post", () => {
    const row = savedRow(comment())!;
    expect(row.title).toBe("The third headland light is real");
    expect(row.aside).toBe("@tobias");
    expect(row.second).toBe("on The long way home");
    expect(row.disc).toEqual({ kind: "glyph", glyph: "chat_bubble" });
    // Landing on the comment: the thread opens over its post.
    expect(row.href).toBe("/posts/p1?comment=c1&from=saved");
  });

  it("a_wordless_comment_is_named_as_a_media_post_is", () => {
    const row = savedRow(comment({ content: moderated(null), attachments: pictures }))!;
    expect(row.title).toBe("Pictures by @tobias");
    expect(row.aside).toBeUndefined();
  });

  it("a_replys_on_line_names_the_threads_post_by_its_stand_in_when_untitled", () => {
    const row = savedRow(
      comment({
        post: {
          __typename: "Post",
          id: "p9",
          title: moderated(null),
          content: moderated(null),
          attachments: video,
          author: { __typename: "User", id: "u1", handle: "ada" },
        },
      }),
    )!;
    expect(row.second).toBe("on A video by @ada");
  });

  it("a_removed_post_or_comment_stays_reading_removed_by_its_author", () => {
    const removedPost = savedRow(post({ title: moderated(null, "REDACTED"), content: moderated(null, "REDACTED") }))!;
    expect(removedPost.title).toBe(REMOVED_BY_AUTHOR);
    expect(removedPost.titleQuiet).toBe(true);
    expect(removedPost.second).toBeUndefined();
    expect(removedPost.href).toBe("/posts/p1?from=saved");
    const removedComment = savedRow(comment({ content: moderated(null, "REDACTED") }))!;
    expect(removedComment.title).toBe(REMOVED_BY_AUTHOR);
    expect(removedComment.disc).toEqual({ kind: "glyph", glyph: "chat_bubble" });
  });

  it("a_sensitive_things_second_line_gives_way_to_its_reason", () => {
    const row = savedRow(post({ moderationStatus: "SENSITIVE", sensitiveReason: "spoilers" }))!;
    expect(row.title).toBe("The long way home");
    expect(row.second).toBe("spoilers");
  });

  it("a_person_reads_name_handle_and_bio", () => {
    const row = savedRow(person())!;
    expect(row.title).toBe("Mira Voss");
    expect(row.aside).toBe("@mira");
    expect(row.second).toBe("Runs the stand by the sea wall.");
    expect(row.disc).toEqual({ kind: "monogram", name: "Mira Voss" });
    expect(row.key).toBe("mira-voss");
    expect(row.href).toBe("/u/mira?from=saved");
  });

  it("a_person_brings_their_picture", () => {
    const row = savedRow(person({ avatar: { __typename: "MediaAttachment", url: "https://m/a.webp", status: "NORMAL" } }))!;
    expect(row.disc).toEqual({ kind: "picture", src: "https://m/a.webp", name: "Mira Voss" });
  });

  it("a_nameless_person_takes_the_handle_with_no_aside_and_no_bio_line", () => {
    const row = savedRow(person({ displayName: moderated(null), bio: moderated(null) }))!;
    expect(row.title).toBe("@mira");
    expect(row.aside).toBeUndefined();
    expect(row.second).toBeUndefined();
  });

  it("a_deleted_account_wears_the_reserved_disc_and_no_aside", () => {
    const row = savedRow(person({ displayName: moderated(null, "REDACTED"), bio: moderated(null, "REDACTED") }))!;
    expect(row.disc).toEqual({ kind: "redacted" });
    expect(row.aside).toBeUndefined();
    expect(row.second).toBeUndefined();
    expect(row.key).toBe("u3");
  });
});

describe("slug", () => {
  it("lowercases_and_runs_other_characters_into_one_dash", () => {
    expect(slug("The long way home")).toBe("the-long-way-home");
    expect(slug("  Sunday at the tide market!! ")).toBe("sunday-at-the-tide-market");
    expect(slug("Pictures by @ada")).toBe("pictures-by-ada");
  });
});

describe("mediaStandIn", () => {
  it("names_a_clip_a_video_and_anything_else_pictures", () => {
    expect(mediaStandIn([{ mimeType: "video/mp4" }, { mimeType: "image/png" }], "ada")).toBe("A video by @ada");
    expect(mediaStandIn([{ mimeType: "image/png" }], "ada")).toBe("Pictures by @ada");
  });
});
