import { describe, expect, it } from "vitest";

import { deviceLabel } from "./device-label";

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/126.0.0.0`;
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

describe("deviceLabel", () => {
  it("names browser and system", () => {
    expect(deviceLabel(CHROME_WINDOWS)).toBe("Chrome on Windows");
    expect(deviceLabel(FIREFOX_LINUX)).toBe("Firefox on Linux");
    expect(deviceLabel(SAFARI_IPHONE)).toBe("Safari on iOS");
  });

  it("recognizes Edge before its Chrome token", () => {
    expect(deviceLabel(EDGE_WINDOWS)).toBe("Edge on Windows");
  });

  it("falls back gracefully on an unknown agent", () => {
    expect(deviceLabel("SomethingElse/1.0")).toBe("Browser");
  });
});
