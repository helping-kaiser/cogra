import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useProfileChange, type ProfileChangeOutcome } from "@/lib/profile/profile-change";
import {
  BUG_FACT,
  BUG_TITLE,
  OFFLINE_LINE,
  ProfileEditSeal,
  PUBLIC_RECORD_LINE,
  WRITE_RULE_FACT,
  WRITE_RULE_TITLE,
} from "./profile-edit-seal";

/** A signing the test answers when it chooses. */
function deferred() {
  let answer!: (outcome: ProfileChangeOutcome) => void;
  const promise = new Promise<ProfileChangeOutcome>((resolve) => (answer = resolve));
  return { promise, answer };
}

function HeadReadout() {
  const change = useProfileChange();
  return <output data-testid="head">{change?.kind ?? "none"}</output>;
}

function draw({
  sign = vi.fn(async (): Promise<ProfileChangeOutcome> => ({ kind: "taken" })),
  hasKey = async () => true,
}: {
  sign?: () => Promise<ProfileChangeOutcome>;
  hasKey?: () => Promise<boolean>;
} = {}) {
  const handlers = { onTaken: vi.fn(), onBack: vi.fn(), onLeave: vi.fn(), onClosed: vi.fn() };
  render(
    <>
      <ProfileEditSeal
        avatar={<span data-testid="disc" />}
        change="A new picture, bio and website"
        hasKey={hasKey}
        sign={sign}
        {...handlers}
      />
      <HeadReadout />
    </>,
  );
  return handlers;
}

const sign = () => screen.getByTestId("profile-edit-seal-sign");
const press = async () => {
  await act(async () => {
    fireEvent.click(sign());
  });
};

afterEach(() => {
  vi.useRealTimers();
});

// ProfileEditSeal.jsx / .md:3-11.
describe("what the seal reads back", () => {
  it("reads the change back as one Profile row, 1 thing, signed, with the record line", () => {
    draw();
    expect(screen.getByRole("heading", { name: "What you sign" })).toHaveFocus();
    expect(screen.getByText("Your profile")).toBeInTheDocument();
    const acts = screen.getByTestId("profile-edit-seal-acts");
    expect(acts).toHaveTextContent("Profile");
    expect(acts).toHaveTextContent("A new picture, bio and website");
    expect(acts).toHaveTextContent("1 thing, signed");
    // No all-or-nothing line.
    expect(acts).not.toHaveTextContent(/together|none does/);
    expect(screen.getByTestId("profile-edit-seal-record")).toHaveTextContent(PUBLIC_RECORD_LINE);
    expect(sign()).toHaveTextContent("Sign the change");
  });

  it("opens Changing your profile from its ?", () => {
    draw();
    fireEvent.click(screen.getByTestId("profile-edit-seal-help"));
    expect(screen.getByTestId("profile-edit-seal-help-dialog")).toHaveAttribute("aria-label", "Changing your profile");
  });
});

