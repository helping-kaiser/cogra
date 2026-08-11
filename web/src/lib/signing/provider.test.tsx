// The provider's teardown wiring: the flow's progress belongs to the
// account whose poll produced it, so a sign-out or an account switch
// (which cross-tab can perform without ever passing signedOut) resets
// the loop. The loop itself is covered by registration-flow.test.ts.

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { renderWithProviders } from "@/test/providers";
import { fakeFlow } from "@/test/registration";

beforeEach(() => {
  window.localStorage.clear();
});

describe("RegistrationProvider", () => {
  it("resets the flow on sign-out", () => {
    const store = createTokenStore();
    store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
    const { flow } = fakeFlow();
    renderWithProviders(<span />, { store, flow });
    vi.mocked(flow.reset).mockClear();

    act(() => store.clear());
    expect(flow.reset).toHaveBeenCalled();
  });

  it("resets the flow when the active account changes", () => {
    const store = createTokenStore();
    store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
    const { flow } = fakeFlow();
    renderWithProviders(<span />, { store, flow });
    vi.mocked(flow.reset).mockClear();

    act(() => store.save({ accessToken: "a2", refreshToken: "r2", accountId: "acct-2" }));
    expect(flow.reset).toHaveBeenCalled();
  });

  it("does not reset while the same account's session merely rotates", () => {
    const store = createTokenStore();
    store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
    const { flow } = fakeFlow();
    renderWithProviders(<span />, { store, flow });
    vi.mocked(flow.reset).mockClear();

    act(() => store.save({ accessToken: "a2", refreshToken: "r2", accountId: "acct-1" }));
    expect(flow.reset).not.toHaveBeenCalled();
  });
});
