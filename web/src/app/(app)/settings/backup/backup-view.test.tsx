import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BackupManager } from "@/lib/identity/backup";
import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { renderWithProviders } from "@/test/providers";
import { BackupView } from "./backup-view";

const CODE = "AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE";

function fakeBackup(overrides: Partial<BackupManager> = {}): BackupManager {
  return {
    enable: vi.fn(() => Promise.resolve({ kind: "created" as const, code: CODE })),
    rekey: vi.fn(() => Promise.resolve({ kind: "created" as const, code: CODE })),
    revealRetained: vi.fn(() => Promise.resolve({ kind: "noSeed" as const })),
    revealFromBackup: vi.fn(() => Promise.resolve({ kind: "noSeed" as const })),
    ...overrides,
  };
}

function renderBackup({
  seed = null as Uint8Array | null,
  keyOnDevice = false,
  backup = fakeBackup(),
} = {}) {
  const identity = fakeIdentityStore({ keyOnDevice, seed });
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  renderWithProviders(<BackupView store={identity} backup={backup} />, { store });
  return { backup };
}

// The flows that stood inline on the settings page, moved behind the
// Recovery code row until the backup-replacement packet builds its boards.
describe("the interim recovery-code page", () => {
  it("offers one-step creation while the seed is retained", async () => {
    const { backup } = renderBackup({ seed: new Uint8Array(32), keyOnDevice: true });
    fireEvent.click(await screen.findByTestId("settings_backup_create"));
    expect(await screen.findByTestId("settings_backup_code")).toHaveTextContent(CODE);
    expect(backup.enable).toHaveBeenCalled();
    expect(screen.getByTestId("settings_backup_code_saved")).toBeDisabled();
    fireEvent.change(screen.getByTestId("settings_backup_code_typed_back"), {
      target: { value: CODE },
    });
    fireEvent.click(screen.getByTestId("settings_backup_code_saved"));
    await waitFor(() =>
      expect(screen.queryByTestId("settings_backup_code")).not.toBeInTheDocument(),
    );
  });

  it("asks for the current code once the seed is wiped", async () => {
    const { backup } = renderBackup({ keyOnDevice: true });
    const input = await screen.findByTestId("settings_rekey_code");
    fireEvent.change(input, { target: { value: CODE } });
    fireEvent.click(screen.getByTestId("settings_backup_rekey"));
    expect(await screen.findByTestId("settings_backup_code")).toHaveTextContent(CODE);
    expect(backup.rekey).toHaveBeenCalledWith(CODE);
  });

  it.each([
    ["malformedCode" as const, "26 letters and digits"],
    ["wrongCode" as const, "doesn't open your backup"],
    ["noBackup" as const, "no backup on the server"],
  ])("maps a %s re-key result", async (kind, expected) => {
    renderBackup({
      keyOnDevice: true,
      backup: fakeBackup({ rekey: vi.fn(() => Promise.resolve({ kind })) }),
    });
    fireEvent.change(await screen.findByTestId("settings_rekey_code"), {
      target: { value: "nope" },
    });
    fireEvent.click(screen.getByTestId("settings_backup_rekey"));
    expect(await screen.findByTestId("settings_feedback")).toHaveTextContent(expected);
  });

  it("points a keyless browser at restore", async () => {
    renderBackup();
    expect(await screen.findByTestId("settings_backup_no_actor")).toBeInTheDocument();
    expect(screen.getByTestId("settings_backup_restore")).toHaveAttribute("href", "/restore");
  });
});
