import { beforeEach, describe, expect, it } from "vitest";

import { afterSignIn, heldAskLink, holdAskLink } from "./held-link";

const ASK = "0b2f5c1e-7a43-4c8e-9d0a-5e6f1a2b3c4d";

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("the held ask link", () => {
  it("brings a valid ask back after sign-in", () => {
    holdAskLink(ASK);
    expect(heldAskLink()).toBe(ASK);
    expect(afterSignIn()).toBe(`/vouch/${ASK}`);
  });

  // The id arrives from the URL and the post-sign-in redirect is built from it,
  // so anything that is not the capability's own shape must never be held.
  it.each([
    ["a path traversal", "../../settings"],
    ["a protocol-relative URL", "//evil.example"],
    ["an id with a query", `${ASK}?next=/x`],
    ["an id with trailing text", `${ASK}/extra`],
    ["a short id", "k1"],
    ["the empty string", ""],
  ])("holds nothing for %s", (_name, id) => {
    holdAskLink(id);
    expect(heldAskLink()).toBeNull();
    expect(afterSignIn()).toBe("/");
  });

  it("ignores a stored value that was not written by holdAskLink", () => {
    window.sessionStorage.setItem("cogra.heldAskLink", "../../logout");
    expect(heldAskLink()).toBeNull();
    expect(afterSignIn()).toBe("/");
  });

  it("accepts the uppercase form of a UUID", () => {
    holdAskLink(ASK.toUpperCase());
    expect(heldAskLink()).toBe(ASK.toUpperCase());
  });
});
