import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionProvider } from "@/lib/session/provider";
import { createTokenStore } from "@/lib/session/token-store";
import AppLayout from "./layout";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

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

  it("replaces a signed-out visit to /login and renders nothing", () => {
    renderGate();
    expect(screen.queryByTestId("gated-child")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
