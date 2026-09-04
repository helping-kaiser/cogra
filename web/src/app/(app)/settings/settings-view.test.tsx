import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BackupManager } from "@/lib/identity/backup";
import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { SettingsView } from "./settings-view";

const server = startMswServer();

const CODE = "AAAAA-BBBBB-CCCCC-DDDDD-EEEEEE";

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function sessionsHandler(
  sessions: { id: string; deviceLabel: string | null; isCurrent: boolean }[] = [
    { id: "s1", deviceLabel: "Chrome on Linux", isCurrent: true },
    { id: "s2", deviceLabel: null, isCurrent: false },
  ],
) {
  return graphql.query("Sessions", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          sessions: sessions.map((session) => ({ __typename: "Session", ...session })),
        },
      },
    }),
  );
}

function okMutation(operation: string, payloadType: string, extra: Record<string, unknown> = {}) {
  return graphql.mutation(operation, () =>
    HttpResponse.json({
      data: {
        [operation.charAt(0).toLowerCase() + operation.slice(1)]: {
          __typename: payloadType,
          userErrors: [],
          ...extra,
        },
      },
    }),
  );
}

function refusedMutation(operation: string, payloadType: string, code: string) {
  return graphql.mutation(operation, () =>
    HttpResponse.json({
      data: {
        [operation.charAt(0).toLowerCase() + operation.slice(1)]: {
          __typename: payloadType,
          ok: null,
          user: null,
          userErrors: [{ __typename: "UserError", message: "refused", code, field: null }],
        },
      },
    }),
  );
}

function fakeBackup(overrides: Partial<BackupManager> = {}): BackupManager {
  return {
    enable: vi.fn(() => Promise.resolve({ kind: "created" as const, code: CODE })),
    rekey: vi.fn(() => Promise.resolve({ kind: "created" as const, code: CODE })),
    revealRetained: vi.fn(() => Promise.resolve({ kind: "noSeed" as const })),
    revealFromBackup: vi.fn(() => Promise.resolve({ kind: "noSeed" as const })),
    ...overrides,
  };
}

function fakeDraftStore() {
  return {
    save: vi.fn(async () => {}),
    load: vi.fn(async () => null),
    clear: vi.fn(async () => {}),
  };
}

function renderSettings({
  seed = null as Uint8Array | null,
  keyOnDevice = false,
  ephemeral = false,
  backup = fakeBackup(),
  drafts = fakeDraftStore(),
} = {}) {
  const identity = fakeIdentityStore({ keyOnDevice, seed, ephemeral });
  const store = signedInStore();
  const rendered = renderWithProviders(
    <SettingsView store={identity} backup={backup} drafts={drafts} />,
    { store },
  );
  return { ...rendered, identity, backup, drafts, tokenStore: store };
}

