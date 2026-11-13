import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { delay } from "msw/utils/delay";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { ChangePasswordView } from "./change-password-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const server = startMswServer();

function account() {
  return gqlLink.query("SettingsAccount", () =>
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
  return gqlLink.mutation("ChangePassword", async () => {
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
/** The new password, typed into both of its fields. */
const typeNew = (value: string) => {
  type("password", value);
  type("confirm", value);
};

const GOOD = "a fresh strong password";
const MISMATCH = "The two passwords don't match.";

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
    expect(input("password")).toHaveAttribute("enterkeyhint", "next");
  });

  // ChangePassword.md: "ALWAYS the screen asks for the current password, then
  // the new password twice: New password and under it Repeat password, masked
  // alike, Repeat password with no hint".
  it("asks_for_the_current_password_then_the_new_one_twice_the_repeat_with_no_hint", () => {
    renderPage();
    const fields = screen.getAllByLabelText(/password$/i, { selector: "input" });
    expect(fields.map((field) => field.getAttribute("data-testid"))).toEqual([
      "changePassword.current.input",
      "changePassword.password.input",
      "changePassword.confirm.input",
    ]);
    expect(screen.getByTestId("changePassword.confirm.label")).toHaveTextContent("Repeat password");
    expect(input("confirm")).toHaveAttribute("type", "password");
    expect(input("confirm")).toHaveAttribute("autocomplete", "new-password");
    expect(input("confirm")).toHaveAttribute("enterkeyhint", "go");
    expect(input("confirm")).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByTestId("changePassword.confirm.support")).not.toBeInTheDocument();
  });

  it("the_repeat_field_has_its_own_reveal_control", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("changePassword.confirm.reveal"));
    expect(input("confirm")).toHaveAttribute("type", "text");
    expect(screen.getByTestId("changePassword.confirm.reveal")).toHaveAccessibleName("Hide password");
    expect(input("password")).toHaveAttribute("type", "password");
  });

  // ChangePassword.md: "WHEN press Change password GIVEN Repeat password
  // differs from New password -> the Repeat password field reads The two
  // passwords don't match. AND NEVER the password changes".
  it("a_repeat_that_differs_reads_on_the_repeat_field_and_the_password_never_changes", async () => {
    const asked = vi.fn();
    server.use(
      gqlLink.mutation("ChangePassword", () => {
        asked();
        return HttpResponse.json({ data: { changePassword: { __typename: "ChangePasswordPayload", ok: true, userErrors: [] } } });
      }),
    );
    renderPage();
    type("current", "the current one");
    type("password", GOOD);
    type("confirm", `${GOOD}!`);
    press();
    expect(await screen.findByTestId("changePassword.confirm.support")).toHaveTextContent(MISMATCH);
    expect(input("confirm")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("changePassword.confirm.label")).toHaveClass("text-error");
    expect(screen.getByTestId("changePassword.password.support")).toHaveTextContent("At least 12 characters.");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(asked).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("each_field_is_checked_on_its_own_at_the_press", async () => {
    renderPage();
    type("current", "the current one");
    type("password", "short");
    type("confirm", "shirt");
    press();
    expect(await screen.findByTestId("changePassword.confirm.support")).toHaveTextContent(MISMATCH);
    expect(screen.getByTestId("changePassword.password.support")).toHaveTextContent(
      "A password is at least 12 characters.",
    );
  });

  // ChangePassword.md: "WHEN typing in New password or Repeat password GIVEN
  // Repeat password reads The two passwords don't match. -> the line
  // re-checks as the reader types and goes once the two passwords match".
  it("the_mismatch_line_rechecks_as_either_field_changes_and_goes_once_they_match", async () => {
    renderPage();
    type("current", "the current one");
    type("password", GOOD);
    type("confirm", "a fresh strong");
    press();
    expect(await screen.findByTestId("changePassword.confirm.support")).toHaveTextContent(MISMATCH);
    type("confirm", "a fresh strong pass");
    expect(screen.getByTestId("changePassword.confirm.support")).toHaveTextContent(MISMATCH);
    type("confirm", GOOD);
    expect(screen.queryByTestId("changePassword.confirm.support")).not.toBeInTheDocument();
    expect(input("confirm")).not.toHaveAttribute("aria-invalid");
    type("password", `${GOOD}s`);
    expect(screen.queryByTestId("changePassword.confirm.support")).not.toBeInTheDocument();
    press();
    expect(await screen.findByTestId("changePassword.confirm.support")).toHaveTextContent(MISMATCH);
    type("password", GOOD);
    expect(screen.queryByTestId("changePassword.confirm.support")).not.toBeInTheDocument();
  });

  it("current_password_names_the_account_by_hidden_username", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("hidden-username")).toHaveValue("sol@solferreira.art"));
    expect(screen.getByTestId("hidden-username")).toHaveAttribute("autocomplete", "username");
  });

  // ChangePassword.md: "ALWAYS Change password stands disabled, with no line
  // above it, GIVEN any password field is empty" and "WHEN all three password
  // fields hold a character -> Change password wakes".
  it("change_password_stands_disabled_with_no_line_until_all_three_fields_hold_a_character", () => {
    renderPage();
    const commit = screen.getByTestId("changePassword.commit.action");
    expect(commit).toBeDisabled();
    expect(screen.queryByTestId("changePassword.commit.reason")).not.toBeInTheDocument();
    expect(commit).not.toHaveAttribute("aria-describedby");
    expect(screen.getByTestId("changePassword.commit")).toHaveTextContent(/^Change password$/);
    type("current", "x");
    type("password", "y");
    expect(commit).toBeDisabled();
    type("confirm", "z");
    expect(commit).toBeEnabled();
    type("current", "");
    expect(commit).toBeDisabled();
    expect(screen.queryByTestId("changePassword.commit.reason")).not.toBeInTheDocument();
  });

  it("form_opens_unmarked_and_typing_never_marks", () => {
    renderPage();
    type("current", "x");
    type("password", "short");
    type("confirm", "shirt");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("short_or_long_new_password_rechecks_live", async () => {
    renderPage();
    type("current", "the current one");
    typeNew("short");
    press();
    expect(await screen.findByTestId("changePassword.password.support")).toHaveTextContent(
      "A password is at least 12 characters.",
    );
    type("password", "x".repeat(129));
    expect(screen.getByTestId("changePassword.password.support")).toHaveTextContent(
      "A password is at most 128 characters.",
    );
    typeNew(GOOD);
    expect(screen.getByTestId("changePassword.password.support")).toHaveTextContent("At least 12 characters.");
  });

  it("wrong_current_password_reads_on_its_field_until_the_next_press", async () => {
    server.use(refusal("INVALID_CREDENTIALS", "currentPassword"));
    renderPage();
    type("current", "not it");
    typeNew(GOOD);
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
    typeNew("correct horse battery staple");
    press();
    await waitFor(() =>
      expect(screen.getByTestId("changePassword.password.support")).toHaveTextContent(
        "That password has turned up in a data breach — pick another one.",
      ),
    );
    type("password", "another long password");
    expect(screen.getByTestId("changePassword.password.support")).toHaveTextContent("data breach");
  });

  it("changing_password_label_after_200ms", async () => {
    server.use(answer({ ok: true, userErrors: [] }, 400));
    renderPage();
    type("current", "the current one");
    typeNew(GOOD);
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
    typeNew(GOOD);
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
    typeNew(GOOD);
    press();
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent(
      "Too many tries. Wait a little, then try again.",
    );
  });

  it("success_returns_to_settings_with_the_snackbar", async () => {
    server.use(answer({ ok: true, userErrors: [] }));
    renderPage();
    type("current", "the current one");
    typeNew(GOOD);
    press();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings?done=password"));
  });

  it("back_changes_nothing", () => {
    renderPage();
    expect(screen.getByTestId("changePassword.header.back")).toHaveAccessibleName("Back to settings");
  });
});
