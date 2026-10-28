// KeyElsewhere.md and KeyElsewhereNoBackup.md — the feed's key card, against
// the stand-in seam (the key and the backup stubbed; nothing restores here).

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createStubStanceData } from "@/lib/stance/stub-stance-data";
import { createTokenStore } from "@/lib/session/token-store";
import { renderWithProviders } from "@/test/providers";
import { RestoreCard } from "./applicant-status";

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "u1" });
  return store;
}

describe("the key card", () => {
  it("wears the account-notice register with Restore the key filled in inverse", async () => {
    renderWithProviders(<RestoreCard />, {
      store: signedIn(),
      stanceData: createStubStanceData({ keyAbsent: true }),
    });
    const card = await screen.findByTestId("home_key_elsewhere_card");
    expect(card).toHaveTextContent("Your key isn't on this browser");
    expect(card).toHaveTextContent(
      "Restore it with your recovery code to post, vouch, and act. Until then, anything you sign waits as pending.",
    );
    expect(card.className).toContain("cg-task-ring-notice");
    expect(card.className).toContain("text-on-tertiary-container");
    const restore = screen.getByTestId("home_restore");
    expect(restore).toHaveAttribute("href", "/restore");
    expect(restore.className).toContain("bg-on-tertiary-container");
  });

  it("says the key can't be brought here yet, and offers no control, when the account has no backup", async () => {
    renderWithProviders(<RestoreCard />, {
      store: signedIn(),
      stanceData: createStubStanceData({ keyAbsent: true, noBackup: true }),
    });
    const card = await screen.findByTestId("home_key_no_backup");
    await waitFor(() =>
      expect(card).toHaveTextContent(
        "This account has no backup, so the key can't be brought here yet. Make a recovery code on the device that holds it, then restore it here. Until then, anything you sign waits as pending.",
      ),
    );
    expect(card).toHaveTextContent("Your key isn't on this browser");
    expect(screen.queryByTestId("home_restore")).toBeNull();
    expect(card.querySelector("button, a")).toBeNull();
  });
});
