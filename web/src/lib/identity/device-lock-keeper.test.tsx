// The device lock's start-time duties (sign-out-custody §3.4-§3.5): every
// page load finishes interrupted locks; a signed-in "don't remember" start
// retries a lock that never arrived.

import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { renderWithProviders } from "@/test/providers";
import { DeviceLockKeeper } from "./device-lock-keeper";

function fakeEngine() {
  return {
    recover: vi.fn(async () => {}),
    ensureHeld: vi.fn(async () => "held" as const),
  };
}

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

describe("DeviceLockKeeper", () => {
  it("finishes interrupted locks at every start, signed in or not", async () => {
    const engine = fakeEngine();
    renderWithProviders(<DeviceLockKeeper deviceLock={engine} store={fakeIdentityStore()} />);
    await waitFor(() => expect(engine.recover).toHaveBeenCalledTimes(1));
    expect(engine.ensureHeld).not.toHaveBeenCalled();
  });

  it("a_missing_lock_is_retried_on_signed_in_start", async () => {
    const engine = fakeEngine();
    renderWithProviders(
      <DeviceLockKeeper deviceLock={engine} store={fakeIdentityStore({ ephemeral: true })} />,
      { store: signedIn() },
    );
    await waitFor(() => expect(engine.ensureHeld).toHaveBeenCalledWith("acct-1"));
  });

  it("a remembered account's start asks for no lock", async () => {
    const engine = fakeEngine();
    renderWithProviders(<DeviceLockKeeper deviceLock={engine} store={fakeIdentityStore()} />, {
      store: signedIn(),
    });
    await waitFor(() => expect(engine.recover).toHaveBeenCalled());
    expect(engine.ensureHeld).not.toHaveBeenCalled();
  });
});
