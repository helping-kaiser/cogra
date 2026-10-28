// Pins the landing's zero-state family to its master,
// `design/components/stance/StanceReadout.jsx` (round 18, jakob 2026-10-20):
// the tail, the four heads and the borrowed-view line are read out of the
// master, not transcribed, so a wording edited there and not here fails.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BORROWED_KEPT_LINE,
  CURRENT_LABEL,
  EMPTY_PICK_LABEL,
  landingLine,
  NO_STANDING_LABEL,
  PICK_LABEL,
  RESULTING_LABEL,
  SEVERED_LABEL,
  signedLine,
  StanceLandingLine,
  StanceStanding,
  UNREACHABLE_TAIL,
  unreachableHead,
} from "./stance-readout";
import {
  DIRECTED_LABEL,
  formatDimension,
  formatStancePair,
  INTEREST_LABEL,
  STANCE_SEVERANCE_WORDS,
} from "./stance-format";
import { alternatesHelp, padHelp, unreachableHelp } from "./stance-pad-help";

// jsdom's `import.meta.url` is not a file URL; vitest runs from `web/`
// (seen-tracker.test.tsx's precedent).
const MASTER = readFileSync(
  join(process.cwd(), "..", "design", "components", "stance", "StanceReadout.jsx"),
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
    ).toBe("Resulting opinion 🤔 Interested, no side taken — this won't shape anyone's feed.");
  });

  it("keeps severance's own line for (0, 0)", () => {
    expect(
      landingLine({ landing: { pDirected: 0, pInterest: 0 }, inert: true, severed: true }),
    ).toBe("This takes you back to zero.");
  });
});

