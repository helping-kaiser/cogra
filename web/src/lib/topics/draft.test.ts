import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONFIDENCE,
  DEFAULT_RELEVANCE,
  newTagDraft,
  tagChanges,
  type TagDraft,
} from "./draft";

function tag(name: string, relevance = DEFAULT_RELEVANCE, confidence = DEFAULT_CONFIDENCE): TagDraft {
  return { name, relevance, confidence };
}

describe("newTagDraft", () => {
  it("opens on the server's own defaults (F6)", () => {
    expect(newTagDraft("rust")).toEqual({ name: "rust", relevance: 0.1, confidence: 1 });
  });
});

describe("tagChanges", () => {
  it("stages nothing when the draft matches what is there", () => {
    expect(tagChanges([tag("rust")], [tag("rust")])).toEqual([]);
  });

  it("stages a Tag act for an added topic", () => {
    expect(tagChanges([], [tag("rust")])).toEqual([{ kind: "tag", tag: tag("rust") }]);
  });

  it("stages an untag for a removed topic — never a deletion", () => {
    expect(tagChanges([tag("rust")], [])).toEqual([{ kind: "untag", name: "rust" }]);
  });

  it("re-declares a topic whose parameters moved", () => {
    const moved = tag("rust", 0.8, 0.5);
    expect(tagChanges([tag("rust")], [moved])).toEqual([{ kind: "tag", tag: moved }]);
  });

  it("counts one act per change, adds before removals", () => {
    const changes = tagChanges([tag("rust"), tag("wasm")], [tag("rust"), tag("webdev")]);
    expect(changes).toEqual([
      { kind: "tag", tag: tag("webdev") },
      { kind: "untag", name: "wasm" },
    ]);
  });

  it("treats a re-added name with the same parameters as untouched", () => {
    const before = [tag("rust", 0.4, 0.9)];
    expect(tagChanges(before, [tag("rust", 0.4, 0.9)])).toEqual([]);
  });
});
