import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { ResetForm } from "./reset-form";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

// THE LINK IS READ FIRST (ResetNew.md: a used or expired link opens
// ResetExpired "AND NEVER ResetNew opens"): every test holding a link answers
// the read-only check, live unless it says otherwise.
const resetCheck = (live: boolean) =>
  gqlLink.query("PasswordResetLinkCheck", () =>
    HttpResponse.json({ data: { passwordResetLinkCheck: live } }),
  );

const server = startMswServer(resetCheck(true));

/** ResetForm on a held link, once its check has answered live. */
async function renderNew() {
  renderWithProviders(<ResetForm />);
  await screen.findByRole("heading", { level: 1, name: "Set a new password" });
}

const requestOk = gqlLink.mutation("RequestPasswordReset", () =>
  HttpResponse.json({
    data: { requestPasswordReset: { __typename: "RequestPasswordResetPayload", ok: true } },
  }),
);

const confirmRefused = (code: string) =>
  gqlLink.mutation("ConfirmPasswordReset", () =>
    HttpResponse.json({
      data: {
        confirmPasswordReset: {
          __typename: "ConfirmPasswordResetPayload",
          ok: null,
          userErrors: [
            { __typename: "UserError", code, message: "refused", field: ["resetToken"] },
          ],
        },
      },
    }),
  );

const newInput = (field: "password" | "confirm") => screen.getByTestId(`reset.${field}.input`);
const typeIn = (field: "password" | "confirm", value: string) =>
  fireEvent.change(newInput(field), { target: { value } });
const pressSet = () => fireEvent.click(screen.getByTestId("reset.commit.action"));

/** The new password typed into both fields (or the repeat as given), then the press. */
function fillConfirm(password = "long enough password", repeat = password) {
  typeIn("password", password);
  typeIn("confirm", repeat);
  pressSet();
}

const MISMATCH = "The two passwords don't match.";

function requestFor(email = "a@b.c") {
  fireEvent.change(screen.getByTestId("reset_email"), { target: { value: email } });
  fireEvent.click(screen.getByTestId("reset_request"));
}

const rateLimited = (operation: string) =>
  gqlLink.mutation(operation, () =>
    HttpResponse.json({ errors: [{ message: "too many attempts", extensions: { code: "RATE_LIMITED" } }] }),
  );

const SIGN_IN_ONLY =
  "This restores your sign-in only. Your key stays wherever it is — restoring the key is its own step, with your recovery code.";

beforeEach(() => {
  window.localStorage.clear();
  nav.replace.mockClear();
  nav.search = "";
});

