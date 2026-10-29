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
  // YourKey.md: a browser that still keeps the seed opens the key, asking nothing first.
  it("a retained seed reveals at once without asking for a code", async () => {
    const { backup } = renderExport({ seed: new Uint8Array(32) });
    expect(screen.queryByTestId("key_export_code")).toBeNull();
    expect(screen.queryByTestId("key_export_reveal")).toBeNull();

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
    fireEvent.change(await screen.findByTestId("key_export_code"), {
      target: { value: "AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE" },
    });
    fireEvent.click(screen.getByTestId("key_export_reveal"));

    // YourKeyGate.md: the field's own line, and the field keeps what was typed.
    expect(await screen.findByText("That code doesn't check out.")).toBeInTheDocument();
    expect(screen.getByTestId("key_export_code")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("key_export_code")).toHaveValue("AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE");
    expect(screen.queryByTestId("key_export_pem")).toBeNull();
  });

  it("a browser without the key offers restore instead", async () => {
    renderExport();
    expect(await screen.findByTestId("key_export_no_actor")).toBeInTheDocument();
    expect(screen.getByTestId("key_export_restore")).toHaveAttribute("href", "/restore");
    expect(screen.queryByTestId("key_export_reveal")).toBeNull();
    expect(screen.getByTestId("key_export_no_actor")).toHaveTextContent("There is no key on this browser to show.");
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

  // YourKey.jsx: the lead, the key card with both encodings and their copies, the quiet note.
  it("the shown key reads the drawn words and copies each encoding", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderExport({ seed: new Uint8Array(32) });
    await screen.findByTestId("key_export_pem");
    expect(
      screen.getByText(
        "This key signs everything you publish, and it lives only in this browser. Store a copy somewhere safe and you keep it whatever happens to CoGra. Anyone who has a copy can act as you.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Nothing here is sent anywhere — the key is read from this browser and shown.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your actor key" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy the PEM block" }));
    expect(writeText).toHaveBeenCalledWith(SECRETS[0].pem);
    expect(await screen.findByText("Copied")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy the raw hex" }));
    expect(writeText).toHaveBeenCalledWith(SECRETS[0].hex);
  });

  // YourKeyGate.jsx / .md
  it("the gate waits for the code, and a short one answers on the field and re-checks live", async () => {
    const { backup } = renderExport({ keyOnDevice: true });
    expect(
      await screen.findByText(
        "On this browser your key is sealed inside its backup. Enter your recovery code to open it and see the key.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Waiting for your recovery code")).toBeInTheDocument();
    expect(screen.getByTestId("key_export_reveal")).toBeDisabled();
    fireEvent.change(screen.getByTestId("key_export_code"), { target: { value: "AAAAA" } });
    fireEvent.click(screen.getByTestId("key_export_reveal"));
    expect(await screen.findByText("A recovery code is 26 characters.")).toBeInTheDocument();
    expect(backup.revealFromBackup).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("key_export_code"), { target: { value: "AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE" } });
    expect(screen.queryByText("A recovery code is 26 characters.")).not.toBeInTheDocument();
  });

  it("a gate press without an answer says so above the commit", async () => {
    const backup = fakeBackup({
      revealFromBackup: vi.fn(() => Promise.resolve({ kind: "failed", cause: new Error("net") } as RevealResult)),
    });
    renderExport({ keyOnDevice: true, backup });
    fireEvent.change(await screen.findByTestId("key_export_code"), {
      target: { value: "AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE" },
    });
    fireEvent.click(screen.getByTestId("key_export_reveal"));
    expect(await screen.findByRole("alert")).toHaveTextContent("That didn't send. Try again.");
  });

  // YourKeyAbsent.jsx / .md
  it("with no key here the notice leads, no key card is drawn, and the paragraph names the device", async () => {
    renderExport();
    await screen.findByTestId("key_export_no_actor");
    expect(screen.getByRole("button", { name: "Your key" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your actor key" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "This key signs everything you publish, and it lives only on the device it was made on. Store a copy somewhere safe and you keep it whatever happens to CoGra. Anyone who has a copy can act as you.",
      ),
    ).toBeInTheDocument();
  });
});
