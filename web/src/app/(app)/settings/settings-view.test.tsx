import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { delay, graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { SettingsView } from "./settings-view";

const push = vi.fn();
const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => search,
}));

const server = startMswServer();

const DAY_MS = 86_400_000;

type Session = {
  id: string;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  isCurrent: boolean;
};

function ago(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

const SESSIONS: Session[] = [
  { id: "s2", deviceLabel: "Pixel 8", createdAt: ago(9), lastUsedAt: ago(2), isCurrent: false },
  { id: "s1", deviceLabel: "Firefox on Ubuntu", createdAt: ago(1), lastUsedAt: null, isCurrent: true },
  { id: "s3", deviceLabel: null, createdAt: ago(60), lastUsedAt: ago(45), isCurrent: false },
];

function account(overrides: Record<string, unknown> = {}) {
  return {
    __typename: "User",
    id: "u1",
    handle: "sol",
    email: "sol@solferreira.art",
    emailVerified: true,
    accountState: "MEMBER",
    actorPubkey: "pk",
    passwordChangedAt: ago(21),
    keyBackupCreatedAt: "2026-08-12T10:00:00Z",
    pendingEmailChange: null,
    preferences: { __typename: "UserPreferences", defaultLicense: null },
    sessions: SESSIONS.map((session) => ({ __typename: "Session", ...session })),
    ...overrides,
  };
}

function accountHandler(overrides: Record<string, unknown> = {}) {
  return graphql.query("SettingsAccount", () => HttpResponse.json({ data: { me: account(overrides) } }));
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

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function renderSettings({
  keyOnDevice = true,
  seed = null as Uint8Array | null,
  ephemeral = false,
} = {}) {
  const identity = fakeIdentityStore({ keyOnDevice, seed, ephemeral });
  const drafts = { clear: vi.fn(async () => {}) };
  const tokens = signedInStore();
  const rendered = renderWithProviders(<SettingsView store={identity} drafts={drafts} />, {
    store: tokens,
  });
  return { ...rendered, identity, drafts, tokens };
}

/** The node a registered path names (`data-node.ts`). */
const byNode = (path: string, key?: string) =>
  key === undefined
    ? screen.getByTestId(path)
    : screen.getAllByTestId(path).find((element) => element.getAttribute("data-testid-key") === key)!;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  delete document.documentElement.dataset.theme;
  push.mockReset();
  replace.mockReset();
  search = new URLSearchParams();
  server.use(accountHandler());
});