// Reset.jsx / Reset.md
describe("the reset request (Reset)", () => {
  it("heads with Back to the sign-in and the drawn words", () => {
    renderWithProviders(<ResetForm />);
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Reset your password");
    expect(
      screen.getByText(
        "Enter the email you signed up with and we send a reset link. Resetting the password signs out every device.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(SIGN_IN_ONLY)).toBeInTheDocument();
    expect(screen.queryByText(/reset token/i)).not.toBeInTheDocument();
  });

  it("send_reset_link_stands_disabled_with_its_waiting_line_until_the_email_holds_a_character", () => {
    renderWithProviders(<ResetForm />);
    expect(screen.getByTestId("reset_request")).toBeDisabled();
    expect(screen.getByText("Waiting for your email")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("reset_email"), { target: { value: "a" } });
    expect(screen.getByTestId("reset_request")).toBeEnabled();
    expect(screen.queryByText("Waiting for your email")).not.toBeInTheDocument();
  });

  it("the_status_line_stands_only_after_a_press_and_never_says_whether_the_email_has_an_account", async () => {
    server.use(requestOk);
    renderWithProviders(<ResetForm />);
    expect(screen.queryByTestId("reset_requested")).not.toBeInTheDocument();
    requestFor();
    expect(await screen.findByTestId("reset_requested")).toHaveTextContent(
      "If that email has an account, a reset link is on its way. The link works once and expires after 15 minutes.",
    );
  });

  it("no_answer_keeps_the_field_and_says_it_above_send_reset_link", async () => {
    server.use(gqlLink.mutation("RequestPasswordReset", () => HttpResponse.error()));
    renderWithProviders(<ResetForm />);
    requestFor();
    expect(await screen.findByRole("alert")).toHaveTextContent("That didn't send. Try again.");
    expect(screen.getByTestId("reset_email")).toHaveValue("a@b.c");
    expect(screen.queryByTestId("reset_requested")).not.toBeInTheDocument();
  });

  it("renders a rate-limited request as a backoff — no sent-email claim, no connectivity copy", async () => {
    server.use(rateLimited("RequestPasswordReset"));
    renderWithProviders(<ResetForm />);
    requestFor();
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many tries. Wait a little, then try again.");
    expect(screen.queryByTestId("reset_requested")).not.toBeInTheDocument();
  });
});

// ResetNew.jsx / ResetNew.md
describe("the new password (ResetNew)", () => {
  beforeEach(() => {
    nav.search = "token=token-1";
  });

  it("holds the link's own secret and never asks for it; no header, the new password twice, one commitment", async () => {
    await renderNew();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Set a new password");
    expect(
      screen.getByText("Setting a new password signs out every device. You sign in again with the new one."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back" })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByText("At least 12 characters.")).toBeInTheDocument();
    expect(screen.getByText(SIGN_IN_ONLY)).toBeInTheDocument();
    expect(screen.getByText("Waiting for a new password")).toBeInTheDocument();
  });

  it("routes to login after a confirmed reset — every session was revoked", async () => {
    let seen: unknown = null;
    server.use(
      gqlLink.mutation("ConfirmPasswordReset", ({ variables }) => {
        seen = variables;
        return HttpResponse.json({
          data: { confirmPasswordReset: { __typename: "ConfirmPasswordResetPayload", ok: true, userErrors: [] } },
        });
      }),
    );
    await renderNew();
    fillConfirm();
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/login"));
    expect(JSON.stringify(seen)).toContain("token-1");
  });

  it("a_short_password_answers_on_the_field_and_re_checks_live", async () => {
    await renderNew();
    fillConfirm("short");
    expect(await screen.findByText("A password is at least 12 characters.")).toBeInTheDocument();
    expect(screen.queryByText("At least 12 characters.")).not.toBeInTheDocument();
    typeIn("password", "long enough password");
    expect(screen.queryByText("A password is at least 12 characters.")).not.toBeInTheDocument();
  });

  // ResetNew.md: "ALWAYS the screen holds two password fields, New password
  // and under it Repeat password, masked alike, each with its own reveal
  // control, and one commitment" · "ALWAYS Repeat password carries no hint".
  it("holds_new_password_and_under_it_repeat_password_masked_alike_the_repeat_with_no_hint", async () => {
    await renderNew();
    const fields = screen.getAllByLabelText(/password$/i, { selector: "input" });
    expect(fields.map((field) => field.getAttribute("data-testid"))).toEqual(["reset.password.input", "reset.confirm.input"]);
    expect(screen.getByTestId("reset.confirm.label")).toHaveTextContent("Repeat password");
    expect(newInput("password")).toHaveAttribute("type", "password");
    expect(newInput("confirm")).toHaveAttribute("type", "password");
    expect(newInput("password")).toHaveAttribute("enterkeyhint", "next");
    expect(newInput("confirm")).toHaveAttribute("enterkeyhint", "go");
    expect(newInput("confirm")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.queryByTestId("reset.confirm.support")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^(Show|Hide) password$/ })).toHaveLength(2);
    fireEvent.click(screen.getByTestId("reset.confirm.reveal"));
    expect(newInput("confirm")).toHaveAttribute("type", "text");
    expect(screen.getByTestId("reset.confirm.reveal")).toHaveAccessibleName("Hide password");
    expect(newInput("password")).toHaveAttribute("type", "password");
    expect(screen.getByTestId("reset.title")).toHaveTextContent("Set a new password");
    expect(screen.getByTestId("reset.note")).toHaveTextContent(SIGN_IN_ONLY);
  });

  // ResetNew.md: "ALWAYS Set the new password stands disabled with Waiting
  // for a new password right above it GIVEN New password or Repeat password
  // is empty" · "WHEN both password fields hold a character -> Set the new
  // password wakes AND the line Waiting for a new password goes".
  it("set_the_new_password_waits_until_both_fields_hold_a_character", async () => {
    await renderNew();
    const commit = screen.getByTestId("reset.commit.action");
    expect(commit).toBeDisabled();
    expect(screen.getByTestId("reset.commit.reason")).toHaveTextContent("Waiting for a new password");
    typeIn("password", "x");
    expect(commit).toBeDisabled();
    expect(screen.getByTestId("reset.commit.reason")).toBeInTheDocument();
    typeIn("confirm", "y");
    expect(commit).toBeEnabled();
    expect(screen.queryByTestId("reset.commit.reason")).not.toBeInTheDocument();
  });

  // ResetNew.md: "WHEN press Set the new password GIVEN Repeat password
  // differs from New password -> Repeat password's line reads The two
  // passwords don't match. AND the field takes the error state AND NEVER the
  // password changes".
  it("a_repeat_that_differs_reads_on_the_repeat_field_and_the_password_never_changes", async () => {
    const asked = vi.fn();
    server.use(
      gqlLink.mutation("ConfirmPasswordReset", () => {
        asked();
        return HttpResponse.json({
          data: { confirmPasswordReset: { __typename: "ConfirmPasswordResetPayload", ok: true, userErrors: [] } },
        });
      }),
    );
    await renderNew();
    fillConfirm("long enough password", "long enough passwrod");
    expect(await screen.findByTestId("reset.confirm.support")).toHaveTextContent(MISMATCH);
    expect(newInput("confirm")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("reset.confirm.label")).toHaveClass("text-error");
    expect(screen.getByTestId("reset.password.support")).toHaveTextContent("At least 12 characters.");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(asked).not.toHaveBeenCalled();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  // ResetNew.md: "WHEN typing in New password or Repeat password GIVEN
  // Repeat password carries The two passwords don't match. -> the line
  // re-checks as the text changes AND it goes once the two passwords match".
  it("the_mismatch_line_rechecks_as_either_field_changes_and_goes_once_they_match", async () => {
    await renderNew();
    fillConfirm("long enough password", "long enough");
    expect(await screen.findByTestId("reset.confirm.support")).toHaveTextContent(MISMATCH);
    typeIn("confirm", "long enough pass");
    expect(screen.getByTestId("reset.confirm.support")).toHaveTextContent(MISMATCH);
    typeIn("password", "long enough pass");
    expect(screen.queryByTestId("reset.confirm.support")).not.toBeInTheDocument();
    typeIn("confirm", "long enough pas");
    expect(screen.queryByTestId("reset.confirm.support")).not.toBeInTheDocument();
  });

  it("a_short_and_a_differing_password_each_answer_on_their_own_field", async () => {
    await renderNew();
    fillConfirm("short", "shirt");
    expect(await screen.findByTestId("reset.confirm.support")).toHaveTextContent(MISMATCH);
    expect(screen.getByTestId("reset.password.support")).toHaveTextContent("A password is at least 12 characters.");
  });

  it("typing_never_marks_a_field_before_the_press", async () => {
    await renderNew();
    typeIn("password", "short");
    typeIn("confirm", "shirt");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a_breached_password_reads_on_the_field", async () => {
    server.use(confirmRefused("WEAK_PASSWORD"));
    await renderNew();
    fillConfirm();
    expect(
      await screen.findByText("That password has turned up in a data breach — pick another one."),
    ).toBeInTheDocument();
    expect(newInput("password")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders a rate-limited confirm as a backoff, not a connectivity failure", async () => {
    server.use(rateLimited("ConfirmPasswordReset"));
    await renderNew();
    fillConfirm();
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many tries. Wait a little, then try again.");
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("no_answer_keeps_the_field_and_says_it_above_the_commit", async () => {
    server.use(gqlLink.mutation("ConfirmPasswordReset", () => HttpResponse.error()));
    await renderNew();
    fillConfirm();
    expect(await screen.findByRole("alert")).toHaveTextContent("That didn't send. Try again.");
    expect(newInput("password")).toHaveValue("long enough password");
    expect(newInput("confirm")).toHaveValue("long enough password");
  });
});

// ResetExpired.jsx / ResetExpired.md
describe("the spent link (ResetExpired)", () => {
  beforeEach(() => {
    nav.search = "token=token-1";
  });

  it("a_link_spent_while_the_form_stood_opens_reset_expired_and_never_changes_the_password", async () => {
    server.use(confirmRefused("RESET_TOKEN_INVALID"));
    await renderNew();
    fillConfirm();
    expect(await screen.findByRole("heading", { level: 1, name: "This link doesn't work anymore" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "It may have expired or already been used. A reset link works once and expires after 15 minutes — ask for a fresh one.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back" })).not.toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalledWith("/login");
    fireEvent.click(screen.getByRole("button", { name: "Reset your password" }));
    expect(nav.replace).toHaveBeenCalledWith("/reset");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(nav.replace).toHaveBeenCalledWith("/login");
  });
});

// ResetNew.md:37 · ResetExpired.md:3 — the link is checked before the form.
describe("the link's check (ResetNew · ResetExpired)", () => {
  beforeEach(() => {
    nav.search = "token=token-1";
  });

  it("a_reset_link_already_used_or_past_its_time_opens_reset_expired_and_never_reset_new", async () => {
    let asked: unknown = null;
    server.use(
      gqlLink.query("PasswordResetLinkCheck", ({ variables }) => {
        asked = variables;
        return HttpResponse.json({ data: { passwordResetLinkCheck: false } });
      }),
    );
    renderWithProviders(<ResetForm />);
    expect(screen.queryByRole("heading", { level: 1, name: "Set a new password" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: "This link doesn't work anymore" })).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(asked).toEqual({ token: "token-1" });
  });

  it("a_live_link_opens_reset_new_once_the_check_answers", async () => {
    renderWithProviders(<ResetForm />);
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
  });

  it("a_check_that_gets_no_answer_opens_the_form_whose_press_still_meets_a_spent_link", async () => {
    server.use(
      gqlLink.query("PasswordResetLinkCheck", () => HttpResponse.error()),
      confirmRefused("RESET_TOKEN_INVALID"),
    );
    await renderNew();
    fillConfirm();
    expect(await screen.findByRole("heading", { level: 1, name: "This link doesn't work anymore" })).toBeInTheDocument();
  });
});
