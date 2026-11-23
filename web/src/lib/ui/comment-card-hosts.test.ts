// @vitest-environment node
// EVERY HOST OF THE COMMENT CARD KEEPS THE POINTER'S DOOR (jakob 2026-11-23,
// design seams 405 / 417; FeedKinds.md:27, History.md:51, Saved.md:29,
// ProfileComments.md:45, ProfileCommentsOwn.md:15, TagPage.md:23): the line
// naming a post opens the post itself, the line naming a comment opens the
// thread at that comment, the rest of the card opens the thread at the card's
// own comment — "on every surface that draws the card".
//
// The door lives in the one card (`comment-feed-card.tsx`), so a host keeps it
// by drawing that card under a registered name and proving the door in its own
// test. This census fails when a screen starts drawing the card without being
// listed here — the new host then has to name its registered pointer and its
// test before it ships.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../../", import.meta.url));
const NODES = readFileSync(new URL("../../../../design/designs/canonical/nodes.json", import.meta.url), "utf-8");

type Host = {
  /** The card's registered path on this host (`<path>.target` is its pointer). */
  readonly node: string;
  /** The host's test that taps the pointer (both kinds) and the card. */
  readonly test: string;
};

/** Every screen that draws `CommentFeedCard`, by its source under `src/`. */
const HOSTS: Record<string, Host> = {
  "app/feed/feed-view.tsx": { node: "feed.commentCard", test: "app/feed/feed-filter.test.tsx" },
  "app/history/history-view.tsx": { node: "history.commentCard", test: "app/history/history-view.test.tsx" },
  "app/saved/saved-view.tsx": { node: "saved.commentCard", test: "app/saved/saved-view.test.tsx" },
  "app/topics/[name]/topic-view.tsx": { node: "tagPage.commentCard", test: "app/topics/[name]/topic-view.test.tsx" },
  "app/u/[handle]/profile-comments.tsx": {
    node: "profile.comments.commentCard",
    test: "app/u/[handle]/profile-comments.test.tsx",
  },
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__generated__" ? [] : sources(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });
}

const drawing = sources(SRC)
  .filter((path) => /<CommentFeedCard\b/.test(readFileSync(path, "utf-8")))
  .map((path) => relative(SRC, path).split("\\").join("/"))
  .filter((path) => path !== "lib/ui/comment-feed-card.tsx")
  .sort();

describe("the comment card's hosts", () => {
  it("lists every screen that draws the card", () => {
    expect(drawing).toEqual(Object.keys(HOSTS).sort());
  });

  for (const [file, host] of Object.entries(HOSTS)) {
    it(`${file} draws the card under its registered name, its pointer registered`, () => {
      const source = readFileSync(join(SRC, file), "utf-8");
      // The node path is written whole, or as the page's NODE constant + `.commentCard`.
      const [root] = host.node.split(".commentCard");
      const named =
        source.includes(`"${host.node}"`) || (source.includes(`"${root}"`) && source.includes("}.commentCard`"));
      expect(named).toBe(true);
      expect(NODES).toContain(`"${host.node}.target"`);
    });

    it(`${file} proves the pointer's door in ${host.test}`, () => {
      const test = readFileSync(join(SRC, host.test), "utf-8");
      expect(test).toContain(`${host.node}.target`);
      // The post-naming pointer opens the post itself: no `comment=` in its href.
      expect(test).toMatch(/POINTER DOOR/);
    });
  }
});
