import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BackupManager } from "@/lib/identity/backup";
import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { renderWithProviders } from "@/test/providers";
import { BackupView } from "./backup-view";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

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

// SettingsBackupNone, SettingsBackup(+Error), SettingsBackupKeyAbsent and the
// code screen they open.
describe("the recovery-code screens", () => {
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
    // SettingsBackupNone.md: settings returns with the backed-up snackbar.
    expect(push).toHaveBeenCalledWith("/settings?done=backup");
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
    ["malformedCode" as const, "A recovery code is 26 characters."],
    ["wrongCode" as const, "That code doesn't check out."],
    ["noBackup" as const, "There's no backup on the server to replace."],
  ])("maps a %s re-key result", async (kind, expected) => {
    renderBackup({
      keyOnDevice: true,
      backup: fakeBackup({ rekey: vi.fn(() => Promise.resolve({ kind })) }),
    });
    fireEvent.change(await screen.findByTestId("settings_rekey_code"), {
      target: { value: CODE },
    });
    fireEvent.click(screen.getByTestId("settings_backup_rekey"));
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
  });

  it("points a keyless browser at restore", async () => {
    renderBackup();
    expect(await screen.findByTestId("settings_backup_no_actor")).toBeInTheDocument();
    expect(screen.getByTestId("settings_backup_restore")).toHaveAttribute("href", "/restore");
  });

  // SettingsBackupNone.jsx / .md
  it("the_make_a_code_screen_carries_no_code_field_and_says_the_code_is_shown_once", async () => {
    renderBackup({ seed: new Uint8Array(32), keyOnDevice: true });
    expect(await screen.findByRole("heading", { level: 1, name: "Make a recovery code" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Without a recovery code, losing this device means losing your key. Your sign-in survives, but no one — including CoGra — can bring the key back.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings_backup_create")).toHaveTextContent("Create my recovery code");
    expect(
      screen.getByText("The code is shown once and never stored. Have somewhere to write it down before you go on."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to settings" })).toHaveAttribute("href", "/settings");
  });

  // SettingsBackup.jsx / .md
  it("the_replace_screen_waits_for_the_current_code_and_says_the_old_one_keeps_working", async () => {
    renderBackup({ keyOnDevice: true });
    expect(await screen.findByRole("heading", { level: 1, name: "A new recovery code" })).toBeInTheDocument();
    expect(screen.getByText("Waiting for your current recovery code")).toBeInTheDocument();
    expect(screen.getByTestId("settings_backup_rekey")).toBeDisabled();
    expect(screen.getByLabelText("Current recovery code")).toHaveAttribute("placeholder", "XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX");
    expect(
      screen.getByText(
        "Lost it? This browser can't make a new code without the current one. If the Android app holds your key, make the new code there.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The new code is shown once and never stored. Have somewhere to write it down before you go on — the old code keeps working until the new one is confirmed.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("settings_rekey_code"), { target: { value: "a" } });
    expect(screen.getByTestId("settings_backup_rekey")).toBeEnabled();
  });

  it("a_short_code_answers_on_the_press_never_makes_a_code_and_re_checks_live", async () => {
    const { backup } = renderBackup({ keyOnDevice: true });
    fireEvent.change(await screen.findByTestId("settings_rekey_code"), { target: { value: "AAAAA" } });
    expect(screen.queryByText("A recovery code is 26 characters.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("settings_backup_rekey"));
    expect(await screen.findByText("A recovery code is 26 characters.")).toBeInTheDocument();
    expect(backup.rekey).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("settings_rekey_code"), { target: { value: CODE } });
    expect(screen.queryByText("A recovery code is 26 characters.")).not.toBeInTheDocument();
  });

  // SettingsBackupError.md: the refused code's line stands while typing.
  it("a_refused_code_stands_on_the_field_until_the_next_press", async () => {
    renderBackup({
      keyOnDevice: true,
      backup: fakeBackup({ rekey: vi.fn(() => Promise.resolve({ kind: "wrongCode" as const })) }),
    });
    fireEvent.change(await screen.findByTestId("settings_rekey_code"), { target: { value: CODE } });
    fireEvent.click(screen.getByTestId("settings_backup_rekey"));
    expect(await screen.findByText("That code doesn't check out.")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("settings_rekey_code"), { target: { value: `${CODE}x` } });
    expect(screen.getByText("That code doesn't check out.")).toBeInTheDocument();
    expect(screen.getByTestId("settings_rekey_code")).toHaveAttribute("aria-invalid", "true");
  });

  // SettingsBackupKeyAbsent.jsx / .md
  it("with_the_key_elsewhere_the_notice_leads_and_no_field_or_commit_stands", async () => {
    renderBackup();
    const notice = await screen.findByTestId("settings_backup_no_actor");
    expect(notice).toHaveTextContent("Your key isn't on this browser");
    expect(notice).toHaveTextContent("Making a new code needs the key itself. Your current recovery code keeps working.");
    expect(screen.getByRole("button", { name: "Your key" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "A new recovery code" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Create a new recovery code")).not.toBeInTheDocument();
  });
});