describe("SettingsView backup", () => {
  beforeEach(() => {
    window.localStorage.clear();
    server.use(sessionsHandler());
  });

  it("offers one-step creation while the seed is retained", async () => {
    const { backup } = renderSettings({ seed: new Uint8Array(32), keyOnDevice: true });
    fireEvent.click(await screen.findByTestId("settings_backup_create"));
    expect(await screen.findByTestId("settings_backup_code")).toHaveTextContent(CODE);
    expect(backup.enable).toHaveBeenCalled();
    // The code shows once, and only the code itself dismisses it.
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
    const { backup } = renderSettings({ keyOnDevice: true });
    const input = await screen.findByTestId("settings_rekey_code");
    expect(screen.queryByTestId("settings_backup_create")).not.toBeInTheDocument();

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
    renderSettings({
      keyOnDevice: true,
      backup: fakeBackup({ rekey: vi.fn(() => Promise.resolve({ kind })) }),
    });
    fireEvent.change(await screen.findByTestId("settings_rekey_code"), {
      target: { value: "nope" },
    });
    fireEvent.click(screen.getByTestId("settings_backup_rekey"));
    expect(await screen.findByTestId("settings_feedback")).toHaveTextContent(expected);
  });

  it("backs to the profile it hangs off", async () => {
    renderSettings();
    expect(await screen.findByTestId("settings_back")).toHaveAttribute("href", "/profile");
  });

  // design.md §8.6: settings are where the alternates to the pad are
  // offered, and choosing one replaces the pad everywhere.
  it("offers the alternates to the stance pad, and remembers the choice", async () => {
    renderSettings();
    const pad = await screen.findByTestId("settings_stance_input_pad");
    expect(pad).toBeChecked();
    fireEvent.click(screen.getByTestId("settings_stance_input_sliders"));
    await waitFor(() => expect(screen.getByTestId("settings_stance_input_sliders")).toBeChecked());
    expect(window.localStorage.getItem("cogra.stanceInputMode")).toBe("sliders");
  });

  // F4: the way back to a confirmation switched off from the dialog.
  it("offers the multi-action confirmation toggle, and remembers it", async () => {
    renderSettings();
    const toggle = await screen.findByTestId("settings_confirm_multi_action");
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(screen.getByTestId("settings_confirm_multi_action")).not.toBeChecked(),
    );
    expect(window.localStorage.getItem("cogra.confirmMultiActionSubmits")).toBe("false");
  });

  it("collapses the restore card into the header for a keyless browser", async () => {
    // The key banner rides settings like every main surface
    // (design.md §6).
    renderSettings();
    const restore = await screen.findByTestId("home_restore");
    expect(screen.getByTestId("collapsing-top")).toContainElement(restore);
  });

  it("shows no restore card while the key is on this browser", async () => {
    renderSettings({ keyOnDevice: true });
    expect(await screen.findByTestId("settings_export_key")).toBeInTheDocument();
    expect(screen.queryByTestId("home_restore")).not.toBeInTheDocument();
  });

  it("points a keyless browser at restore", async () => {
    renderSettings();
    expect(await screen.findByTestId("settings_backup_no_actor")).toBeInTheDocument();
    expect(screen.getByTestId("settings_backup_restore")).toHaveAttribute("href", "/restore");
    expect(screen.queryByTestId("settings_backup_create")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings_rekey_code")).not.toBeInTheDocument();
    // Nothing to export either.
    expect(screen.queryByTestId("settings_export_key")).not.toBeInTheDocument();
  });

  it.each([
    ["retained", { seed: new Uint8Array(32), keyOnDevice: true }],
    ["sealed", { keyOnDevice: true }],
  ])("offers the export surface while the key is %s", async (_custody, custody) => {
    renderSettings(custody);
    expect(await screen.findByTestId("settings_export_key")).toHaveAttribute(
      "href",
      "/settings/key",
    );
  });

  it("keeps the export entry off the screen showing a fresh code", async () => {
    renderSettings({ seed: new Uint8Array(32), keyOnDevice: true });
    fireEvent.click(await screen.findByTestId("settings_backup_create"));
    await screen.findByTestId("settings_backup_code");
    expect(screen.queryByTestId("settings_export_key")).not.toBeInTheDocument();
  });
});

describe("SettingsView sessions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    server.use(sessionsHandler());
  });

  it("lists sessions and offers revocation only for the others", async () => {
    renderSettings();
    expect(await screen.findByTestId("session_s1")).toHaveTextContent(
      "Chrome on Linux (this browser)",
    );
    expect(screen.getByTestId("session_s2")).toHaveTextContent("Unnamed device");
    expect(screen.queryByTestId("revoke_s1")).not.toBeInTheDocument();
    expect(screen.getByTestId("revoke_s2")).toBeInTheDocument();
  });

  it("revokes one session and refreshes the list", async () => {
    let revoked = false;
    server.use(
      graphql.query("Sessions", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "u1",
              sessions: [
                { __typename: "Session", id: "s1", deviceLabel: "here", isCurrent: true },
                ...(revoked
                  ? []
                  : [{ __typename: "Session", id: "s2", deviceLabel: null, isCurrent: false }]),
              ],
            },
          },
        }),
      ),
      graphql.mutation("RevokeSession", ({ variables }) => {
        revoked = true;
        expect(variables).toEqual({ input: { session: "s2" } });
        return HttpResponse.json({
          data: {
            revokeSession: {
              __typename: "RevokeSessionPayload",
              session: { __typename: "Session", id: "s2" },
              userErrors: [],
            },
          },
        });
      }),
    );
    renderSettings();

    fireEvent.click(await screen.findByTestId("revoke_s2"));
    expect(await screen.findByTestId("settings_feedback")).toHaveTextContent("Session revoked.");
    await waitFor(() => expect(screen.queryByTestId("session_s2")).not.toBeInTheDocument());
  });

  it("signs out everywhere else, with the feedback in the sessions card", async () => {
    server.use(
      okMutation("RevokeOtherSessions", "RevokeSessionsPayload", { revokedCount: 2 }),
    );
    renderSettings();
    fireEvent.click(await screen.findByTestId("settings_revoke_others"));
    const feedback = await screen.findByTestId("settings_feedback");
    expect(feedback).toHaveTextContent("All other sessions signed out.");
    // Access tokens survive their TTL by design (auth.md "Sessions") — the copy says so.
    expect(feedback).toHaveTextContent("up to 15 minutes");
    expect(
      within(screen.getByTestId("settings_sessions_card")).getByTestId("settings_feedback"),
    ).toBe(feedback);
  });
});

