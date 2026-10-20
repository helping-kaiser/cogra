// What the comment card's head row names, per target (FeedCommentShapes.md;
// `_shared.jsx` `commentTarget`).

import { describe, expect, it } from "vitest";

import { headRowOf, type CommentTargetView } from "./comment-feed-card";

const moderated = (value: string | null, status = "NORMAL") => ({ value, status });

function post(overrides: Partial<Extract<CommentTargetView, { __typename: "Post" }>> = {}): CommentTargetView {
  return {
    __typename: "Post",
    id: "p1",
    title: moderated("The long way home"),
    content: moderated("Took the coast road"),
    attachments: [],
    author: { handle: "ada" },
    moderationStatus: "NORMAL",
    ...overrides,
  };
}

describe("headRowOf", () => {
  it("a_post_reads_its_title_over_its_author_with_the_text_posts_mark", () => {
    expect(headRowOf(post())).toMatchObject({
      kind: "post",
      title: "The long way home",
      sub: "@ada",
      cover: null,
      removed: false,
      label: "“The long way home” — @ada",
    });
  });

  it("an_untitled_post_is_named_by_its_first_words_in_the_titles_place", () => {
    expect(headRowOf(post({ title: moderated(null), content: moderated("Low tide at six\nanyone?") })).title).toBe(
      "Low tide at six",
    );
  });

  it("a_post_with_pictures_takes_its_cover_as_the_mark", () => {
    const row = headRowOf(
      post({ attachments: [{ url: "https://m/c.webp", status: "NORMAL", mimeType: "image/webp" }] }),
    );
    expect(row.cover).toBe("https://m/c.webp");
  });

  it("a_removed_post_keeps_its_row_reading_the_removal_mark_with_an_empty_tile", () => {
    const row = headRowOf(post({ title: moderated(null, "REDACTED"), content: moderated(null, "REDACTED") }));
    expect(row).toMatchObject({ title: "Removed by its author", sub: "@ada", removed: true, cover: null });
  });

  it("a_comment_it_answers_is_named_by_its_author_over_its_first_words", () => {
    const row = headRowOf({
      __typename: "Comment",
      id: "c0",
      content: moderated("The light is real\nI saw it."),
      author: { handle: "sol" },
      moderationStatus: "NORMAL",
    });
    expect(row).toMatchObject({ kind: "comment", title: "@sol", sub: "The light is real", label: "@sol's comment" });
  });
});
