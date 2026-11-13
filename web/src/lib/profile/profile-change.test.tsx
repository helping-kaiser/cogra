import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CarriedSnackbar } from "@/lib/ui/carried-snackbar";
import {
  closeProfileChangeSeal,
  PROFILE_SIGNED,
  signProfileChange,
  useProfileChange,
  useProfileChangesLanded,
  type ProfileChangeOutcome,
  type ProfileChangeState,
} from "./profile-change";

let seen: ProfileChangeState | null = null;
function Readout() {
  const change = useProfileChange();
  const landed = useProfileChangesLanded();
  seen = change;
  return <output data-testid="readout">{`${change?.kind ?? "none"} ${landed}`}</output>;
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

    act(() => (seen as Extract<ProfileChangeState, { kind: "failed" }>).retry());
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
