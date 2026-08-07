import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { SessionProvider, useAuthPhase } from "./provider";
import { createTokenStore } from "./token-store";

function Probe() {
  return <span data-testid="phase">{useAuthPhase()}</span>;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("SessionProvider", () => {
  it("derives signedOut from an empty store", () => {
    render(
      <SessionProvider store={createTokenStore()}>
        <Probe />
      </SessionProvider>,
    );
    expect(screen.getByTestId("phase")).toHaveTextContent("signedOut");
  });

  it("derives signedIn from token presence alone", () => {
    const store = createTokenStore();
    store.save({ accessToken: "a", refreshToken: "r" });
    render(
      <SessionProvider store={store}>
        <Probe />
      </SessionProvider>,
    );
    expect(screen.getByTestId("phase")).toHaveTextContent("signedIn");
  });

  it("flips the phase when the store changes", () => {
    const store = createTokenStore();
    render(
      <SessionProvider store={store}>
        <Probe />
      </SessionProvider>,
    );
    act(() => store.save({ accessToken: "a", refreshToken: "r" }));
    expect(screen.getByTestId("phase")).toHaveTextContent("signedIn");
    act(() => store.clear());
    expect(screen.getByTestId("phase")).toHaveTextContent("signedOut");
  });

  it("requires a provider", () => {
    expect(() => render(<Probe />)).toThrow(/SessionProvider/);
  });
});