describe("SettingsView credentials", () => {
  beforeEach(() => {
    window.localStorage.clear();
    server.use(sessionsHandler());
  });

  it("changes the password and clears both fields", async () => {
    server.use(okMutation("ChangePassword", "ChangePasswordPayload", { ok: true }));
    renderSettings();

    fireEvent.change(await screen.findByTestId("settings_current_password"), {
      target: { value: "old-password-1" },
    });
    fireEvent.change(screen.getByTestId("settings_new_password"), {
      target: { value: "new-password-12" },
    });
    fireEvent.click(screen.getByTestId("settings_change_password"));
    const feedback = await screen.findByTestId("settings_feedback");
    expect(feedback).toHaveTextContent("Password changed. Other sessions were signed out.");
    // Feedback renders beside the fields that acted, not at the page top.
    expect(
      within(screen.getByTestId("settings_credentials_card")).getByTestId("settings_feedback"),
    ).toBe(feedback);
    expect(screen.getByTestId("settings_current_password")).toHaveValue("");
    expect(screen.getByTestId("settings_new_password")).toHaveValue("");
  });

  it.each([
    ["INVALID_CREDENTIALS", "current password didn't match"],
    ["WEAK_PASSWORD", "at least 12 characters"],
    ["RATE_LIMITED", "Too many attempts"],
  ])("maps a %s refusal", async (code, expected) => {
    server.use(refusedMutation("ChangePassword", "ChangePasswordPayload", code));
    renderSettings();

    fireEvent.change(await screen.findByTestId("settings_current_password"), {
      target: { value: "old" },
    });
    fireEvent.change(screen.getByTestId("settings_new_password"), { target: { value: "new" } });
    fireEvent.click(screen.getByTestId("settings_change_password"));
    expect(await screen.findByTestId("settings_feedback")).toHaveTextContent(expected);
  });

  it("lowercases the handle input and reports a taken handle", async () => {
    server.use(refusedMutation("ChangeHandle", "ChangeHandlePayload", "HANDLE_TAKEN"));
    renderSettings();

    const input = await screen.findByTestId("settings_new_handle");
    fireEvent.change(input, { target: { value: "Ada" } });
    expect(input).toHaveValue("ada");
    fireEvent.click(screen.getByTestId("settings_change_handle"));
    expect(await screen.findByTestId("settings_feedback")).toHaveTextContent(
      "That handle is taken.",
    );
  });

  it("runs the two-sided email change", async () => {
    server.use(
      graphql.mutation("RequestEmailChange", () =>
        HttpResponse.json({
          data: { requestEmailChange: { __typename: "RequestEmailChangePayload", ok: true } },
        }),
      ),
      okMutation("ConfirmEmailChange", "ConfirmEmailChangePayload", {
        user: { __typename: "User", id: "u1" },
      }),
    );
    renderSettings();

    expect(screen.queryByTestId("settings_email_code")).not.toBeInTheDocument();
    fireEvent.change(await screen.findByTestId("settings_new_email"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByTestId("settings_email_password"), {
      target: { value: "password-123" },
    });
    fireEvent.click(screen.getByTestId("settings_request_email"));
    expect(await screen.findByTestId("settings_email_requested")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("settings_email_code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByTestId("settings_confirm_email"));
    expect(await screen.findByTestId("settings_feedback")).toHaveTextContent("Email updated.");
    await waitFor(() =>
      expect(screen.queryByTestId("settings_email_requested")).not.toBeInTheDocument(),
    );
  });

  it("renders a rate-limited email confirm as a backoff, not a connectivity failure", async () => {
    server.use(
      graphql.mutation("RequestEmailChange", () =>
        HttpResponse.json({
          data: { requestEmailChange: { __typename: "RequestEmailChangePayload", ok: true } },
        }),
      ),
      graphql.mutation("ConfirmEmailChange", () =>
        HttpResponse.json({
          errors: [{ message: "too many attempts", extensions: { code: "RATE_LIMITED" } }],
        }),
      ),
    );
    renderSettings();

    fireEvent.change(await screen.findByTestId("settings_new_email"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByTestId("settings_email_password"), {
      target: { value: "password-123" },
    });
    fireEvent.click(screen.getByTestId("settings_request_email"));
    fireEvent.change(await screen.findByTestId("settings_email_code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("settings_confirm_email"));
    expect(await screen.findByTestId("settings_feedback")).toHaveTextContent(
      "Too many attempts — wait a moment and try again.",
    );
  });

  it("the email change needs its own password field", async () => {
    renderSettings();
    fireEvent.change(await screen.findByTestId("settings_new_email"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByTestId("settings_current_password"), {
      target: { value: "password-123" },
    });
    expect(screen.getByTestId("settings_request_email")).toBeDisabled();
  });
});

describe("SettingsView sign-out", () => {
  beforeEach(() => {
    window.localStorage.clear();
    server.use(sessionsHandler());
  });

  it("revokes the current session and clears the tokens", async () => {
    let revokedCurrent = false;
    server.use(
      graphql.mutation("RevokeSession", ({ variables }) => {
        revokedCurrent = true;
        expect(variables).toEqual({ input: {} });
        return HttpResponse.json({
          data: {
            revokeSession: {
              __typename: "RevokeSessionPayload",
              session: { __typename: "Session", id: "s1" },
              userErrors: [],
            },
          },
        });
      }),
    );
    const { tokenStore } = renderSettings();

    fireEvent.click(await screen.findByTestId("settings_sign_out"));
    await waitFor(() => expect(tokenStore.hasSession()).toBe(false));
    expect(revokedCurrent).toBe(true);
  });

  it("signs out even when the server is unreachable", async () => {
    server.use(graphql.mutation("RevokeSession", () => HttpResponse.error()));
    const { tokenStore } = renderSettings();

    fireEvent.click(await screen.findByTestId("settings_sign_out"));
    await waitFor(() => expect(tokenStore.hasSession()).toBe(false));
  });

  it("purges a don't-remember account's key material at sign-out", async () => {
    server.use(graphql.mutation("RevokeSession", () => HttpResponse.error()));
    const { tokenStore, identity } = renderSettings({ keyOnDevice: true, ephemeral: true });

    fireEvent.click(await screen.findByTestId("settings_sign_out"));
    await waitFor(() => expect(tokenStore.hasSession()).toBe(false));
    expect(await identity.actorKey()).toBeNull();
  });

  it("keeps key material on a default sign-out — an auth act, not an identity act", async () => {
    server.use(graphql.mutation("RevokeSession", () => HttpResponse.error()));
    const { tokenStore, identity } = renderSettings({ keyOnDevice: true });

    fireEvent.click(await screen.findByTestId("settings_sign_out"));
    await waitFor(() => expect(tokenStore.hasSession()).toBe(false));
    expect(await identity.actorKey()).not.toBeNull();
  });

  // The unpublished draft goes with the session, on every sign-out — not only
  // the don't-remember kind. A shared browser would otherwise offer this
  // account's own words and pictures to whoever signs in next.
  it("clears the compose draft at sign-out", async () => {
    server.use(graphql.mutation("RevokeSession", () => HttpResponse.error()));
    const { tokenStore, drafts } = renderSettings();

    fireEvent.click(await screen.findByTestId("settings_sign_out"));
    await waitFor(() => expect(tokenStore.hasSession()).toBe(false));
    expect(drafts.clear).toHaveBeenCalled();
  });

  it("signs out anyway when the draft cannot be cleared", async () => {
    server.use(graphql.mutation("RevokeSession", () => HttpResponse.error()));
    const drafts = fakeDraftStore();
    drafts.clear.mockRejectedValueOnce(new Error("storage is blocked"));
    const { tokenStore } = renderSettings({ drafts });

    fireEvent.click(await screen.findByTestId("settings_sign_out"));
    await waitFor(() => expect(tokenStore.hasSession()).toBe(false));
  });
});
