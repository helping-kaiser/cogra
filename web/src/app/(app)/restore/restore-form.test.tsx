import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RestoreResult } from "@/lib/identity/restorer";
import { createTokenStore } from "@/lib/session/token-store";
import { renderWithProviders } from "@/test/providers";
import { fakeFlow } from "@/test/registration";
import { RestoreForm } from "./restore-form";

const { replace, restoreResult } = vi.hoisted(() => ({
  replace: vi.fn(),
  restoreResult: { value: { kind: "restored" } as RestoreResult },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));
// The crypto path is covered by the node-environment restorer suite;
// here the form logic is under test.
vi.mock("@/lib/identity/restorer", () => ({
  restoreActor: vi.fn(() => Promise.resolve(restoreResult.value)),
}));

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1" });
  return store;
}

function submit(code = "AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE") {
  fireEvent.change(screen.getByTestId("restore_code"), { target: { value: code } });
  fireEvent.click(screen.getByTestId("restore_submit"));
}

describe("RestoreForm", () => {
  beforeEach(() => {
    window.localStorage.clear();
    replace.mockClear();
    restoreResult.value = { kind: "restored" };
  });

  it("restores, pokes the loop, and goes home", async () => {
    const { flow } = fakeFlow();
    renderWithProviders(<RestoreForm />, { store: signedInStore(), flow });
    submit();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(flow.ensureAdvancing).toHaveBeenCalled();
  });

  it.each([
    ["malformedCode", /doesn't look like a recovery code/],
    ["wrongCode", /doesn't open your backup/],
    ["noBackup", /no key backup/],
  ] as const)("surfaces %s", async (kind, message) => {
    restoreResult.value = { kind } as RestoreResult;
    renderWithProviders(<RestoreForm />, { store: signedInStore() });
    submit();
    expect(await screen.findByTestId("restore_error")).toHaveTextContent(message);
    expect(replace).not.toHaveBeenCalled();
  });

  it("surfaces a transport failure", async () => {
    restoreResult.value = { kind: "failed", cause: new Error("net") };
    renderWithProviders(<RestoreForm />, { store: signedInStore() });
    submit();
    expect(await screen.findByTestId("restore_error")).toHaveTextContent(/reach the server/);
  });

  it("disables submit while the code is empty", () => {
    renderWithProviders(<RestoreForm />, { store: signedInStore() });
    expect(screen.getByTestId("restore_submit")).toBeDisabled();
  });
});
