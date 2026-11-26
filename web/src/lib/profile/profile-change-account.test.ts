// THE CHANGE AND ITS RETRY ARE THE PRESSING ACCOUNT'S (auth.md "Multi-account
// device custody": every piece of material is bound "to the account it belongs
// to, never to a device-global slot"). A Retry the head handed out under A —
// a rendered button can hold it past a switch — is pressed after the tab is
// B's: it must not run A's signing as B's, and nothing of A's change stands
// for B. The app's twin: ProfileChanges.kt `Owner` / `retry(owner, act)`.

import { afterEach, describe, expect, it, vi } from "vitest";

import { tokenStore } from "@/lib/session/token-store";
import { resetCarriedSnackbarForTests } from "@/lib/ui/carried-snackbar";
import {
  closeProfileChangeSeal,
  readProfileChange,
  resetProfileChangeForTests,
  signProfileChange,
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
  it("a Retry captured under A and pressed under B runs nothing", async () => {
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
  });

  it("A's line goes at the account change, and is not there when A comes back", async () => {
    await failedUnderA(async () => ({ kind: "offline" }));

    signInAs("acct-b");
    expect(readProfileChange()).toBeNull();
    signInAs("acct-a");
    expect(readProfileChange()).toBeNull();
  });

  it("A's change answering after the switch draws nothing, under B or under A again", async () => {
    signInAs("acct-a");
    let answer!: (outcome: ProfileChangeOutcome) => void;
    const signing = signProfileChange(() => new Promise((resolve) => (answer = resolve)), { signed: SIGNED });
    closeProfileChangeSeal();

    signInAs("acct-b");
    answer({ kind: "offline" });
    await signing;
    expect(readProfileChange()).toBeNull();
    signInAs("acct-a");
    expect(readProfileChange()).toBeNull();
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
