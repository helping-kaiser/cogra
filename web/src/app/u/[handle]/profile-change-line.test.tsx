import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  closeProfileChangeSeal,
  signProfileChange,
  type ProfileChangeOutcome,
} from "@/lib/profile/profile-change";
import { ProfileChangeLine } from "./profile-view";

function deferred() {
  let answer!: (outcome: ProfileChangeOutcome) => void;
  const promise = new Promise<ProfileChangeOutcome>((resolve) => (answer = resolve));
  return { promise, answer };
}

afterEach(() => {
  vi.useRealTimers();
});

// ProfileEditSeal.md:43-47; Profile.jsx's `change` chip: the line under one's
// own head for a change whose seal closed while it signed.
describe("the line under the profile's head", () => {
  it("stands empty while nothing is signing", () => {
    render(<ProfileChangeLine />);
    expect(screen.queryByTestId("profile-change-line")).not.toBeInTheDocument();
  });

  it("reads Signing… once 200ms pass, then That didn't sign. with Retry", async () => {
    vi.useFakeTimers();
    render(<ProfileChangeLine />);
    const first = deferred();
    const second = deferred();
    const run = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    act(() => void signProfileChange(run));
    act(() => closeProfileChangeSeal());
    expect(screen.queryByTestId("profile-change-line")).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(200));
    expect(screen.getByTestId("profile-change-line")).toHaveTextContent("Signing…");

    await act(async () => first.answer({ kind: "offline" }));
    const line = screen.getByTestId("profile-change-line");
    expect(line).toHaveAttribute("role", "alert");
    expect(line).toHaveTextContent("That didn't sign.");

    fireEvent.click(screen.getByTestId("profile-change-line-retry"));
    expect(run).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTime(200));
    expect(screen.getByTestId("profile-change-line")).toHaveTextContent("Signing…");
    await act(async () => second.answer({ kind: "taken" }));
    expect(screen.queryByTestId("profile-change-line")).not.toBeInTheDocument();
  });
});