describe("the settings page", () => {
  it("groups_stand_in_the_ruled_order", async () => {
    renderSettings();
    await screen.findByTestId("settings.credentials.password.status");
    const groups = [
      "settings.theme",
      "settings.stance",
      "settings.writing",
      "settings.reading",
      "settings.people",
      "settings.backup",
      "settings.sessions",
      "settings.credentials",
      "settings.about",
      "settings.leaving",
    ].map((path) => screen.getByTestId(path));
    for (let i = 1; i < groups.length; i += 1) {
      // Each group follows the one before it in the document.
      expect(groups[i - 1].compareDocumentPosition(groups[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByTestId("settings.stance.label")).toHaveTextContent("Giving an opinion");
    // The delete group is the erasure packet's: its slot stays empty here.
    expect(screen.queryByTestId("settings.ending")).not.toBeInTheDocument();
  });

  it("back_returns_to_the_own_profile", async () => {
    renderSettings();
    const back = await screen.findByTestId("settings.header.back");
    expect(back).toHaveAttribute("href", "/profile");
    expect(back).toHaveAccessibleName("Back to your profile");
    expect(screen.getByTestId("settings.header.title")).toHaveTextContent("Settings");
  });

  it("header_stays_pinned_while_scrolling", async () => {
    renderSettings();
    const header = await screen.findByTestId("settings.header");
    expect(header.parentElement).toHaveClass("sticky", "top-0");
  });

  it("carries no restore card and no collapsing top", async () => {
    renderSettings({ keyOnDevice: false });
    await screen.findByTestId("settings.credentials.password.status");
    expect(screen.queryByTestId("home_restore")).not.toBeInTheDocument();
    expect(screen.queryByTestId("collapsing-top")).not.toBeInTheDocument();
  });

  it("theme_choice_repaints_and_stays_on_this_device", async () => {
    renderSettings();
    const auto = await screen.findByTestId("settings.theme.picker.autoOption");
    expect(auto).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("settings.theme.picker.darkOption"));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("cogra.theme")).toBe("dark");
    await waitFor(() =>
      expect(screen.getByTestId("settings.theme.picker.darkOption")).toHaveAttribute("aria-pressed", "true"),
    );
  });

  it("auto_follows_the_device_setting", async () => {
    window.localStorage.setItem("cogra.theme", "light");
    document.documentElement.dataset.theme = "light";
    renderSettings();
    fireEvent.click(await screen.findByTestId("settings.theme.picker.autoOption"));
    // Auto leaves the attribute off, where the stylesheet follows the device.
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(window.localStorage.getItem("cogra.theme")).toBe("auto");
  });

  it("exactly_one_opinion_input_stands_selected", async () => {
    renderSettings();
    const radios = within(await screen.findByTestId("settings.stance")).getAllByRole("radio");
    expect(radios.filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(1);
    fireEvent.click(screen.getByTestId("settings.stance.sliders"));
    await waitFor(() =>
      expect(screen.getByTestId("settings.stance.sliders").querySelector("input")).toBeChecked(),
    );
    expect(screen.getByTestId("settings.stance.pad").querySelector("input")).not.toBeChecked();
    expect(window.localStorage.getItem("cogra.stanceInputMode")).toBe("sliders");
  });

  it("multi_action_switch_flips_without_a_dialog", async () => {
    renderSettings();
    const row = await screen.findByTestId("settings.writing.confirm");
    expect(row).toHaveAttribute("role", "switch");
    expect(row).toHaveAttribute("aria-checked", "true");
    fireEvent.click(row);
    await waitFor(() => expect(row).toHaveAttribute("aria-checked", "false"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("cogra.confirmMultiActionSubmits")).toBe("false");
  });

  it("exact_values_switch_is_device_local", async () => {
    renderSettings();
    const row = await screen.findByTestId("settings.reading.exact");
    expect(row).toHaveAttribute("aria-checked", "false");
    fireEvent.click(row);
    await waitFor(() => expect(row).toHaveAttribute("aria-checked", "true"));
    expect(window.localStorage.getItem("cogra.exactValues")).toBe("on");
  });

  it("hidden_row_is_inert_and_reads_none_when_nobody_is_hidden", async () => {
    renderSettings();
    const row = await screen.findByTestId("settings.people.hidden");
    expect(row.tagName).toBe("DIV");
    expect(screen.getByTestId("settings.people.hidden.value")).toHaveTextContent("None");
    expect(screen.queryByTestId("settings.people.hidden.chevron")).not.toBeInTheDocument();
  });

  it("reads the recovery code's date, and Not made yet without one", async () => {
    renderSettings();
    expect(await screen.findByTestId("settings.backup.recovery.status")).toHaveTextContent(
      "Last created 12.08.2026",
    );
    expect(screen.getByTestId("settings.backup.footnote")).toHaveTextContent(
      "Your recovery code is the only way back.",
    );
  });

  it("an unbacked key reads Not made yet and says it can't be brought back", async () => {
    server.use(accountHandler({ keyBackupCreatedAt: null }));
    renderSettings();
    expect(await screen.findByTestId("settings.backup.recovery.status")).toHaveTextContent("Not made yet");
    expect(screen.getByTestId("settings.backup.footnote")).toHaveTextContent(
      "Until you make a recovery code, it can't be brought back.",
    );
  });

  it("an applicant before the key ceremony reads Not made yet on both rows and opens the ceremony", async () => {
    server.use(accountHandler({ actorPubkey: null, keyBackupCreatedAt: null, accountState: "APPLICANT" }));
    renderSettings({ keyOnDevice: false });
    expect(await screen.findByTestId("settings.backup.key.status")).toHaveTextContent("Not made yet");
    fireEvent.click(screen.getByTestId("settings.backup.recovery"));
    expect(push).toHaveBeenCalledWith("/key");
  });

  it("current_session_reads_this_browser and carries no Revoke", async () => {
    renderSettings();
    expect(await screen.findAllByTestId("settings.sessions.session.status")).toHaveLength(3);
    const first = byNode("settings.sessions.session", "1");
    expect(first).toHaveTextContent("Firefox on Ubuntu");
    expect(within(first).getByTestId("settings.sessions.session.status")).toHaveTextContent("This browser");
    expect(within(first).queryByTestId("settings.sessions.session.revoke")).not.toBeInTheDocument();
    const second = byNode("settings.sessions.session", "2");
    expect(second).toHaveTextContent("Pixel 8");
    expect(second).toHaveTextContent("Last used 2d");
    // Past the ladder's thirty days an age is a date.
    const third = byNode("settings.sessions.session", "3");
    expect(third).toHaveTextContent("Unnamed device");
    expect(third).toHaveTextContent(/Last used \d\d\.\d\d\.\d{4}/);
  });

  it("revoke_removes_the_row_and_names_the_device", async () => {
    server.use(okMutation("RevokeSession", "RevokeSessionPayload", { session: { __typename: "Session", id: "s2" } }));
    renderSettings();
    await screen.findByText("Pixel 8");
    fireEvent.click(within(byNode("settings.sessions.session", "2")).getByTestId("settings.sessions.session.revoke"));
    expect(await screen.findByTestId("settings-snackbar")).toHaveTextContent("Signed out of Pixel 8.");
    expect(screen.queryByText("Pixel 8")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("revoke_moves_focus_to_the_next_row", async () => {
    server.use(okMutation("RevokeSession", "RevokeSessionPayload", { session: { __typename: "Session", id: "s2" } }));
    renderSettings();
    await screen.findByText("Pixel 8");
    fireEvent.click(within(byNode("settings.sessions.session", "2")).getByTestId("settings.sessions.session.revoke"));
    await screen.findByTestId("settings-snackbar");
    await waitFor(() => expect(document.activeElement).toHaveTextContent("Unnamed device"));
  });

  it("revoke_reads_revoking_after_200ms_and_never_spins", async () => {
    server.use(
      graphql.mutation("RevokeSession", async () => {
        await delay(400);
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
    await screen.findByText("Pixel 8");
    const revoke = within(byNode("settings.sessions.session", "2")).getByTestId("settings.sessions.session.revoke");
    fireEvent.click(revoke);
    // Never within 200ms.
    expect(revoke).toHaveTextContent("Revoke");
    expect(revoke).not.toHaveTextContent("Revoking…");
    await waitFor(() => expect(revoke).toHaveTextContent("Revoking…"));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("revoke_offline_opens_network_error_and_keeps_the_row", async () => {
    server.use(graphql.mutation("RevokeSession", () => HttpResponse.error()));
    renderSettings();
    await screen.findByText("Pixel 8");
    fireEvent.click(within(byNode("settings.sessions.session", "2")).getByTestId("settings.sessions.session.revoke"));
    expect(await screen.findByTestId("settings-snackbar")).toHaveTextContent("That didn't send. Try again.");
    expect(screen.getByText("Pixel 8")).toBeInTheDocument();
  });

  it("sign_out_everywhere_else_keeps_this_device", async () => {
    server.use(okMutation("RevokeOtherSessions", "RevokeSessionsPayload", { revokedCount: 2 }));
    renderSettings();
    await screen.findByText("Pixel 8");
    fireEvent.click(screen.getByTestId("settings.sessions.elsewhere"));
    expect(await screen.findByTestId("settings-snackbar")).toHaveTextContent("Signed out everywhere else.");
    expect(screen.queryByText("Pixel 8")).not.toBeInTheDocument();
    expect(screen.getByText("Firefox on Ubuntu")).toBeInTheDocument();
  });

  it("password_row_reads_changed_and_its_age", async () => {
    renderSettings();
    expect(await screen.findByTestId("settings.credentials.password.status")).toHaveTextContent("Changed 21d");
    fireEvent.click(screen.getByTestId("settings.credentials.password"));
    expect(push).toHaveBeenCalledWith("/settings/password");
  });

  it("reads the handle and opens its change", async () => {
    renderSettings();
    expect(await screen.findByTestId("settings.credentials.handle.value")).toHaveTextContent("@sol");
    fireEvent.click(screen.getByTestId("settings.credentials.handle"));
    expect(push).toHaveBeenCalledWith("/settings/handle");
  });

  it("email_row_reads_change_pending_while_a_side_is_owed", async () => {
    server.use(
      accountHandler({
        pendingEmailChange: {
          __typename: "PendingEmailChange",
          newEmail: "sol@ferreira.studio",
          requiresCode: true,
          codeConfirmed: false,
          linkConfirmed: true,
          expiresAt: ago(-1),
        },
      }),
    );
    renderSettings();
    expect(await screen.findByTestId("settings.credentials.email.status")).toHaveTextContent("Change pending");
    // email_row_never_reads_the_new_address_while_pending
    expect(screen.getByTestId("settings.credentials.email.value")).toHaveTextContent("sol@solferreira.art");
    expect(screen.getByTestId("settings.credentials.email")).not.toHaveTextContent("sol@ferreira.studio");
    // email_row_opens_the_confirmation_on_the_owed_side
    fireEvent.click(screen.getByTestId("settings.credentials.email"));
    expect(push).toHaveBeenCalledWith("/settings/email/confirm");
  });

  it("email_row_opens_the_request_after_a_change_ran_out", async () => {
    // A run-out change reads null on the account (EC delta 3).
    renderSettings();
    await screen.findByTestId("settings.credentials.email.value");
    expect(screen.queryByTestId("settings.credentials.email.status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("settings.credentials.email"));
    expect(push).toHaveBeenCalledWith("/settings/email");
  });

  it("email_row_opens_the_applicant_change_for_an_unverified_applicant", async () => {
    server.use(accountHandler({ emailVerified: false, accountState: "APPLICANT" }));
    renderSettings();
    await screen.findByTestId("settings.credentials.email.value");
    fireEvent.click(screen.getByTestId("settings.credentials.email"));
    expect(push).toHaveBeenCalledWith("/settings/email/applicant");
  });

  it("contact_opens_mail_not_the_report", async () => {
    renderSettings();
    expect(await screen.findByTestId("settings.about.contact.value")).toHaveTextContent("hello@cogra.local");
    // The running version, as the build inlines it (`next.config.ts`).
    expect(screen.getByTestId("settings.about.whatsNew.value")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("settings.about.aboutCogra"));
    expect(push).toHaveBeenCalledWith("/about?from=settings");
  });

  it("says a subpage's return in its snackbar, once", async () => {
    search = new URLSearchParams("done=handle");
    renderSettings();
    expect(await screen.findByTestId("settings-snackbar")).toHaveTextContent("Your handle is now @sol.");
    expect(replace).toHaveBeenCalledWith("/settings");
  });

  it("success_returns_to_settings_with_the_snackbar_and_new_age", async () => {
    search = new URLSearchParams("done=password");
    server.use(accountHandler({ passwordChangedAt: new Date().toISOString() }));
    renderSettings();
    expect(await screen.findByTestId("settings-snackbar")).toHaveTextContent(
      "Password changed — other devices are signed out.",
    );
    expect(screen.getByTestId("settings.credentials.password.status")).toHaveTextContent("Changed now");
  });
});

describe("the default license", () => {
  it("opens_with_the_current_default_focus_on_title", async () => {
    server.use(
      accountHandler({
        preferences: {
          __typename: "UserPreferences",
          defaultLicense: { __typename: "License", attribution: 1, provenance: 0 },
        },
      }),
    );
    renderSettings();
    expect(await screen.findByTestId("settings.writing.license.value")).toHaveTextContent(
      "Credit always · Not logged",
    );
    fireEvent.click(screen.getByTestId("settings.writing.license"));
    const sheet = await screen.findByTestId("settings.licenseSheet");
    expect(within(sheet).getByTestId("settings.licenseSheet.title")).toHaveTextContent("Default license");
    expect(within(sheet).getByTestId("settings.licenseSheet.title.help")).toHaveAccessibleName("License");
    expect(document.activeElement).toHaveTextContent("Default license");
    const chosen = byNode("settings.licenseSheet.credit.tier", "3").querySelector("input");
    expect(chosen).toBeChecked();
    expect(screen.getByTestId("settings.licenseSheet.foot.summary")).toHaveTextContent(
      "Credit always · Not logged — every use credits you, and uses go unlogged.",
    );
  });

  it("taps_stage_until_done and done_saves_and_the_row_reads_it", async () => {
    const saved: unknown[] = [];
    server.use(
      graphql.mutation("SetPreferences", ({ variables }) => {
        saved.push(variables);
        return HttpResponse.json({
          data: {
            setPreferences: {
              __typename: "SetPreferencesPayload",
              preferences: {
                __typename: "UserPreferences",
                defaultLicense: { __typename: "License", attribution: 0.5, provenance: 1 },
              },
              userErrors: [],
            },
          },
        });
      }),
    );
    renderSettings();
    expect(await screen.findByTestId("settings.writing.license.value")).toHaveTextContent("Public domain");
    fireEvent.click(screen.getByTestId("settings.writing.license"));
    await screen.findByTestId("settings.licenseSheet");
    fireEvent.click(byNode("settings.licenseSheet.credit.tier", "2").querySelector("input")!);
    fireEvent.click(byNode("settings.licenseSheet.record.tier", "3").querySelector("input")!);
    // Staged, not saved.
    expect(saved).toEqual([]);
    expect(screen.getByTestId("settings.writing.license.value")).toHaveTextContent("Public domain");
    fireEvent.click(screen.getByTestId("settings.licenseSheet.foot.done"));
    await waitFor(() =>
      expect(screen.getByTestId("settings.writing.license.value")).toHaveTextContent(
        "Credit commercially · Log every use",
      ),
    );
    await waitFor(() => expect(saved).toEqual([{ input: { defaultLicense: { attribution: 0.5, provenance: 1 } } }]));
  });

  it("failed_save_reverts_with_that_didnt_go_through_and_retry", async () => {
    server.use(graphql.mutation("SetPreferences", () => HttpResponse.error()));
    renderSettings();
    await screen.findByTestId("settings.writing.license.value");
    fireEvent.click(screen.getByTestId("settings.writing.license"));
    await screen.findByTestId("settings.licenseSheet");
    fireEvent.click(byNode("settings.licenseSheet.credit.tier", "3").querySelector("input")!);
    fireEvent.click(screen.getByTestId("settings.licenseSheet.foot.done"));
    expect(await screen.findByTestId("settings.writing.license.status")).toHaveTextContent(
      "That didn't go through.",
    );
    expect(screen.getByTestId("settings.writing.license.value")).toHaveTextContent("Public domain");
    expect(screen.getByTestId("settings-license-retry")).toHaveTextContent("Retry");
  });

  it("scrim_swipe_back_escape_discard", async () => {
    const saved: unknown[] = [];
    server.use(
      graphql.mutation("SetPreferences", ({ variables }) => {
        saved.push(variables);
        return HttpResponse.json({ data: null });
      }),
    );
    renderSettings();
    await screen.findByTestId("settings.writing.license.value");
    fireEvent.click(screen.getByTestId("settings.writing.license"));
    const sheet = await screen.findByTestId("settings.licenseSheet");
    fireEvent.click(byNode("settings.licenseSheet.credit.tier", "3").querySelector("input")!);
    // A press on the backdrop is a press on the dialog element itself.
    fireEvent.click(sheet);
    await waitFor(() => expect(screen.queryByTestId("settings.licenseSheet")).not.toBeInTheDocument());
    expect(saved).toEqual([]);
    expect(screen.getByTestId("settings.writing.license.value")).toHaveTextContent("Public domain");
  });
});

describe("signing out", () => {
  it("forget_switch_flips_without_signing_out", async () => {
    const { identity, tokens } = renderSettings();
    const row = await screen.findByTestId("settings.leaving.forget");
    expect(row).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("settings.leaving.forget.status")).toHaveTextContent(
      "Your key, your draft and any kept picks are cleared from this browser when you sign out.",
    );
    fireEvent.click(row);
    await waitFor(() => expect(row).toHaveAttribute("aria-checked", "true"));
    expect(await identity.isEphemeral()).toBe(true);
    expect(tokens.accessToken()).toBe("access-1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sign_out_remembered_keeps_the_key_and_offers_the_account — and keeps the draft (F4)", async () => {
    server.use(okMutation("RevokeSession", "RevokeSessionPayload", { session: { __typename: "Session", id: "s1" } }));
    const { identity, drafts, tokens } = renderSettings();
    await screen.findByTestId("settings.credentials.password.status");
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    await waitFor(() => expect(tokens.accessToken()).toBeNull());
    expect(await identity.actorKey()).not.toBeNull();
    // A remembered sign-out clears nothing — the draft included.
    expect(drafts.clear).not.toHaveBeenCalled();
  });

  it("sign_out_forgotten_with_a_backup_clears_without_asking", async () => {
    server.use(okMutation("RevokeSession", "RevokeSessionPayload", { session: { __typename: "Session", id: "s1" } }));
    const { identity, drafts, tokens } = renderSettings({ ephemeral: true });
    await screen.findByTestId("settings.credentials.password.status");
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    await waitFor(() => expect(tokens.accessToken()).toBeNull());
    expect(screen.queryByTestId("settings.dialog")).not.toBeInTheDocument();
    expect(await identity.actorKey()).toBeNull();
    expect(drafts.clear).toHaveBeenCalled();
  });

  it("sign_out_forgotten_with_the_only_key_asks_first", async () => {
    server.use(accountHandler({ keyBackupCreatedAt: null }));
    const { identity, drafts, tokens } = renderSettings({ ephemeral: true });
    await screen.findByTestId("settings.backup.recovery.status");
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    const dialog = await screen.findByTestId("settings.dialog");
    // Nothing ends or is cleared before an answer.
    expect(tokens.accessToken()).toBe("access-1");
    expect(await identity.actorKey()).not.toBeNull();
    expect(drafts.clear).not.toHaveBeenCalled();
    // dialog_names_key_draft_and_kept_picks
    expect(within(dialog).getByTestId("settings.dialog.title")).toHaveTextContent("Sign out without a backup?");
    expect(within(dialog).getByTestId("settings.dialog.body")).toHaveTextContent(
      "This browser holds the only copy of your key. Signing out leaves your key, your draft and any opinions you kept pending here",
    );
    expect(within(dialog).getByTestId("settings.dialog.recovery")).toHaveTextContent("Make a recovery code");
    expect(within(dialog).getByTestId("settings.dialog.erase")).toHaveTextContent("Erase them and sign out");
    // The lock answer waits for the device lock (sign-out custody packet).
    expect(within(dialog).queryByTestId("settings.dialog.lock")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(within(dialog).getByTestId("settings.dialog.title"));
  });

  it("an unconfirmed backup asks too", async () => {
    // No account read and a seed still retained: nothing proves an upload.
    server.use(graphql.query("SettingsAccount", () => HttpResponse.error()));
    renderSettings({ ephemeral: true, seed: new Uint8Array(32) });
    await screen.findByTestId("settings-read-failed");
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    expect(await screen.findByTestId("settings.dialog")).toBeInTheDocument();
  });

  it("make_a_recovery_code_stays_signed_in", async () => {
    server.use(accountHandler({ keyBackupCreatedAt: null }));
    const { tokens } = renderSettings({ ephemeral: true });
    await screen.findByTestId("settings.backup.recovery.status");
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    fireEvent.click(await screen.findByTestId("settings.dialog.recovery"));
    expect(push).toHaveBeenCalledWith("/settings/backup");
    expect(tokens.accessToken()).toBe("access-1");
  });

  it("erase_purges_and_signs_out", async () => {
    server.use(
      accountHandler({ keyBackupCreatedAt: null }),
      okMutation("RevokeSession", "RevokeSessionPayload", { session: { __typename: "Session", id: "s1" } }),
    );
    const { identity, drafts, tokens } = renderSettings({ ephemeral: true });
    await screen.findByTestId("settings.backup.recovery.status");
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    fireEvent.click(await screen.findByTestId("settings.dialog.erase"));
    await waitFor(() => expect(tokens.accessToken()).toBeNull());
    expect(await identity.actorKey()).toBeNull();
    expect(drafts.clear).toHaveBeenCalled();
  });

  it("scrim_and_back_close_still_signed_in_focus_on_sign_out", async () => {
    server.use(accountHandler({ keyBackupCreatedAt: null }));
    const { identity, tokens } = renderSettings({ ephemeral: true });
    await screen.findByTestId("settings.backup.recovery.status");
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    const dialog = await screen.findByTestId("settings.dialog");
    fireEvent.click(dialog);
    await waitFor(() => expect(screen.queryByTestId("settings.dialog")).not.toBeInTheDocument());
    expect(tokens.accessToken()).toBe("access-1");
    expect(await identity.actorKey()).not.toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("settings.leaving.leave")));

    // System Back and Escape arrive as the dialog's cancel.
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    const again = await screen.findByTestId("settings.dialog");
    act(() => {
      again.dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    await waitFor(() => expect(screen.queryByTestId("settings.dialog")).not.toBeInTheDocument());
    expect(tokens.accessToken()).toBe("access-1");
  });

  it("sign_out_reads_signing_out_after_200ms", async () => {
    server.use(
      graphql.mutation("RevokeSession", async () => {
        await delay(400);
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
    renderSettings();
    await screen.findByTestId("settings.credentials.password.status");
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    expect(screen.getByTestId("settings.leaving.leave.label")).toHaveTextContent("Sign out");
    await waitFor(() =>
      expect(screen.getByTestId("settings.leaving.leave.label")).toHaveTextContent("Signing out…"),
    );
  });
});
