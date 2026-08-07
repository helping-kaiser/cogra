import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { renderWithProviders } from "@/test/providers";
import { fakeCeremony, fakeFlow } from "@/test/registration";
import { KeyCeremonyView } from "./key-ceremony-view";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

describe("KeyCeremonyView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    replace.mockClear();
  });

  it("accept mints, attaches, parks, uploads, and shows the code once", async () => {
    const ceremony = fakeCeremony();
    renderWithProviders(<KeyCeremonyView />, { store: signedInStore(), ceremony });
    fireEvent.click(screen.getByTestId("backup_accept"));
    expect(await screen.findByTestId("backup_code")).toHaveTextContent(
      "AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE",
    );
    expect(ceremony.createActorKey).toHaveBeenCalled();
    expect(ceremony.attachActorKey).toHaveBeenCalled();
    expect(ceremony.uploadPendingBackup).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows the code even when the upload fails — the blob stays parked", async () => {
    const ceremony = fakeCeremony({ uploadPendingBackup: vi.fn(() => Promise.resolve(false)) });
    renderWithProviders(<KeyCeremonyView />, { store: signedInStore(), ceremony });
    fireEvent.click(screen.getByTestId("backup_accept"));
    expect(await screen.findByTestId("backup_code")).toBeInTheDocument();
  });

  it("code-saved pokes the loop and goes home", async () => {
    const { flow } = fakeFlow();
    renderWithProviders(<KeyCeremonyView />, {
      store: signedInStore(),
      ceremony: fakeCeremony(),
      flow,
    });
    fireEvent.click(screen.getByTestId("backup_accept"));
    fireEvent.click(await screen.findByTestId("backup_code_saved"));
    expect(flow.ensureAdvancing).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("a failed attach surfaces and no code is created", async () => {
    const ceremony = fakeCeremony({
      attachActorKey: vi.fn(() => Promise.resolve({ kind: "failed" as const, cause: new Error("net") })),
    });
    renderWithProviders(<KeyCeremonyView />, { store: signedInStore(), ceremony });
    fireEvent.click(screen.getByTestId("backup_accept"));
    expect(await screen.findByTestId("ceremony_attach_error")).toBeInTheDocument();
    expect(ceremony.createPendingBackup).not.toHaveBeenCalled();
    // A retry mints again — the key is replaceable until approval.
    fireEvent.click(screen.getByTestId("backup_accept"));
    await waitFor(() => expect(ceremony.createActorKey).toHaveBeenCalledTimes(2));
  });

  it("a key bound to another account gets its own explanation", async () => {
    const ceremony = fakeCeremony({
      attachActorKey: vi.fn(() =>
        Promise.resolve({
          kind: "refused" as const,
          errors: [
            {
              message: "the key already belongs to another account",
              code: "ACTOR_KEY_IN_USE" as const,
              field: ["actorPubkey"],
            },
          ],
        }),
      ),
    });
    renderWithProviders(<KeyCeremonyView />, { store: signedInStore(), ceremony });
    fireEvent.click(screen.getByTestId("backup_accept"));
    expect(await screen.findByTestId("ceremony_key_in_use")).toBeInTheDocument();
    expect(screen.queryByTestId("ceremony_attach_error")).not.toBeInTheDocument();
    expect(ceremony.createPendingBackup).not.toHaveBeenCalled();
  });

  it("decline asks for confirmation, then still mints and attaches", async () => {
    const ceremony = fakeCeremony();
    const { flow } = fakeFlow();
    renderWithProviders(<KeyCeremonyView />, { store: signedInStore(), ceremony, flow });
    fireEvent.click(screen.getByTestId("backup_decline"));
    expect(screen.getByTestId("backup_decline_consequence")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("backup_decline_confirm"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(ceremony.createActorKey).toHaveBeenCalled();
    expect(ceremony.attachActorKey).toHaveBeenCalled();
    expect(ceremony.createPendingBackup).not.toHaveBeenCalled();
    expect(flow.ensureAdvancing).toHaveBeenCalled();
  });

  it("cancelling the decline returns to the offer", () => {
    renderWithProviders(<KeyCeremonyView />, { store: signedInStore(), ceremony: fakeCeremony() });
    fireEvent.click(screen.getByTestId("backup_decline"));
    fireEvent.click(screen.getByTestId("backup_decline_cancel"));
    expect(screen.queryByTestId("backup_decline_consequence")).not.toBeInTheDocument();
    expect(screen.getByTestId("backup_accept")).toBeInTheDocument();
  });

  it("bounces home when the key is already attached", () => {
    const { flow } = fakeFlow({
      kind: "awaitingApproval",
      emailVerified: true,
      keyAttached: true,
      keyOnDevice: true,
    });
    renderWithProviders(<KeyCeremonyView />, {
      store: signedInStore(),
      ceremony: fakeCeremony(),
      flow,
    });
    expect(replace).toHaveBeenCalledWith("/");
  });
});
