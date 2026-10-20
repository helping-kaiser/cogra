// Pins the landing's zero-state family to its master,
// `design/components/stance/StanceReadout.jsx` (round 18, jakob 2026-10-20):
// the tail, the four heads and the borrowed-view line are read out of the
// master, not transcribed, so a wording edited there and not here fails.

import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BORROWED_KEPT_LINE,
  landingLine,
  StanceLandingLine,
  UNREACHABLE_TAIL,
  unreachableHead,
} from "./stance-readout";

const MASTER = readFileSync(
  new URL("../../../../design/components/stance/StanceReadout.jsx", import.meta.url),
  "utf-8",
);

function masterString(name: string): string {
  const found = MASTER.match(new RegExp(`export const ${name} = "([^"]+)";`));
  expect(found, `the master no longer exports ${name} as a literal`).not.toBeNull();
  return found![1];
}

describe("the unreachable landing", () => {
  it("carries the master's tail and borrowed-view line verbatim", () => {
    expect(UNREACHABLE_TAIL).toBe(masterString("UNREACHABLE_TAIL"));
    expect(BORROWED_KEPT_LINE).toBe(masterString("BORROWED_KEPT_LINE"));
  });

  it("names the state by the sign of the number that stands, as the master does", () => {
    const heads = [
      { pDirected: 0, pInterest: 0.4, head: "Interested, no side taken" },
      { pDirected: 0, pInterest: -0.4, head: "Rather not see it, no side taken" },
      { pDirected: 0.4, pInterest: 0, head: "For it, no interest either way" },
      { pDirected: -0.4, pInterest: 0, head: "Against it, no interest either way" },
    ];
    for (const { head, ...pair } of heads) {
      expect(MASTER).toContain(`"${head}"`);
      expect(unreachableHead(pair)).toBe(head);
    }
  });

  it("reads under the landing label, wearing 🤔 and never the table's face", () => {
    expect(
      landingLine({ landing: { pDirected: 0, pInterest: 0.4 }, inert: true, severed: false }),
    ).toBe("This leaves you at: 🤔 Interested, no side taken — this won't shape anyone's feed.");
  });

  it("keeps severance's own line for (0, 0)", () => {
    expect(
      landingLine({ landing: { pDirected: 0, pInterest: 0 }, inert: true, severed: true }),
    ).toBe("This pick nets everything you've said about it back to nothing.");
  });
});

describe("the borrowed-view line", () => {
  const inert = { landing: { pDirected: 0, pInterest: 0.4 }, inert: true, severed: false };
  const severed = { landing: { pDirected: 0, pInterest: 0 }, inert: true, severed: true };
  const live = { landing: { pDirected: 0.3, pInterest: 0.4 }, inert: false, severed: false };

  it("rides an unreachable or severed landing while the reader borrows", () => {
    for (const landing of [inert, severed]) {
      const { unmount } = render(<StanceLandingLine landing={landing} testIdPrefix="t" borrowed />);
      expect(screen.getByTestId("t-landing-borrowed")).toHaveTextContent(BORROWED_KEPT_LINE);
      unmount();
    }
  });

  it("never rides a live landing, nor a reader whose view is their own", () => {
    const { unmount } = render(<StanceLandingLine landing={live} testIdPrefix="t" borrowed />);
    expect(screen.queryByTestId("t-landing-borrowed")).not.toBeInTheDocument();
    unmount();
    render(<StanceLandingLine landing={inert} testIdPrefix="t" />);
    expect(screen.queryByTestId("t-landing-borrowed")).not.toBeInTheDocument();
  });
});
