import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { UserError } from "@/lib/api/outcome";
import type { WriteResult } from "@/lib/signing/write-signer";
import { CarriedSnackbar } from "@/lib/ui/carried-snackbar";
import { NOT_THROUGH_LINE, UNVERIFIED_LINE } from "@/lib/ui/error-messages";
import {
  closeProfileChangeSeal,
  outcomeOf,
  PROFILE_SIGNED,
  signProfileChange,
  useProfileChange,
  useProfileChangesLanded,
  type ProfileChangeOutcome,
  type ProfileChangeState,
} from "./profile-change";

function Readout() {
  const change: ProfileChangeState | null = useProfileChange();
  const landed = useProfileChangesLanded();
  return (
    <>
      <output data-testid="readout">{`${change?.kind ?? "none"} ${landed}`}</output>
      {change?.kind === "failed" && (
        <button type="button" data-testid="retry" onClick={change.retry}>
          Retry
        </button>
      )}
    </>
  );
}

function deferred() {
  let answer!: (outcome: ProfileChangeOutcome) => void;
  const promise = new Promise<ProfileChangeOutcome>((resolve) => (answer = resolve));
  return { promise, answer };
}

const readout = () => screen.getByTestId("readout").textContent;

// ProfileEditSeal.md:41-47; Profile.jsx's `change` chip.
describe("a profile change and the seal that started it", () => {
  it("leaves the answer to an open seal, keeping nothing", async () => {
    render(<Readout />);
    const pending = deferred();
    let outcome: ProfileChangeOutcome | null = null;
    act(() => void signProfileChange(() => pending.promise).then((o) => (outcome = o)));
    expect(readout()).toBe("signing 0");
    await act(async () => pending.answer({ kind: "bug" }));
    expect(outcome).toEqual({ kind: "bug" });
    expect(readout()).toBe("none 0");
  });

  it("lands a change taken after Close: the line goes, the profile reads again, the snackbar confirms", async () => {
    render(
      <>
        <Readout />
        <CarriedSnackbar />
      </>,
    );
    const pending = deferred();
    act(() => void signProfileChange(() => pending.promise));
    act(() => closeProfileChangeSeal());
    await act(async () => pending.answer({ kind: "taken" }));
    expect(readout()).toBe("none 1");
    expect(screen.getByTestId("carried-snackbar")).toHaveTextContent(PROFILE_SIGNED);
  });

  it("stands a failure after Close under the head, whose Retry asks the same change again", async () => {
    render(<Readout />);
    const first = deferred();
    const second = deferred();
    const run = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    act(() => void signProfileChange(run));
    act(() => closeProfileChangeSeal());
    await act(async () => first.answer({ kind: "offline" }));
    expect(readout()).toBe("failed 0");

    act(() => screen.getByTestId("retry").click());
    expect(readout()).toBe("signing 0");
    expect(run).toHaveBeenCalledTimes(2);
    await act(async () => second.answer({ kind: "taken" }));
    expect(readout()).toBe("none 1");
  });

  it("reads a signing that throws as no answer", async () => {
    render(<Readout />);
    let outcome: ProfileChangeOutcome | null = null;
    await act(async () => {
      outcome = await signProfileChange(() => Promise.reject(new Error("socket")));
    });
    expect(outcome).toEqual({ kind: "offline" });
  });
});

// NetworkError.md:3, :13-19 — what one signing came to, by code.
describe("outcomeOf", () => {
  const refusedWith = (code: UserError["code"], field: readonly string[] | null = null): WriteResult => ({
    kind: "refused",
    id: "w0",
    errors: [{ code, message: "", field }],
  });
  const internal = new CombinedGraphQLErrors({ errors: [{ message: "no", extensions: { code: "INTERNAL" } }] });

  it.each(["FORBIDDEN", "INTERNAL", "SIGNATURE_INVALID"] as const)("reads %s as not through", (code) => {
    expect(outcomeOf([refusedWith(code)])).toEqual({ kind: "notThrough", line: NOT_THROUGH_LINE });
  });

  it("reads a BAD_INPUT naming no field as not through, one naming a field as the bug", () => {
    expect(outcomeOf([refusedWith("BAD_INPUT")])).toEqual({ kind: "notThrough", line: NOT_THROUGH_LINE });
    expect(outcomeOf([refusedWith("BAD_INPUT", ["bio"])])).toEqual({ kind: "bug" });
  });

  it("reads EMAIL_NOT_VERIFIED in its own line", () => {
    expect(outcomeOf([refusedWith("EMAIL_NOT_VERIFIED")])).toEqual({ kind: "notThrough", line: UNVERIFIED_LINE });
  });

  it("keeps the write rule's notice and the no-answer line", () => {
    expect(outcomeOf([refusedWith("WRITE_RULE_FAILED")])).toEqual({ kind: "writeRule" });
    expect(outcomeOf([{ kind: "failed", id: "w0", cause: new Error("offline") }])).toEqual({ kind: "offline" });
  });

  it("reads an INTERNAL on a failed leg as an answer, not as no answer", () => {
    expect(outcomeOf([{ kind: "failed", id: "w0", cause: internal }])).toEqual({
      kind: "notThrough",
      line: NOT_THROUGH_LINE,
    });
  });
});

// Seam 355: the device's own refusal reads not through, never the bug notice.
it("reads a device's own refusal of the bytes as not through", () => {
  expect(outcomeOf([{ kind: "rejectedByDevice", id: "w0", reason: "bad seal" }])).toEqual({
    kind: "notThrough",
    line: NOT_THROUGH_LINE,
  });
});
