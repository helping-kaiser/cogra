import { fireEvent, screen, waitFor } from "@testing-library/react";
import { delay, graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { ChangePasswordView } from "./change-password-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const server = startMswServer();

function account() {
  return graphql.query("SettingsAccount", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle: "sol",
          email: "sol@solferreira.art",
          emailVerified: true,
          accountState: "MEMBER",
          actorPubkey: "pk",
          passwordChangedAt: null,
          keyBackupCreatedAt: null,
          pendingEmailChange: null,
          preferences: null,
          sessions: [],
        },
      },
    }),
  );
}

function answer(body: Record<string, unknown> | "offline" | "rateLimited", wait = 0) {
  return graphql.mutation("ChangePassword", async () => {
    if (wait > 0) await delay(wait);
    if (body === "offline") return HttpResponse.error();
    if (body === "rateLimited") {
      return HttpResponse.json({ data: null, errors: [{ message: "x", extensions: { code: "RATE_LIMITED" } }] });
    }
    return HttpResponse.json({ data: { changePassword: { __typename: "ChangePasswordPayload", ...body } } });
  });
}

function refusal(code: string, field: string) {
  return answer({ ok: null, userErrors: [{ __typename: "UserError", message: "x", code, field: [field] }] });
}

function renderPage() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
  return renderWithProviders(<ChangePasswordView />, { store });
}

const input = (path: string) => screen.getByTestId(`changePassword.${path}.input`);
const type = (path: string, value: string) => fireEvent.change(input(path), { target: { value } });
const press = () => fireEvent.click(screen.getByTestId("changePassword.commit.action"));

const GOOD = "a fresh strong password";

beforeEach(() => {
  push.mockReset();
  server.use(account());
});

describe("ChangePassword", () => {
  it("draws the page as the board does", async () => {
    renderPage();
    expect(screen.getByTestId("changePassword.title")).toHaveTextContent("Change your password");
    expect(screen.getByTestId("changePassword.body")).toHaveTextContent(
      "Changing your password signs out every other device. This one stays signed in.",
    );
    expect(screen.getByTestId("changePassword.header.back")).toHaveAttribute("href", "/settings");
    expect(screen.getByTestId("changePassword.password.support")).toHaveTextContent("At least 12 characters.");
    expect(screen.getByTestId("changePassword.note")).toHaveTextContent(
      "Your current password is asked for even though you are signed in",
    );
    expect(input("current")).toHaveAttribute("autocomplete", "current-password");
    expect(input("current")).toHaveAttribute("enterkeyhint", "next");
    expect(input("password")).toHaveAttribute("autocomplete", "new-password");
    expect(input("password")).toHaveAttribute("enterkeyhint", "go");
  });

  it("current_password_names_the_account_by_hidden_username", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("hidden-username")).toHaveValue("sol@solferreira.art"));
    expect(screen.getByTestId("hidden-username")).toHaveAttribute("autocomplete", "username");
  });

  it("change_password_waits_for_both_fields", () => {
    renderPage();
    expect(screen.getByTestId("changePassword.commit.action")).toBeDisabled();
    expect(screen.getByTestId("changePassword.commit.reason")).toHaveTextContent("Waiting for both passwords");
    type("current", "x");
    expect(screen.getByTestId("changePassword.commit.action")).toBeDisabled();
    type("password", "y");
    expect(screen.getByTestId("changePassword.commit.action")).toBeEnabled();
    expect(screen.queryByTestId("changePassword.commit.reason")).not.toBeInTheDocument();
  });

  it("form_opens_unmarked_and_typing_never_marks", () => {
    renderPage();
    type("current", "x");
    type("password", "short");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("short_or_long_new_password_rechecks_live", async () => {
    renderPage();
    type("current", "the current one");
    type("password", "short");
    press();
    expect(await screen.findByTestId("changePassword.password.support")).toHaveTextContent(
      "A password is at least 12 characters.",
    );
    type("password", "x".repeat(129));
    expect(screen.getByTestId("changePassword.password.support")).toHaveTextContent(
      "A password is at most 128 characters.",
    );
    type("password", GOOD);
    expect(screen.getByTestId("changePassword.password.support")).toHaveTextContent("At least 12 characters.");
  });

  it("wrong_current_password_reads_on_its_field_until_the_next_press", async () => {
    server.use(refusal("INVALID_CREDENTIALS", "currentPassword"));
    renderPage();
    type("current", "not it");
    type("password", GOOD);
    press();
    expect(await screen.findByTestId("changePassword.current.support")).toHaveTextContent(
      "That password isn't right.",
    );
    type("current", "still typing");
    expect(screen.getByTestId("changePassword.current.support")).toHaveTextContent("That password isn't right.");
    expect(push).not.toHaveBeenCalled();
  });

  it("breached_password_line_stands_until_the_next_press", async () => {
    server.use(refusal("WEAK_PASSWORD", "newPassword"));
    renderPage();
    type("current", "the current one");
    type("password", "correct horse battery staple");
    press();
    expect(await screen.findByTestId("changePassword.password.support")).toHaveTextContent(
      "That password has turned up in a data breach — pick another one.",
    );
    type("password", "another long password");
    expect(screen.getByTestId("changePassword.password.support")).toHaveTextContent("data breach");
  });

  it("changing_password_label_after_200ms", async () => {
    server.use(answer({ ok: true, userErrors: [] }, 400));
    renderPage();
    type("current", "the current one");
    type("password", GOOD);
    press();
    expect(screen.getByTestId("changePassword.commit.action")).toHaveTextContent("Change password");
    await waitFor(() =>
      expect(screen.getByTestId("changePassword.commit.action")).toHaveTextContent("Changing password…"),
    );
    // The delayed answer lands inside this test, never the next one's.
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings?done=password"));
  });

  it("offline_press_answers_in_slot_and_keeps_both_fields", async () => {
    server.use(answer("offline"));
    renderPage();
    type("current", "the current one");
    type("password", GOOD);
    press();
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent("That didn't send. Try again.");
    expect(input("current")).toHaveValue("the current one");
    expect(input("password")).toHaveValue(GOOD);
    expect(screen.getByTestId("changePassword.commit.action")).toHaveTextContent("Change password");
  });

  it("a tripped re-authentication budget says B7's line above the commit", async () => {
    server.use(answer("rateLimited"));
    renderPage();
    type("current", "the current one");
    type("password", GOOD);
    press();
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent(
      "Too many tries. Wait a little, then try again.",
    );
  });

  it("success_returns_to_settings_with_the_snackbar", async () => {
    server.use(answer({ ok: true, userErrors: [] }));
    renderPage();
    type("current", "the current one");
    type("password", GOOD);
    press();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings?done=password"));
  });

  it("back_changes_nothing", () => {
    renderPage();
    expect(screen.getByTestId("changePassword.header.back")).toHaveAccessibleName("Back to settings");
  });
});
