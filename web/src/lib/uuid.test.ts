import { describe, expect, it } from "vitest";

import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("accepts the canonical 8-4-4-4-12 form, either case", () => {
    expect(isUuid("0b2f5c1e-7a43-4c8e-9d0a-5e6f1a2b3c4d")).toBe(true);
    expect(isUuid("0B2F5C1E-7A43-4C8E-9D0A-5E6F1A2B3C4D")).toBe(true);
  });

  it("rejects anything else, including a UUID embedded in more text", () => {
    for (const bad of [
      "",
      "k1",
      "0b2f5c1e7a434c8e9d0a5e6f1a2b3c4d",
      "0b2f5c1e-7a43-4c8e-9d0a-5e6f1a2b3c4d/",
      " 0b2f5c1e-7a43-4c8e-9d0a-5e6f1a2b3c4d",
      "0b2f5c1e-7a43-4c8e-9d0a-5e6f1a2b3c4d\n",
      "../0b2f5c1e-7a43-4c8e-9d0a-5e6f1a2b3c4d",
      "gb2f5c1e-7a43-4c8e-9d0a-5e6f1a2b3c4d",
    ]) {
      expect(isUuid(bad)).toBe(false);
    }
  });
});
