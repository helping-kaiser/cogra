import { afterEach, describe, expect, it } from "vitest";

import { keepWords, readKeptWords, REPORT_ADDRESS, reportMailto, reportTime } from "./report-problem";

const FACTS = { to: REPORT_ADDRESS, version: "0.1.2", runningOn: "Firefox on Linux", time: "01.10.2026, 14:32" };

function parse(url: string) {
  const [target, query] = url.slice("mailto:".length).split("?");
  const params = new URLSearchParams(query.replace(/\+/g, "%2B"));
  return { target, subject: params.get("subject"), body: params.get("body") };
}

describe("reportMailto (ReportProblem.md: the words, the four facts and the report address)", () => {
  it("addresses the report address and carries the words, then the other three facts", () => {
    const draft = parse(reportMailto("It broke.\nTwice.", FACTS));
    expect(draft.target).toBe("reports@cogra.local");
    expect(draft.subject).toBe("Report a problem");
    expect(draft.body).toBe("It broke.\nTwice.\r\n\r\nVersion: 0.1.2\r\nRunning on: Firefox on Linux\r\nTime: 01.10.2026, 14:32");
  });

  it("still carries the facts when the field is empty or only spaces (ReportProblemEmpty.md)", () => {
    for (const words of ["", "   "]) {
      expect(parse(reportMailto(words, FACTS)).body).toBe(
        "Version: 0.1.2\r\nRunning on: Firefox on Linux\r\nTime: 01.10.2026, 14:32",
      );
    }
  });

  it("encodes the words so no character can end the body or start a header", () => {
    const url = reportMailto("a & b = c? #1 100%", FACTS);
    expect(url).not.toMatch(/body=[^&]*&[^b]/);
    expect(parse(url).body?.startsWith("a & b = c? #1 100%")).toBe(true);
  });
});

describe("reportTime", () => {
  it("reads the house date then the minute", () => {
    expect(reportTime(new Date(2026, 9, 1, 14, 32, 59))).toBe("01.10.2026, 14:32");
  });
});

describe("the kept words", () => {
  afterEach(() => window.localStorage.clear());

  it("keeps the words for the next visit", () => {
    keepWords("half a report");
    expect(readKeptWords()).toBe("half a report");
  });

  it("keeps nothing for an empty field (ReportProblemEmpty.md: NEVER words are kept)", () => {
    keepWords("something");
    keepWords("");
    expect(readKeptWords()).toBe("");
    expect(window.localStorage.length).toBe(0);
  });
});
