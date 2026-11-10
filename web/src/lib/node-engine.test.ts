// @vitest-environment node
//
// The Node version is pinned in three places that must agree: `.nvmrc` (CI's
// `setup-node` and local nvm), the Containerfile's base image, and the
// `engines` range npm enforces. `npm ci` output depends on the npm that ships
// with the Node, so an unpinned install on another major can resolve and lay
// out the tree differently — a range plus `engine-strict` turns that into a
// refusal at install time instead of a puzzling build later.

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const pinned = read(".nvmrc").trim().replace(/^v/, "");
const [major, minor, patch] = pinned.split(".").map(Number) as [number, number, number];

describe("the Node engine pin", () => {
  it("declares an engines range that admits exactly the .nvmrc version's major, from that release up", () => {
    const engines = (JSON.parse(read("package.json")) as { engines?: { node?: string } }).engines;
    expect(engines?.node).toBe(`>=${major}.${minor}.${patch} <${major + 1}`);
  });

  it("makes npm refuse an install on a Node outside it", () => {
    const rc = read(".npmrc")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#"));
    expect(rc).toContain("engine-strict=true");
  });

  it("matches the image the app ships in", () => {
    const containerfile = readFileSync(
      path.resolve(root, "../deploy/Containerfile.web"),
      "utf8",
    );
    const bases = [...containerfile.matchAll(/^FROM \S*node:(\S+?)-/gm)].map((m) => m[1]);
    expect(bases.length).toBeGreaterThan(0);
    for (const base of bases) expect(base).toBe(pinned);
  });
});
