import { describe, expect, it } from "vitest";

import {
  isQueryable,
  queryShape,
  REFERENCE_BATCH_CAP,
  snippet,
  targetKindWord,
  targetView,
  untypedTargetView,
} from "./normalize";

describe("queryShape", () => {
  it("reads a bare word as a handle — the server tries it that way too", () => {
    expect(queryShape("ada")).toBe("handle");
  });

  it("reads an @-sigilled word as a handle", () => {
    expect(queryShape("@ada")).toBe("handle");
  });

  it("resolves nothing for a #-sigilled query — a topic is tagged, not referenced", () => {
    expect(queryShape("#rust")).toBeNull();
    expect(queryShape("#")).toBeNull();
  });

  it("reads a UUID as an id", () => {
    expect(queryShape("0b7f8c1e-2a3d-4b5c-8d9e-1f2a3b4c5d6e")).toBe("id");
  });

  it("resolves nothing for an empty or whitespace-only query", () => {
    expect(queryShape("")).toBeNull();
    expect(queryShape("   ")).toBeNull();
  });

  it("resolves nothing for a bare @ still being typed", () => {
    expect(queryShape("@")).toBeNull();
  });
});

describe("isQueryable", () => {
  it("gates the lookup on a query that resolves nothing", () => {
    expect(isQueryable("")).toBe(false);
    expect(isQueryable("#rust")).toBe(false);
    expect(isQueryable("ada")).toBe(true);
  });
});

describe("snippet", () => {
  it("collapses whitespace so a multi-line body reads as one chip line", () => {
    expect(snippet("a\n\n  b   c")).toBe("a b c");
  });

  it("elides a body past the label bound", () => {
    const long = "x".repeat(80);
    expect(snippet(long).length).toBeLessThanOrEqual(48);
    expect(snippet(long).endsWith("…")).toBe(true);
  });

  it("names an empty body rather than rendering a blank chip", () => {
    expect(snippet("")).toBe("untitled");
    expect(snippet(null)).toBe("untitled");
  });
});

describe("targetView", () => {
  it("renders a User as a mention opening the profile", () => {
    const view = targetView(
      { __typename: "User", handle: "ada", displayName: { value: "Ada" } },
      "u1",
    );
    // The actor chip needs the pair, not a flat label (D16).
    expect(view).toEqual({
      kind: "User",
      label: "@ada",
      href: "/u/ada",
      handle: "ada",
      displayName: "Ada",
    });
  });

  it("carries a null display name through, so the chip falls back to the handle", () => {
    const view = targetView({ __typename: "User", handle: "ada" }, "u1");
    expect(view.handle).toBe("ada");
    expect(view.displayName).toBeNull();
  });

  it("prefers a post's title over its body for the chip label", () => {
    const view = targetView(
      {
        __typename: "Post",
        id: "p1",
        title: { value: "On folding" },
        content: { value: "the body" },
        author: { handle: "ada" },
      },
      "p1",
    );
    expect(view.label).toBe("@ada: On folding");
    expect(view.href).toBe("/posts/p1");
  });

  it("falls back to a post's body when it carries no title", () => {
    const view = targetView(
      {
        __typename: "Post",
        id: "p1",
        title: { value: null },
        content: { value: "the body" },
        author: { handle: "ada" },
      },
      "p1",
    );
    expect(view.label).toBe("@ada: the body");
  });

  it("opens a referenced comment on the post carrying it", () => {
    const view = targetView(
      {
        __typename: "Comment",
        id: "c1",
        content: { value: "a reply" },
        author: { handle: "bob" },
        target: { __typename: "Post", id: "p1" },
      },
      "c1",
    );
    expect(view.kind).toBe("Comment");
    expect(view.label).toBe("@bob: a reply");
    expect(view.href).toBe("/posts/p1");
  });

  it("walks a nested reply up to the post it reads on", () => {
    const view = targetView(
      {
        __typename: "Comment",
        id: "c2",
        content: { value: "deep" },
        author: { handle: "bob" },
        target: {
          __typename: "Comment",
          target: { __typename: "Post", id: "p9" },
        },
      },
      "c2",
    );
    expect(view.href).toBe("/posts/p9");
  });

  it("navigates nowhere when no post is reachable from the comment", () => {
    const view = targetView(
      {
        __typename: "Comment",
        id: "c1",
        content: { value: "orphan" },
        author: null,
        target: null,
      },
      "c1",
    );
    expect(view.href).toBeNull();
    expect(view.label).toBe("orphan");
  });

  it("falls back to the untyped chip for a class this client does not render", () => {
    // D21 removes Hashtag from the union; anything unrecognised must
    // degrade to the plain chip rather than fail to render.
    const view = targetView({ __typename: "Something", id: "x1" }, "x1");
    expect(view).toEqual({ kind: null, label: "x1", href: null });
  });
});

describe("untypedTargetView", () => {
  it("renders a claim with no display row off its raw identifier, navigating nowhere", () => {
    expect(untypedTargetView("l1-record-7")).toEqual({
      kind: null,
      label: "l1-record-7",
      href: null,
    });
  });
});

describe("targetKindWord", () => {
  it("calls a reference to a profile a mention (D20)", () => {
    expect(targetKindWord("User")).toBe("mention");
  });

  it("never says cite or citation in a reader-facing word", () => {
    for (const kind of ["User", "Post", "Comment", null] as const) {
      expect(targetKindWord(kind)).not.toMatch(/cit/i);
    }
  });
});

describe("REFERENCE_BATCH_CAP", () => {
  it("mirrors the server's ten-per-batch cap", () => {
    expect(REFERENCE_BATCH_CAP).toBe(10);
  });
});
