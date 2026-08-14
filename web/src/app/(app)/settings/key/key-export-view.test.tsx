import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BackupManager, RevealResult } from "@/lib/identity/backup";
import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { KeyExportView } from "./key-export-view";

startMswServer();

const SECRETS = [
  {
    kind: "actorKey" as const,
    pem: "-----BEGIN PRIVATE KEY-----\nMC4=\n-----END PRIVATE KEY-----",
    hex: "d4ee72db",
  },
];

function fakeBackup(overrides: Partial<BackupManager> = {}): BackupManager {
  return {
    enable: vi.fn(),
    rekey: vi.fn(),
    revealRetained: vi.fn(() => Promise.resolve({ kind: "revealed", secrets: SECRETS } as RevealResult)),
    revealFromBackup: vi.fn(() =>
      Promise.resolve({ kind: "revealed", secrets: SECRETS } as RevealResult),
    ),
    ...overrides,
  } as BackupManager;
}

function renderExport({
  seed = null as Uint8Array | null,
  keyOnDevice = false,
  backup = fakeBackup(),
} = {}) {
  const identity = fakeIdentityStore({ keyOnDevice, seed });
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  const rendered = renderWithProviders(<KeyExportView store={identity} backup={backup} />, { store });
  return { ...rendered, backup };
}

describe("KeyExportView", () => {
  it("shows nothing until the reveal is asked for", async () => {
    renderExport({ seed: new Uint8Array(32) });
    await screen.findByTestId("key_export_reveal");
    expect(screen.queryByTestId("key_export_pem")).toBeNull();
    expect(screen.queryByTestId("key_export_hex")).toBeNull();
  });

  it("a retained seed reveals without asking for a code", async () => {
    const { backup } = renderExport({ seed: new Uint8Array(32) });
    expect(screen.queryByTestId("key_export_code")).toBeNull();

    fireEvent.click(await screen.findByTestId("key_export_reveal"));

    expect(await screen.findByTestId("key_export_pem")).toHaveTextContent("BEGIN PRIVATE KEY");
    expect(screen.getByTestId("key_export_hex")).toHaveTextContent("d4ee72db");
    expect(backup.revealRetained).toHaveBeenCalled();
  });

  it("a sealed key asks for the current code first", async () => {
    const { backup } = renderExport({ keyOnDevice: true });
    const field = await screen.findByTestId("key_export_code");
    fireEvent.change(field, { target: { value: "AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE" } });
    fireEvent.click(screen.getByTestId("key_export_reveal"));

    await screen.findByTestId("key_export_pem");
    expect(backup.revealFromBackup).toHaveBeenCalledWith("AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE");
  });

  it("a wrong code reveals nothing and says so", async () => {
    const backup = fakeBackup({
      revealFromBackup: vi.fn(() => Promise.resolve({ kind: "wrongCode" } as RevealResult)),
    });
    renderExport({ keyOnDevice: true, backup });
    fireEvent.change(await screen.findByTestId("key_export_code"), { target: { value: "nope" } });
    fireEvent.click(screen.getByTestId("key_export_reveal"));

    expect(await screen.findByTestId("key_export_error")).toHaveTextContent(
      "That code doesn't open your backup",
    );
    expect(screen.queryByTestId("key_export_pem")).toBeNull();
  });

  it("a browser without the key offers restore instead", async () => {
    renderExport();
    expect(await screen.findByTestId("key_export_no_actor")).toBeInTheDocument();
    expect(screen.getByTestId("key_export_restore")).toHaveAttribute("href", "/restore");
    expect(screen.queryByTestId("key_export_reveal")).toBeNull();
  });

  it("the entered code does not linger after the reveal", async () => {
    renderExport({ keyOnDevice: true });
    const field = await screen.findByTestId("key_export_code");
    fireEvent.change(field, { target: { value: "AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE" } });
    fireEvent.click(screen.getByTestId("key_export_reveal"));

    await screen.findByTestId("key_export_pem");
    await waitFor(() => expect(screen.queryByTestId("key_export_code")).toBeNull());
  });

  it("the header returns to settings", async () => {
    renderExport({ seed: new Uint8Array(32) });
    expect(await screen.findByTestId("key_export_back")).toHaveAttribute("href", "/settings");
  });
});