describe("the commit", () => {
  it("signs, and hands the taken change to its host", async () => {
    const handlers = draw();
    await press();
    expect(handlers.onTaken).toHaveBeenCalledTimes(1);
  });

  it("refuses a second press until the signing answers, and never dims", async () => {
    const pending = deferred();
    const run = vi.fn(() => pending.promise);
    draw({ sign: run });
    await press();
    await press();
    expect(run).toHaveBeenCalledTimes(1);
    expect(sign()).not.toBeDisabled();
    await act(async () => pending.answer({ kind: "taken" }));
  });

  it("reads Signing the change… past 200ms and the slow line past 5s, never before", async () => {
    vi.useFakeTimers();
    const pending = deferred();
    draw({ sign: () => pending.promise });
    await press();
    expect(sign()).toHaveTextContent("Sign the change");
    await act(async () => vi.advanceTimersByTime(200));
    expect(sign()).toHaveTextContent("Signing the change…");
    expect(screen.getByTestId("profile-edit-seal-acts")).not.toHaveTextContent("Still signing");
    await act(async () => vi.advanceTimersByTime(4800));
    expect(screen.getByTestId("profile-edit-seal-acts")).toHaveTextContent(
      "Still signing — the network is slow right now.",
    );
    await act(async () => pending.answer({ kind: "taken" }));
  });

  it("reads Close from the press, and closing never cancels: the head takes the wait", async () => {
    const pending = deferred();
    const handlers = draw({ sign: () => pending.promise });
    await press();
    expect(screen.getByTestId("profile-edit-seal-back")).toHaveTextContent("Close");
    expect(screen.getByLabelText("Close", { selector: "[data-testid=header-leave]" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("profile-edit-seal-back"));
    expect(handlers.onClosed).toHaveBeenCalledTimes(1);
    expect(handlers.onBack).not.toHaveBeenCalled();
    expect(screen.getByTestId("head")).toHaveTextContent("signing");
    // Its answer, after Close, is the head's: a failure stands there.
    await act(async () => pending.answer({ kind: "offline" }));
    expect(screen.getByTestId("head")).toHaveTextContent("failed");
    expect(handlers.onTaken).not.toHaveBeenCalled();
  });
});

describe("what a press can come to", () => {
  it("puts the fault line and Retry in the commit's place when no answer came", async () => {
    const run = vi
      .fn<() => Promise<ProfileChangeOutcome>>()
      .mockResolvedValueOnce({ kind: "offline" })
      .mockResolvedValueOnce({ kind: "taken" });
    const handlers = draw({ sign: run });
    await press();
    expect(screen.getByTestId("profile-edit-seal-offline")).toHaveTextContent(OFFLINE_LINE);
    expect(screen.queryByTestId("profile-edit-seal-sign")).not.toBeInTheDocument();
    expect(screen.getByTestId("profile-edit-seal-acts")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId("profile-edit-seal-retry"));
    });
    expect(handlers.onTaken).toHaveBeenCalledTimes(1);
  });

  it("puts the write rule's notice there, with Not now and never Retry", async () => {
    draw({ sign: async () => ({ kind: "writeRule" }) });
    await press();
    const notice = screen.getByTestId("profile-edit-seal-write-rule");
    expect(notice).toHaveTextContent(WRITE_RULE_TITLE);
    expect(notice).toHaveTextContent(WRITE_RULE_FACT);
    expect(notice.className).not.toMatch(/error/);
    expect(screen.queryByTestId("profile-edit-seal-retry")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("profile-edit-seal-not-now"));
    expect(sign()).toHaveTextContent("Sign the change");
  });

  it("puts the bug's notice there: Try again, Report a problem, Not now back to the edit", async () => {
    const handlers = draw({ sign: async () => ({ kind: "bug" }) });
    await press();
    const notice = screen.getByTestId("profile-edit-seal-bug");
    expect(notice).toHaveTextContent(BUG_TITLE);
    expect(notice).toHaveTextContent(BUG_FACT);
    expect(screen.getByTestId("profile-edit-seal-try-again")).toBeInTheDocument();
    expect(screen.getByTestId("profile-edit-seal-report")).toHaveTextContent("Report a problem");
    fireEvent.click(screen.getByTestId("profile-edit-seal-not-now"));
    expect(handlers.onBack).toHaveBeenCalledTimes(1);
  });

  it("puts the key-absent notice there when the key is not on this browser, signing nothing", async () => {
    const run = vi.fn(async (): Promise<ProfileChangeOutcome> => ({ kind: "taken" }));
    draw({ sign: run, hasKey: async () => false });
    await press();
    expect(screen.getByTestId("profile-edit-seal-key-absent")).toBeInTheDocument();
    expect(screen.getByTestId("profile-edit-seal-restore")).toHaveAttribute("href", "/restore");
    expect(screen.queryByText("Keep the draft, restore later")).not.toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("profile-edit-seal-not-now"));
    expect(sign()).toBeInTheDocument();
  });
});

describe("the ways out before the press", () => {
  it("goes one stage back from Back and the arrow, and leaves from the X", () => {
    const handlers = draw();
    fireEvent.click(screen.getByTestId("profile-edit-seal-back"));
    fireEvent.click(screen.getByLabelText("Back a step"));
    expect(handlers.onBack).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByLabelText("Leave"));
    expect(handlers.onLeave).toHaveBeenCalledTimes(1);
  });
});