// EmptySignConfirm.md (round 20/21): "the pad's landing under the pick reads
// Resulting opinion with 🤷 and Says nothing., never This takes you back to
// zero. GIVEN the pick lands at exactly (0, 0) and nothing stands".
describe("the empty sign's landing", () => {
  const empty = { landing: { pDirected: 0, pInterest: 0 }, inert: true, severed: true, empty: true };

  it("reads in the landing's own shape, never the walk-back's line", () => {
    expect(landingLine(empty)).toBe("Resulting opinion 🤷 Says nothing.");
    expect(MASTER).toContain("export const EMPTY_LANDING_WORDS = `${EMPTY_PICK_LABEL}.`;");
  });

  it("opens no door on its 🤷 even when the pad hands one", () => {
    render(<StanceLandingLine landing={empty} testIdPrefix="pad" onExplainZero={() => {}} />);
    expect(screen.queryByTestId("pad-landing-zero")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByTestId("pad-landing")).toHaveTextContent(/Resulting opinion.*🤷.*Says nothing./u);
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

// THE PAD'S WORDS ARE THE MASTER'S, read out of it rather than transcribed
// (padconform round, jakob 2026-10-21): a wording edited there and not here
// fails here.
describe("the readouts' words and the family's way out", () => {
  it("label the three readouts and the zero states as the master does", () => {
    expect(PICK_LABEL).toBe(masterString("PICK_LABEL"));
    expect(SEVERED_LABEL).toBe(masterString("SEVERED_LABEL"));
    expect(NO_STANDING_LABEL).toBe(masterString("NO_STANDING_LABEL"));
    expect(MASTER).toContain(`(names && names.current) || "${CURRENT_LABEL}"`);
    expect(MASTER).toContain(`(names && names.resulting) || "${RESULTING_LABEL}"`);
    expect(DIRECTED_LABEL).toBe(masterString("DIRECTED_LABEL"));
    expect(INTEREST_LABEL).toBe(masterString("INTEREST_LABEL"));
  });

  it("carries the person family's severance words verbatim", () => {
    const words = STANCE_SEVERANCE_WORDS;
    for (const field of ["control", "busy", "zero", "landing", "help", "helpAlternates"] as const) {
      expect(MASTER, field).toContain(`${field}: ${field === "zero" ? "SEVERED_LABEL" : JSON.stringify(words[field])}`);
    }
    expect(words.title("@ada")).toBe("Walk it all back?");
    expect(MASTER).toContain(words.effect("${targetLabel}"));
    expect(MASTER).toContain(words.sum("${targetLabel}", "${total}"));
    expect(MASTER).toContain(words.gone("${targetLabel}"));
  });

  it("carries the pad's and the alternates' help lines and the 🤔's three verbatim", () => {
    for (const line of [...padHelp(), ...alternatesHelp()]) {
      expect(MASTER).toContain(JSON.stringify(line).slice(1, -1));
    }
    const [held, inert, wayOut] = unreachableHelp(undefined, "this post");
    expect(MASTER).toContain(held);
    expect(MASTER).toContain(inert);
    expect(MASTER).toContain(wayOut.replace("Walk it back", "${severanceWords(names).control}"));
  });

  // StanceReadout.jsx `unreachableHelp` (round 21, seam 245 ask 18): the
  // first line names the list the target stays on, by the label's kind.
  it("names Your people for a person and Your topics for a topic", () => {
    expect(unreachableHelp(undefined, "@ada")[0]).toBe(
      "It still counts among your opinions — @ada stays under Your people.",
    );
    expect(unreachableHelp(undefined, "#saltmaps")[0]).toBe(
      "It still counts among your opinions — #saltmaps stays on Your topics.",
    );
    expect(unreachableHelp(undefined, "this comment")[0]).toBe("It still counts among your opinions.");
    expect(MASTER).toContain("`${targetLabel} stays on Your topics`");
  });

  it("writes a negative pair with U+2212, substituted by part, in en-US", () => {
    expect(formatStancePair({ pDirected: -0.55, pInterest: 0.2 })).toBe("−0.55 / +0.20");
    expect(MASTER).toContain('const MINUS_SIGN = "−";');
    expect(formatDimension(0)).toBe("+0.00");
    expect(formatDimension(-0.004)).toBe("−0.00");
  });
});

describe("the labelled readouts", () => {
  const live = { landing: { pDirected: 0.6, pInterest: 0.65 }, inert: false, severed: false };

  it("draw the face and a cg-exact pair under the label, the words only in the SR twin", () => {
    render(<StanceLandingLine landing={live} testIdPrefix="t" />);
    expect(screen.getByTestId("t-landing-label")).toHaveTextContent("Resulting opinion");
    expect(screen.getByTestId("t-landing-face")).toHaveTextContent("🤩");
    const exact = screen.getByTestId("t-landing-exact");
    expect(exact).toHaveTextContent("+0.60 / +0.65");
    expect(exact.className).toContain("cg-exact");
    const twin = screen.getByTestId("t-landing").querySelector(".sr-only");
    expect(twin).toHaveTextContent(
      "Resulting opinion: Really into this, For or against +0.60, How much reaches you +0.65",
    );
    // The word is never drawn.
    expect(screen.getByTestId("t-landing-face")).not.toHaveTextContent("Really into this");
  });

  it("read the standing as a sentence where there is no opinion yet", () => {
    render(<StanceStanding pick={{ pDirected: 0.1, pInterest: 0.1 }} bundle={null} targetLabel="@ada" testIdPrefix="t" />);
    expect(screen.getByTestId("t-standing")).toHaveTextContent("🤷 No opinion on @ada yet.");
  });

  // FACES FOLLOW THE VALUE (seam 242/243): every pair drawn here reads the
  // rule — 🤷 at (0, 0), 🤔 with the state at one zero — never the table.
  const EMPTY_SIGNED = {
    current: { pDirected: 0, pInterest: 0 },
    rawSum: { pDirected: 0, pInterest: 0 },
    records: 1,
    inert: true,
    severed: false,
    severance: { records: 1 },
  };

  it("draw the pick at one zero as 🤔 speaking its state, never a table face (PadStanding.md:25)", () => {
    render(
      <StanceStanding pick={{ pDirected: 0.1, pInterest: 0 }} bundle={null} targetLabel="@ada" testIdPrefix="t" />,
    );
    expect(screen.getByTestId("t-face")).toHaveTextContent("🤔");
    expect(screen.getByTestId("t-pick").querySelector(".sr-only")).toHaveTextContent(
      "Your pick: For it, no interest either way, For or against +0.10, How much reaches you +0.00",
    );
  });

  it("draw a pick of exactly (0, 0) as 🤷 speaking Says nothing (PadStanding.md:27)", () => {
    expect(EMPTY_PICK_LABEL).toBe(masterString("EMPTY_PICK_LABEL"));
    render(
      <StanceStanding pick={{ pDirected: 0, pInterest: 0 }} bundle={null} targetLabel="@ada" testIdPrefix="t" />,
    );
    expect(screen.getByTestId("t-face")).toHaveTextContent("🤷");
    expect(screen.getByTestId("t-pick").querySelector(".sr-only")).toHaveTextContent(
      "Your pick: Says nothing, For or against +0.00, How much reaches you +0.00",
    );
  });

  it("read an empty sign's standing as 🤷 Says nothing, never Walked back (PadStanding.md:29)", () => {
    render(
      <StanceStanding pick={{ pDirected: 0.1, pInterest: 0.1 }} bundle={EMPTY_SIGNED} targetLabel="@ada" testIdPrefix="t" />,
    );
    expect(screen.getByTestId("t-standing-face")).toHaveTextContent("🤷");
    const twin = screen.getByTestId("t-standing").querySelector(".sr-only");
    expect(twin).toHaveTextContent("Current opinion: Says nothing, For or against +0.00, How much reaches you +0.00");
    expect(twin).not.toHaveTextContent(SEVERED_LABEL);
  });

  it("read a standing at one zero as 🤔 speaking its state (PadStanding.md:31)", () => {
    render(
      <StanceStanding
        pick={{ pDirected: 0.1, pInterest: 0.1 }}
        bundle={{ ...EMPTY_SIGNED, current: { pDirected: 0, pInterest: 0.35 }, rawSum: { pDirected: 0, pInterest: 0.35 } }}
        targetLabel="@ada"
        testIdPrefix="t"
      />,
    );
    expect(screen.getByTestId("t-standing-face")).toHaveTextContent("🤔");
    expect(screen.getByTestId("t-standing").querySelector(".sr-only")).toHaveTextContent(
      "Current opinion: Interested, no side taken",
    );
  });

  it("give an empty sign the ORDINARY snackbar, 🤷 speaking Says nothing (EmptySignConfirm.md:27)", () => {
    render(<p data-testid="line">{signedLine({ pDirected: 0, pInterest: 0 }, 1, false, "@ada")}</p>);
    const line = screen.getByTestId("line");
    expect(line.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      "Signed, still settling. Current opinion 🤷 (+0.00 / +0.00)",
    );
    expect(line).toHaveTextContent("Current opinion: Says nothing");
    expect(line).not.toHaveTextContent(SEVERED_LABEL);
  });

  it("give a one-zero standing's snackbar 🤔, never a table face (PadStanding.md:31)", () => {
    render(<p data-testid="line">{signedLine({ pDirected: 0.4, pInterest: 0 }, 1, false, "@ada")}</p>);
    expect(screen.getByTestId("line").querySelector('[aria-hidden="true"]')).toHaveTextContent("🤔");
    expect(screen.getByTestId("line")).toHaveTextContent("Current opinion: For it, no interest either way");
  });

  it("build the signed line from spans: the face, a cg-exact pair, a spoken twin", () => {
    render(<p data-testid="line">{signedLine({ pDirected: 0.55, pInterest: 0.2 }, 3, false, "this post")}</p>);
    const line = screen.getByTestId("line");
    expect(line.querySelector(".cg-exact")).toHaveTextContent("(+0.55 / +0.20)");
    expect(line).toHaveTextContent(
      "Signed 3 things, still settling. Current opinion: Like this, For or against +0.55, How much reaches you +0.20",
    );
  });
});
