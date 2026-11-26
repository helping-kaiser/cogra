// THE CHANGE AND ITS RETRY ARE THE PRESSING ACCOUNT'S (auth.md "Multi-account
// device custody": every piece of material is bound "to the account it belongs
// to, never to a device-global slot"). A Retry the head handed out under A —
// a rendered button can hold it past a switch — is pressed after the tab is
// B's: it must not run A's signing as B's, and nothing of A's change stands
// for B. The line itself is A's, hidden under any other account and never
// erased by a switch (Profile.md:101: it "stands until Retry or the next
// change"; #659's "…stands under A's again").

import { afterEach, describe, expect, it, vi } from "vitest";

import { tokenStore } from "@/lib/session/token-store";
import { resetCarriedSnackbarForTests } from "@/lib/ui/carried-snackbar";
import {
  closeProfileChangeSeal,
  readProfileChange,
  resetProfileChangeForTests,
  signProfileChange,
  signProfileChangeFor,
  type ProfileChangeOutcome,
} from "./profile-change";
import { readSignedProfile, resetSignedProfileForTests } from "./signed-profile";

function signInAs(account: string): void {
  tokenStore.save({ accessToken: `access-${account}`, refreshToken: `refresh-${account}`, accountId: account });
}

const SIGNED = { profileId: "profile-a", fields: { displayName: "A's new name" } };

afterEach(() => {
  resetProfileChangeForTests();
  resetSignedProfileForTests();
  resetCarriedSnackbarForTests();
  tokenStore.clear();
});

/** A's change, closed while it signs, failing: the head's Retry, as A's head handed it out. */
async function failedUnderA(run: () => Promise<ProfileChangeOutcome>) {
  signInAs("acct-a");
  const signing = signProfileChange(run, { signed: SIGNED });
  closeProfileChangeSeal();
  await signing;
  const line = readProfileChange();
  if (line?.kind !== "failed") throw new Error(`expected A's failed line, got ${JSON.stringify(line)}`);
  return line.retry;
}

describe("a profile change's Retry keeps its account", () => {
  it("a Retry captured under A and pressed under B runs nothing; A's line stands again, and its Retry signs once", async () => {
    const run = vi
      .fn<() => Promise<ProfileChangeOutcome>>()
      .mockResolvedValueOnce({ kind: "offline" })
      .mockResolvedValue({ kind: "taken" });
    const retry = await failedUnderA(run);

    signInAs("acct-b");
    retry();
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
    expect(readProfileChange()).toBeNull();
    expect(readSignedProfile("profile-a")).toBeNull();

    // Profile.md:101: the line "stands until Retry or the next change" —
    // an account change is neither, so it is A's again under A.
    signInAs("acct-a");
    const line = readProfileChange();
    expect(line?.kind).toBe("failed");
    if (line?.kind === "failed") line.retry();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(readProfileChange()).toBeNull());
    expect(readSignedProfile("profile-a")).not.toBeNull();
  });

  it("A's line is hidden under B and stands again under A", async () => {
    await failedUnderA(async () => ({ kind: "offline" }));

    signInAs("acct-b");
    expect(readProfileChange()).toBeNull();
    signInAs("acct-a");
    expect(readProfileChange()?.kind).toBe("failed");
  });

  it("A's change answering not done after the switch is A's failed line: nothing under B, the line under A", async () => {
    signInAs("acct-a");
    let answer!: (outcome: ProfileChangeOutcome) => void;
    const signing = signProfileChange(() => new Promise((resolve) => (answer = resolve)), { signed: SIGNED });
    closeProfileChangeSeal();

    signInAs("acct-b");
    answer({ kind: "offline" });
    await signing;
    expect(readProfileChange()).toBeNull();
    signInAs("acct-a");
    expect(readProfileChange()?.kind).toBe("failed");
  });

  it("A's change taken after the switch lays nothing for B and leaves no line under A", async () => {
    signInAs("acct-a");
    let answer!: (outcome: ProfileChangeOutcome) => void;
    const signing = signProfileChange(() => new Promise((resolve) => (answer = resolve)), { signed: SIGNED });
    closeProfileChangeSeal();

    signInAs("acct-b");
    answer({ kind: "taken" });
    await signing;
    expect(readProfileChange()).toBeNull();
    expect(readSignedProfile("profile-a")).toBeNull();
    signInAs("acct-a");
    expect(readProfileChange()).toBeNull();
  });

  it("an act the owner guard stops before the signing did not sign: A's failed line, nothing run", async () => {
    const run = vi.fn<() => Promise<ProfileChangeOutcome>>().mockResolvedValue({ kind: "taken" });
    signInAs("acct-a");
    const pressedAs = "acct-a";
    signInAs("acct-b");
    const outcome = await signProfileChangeFor(pressedAs, run);

    expect(run).not.toHaveBeenCalled();
    expect(outcome.kind).toBe("offline");
    expect(readProfileChange()).toBeNull();
    signInAs("acct-a");
    expect(readProfileChange()?.kind).toBe("failed");
  });

  it("the Retry under the same account asks the same change again", async () => {
    const run = vi
      .fn<() => Promise<ProfileChangeOutcome>>()
      .mockResolvedValueOnce({ kind: "offline" })
      .mockResolvedValue({ kind: "taken" });
    const retry = await failedUnderA(run);

    retry();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(readProfileChange()).toBeNull());
    expect(readSignedProfile("profile-a")).not.toBeNull();
  });

  it("a Retry pressed under A whose answer arrives under B lays nothing and draws nothing", async () => {
    let answer!: (outcome: ProfileChangeOutcome) => void;
    const run = vi
      .fn<() => Promise<ProfileChangeOutcome>>()
      .mockResolvedValueOnce({ kind: "offline" })
      .mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const retry = await failedUnderA(run);

    retry();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    signInAs("acct-b");
    answer({ kind: "taken" });
    await Promise.resolve();
    await Promise.resolve();

    expect(readProfileChange()).toBeNull();
    expect(readSignedProfile("profile-a")).toBeNull();
  });
});
