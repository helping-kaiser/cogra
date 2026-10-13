import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionProvider } from "@/lib/session/provider";
import { createTokenStore } from "@/lib/session/token-store";
import AppLayout from "./layout";

const { replace, useLeavingDeleted } = vi.hoisted(() => ({
  replace: vi.fn(),
  useLeavingDeleted: vi.fn(() => false),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));
vi.mock("@/lib/deletion/deletion-status", () => ({ useLeavingDeleted }));

beforeEach(() => {
  window.localStorage.clear();
  replace.mockClear();
});

function renderGate(store = createTokenStore()) {
  return render(
    <SessionProvider store={store}>
      <AppLayout>
        <div data-testid="gated-child" />
      </AppLayout>
    </SessionProvider>,
  );
}

describe("(app) gate", () => {
  it("renders children for a signed-in session", () => {
    const store = createTokenStore();
    store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
    renderGate(store);
    expect(screen.getByTestId("gated-child")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("leaves_an_applicant_who_just_deleted_to_the_bare_view", () => {
    // The deletion's provider lands them (DeleteAccount.md:29); the gate's
    // ordinary sign-in redirect must not race it.
    useLeavingDeleted.mockReturnValueOnce(true);
    renderGate();
    expect(screen.queryByTestId("gated-child")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("replaces a signed-out visit to /login and renders nothing", () => {
    renderGate();
    expect(screen.queryByTestId("gated-child")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
