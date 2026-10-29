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

const server = startMswServer();

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

function fillConfirm(password = "long enough password") {
  fireEvent.change(screen.getByTestId("reset_password"), { target: { value: password } });
  fireEvent.click(screen.getByTestId("reset_confirm"));
}

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

  it("holds the link's own secret and never asks for it; no header, one field, one commitment", () => {
    renderWithProviders(<ResetForm />);
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
    renderWithProviders(<ResetForm />);
    fillConfirm();
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/login"));
    expect(JSON.stringify(seen)).toContain("token-1");
  });

  it("a_short_password_answers_on_the_field_and_re_checks_live", async () => {
    renderWithProviders(<ResetForm />);
    fillConfirm("short");
    expect(await screen.findByText("A password is at least 12 characters.")).toBeInTheDocument();
    expect(screen.queryByText("At least 12 characters.")).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId("reset_password"), { target: { value: "long enough password" } });
    expect(screen.queryByText("A password is at least 12 characters.")).not.toBeInTheDocument();
  });

  it("a_breached_password_reads_on_the_field", async () => {
    server.use(confirmRefused("WEAK_PASSWORD"));
    renderWithProviders(<ResetForm />);
    fillConfirm();
    expect(
      await screen.findByText("That password has turned up in a data breach — pick another one."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("reset_password")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders a rate-limited confirm as a backoff, not a connectivity failure", async () => {
    server.use(rateLimited("ConfirmPasswordReset"));
    renderWithProviders(<ResetForm />);
    fillConfirm();
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many tries. Wait a little, then try again.");
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("no_answer_keeps_the_field_and_says_it_above_the_commit", async () => {
    server.use(gqlLink.mutation("ConfirmPasswordReset", () => HttpResponse.error()));
    renderWithProviders(<ResetForm />);
    fillConfirm();
    expect(await screen.findByRole("alert")).toHaveTextContent("That didn't send. Try again.");
    expect(screen.getByTestId("reset_password")).toHaveValue("long enough password");
  });
});

// ResetExpired.jsx / ResetExpired.md
describe("the spent link (ResetExpired)", () => {
  beforeEach(() => {
    nav.search = "token=token-1";
  });

  it("a_link_spent_while_the_form_stood_opens_reset_expired_and_never_changes_the_password", async () => {
    server.use(confirmRefused("RESET_TOKEN_INVALID"));
    renderWithProviders(<ResetForm />);
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
