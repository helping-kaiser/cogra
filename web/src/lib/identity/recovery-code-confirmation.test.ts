// @vitest-environment node

import { describe, expect, it } from "vitest";

import { recoveryCodeTypedBack } from "./recovery-code-confirmation";

const shown = "ABCDE-FGHJK-MNPQR-STVWX-YZ0123";

describe("recoveryCodeTypedBack", () => {
  it("matches the code typed back as shown", () => {
    expect(recoveryCodeTypedBack(shown, shown)).toBe(true);
  });

  it("leaves the separators and the case to the reader", () => {
    expect(recoveryCodeTypedBack(shown, "abcdefghjkmnpqrstvwxyz0123")).toBe(true);
    expect(recoveryCodeTypedBack(shown, " ABCDE FGHJK MNPQR STVWX YZ0123 ")).toBe(true);
  });

  it("reads the confusable letters as their digits", () => {
    // Someone transcribing by hand writes what they see; `1` reads back
    // as `I` or `l`, `0` as `O`.
    expect(recoveryCodeTypedBack(shown, "ABCDE-FGHJK-MNPQR-STVWX-YZOI23")).toBe(true);
  });

  it("refuses a wrong character", () => {
    expect(recoveryCodeTypedBack(shown, "ABCDE-FGHJK-MNPQR-STVWX-YZ0124")).toBe(false);
  });

  it("refuses a truncated code", () => {
    expect(recoveryCodeTypedBack(shown, "ABCDE-FGHJK-MNPQR-STVWX")).toBe(false);
  });

  it("never matches an empty answer", () => {
    expect(recoveryCodeTypedBack(shown, "")).toBe(false);
    expect(recoveryCodeTypedBack(shown, "  --  ")).toBe(false);
  });
});
