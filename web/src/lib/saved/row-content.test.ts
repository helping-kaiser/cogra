// How a row names content with no title of its own (design digest item 50; B11).

import { describe, expect, it } from "vitest";

import { mediaStandIn, postTitle } from "./row-content";

const moderated = (value: string | null, status = "NORMAL") => ({ value, status });

describe("postTitle", () => {
  it("a_titled_post_reads_its_title", () => {
    expect(
      postTitle({ title: moderated("The long way home"), content: moderated("words"), attachments: [] }),
    ).toBe("The long way home");
  });

  it("an_untitled_words_post_reads_its_first_line", () => {
    expect(postTitle({ title: moderated(null), content: moderated("Hello there\nand more"), attachments: [] })).toBe(
      "Hello there",
    );
  });

  it("an_untitled_media_post_is_named_by_b11", () => {
    expect(
      postTitle({
        title: moderated(null),
        content: moderated(null),
        attachments: [{ mimeType: "video/mp4" }],
        author: { handle: "ada" },
      }),
    ).toBe("A video by @ada");
  });
});

describe("mediaStandIn", () => {
  it("names_a_clip_a_video_and_anything_else_pictures", () => {
    expect(mediaStandIn([{ mimeType: "video/mp4" }, { mimeType: "image/png" }], "ada")).toBe("A video by @ada");
    expect(mediaStandIn([{ mimeType: "image/png" }], "ada")).toBe("Pictures by @ada");
  });
});
