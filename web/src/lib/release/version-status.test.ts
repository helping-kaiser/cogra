import { describe, expect, it } from "vitest";

import {
  datelineText,
  datelineWord,
  releaseDate,
  releaseKey,
  versionStatus,
  type Release,
} from "./version-status";

const release = (version: string, day: number): Release => ({
  version,
  notes: [`What ${version} brings`],
  patchNotesUrl: `https://github.com/helping-kaiser/cogra/releases/tag/v${version}`,
  releasedAt: new Date(2026, 8, day, 12).toISOString(),
});

// Newest first, as the registry serves them.
const LIST = [release("0.1.3", 30), release("0.1.2", 28), release("0.1.1", 25), release("0.1.0", 20)];

describe("versionStatus", () => {
  it("is not behind when the running version heads the list", () => {
    const status = versionStatus(LIST, "0.1.3");
    expect(status).toEqual({ behind: false, newest: null, installedIndex: 0 });
  });

  it("is behind when a newer release stands above the running one", () => {
    const status = versionStatus(LIST, "0.1.2");
    expect(status.behind).toBe(true);
    expect(status.newest?.version).toBe("0.1.3");
    expect(status.installedIndex).toBe(1);
  });

  it("names the newest release when more than one release behind", () => {
    const status = versionStatus(LIST, "0.1.0");
    expect(status.behind).toBe(true);
    expect(status.newest?.version).toBe("0.1.3");
    expect(status.installedIndex).toBe(3);
  });

  it("is not behind, and marks nothing, when the registry does not list the running version", () => {
    for (const running of ["0.2.0-dev", ""]) {
      const status = versionStatus(LIST, running);
      expect(status).toEqual({ behind: false, newest: null, installedIndex: -1 });
      expect(LIST.map((_, i) => datelineWord(status, i))).toEqual([null, null, null, null]);
    }
  });

  it("reads the registry's order, never the version strings", () => {
    // 0.9.0 shipped after 0.10.0 here: the list's head is newest whatever it is called.
    const list = [release("0.9.0", 29), release("0.10.0", 28)];
    expect(versionStatus(list, "0.10.0").newest?.version).toBe("0.9.0");
  });
});

describe("datelineWord", () => {
  it("says installed on the running version and nothing else when it is the newest", () => {
    const status = versionStatus(LIST, "0.1.3");
    expect(LIST.map((_, i) => datelineWord(status, i))).toEqual(["installed", null, null, null]);
  });

  it("says newest only on the head of the list, installed on the running one, never current", () => {
    const status = versionStatus(LIST, "0.1.1");
    expect(LIST.map((_, i) => datelineWord(status, i))).toEqual(["newest", null, "installed", null]);
  });
});

describe("the dateline", () => {
  it("is the version, its word and its date as dd.mm.yyyy", () => {
    const r = { ...release("0.1.2", 30), releasedAt: new Date(2026, 8, 30, 9).toISOString() };
    expect(releaseDate(r.releasedAt)).toBe("30.09.2026");
    expect(datelineText(r, "installed")).toBe("Version 0.1.2 · installed · 30.09.2026");
    expect(datelineText(r, null)).toBe("Version 0.1.2 · 30.09.2026");
  });

  it("keys a release by its normalized version", () => {
    expect(releaseKey("0.1.2")).toBe("0-1-2");
    expect(releaseKey("1.0.0-RC.1")).toBe("1-0-0-rc-1");
  });
});
