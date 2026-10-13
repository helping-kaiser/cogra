import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { delay, graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountDeletionProvider } from "@/lib/deletion/deletion-status";
import { RUNNING_VERSION } from "@/lib/release/running-version";
import { createTokenStore } from "@/lib/session/token-store";
import { accountFilterLevel, setAccountFilterLevel } from "@/lib/settings/sensitive-content";
import { fakeIdentityStore } from "@/test/identity";
import { hiddenHandlers, hiddenLog } from "@/test/hidden";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { SettingsView } from "./settings-view";

const push = vi.fn();
const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => search,
  usePathname: () => "/settings",
}));

/** The account's deletion standing, as the server reads it (OS-15). */
function deletionHandler(deletionPath: string, accountDeletion: unknown = null) {
  return graphql.query("AccountDeletion", () =>
    HttpResponse.json({ data: { me: { __typename: "User", id: "u1", deletionPath, accountDeletion } } }),
  );
}

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
  const seals = { forget: vi.fn(async () => {}) };
  const forgetSeenRecord = vi.fn<(account: string) => Promise<void>>(async () => {});
  const erase = vi.fn(async () => {});
  const leave = vi.fn();
  const tokens = signedInStore();
  // The device lock's two settings-side calls (sign-out-custody §3.4-§3.5);
  // the engine itself is covered by `device-lock.test.ts`.
  const deviceLock = {
    ensureHeld: vi.fn(async () => "held" as const),
    discard: vi.fn(async () => {}),
  };
  const rendered = renderWithProviders(
    <AccountDeletionProvider>
      <SettingsView
        store={identity}
        drafts={drafts}
        seals={seals}
        forgetSeenRecord={forgetSeenRecord}
        erase={erase}
        leave={leave}
        deviceLock={deviceLock}
      />
    </AccountDeletionProvider>,
    { store: tokens },
  );
  return { ...rendered, identity, drafts, seals, forgetSeenRecord, tokens, erase, leave, deviceLock };
}

/** The node a registered path names (`data-node.ts`). */
const byNode = (path: string, key?: string) =>
  key === undefined
    ? screen.getByTestId(path)
    : screen.getAllByTestId(path).find((element) => element.getAttribute("data-testid-key") === key)!;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  setAccountFilterLevel(null);
  delete document.documentElement.dataset.theme;
  push.mockReset();
  replace.mockReset();
  search = new URLSearchParams();
  server.use(accountHandler(), deletionHandler("BY_LINK"));
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
      "settings.sensitive",
      "settings.backup",
      "settings.sessions",
      "settings.credentials",
      "settings.about",
      "settings.leaving",
      "settings.ending",
    ].map((path) => screen.getByTestId(path));
    for (let i = 1; i < groups.length; i += 1) {
      // Each group follows the one before it in the document.
      expect(groups[i - 1].compareDocumentPosition(groups[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByTestId("settings.stance.label")).toHaveTextContent("Giving an opinion");
  });

  it("delete_account_is_the_last_row_quiet_with_the_members_footnote", async () => {
    renderSettings();
    await screen.findByTestId("settings.credentials.password.status");
    const row = screen.getByTestId("settings.ending.delete");
    expect(screen.getByTestId("settings.ending")).toHaveAccessibleName("Delete account");
    expect(screen.getByTestId("settings.ending.delete.label")).toHaveTextContent("Delete account");
    expect(screen.getByTestId("settings.ending.delete.chevron")).toBeInTheDocument();
    expect(screen.getByTestId("settings.ending.footnote")).toHaveTextContent(
      "Nothing is deleted here. The next screen says what goes and what stays, and the deletion is confirmed by a link we email you.",
    );
    // The mailed path's row opens the request screen (DeleteAccount.md:3).
    await waitFor(() => {
      fireEvent.click(row);
      expect(push).toHaveBeenCalledWith("/settings/delete");
    });
  });

  it("an_applicants_delete_footnote_drops_the_mailed_link", async () => {
    // Keyed on the server's path, never on the account state (OS-15).
    server.use(deletionHandler("IMMEDIATE"));
    renderSettings();
    await waitFor(() =>
      expect(screen.getByTestId("settings.ending.footnote")).toHaveTextContent(
        /^Nothing is deleted here\. The next screen says what goes and what stays\.$/,
      ),
    );
    fireEvent.click(screen.getByTestId("settings.ending.delete"));
    expect(push).toHaveBeenCalledWith("/settings/delete");
  });

  it("a_locked_row_wears_the_locked_look_and_answers_with_a_snackbar", async () => {
    server.use(deletionHandler("LOCKED"));
    renderSettings();
    const row = screen.getByTestId("settings.ending.delete");
    await waitFor(() => expect(row).toHaveAttribute("aria-disabled", "true"));
    expect(row.className).toContain("opacity-[var(--state-disabled)]");
    // Still tappable: the tap is how it says why (Settings.md:175).
    fireEvent.click(row);
    expect(await screen.findByTestId("settings-snackbar")).toHaveTextContent(
      "You can delete your account once your registration lands.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("the_lock_is_the_servers_never_the_account_states", async () => {
    // An applicant the server reads BY_LINK (item 69's registered applicant)
    // walks the mailed path; nothing here re-derives a lock.
    server.use(accountHandler({ accountState: "APPLICANT" }), deletionHandler("BY_LINK"));
    renderSettings();
    await screen.findByTestId("settings.credentials.password.status");
    await waitFor(() => {
      fireEvent.click(screen.getByTestId("settings.ending.delete"));
      expect(push).toHaveBeenCalledWith("/settings/delete");
    });
    expect(screen.getByTestId("settings.ending.delete")).not.toHaveAttribute("aria-disabled");
  });

  it("during_the_grace_the_row_counts_down_the_footnote_goes_and_the_band_rides", async () => {
    server.use(
      deletionHandler("BY_LINK", {
        __typename: "AccountDeletion",
        scheduledFor: new Date(Date.now() + 6 * 86_400_000).toISOString(),
        includesContent: false,
      }),
    );
    renderSettings();
    expect(await screen.findByTestId("settings.ending.delete.status")).toHaveTextContent("Deletion in 6 days");
    expect(screen.queryByTestId("settings.ending.footnote")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings.deletionBand.line")).toHaveTextContent("Your account is deleted in 6 days.");
    fireEvent.click(screen.getByTestId("settings.ending.delete"));
    // The grace page, never the request screen (SettingsDeleting.md:13).
    expect(push).toHaveBeenCalledWith("/settings/delete/pending");
  });

  it("the_bands_cancel_restores_the_row_and_its_footnote", async () => {
    server.use(
      deletionHandler("BY_LINK", {
        __typename: "AccountDeletion",
        scheduledFor: new Date(Date.now() + 6 * 86_400_000).toISOString(),
        includesContent: false,
      }),
      okMutation("CancelAccountDeletion", "AccountDeletionPayload", { accountDeletion: null }),
    );
    renderSettings();
    fireEvent.click(await screen.findByTestId("settings.deletionBand.cancel"));
    expect(await screen.findByTestId("deletion-snackbar")).toHaveTextContent(
      "Canceled — your account stays, and nothing was deleted.",
    );
    expect(screen.queryByTestId("settings.deletionBand")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings.ending.delete.status")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings.ending.footnote")).toBeInTheDocument();
  });

  it("the_grace_pages_cancel_returns_with_the_canceled_snackbar", async () => {
    search = new URLSearchParams("done=deletionCanceled");
    renderSettings();
    expect(await screen.findByTestId("settings-snackbar")).toHaveTextContent(
      "Canceled — your account stays, and nothing was deleted.",
    );
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
    // The header and its band are one block inside the pinned bar.
    expect(header.closest(".sticky")).toHaveClass("sticky", "top-0");
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
    // The delayed revoke lands inside this test, never the next one's.
    expect(await screen.findByTestId("settings-snackbar")).toHaveTextContent("Signed out of Pixel 8.");
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

  it("whats_new_opens_the_release_chronicle_and_reads_the_running_version", async () => {
    renderSettings();
    const value = await screen.findByTestId("settings.about.whatsNew.value");
    // The one source the chronicle's `installed` reads too (WhatsNew.md:7).
    expect(value).toHaveTextContent(RUNNING_VERSION);
    fireEvent.click(screen.getByTestId("settings.about.whatsNew"));
    expect(push).toHaveBeenCalledWith("/settings/whats-new");
  });

  it("says a subpage's return in its snackbar, once", async () => {
    search = new URLSearchParams("done=handle");
    renderSettings();
    expect(await screen.findByTestId("settings-snackbar")).toHaveTextContent("Your handle is now @sol.");
    // The `?done=` is dropped in the effect after the snackbar's render.
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/settings"));
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

describe("sensitive content (B5)", () => {
  function preferencesWith(level: number | null) {
    return {
      preferences: {
        __typename: "UserPreferences",
        defaultLicense: null,
        contentFilteringSeverityLevel: level,
      },
    };
  }

  /** A SetPreferences that records each input and answers the level it was sent. */
  function recordingSave(sent: unknown[]) {
    return graphql.mutation("SetPreferences", ({ variables }) => {
      sent.push(variables.input);
      const level = (variables.input as { contentFilteringSeverityLevel: number | null })
        .contentFilteringSeverityLevel;
      return HttpResponse.json({
        data: {
          setPreferences: {
            __typename: "SetPreferencesPayload",
            preferences: {
              __typename: "UserPreferences",
              defaultLicense: null,
              contentFilteringSeverityLevel: level,
            },
            userErrors: [],
          },
        },
      });
    });
  }

  it("sensitive_group_stands_after_people", async () => {
    renderSettings();
    const group = await screen.findByTestId("settings.sensitive");
    expect(screen.getByTestId("settings.sensitive.label")).toHaveTextContent("Sensitive content");
    expect(screen.getByTestId("settings.sensitive.footnote")).toHaveTextContent(
      "This choice follows your account to every device.",
    );
    const people = screen.getByTestId("settings.people");
    const backup = screen.getByTestId("settings.backup");
    expect(people.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(group.compareDocumentPosition(backup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // One switch, never a sheet or a pair of rows.
    expect(within(group).getAllByRole("switch")).toHaveLength(1);
  });

  it("unveil_switch_reads_off_by_default", async () => {
    renderSettings();
    await screen.findByTestId("settings.credentials.password.status");
    const row = screen.getByTestId("settings.sensitive.unveil");
    expect(row).toHaveAttribute("role", "switch");
    expect(row).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("settings.sensitive.unveil.label")).toHaveTextContent(
      "Always unveil sensitive content",
    );
    expect(screen.getByTestId("settings.sensitive.unveil.status")).toHaveTextContent(
      "Off, the veil stays until you tap it.",
    );
  });

  it("unveil_switch_flips_without_a_dialog_and_saves_to_the_account", async () => {
    const sent: unknown[] = [];
    server.use(recordingSave(sent));
    renderSettings();
    await screen.findByTestId("settings.credentials.password.status");
    const row = screen.getByTestId("settings.sensitive.unveil");
    fireEvent.click(row);
    // Optimistic: on at once, no dialog.
    expect(row).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(sent).toEqual([{ contentFilteringSeverityLevel: 0 }]));
    await waitFor(() => expect(accountFilterLevel()).toBe(0));
    // The On line (seam 132, G10), verbatim.
    expect(screen.getByTestId("settings.sensitive.unveil.status").textContent).toBe(
      "On, sensitive content stands unveiled wherever you read.",
    );

    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-checked", "false");
    // Off writes the explicit null that restores the default veil.
    await waitFor(() =>
      expect(sent).toEqual([
        { contentFilteringSeverityLevel: 0 },
        { contentFilteringSeverityLevel: null },
      ]),
    );
    await waitFor(() => expect(accountFilterLevel()).toBeNull());
    // Never written to this device.
    expect(JSON.stringify({ ...window.localStorage })).not.toMatch(/unveil|sensitive/i);
  });

  it("a_choice_made_on_another_device_reads_here", async () => {
    server.use(accountHandler(preferencesWith(0)));
    renderSettings();
    await waitFor(() =>
      expect(screen.getByTestId("settings.sensitive.unveil")).toHaveAttribute("aria-checked", "true"),
    );
    expect(accountFilterLevel()).toBe(0);
  });

  it("a level other than 0 reads off — the gradient is post-MVP", async () => {
    server.use(accountHandler(preferencesWith(4)));
    renderSettings();
    await screen.findByTestId("settings.credentials.password.status");
    expect(screen.getByTestId("settings.sensitive.unveil")).toHaveAttribute("aria-checked", "false");
  });

  it("unveil_save_without_an_answer_reverts_with_the_no_answer_snackbar", async () => {
    server.use(graphql.mutation("SetPreferences", () => HttpResponse.error()));
    renderSettings();
    await screen.findByTestId("settings.credentials.password.status");
    const row = screen.getByTestId("settings.sensitive.unveil");
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-checked", "true");
    expect(await screen.findByTestId("settings-snackbar")).toHaveTextContent("That didn't send. Try again.");
    expect(row).toHaveAttribute("aria-checked", "false");
    expect(accountFilterLevel()).toBeNull();
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
      "Your key, your draft, any kept picks and what you've seen are cleared from this browser when you sign out.",
    );
    fireEvent.click(row);
    await waitFor(() => expect(row).toHaveAttribute("aria-checked", "true"));
    expect(await identity.isEphemeral()).toBe(true);
    expect(tokens.accessToken()).toBe("access-1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("forget_switch_on_obtains_a_lock_and_off_discards_it", async () => {
    const { deviceLock } = renderSettings();
    const row = await screen.findByTestId("settings.leaving.forget");
    fireEvent.click(row);
    await waitFor(() => expect(deviceLock.ensureHeld).toHaveBeenCalledWith("acct-1"));
    fireEvent.click(row);
    await waitFor(() => expect(deviceLock.discard).toHaveBeenCalledWith("acct-1"));
    // Neither waits in the way: the switch reads its new state at once.
    expect(row).toHaveAttribute("aria-checked", "false");
  });

  it("the forget switch flips even when its lock gets no answer", async () => {
    const { deviceLock } = renderSettings();
    deviceLock.ensureHeld.mockRejectedValueOnce(new Error("offline"));
    const row = await screen.findByTestId("settings.leaving.forget");
    fireEvent.click(row);
    await waitFor(() => expect(deviceLock.ensureHeld).toHaveBeenCalled());
    expect(row).toHaveAttribute("aria-checked", "true");
  });

  it("sign_out_remembered_keeps_the_key_and_offers_the_account — and keeps the draft (F4)", async () => {
    server.use(okMutation("RevokeSession", "RevokeSessionPayload", { session: { __typename: "Session", id: "s1" } }));
    const { identity, drafts, seals, forgetSeenRecord, tokens } = renderSettings();
    await screen.findByTestId("settings.credentials.password.status");
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    await waitFor(() => expect(tokens.accessToken()).toBeNull());
    expect(await identity.actorKey()).not.toBeNull();
    // A remembered sign-out clears nothing — the draft and its sealed copies included.
    expect(drafts.clear).not.toHaveBeenCalled();
    expect(seals.forget).not.toHaveBeenCalled();
    // a_remembered_sign_out_keeps_the_record
    expect(forgetSeenRecord).not.toHaveBeenCalled();
  });

  it("sign_out_forgotten_with_a_backup_clears_without_asking", async () => {
    server.use(okMutation("RevokeSession", "RevokeSessionPayload", { session: { __typename: "Session", id: "s1" } }));
    const { identity, drafts, seals, forgetSeenRecord, tokens } = renderSettings({ ephemeral: true });
    await screen.findByTestId("settings.credentials.password.status");
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    await waitFor(() => expect(tokens.accessToken()).toBeNull());
    expect(screen.queryByTestId("settings.dialog")).not.toBeInTheDocument();
    expect(await identity.actorKey()).toBeNull();
    expect(drafts.clear).toHaveBeenCalled();
    // A staged post's sealed copy is the draft it came from (Settings.md:145).
    expect(seals.forget).toHaveBeenCalled();
    // a_dont_remember_sign_out_clears_the_accounts_seen_record: this account's, by id, once.
    expect(forgetSeenRecord).toHaveBeenCalledTimes(1);
    expect(forgetSeenRecord).toHaveBeenCalledWith("acct-1");
  });

  it("sign_out_forgotten_with_the_only_key_asks_first", async () => {
    server.use(accountHandler({ keyBackupCreatedAt: null }));
    const { identity, drafts, seals, forgetSeenRecord, tokens } = renderSettings({ ephemeral: true });
    await screen.findByTestId("settings.backup.recovery.status");
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    const dialog = await screen.findByTestId("settings.dialog");
    // Nothing ends or is cleared before an answer.
    expect(tokens.accessToken()).toBe("access-1");
    expect(await identity.actorKey()).not.toBeNull();
    expect(drafts.clear).not.toHaveBeenCalled();
    expect(seals.forget).not.toHaveBeenCalled();
    expect(forgetSeenRecord).not.toHaveBeenCalled();
    // dialog_names_key_draft_and_kept_picks
    expect(within(dialog).getByTestId("settings.dialog.title")).toHaveTextContent("Sign out without a backup?");
    expect(within(dialog).getByTestId("settings.dialog.body")).toHaveTextContent(
      "This browser holds the only copy of your key. Signing out leaves your key, your draft and any opinions you kept pending here",
    );
    // Item 87 (ruled): the custody sentence ends without the locality, both twins.
    expect(within(dialog).getByTestId("settings.dialog.body")).toHaveTextContent(
      "kept pending here, locked until you sign in again. Erase them instead",
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
    const { identity, drafts, seals, forgetSeenRecord, tokens, deviceLock } = renderSettings({ ephemeral: true });
    await screen.findByTestId("settings.backup.recovery.status");
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    fireEvent.click(await screen.findByTestId("settings.dialog.erase"));
    await waitFor(() => expect(tokens.accessToken()).toBeNull());
    expect(await identity.actorKey()).toBeNull();
    expect(drafts.clear).toHaveBeenCalled();
    expect(seals.forget).toHaveBeenCalled();
    expect(forgetSeenRecord).toHaveBeenCalledWith("acct-1");
    // erase_discards_the_device_lock (sign-out-custody §3.5 ERASE)
    expect(deviceLock.discard).toHaveBeenCalledWith("acct-1");
  });

  it("erase_discards_the_device_lock", async () => {
    // The Clearing-data erase too: the server half goes while a session
    // still exists to name it.
    const { deviceLock, leave } = renderSettings();
    await screen.findByTestId("settings.backup.recovery.status");
    fireEvent.click(screen.getByTestId("settings.clearing.erase"));
    fireEvent.click(byNode("settings.dialog.erase", "made"));
    await waitFor(() => expect(leave).toHaveBeenCalledWith("/login"));
    expect(deviceLock.discard).toHaveBeenCalledWith("acct-1");
  });

  it("a forgotten sign-out with a backup discards the lock before it purges", async () => {
    server.use(okMutation("RevokeSession", "RevokeSessionPayload", { session: { __typename: "Session", id: "s1" } }));
    const { deviceLock, tokens } = renderSettings({ ephemeral: true });
    await screen.findByTestId("settings.credentials.password.status");
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    await waitFor(() => expect(tokens.accessToken()).toBeNull());
    expect(deviceLock.discard).toHaveBeenCalledWith("acct-1");
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
    const { tokens } = renderSettings();
    await screen.findByTestId("settings.credentials.password.status");
    fireEvent.click(screen.getByTestId("settings.leaving.leave"));
    expect(screen.getByTestId("settings.leaving.leave.label")).toHaveTextContent("Sign out");
    await waitFor(() =>
      expect(screen.getByTestId("settings.leaving.leave.label")).toHaveTextContent("Signing out…"),
    );
    // The delayed sign-out lands inside this test, never the next one's.
    await waitFor(() => expect(tokens.accessToken()).toBeNull());
  });
});

describe("clearing data (B6)", () => {
  const MADE_FOOTNOTE =
    "Your key lives only in this browser. Clear CoGra's data here and the key is erased with it — without your recovery code, your account is gone for good. Your draft, any kept picks and the choices kept on this device go too, and you're signed out. What you've seen comes back when you sign in.";
  const NONE_FOOTNOTE =
    "Your key lives only in this browser, and it has no recovery code yet. Clear CoGra's data here and the key is erased with it — your account is gone for good. Your draft, any kept picks and the choices kept on this device go too, and you're signed out. What you've seen comes back when you sign in.";

  it("the_footnote_opens_on_the_key_with_a_code_made", async () => {
    server.use(accountHandler());
    renderSettings();
    await screen.findByTestId("settings.backup.recovery.status");
    expect(screen.getByTestId("settings.clearing.label")).toHaveTextContent("Clearing data");
    expect(screen.getByTestId("settings.clearing.footnote")).toHaveTextContent(MADE_FOOTNOTE);
    expect(screen.getByTestId("settings.clearing.erase")).toHaveTextContent("Erase everything from this browser");
  });

  it("the_footnote_drops_its_condition_with_no_code", async () => {
    server.use(accountHandler({ keyBackupCreatedAt: null }));
    renderSettings();
    await screen.findByTestId("settings.backup.recovery.status");
    expect(screen.getByTestId("settings.clearing.footnote")).toHaveTextContent(NONE_FOOTNOTE);
  });

  it("the_row_asks_first_and_nothing_is_erased_before_an_answer", async () => {
    server.use(accountHandler({ keyBackupCreatedAt: null }));
    const { identity, tokens, erase, leave } = renderSettings();
    await screen.findByTestId("settings.backup.recovery.status");
    fireEvent.click(screen.getByTestId("settings.clearing.erase"));
    const dialog = await screen.findByTestId("settings.dialog");
    expect(within(dialog).getByTestId("settings.dialog.title")).toHaveTextContent(
      "Erase everything from this browser?",
    );
    expect(within(dialog).getByTestId("settings.dialog.body")).toHaveTextContent(
      /^This browser holds the only copy of your key, and it has no recovery code\./,
    );
    // No code: Make a recovery code leads, the erase is the quiet answer, no Cancel.
    expect(byNode("settings.dialog.recovery", "none")).toHaveTextContent("Make a recovery code");
    expect(byNode("settings.dialog.erase", "none")).toHaveTextContent("Erase everything and sign out");
    expect(within(dialog).queryByTestId("settings.dialog.cancel")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(within(dialog).getByTestId("settings.dialog.title"));
    expect(erase).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();
    expect(tokens.accessToken()).toBe("access-1");
    expect(await identity.actorKey()).not.toBeNull();
  });

  it("with_a_code_made_the_erase_is_quiet_and_cancel_is_filled", async () => {
    server.use(accountHandler());
    renderSettings();
    await screen.findByTestId("settings.backup.recovery.status");
    fireEvent.click(screen.getByTestId("settings.clearing.erase"));
    const dialog = await screen.findByTestId("settings.dialog");
    expect(within(dialog).getByTestId("settings.dialog.body")).toHaveTextContent(
      /^Your key is erased with everything else, and only your recovery code can bring it back/,
    );
    expect(within(dialog).getByTestId("settings.dialog.body")).toHaveTextContent(
      "What you've seen comes back when you sign in.",
    );
    expect(byNode("settings.dialog.erase", "made")).toHaveTextContent("Erase everything and sign out");
    expect(byNode("settings.dialog.cancel", "made")).toHaveTextContent("Cancel");
    expect(within(dialog).queryByTestId("settings.dialog.recovery")).not.toBeInTheDocument();
  });

  it("the_erase_clears_this_browser_ends_the_session_and_lands_on_sign_in_without_a_snackbar", async () => {
    let revoked = false;
    server.use(
      accountHandler(),
      graphql.mutation("RevokeSession", () => {
        revoked = true;
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
    const { tokens, erase, leave } = renderSettings();
    await screen.findByTestId("settings.backup.recovery.status");
    fireEvent.click(screen.getByTestId("settings.clearing.erase"));
    fireEvent.click(byNode("settings.dialog.erase", "made"));
    await waitFor(() => expect(leave).toHaveBeenCalledWith("/login"));
    // Revoked while a token still named the session, then wiped, then ended.
    expect(revoked).toBe(true);
    expect(erase).toHaveBeenCalledTimes(1);
    expect(tokens.accessToken()).toBeNull();
    expect(screen.queryByTestId("settings-snackbar")).not.toBeInTheDocument();
  });

  it("cancel_the_scrim_and_back_close_still_signed_in", async () => {
    server.use(accountHandler());
    const { tokens, erase } = renderSettings();
    await screen.findByTestId("settings.backup.recovery.status");
    fireEvent.click(screen.getByTestId("settings.clearing.erase"));
    fireEvent.click(byNode("settings.dialog.cancel", "made"));
    await waitFor(() => expect(screen.queryByTestId("settings.dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("settings.clearing.erase")));

    fireEvent.click(screen.getByTestId("settings.clearing.erase"));
    fireEvent.click(await screen.findByTestId("settings.dialog"));
    await waitFor(() => expect(screen.queryByTestId("settings.dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByTestId("settings.clearing.erase"));
    const again = await screen.findByTestId("settings.dialog");
    act(() => {
      again.dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    await waitFor(() => expect(screen.queryByTestId("settings.dialog")).not.toBeInTheDocument());
    expect(erase).not.toHaveBeenCalled();
    expect(tokens.accessToken()).toBe("access-1");
  });

  it("make_a_recovery_code_opens_the_code_and_stays_signed_in", async () => {
    server.use(accountHandler({ keyBackupCreatedAt: null }));
    const { tokens, erase } = renderSettings();
    await screen.findByTestId("settings.backup.recovery.status");
    fireEvent.click(screen.getByTestId("settings.clearing.erase"));
    fireEvent.click(byNode("settings.dialog.recovery", "none"));
    expect(push).toHaveBeenCalledWith("/settings/backup");
    expect(erase).not.toHaveBeenCalled();
    expect(tokens.accessToken()).toBe("access-1");
  });
});

describe("hidden accounts (SettingsHidden.md; hidden-actors packet §5.4, §6)", () => {
  const JUNO = { id: "j", handle: "juno", displayName: "Juno Baptiste", hiddenAt: ago(3) };
  const ADA = { id: "a", handle: "ada", displayName: "Ada Okonkwo", hiddenAt: ago(14) };

  /** The Unhide of the row keyed `handle`. */
  const unhideOf = (handle: string) => byNode("settings.hiddenSheet.list.account.trailing.unhide", handle);

  it("hidden_row_reads_the_count_and_opens_the_sheet_titled_with_no_count", async () => {
    server.use(...hiddenHandlers(hiddenLog(), { entries: [JUNO, ADA] }));
    renderSettings();
    await waitFor(() => expect(screen.getByTestId("settings.people.hidden.value")).toHaveTextContent("2"));
    fireEvent.click(screen.getByTestId("settings.people.hidden"));
    const sheet = await screen.findByTestId("settings.hiddenSheet");
    expect(within(sheet).getByTestId("settings.hiddenSheet.title")).toHaveTextContent(/^Hidden accounts$/);
  });

  it("rows_stand_most_recently_hidden_first_reading_name_handle_and_hidden_age_with_unhide", async () => {
    server.use(...hiddenHandlers(hiddenLog(), { entries: [ADA, JUNO] }));
    renderSettings();
    await waitFor(() => expect(screen.getByTestId("settings.people.hidden.value")).toHaveTextContent("2"));
    fireEvent.click(screen.getByTestId("settings.people.hidden"));
    await screen.findByTestId("settings.hiddenSheet");
    const keys = screen
      .getAllByTestId("settings.hiddenSheet.list.account")
      .map((row) => row.getAttribute("data-testid-key"));
    expect(keys).toEqual(["juno", "ada"]);
    const juno = byNode("settings.hiddenSheet.list.account", "juno");
    expect(juno).toHaveTextContent("Juno Baptiste");
    expect(juno).toHaveTextContent("@juno");
    expect(juno).toHaveTextContent("Hidden 3d");
    expect(unhideOf("juno")).toHaveTextContent("Unhide");
  });

  it("unhide_takes_the_row_and_the_snackbar_offers_undo_which_puts_it_back_in_place", async () => {
    const log = hiddenLog();
    server.use(...hiddenHandlers(log, { entries: [JUNO, ADA] }));
    renderSettings();
    await waitFor(() => expect(screen.getByTestId("settings.people.hidden.value")).toHaveTextContent("2"));
    fireEvent.click(screen.getByTestId("settings.people.hidden"));
    await screen.findByTestId("settings.hiddenSheet");
    fireEvent.click(unhideOf("juno"));
    expect(screen.getAllByTestId("settings.hiddenSheet.list.account")).toHaveLength(1);
    expect(await screen.findByTestId("settings-snackbar")).toHaveTextContent(
      "@juno is unhidden — their posts can reach your feed again.",
    );
    await waitFor(() => expect(log.unhides).toEqual(["j"]));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    // Back in its place, with its own age (the restore passes the row's hiddenAt).
    expect(
      screen.getAllByTestId("settings.hiddenSheet.list.account").map((row) => row.getAttribute("data-testid-key")),
    ).toEqual(["juno", "ada"]);
    await waitFor(() => expect(log.hides).toEqual([{ actor: "j", at: JUNO.hiddenAt }]));
  });

  it("unhiding_the_last_closes_onto_settings_reading_none", async () => {
    server.use(...hiddenHandlers(hiddenLog(), { entries: [JUNO] }));
    renderSettings();
    await waitFor(() => expect(screen.getByTestId("settings.people.hidden.value")).toHaveTextContent("1"));
    fireEvent.click(screen.getByTestId("settings.people.hidden"));
    await screen.findByTestId("settings.hiddenSheet");
    fireEvent.click(unhideOf("juno"));
    await waitFor(() => expect(screen.getByTestId("settings.people.hidden.value")).toHaveTextContent("None"));
    await waitFor(() =>
      expect((screen.getByTestId("settings.hiddenSheet") as HTMLDialogElement).open).toBe(false),
    );
  });

  it("a_failed_unhide_reverts_with_retry_in_the_rows_own_slots", async () => {
    const log = hiddenLog();
    server.use(...hiddenHandlers(log, { entries: [JUNO, ADA], failUnhide: true }));
    renderSettings();
    await waitFor(() => expect(screen.getByTestId("settings.people.hidden.value")).toHaveTextContent("2"));
    fireEvent.click(screen.getByTestId("settings.people.hidden"));
    await screen.findByTestId("settings.hiddenSheet");
    fireEvent.click(unhideOf("juno"));
    await waitFor(() =>
      expect(byNode("settings.hiddenSheet.list.account", "juno")).toHaveTextContent("That didn't go through."),
    );
    fireEvent.click(screen.getByTestId("settings-hidden-j-retry"));
    await waitFor(() => expect(log.unhides).toEqual(["j", "j"]));
  });

  it("a_deleted_accounts_row_reads_deleted_account_keyed_by_its_id", async () => {
    server.use(
      ...hiddenHandlers(hiddenLog(), {
        entries: [{ id: "gone-1", handle: "gone", displayName: "x", hiddenAt: ago(40), redacted: true }],
      }),
    );
    renderSettings();
    await waitFor(() => expect(screen.getByTestId("settings.people.hidden.value")).toHaveTextContent("1"));
    fireEvent.click(screen.getByTestId("settings.people.hidden"));
    await screen.findByTestId("settings.hiddenSheet");
    const row = byNode("settings.hiddenSheet.list.redactedAccount", "gone-1");
    expect(row).toHaveTextContent("Deleted account");
    expect(row).not.toHaveTextContent("@gone");
    fireEvent.click(byNode("settings.hiddenSheet.list.redactedAccount.trailing.unhide", "gone-1"));
    expect(await screen.findByTestId("settings-snackbar")).toHaveTextContent(
      "This account is unhidden — its posts can reach your feed again.",
    );
  });
});
