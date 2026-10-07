import { fireEvent, screen, waitFor } from "@testing-library/react";
import { delay, graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { ApplicantEmailView } from "./applicant/applicant-email-view";
import { ChangeEmailView } from "./change-email-view";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const server = startMswServer();

function account(overrides: Record<string, unknown> = {}) {
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
          ...overrides,
        },
      },
    }),
  );
}

const OPENED = {
  pendingEmailChange: {
    __typename: "PendingEmailChange",
    newEmail: "sol@ferreira.studio",
    requiresCode: true,
    codeConfirmed: false,
    linkConfirmed: false,
    expiresAt: "2026-10-08T12:00:00Z",
  },
  userErrors: [],
};

function answer(body: Record<string, unknown> | "offline" | "rateLimited", wait = 0) {
  return graphql.mutation("RequestEmailChange", async () => {
    if (wait > 0) await delay(wait);
    if (body === "offline") return HttpResponse.error();
    if (body === "rateLimited") {
      return HttpResponse.json({ data: null, errors: [{ message: "x", extensions: { code: "RATE_LIMITED" } }] });
    }
    return HttpResponse.json({
      data: { requestEmailChange: { __typename: "RequestEmailChangePayload", ...body } },
    });
  });
}

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
  return store;
}

const byKey = (path: string, key: string) =>
  screen.getAllByTestId(path).find((element) => element.getAttribute("data-testid-key") === key);
const emailInput = () => screen.getByTestId("changeEmail.email.input");
const passwordInput = () => screen.getByTestId("changeEmail.current.input");
const fill = (email: string, password: string) => {
  fireEvent.change(emailInput(), { target: { value: email } });
  fireEvent.change(passwordInput(), { target: { value: password } });
};
const press = () => fireEvent.click(screen.getByTestId("changeEmail.commit.action"));

beforeEach(() => {
  push.mockReset();
  server.use(account());
});

describe("ChangeEmail", () => {
  it("names the current address and what goes where", async () => {
    renderWithProviders(<ChangeEmailView />, { store: signedIn() });
    expect(await screen.findByTestId("changeEmail.note")).toHaveTextContent(
      "A code goes to sol@solferreira.art and a link to the new address. Your email is unchanged until both have been answered.",
    );
    expect(screen.getByTestId("changeEmail.title")).toHaveTextContent("Change your email");
    expect(emailInput()).toHaveAttribute("type", "email");
    expect(emailInput()).toHaveAttribute("autocomplete", "email");
  });

  it("request_carries_no_code_field", () => {
    renderWithProviders(<ChangeEmailView />, { store: signedIn() });
    expect(screen.queryByLabelText("Confirmation code")).not.toBeInTheDocument();
  });

  it("change_email_waits_for_both_fields", () => {
    renderWithProviders(<ChangeEmailView />, { store: signedIn() });
    expect(screen.getByTestId("changeEmail.commit.action")).toBeDisabled();
    expect(screen.getByTestId("changeEmail.commit.reason")).toHaveTextContent(
      "Waiting for a new email and your password",
    );
    // The nodes wear the fault chip's key — `none` at rest.
    expect(screen.getByTestId("changeEmail.commit.action")).toHaveAttribute("data-testid-key", "none");
    fill("sol@ferreira.studio", "pw");
    expect(screen.getByTestId("changeEmail.commit.action")).toBeEnabled();
  });

  it("malformed_address_reads_on_the_press_then_rechecks_live", () => {
    renderWithProviders(<ChangeEmailView />, { store: signedIn() });
    fill("sol.ferreira", "pw");
    expect(screen.queryByTestId("changeEmail.email.support")).not.toBeInTheDocument();
    press();
    expect(byKey("changeEmail.email.support", "malformed")).toHaveTextContent(
      "That doesn't look like an email address.",
    );
    fireEvent.change(emailInput(), { target: { value: "sol@ferreira.studio" } });
    expect(screen.queryByTestId("changeEmail.email.support")).not.toBeInTheDocument();
  });

  it("wrong_password_reads_on_the_field_and_sends_nothing", async () => {
    server.use(
      answer({
        pendingEmailChange: null,
        userErrors: [{ __typename: "UserError", message: "x", code: "INVALID_CREDENTIALS", field: ["currentPassword"] }],
      }),
    );
    renderWithProviders(<ChangeEmailView />, { store: signedIn() });
    fill("sol@ferreira.studio", "nope");
    press();
    await waitFor(() =>
      expect(byKey("changeEmail.current.support", "password")).toHaveTextContent("That password isn't right."),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("taken_address_is_never_said and success_opens_the_confirmation", async () => {
    // An address another account holds reads exactly like success.
    server.use(answer(OPENED));
    renderWithProviders(<ChangeEmailView />, { store: signedIn() });
    fill("taken@example.com", "pw");
    press();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings/email/confirm"));
  });

  it("mail_budget_line_stands_above_change_email", async () => {
    server.use(answer("rateLimited"));
    renderWithProviders(<ChangeEmailView />, { store: signedIn() });
    fill("sol@ferreira.studio", "pw");
    press();
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent(
      "Too many tries. Wait a little, then try again.",
    );
  });

  it("offline_press_answers_in_slot", async () => {
    server.use(answer("offline"));
    renderWithProviders(<ChangeEmailView />, { store: signedIn() });
    fill("sol@ferreira.studio", "pw");
    press();
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent("That didn't send. Try again.");
    expect(emailInput()).toHaveValue("sol@ferreira.studio");
  });

  it("changing_email_label_after_200ms", async () => {
    server.use(answer(OPENED, 400));
    renderWithProviders(<ChangeEmailView />, { store: signedIn() });
    fill("sol@ferreira.studio", "pw");
    press();
    expect(screen.getByTestId("changeEmail.commit.action")).toHaveTextContent("Change email");
    await waitFor(() =>
      expect(screen.getByTestId("changeEmail.commit.action")).toHaveTextContent("Changing email…"),
    );
    // The delayed answer lands inside this test, never the next one's.
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings/email/confirm"));
  });

  it("back_sends_nothing", () => {
    renderWithProviders(<ChangeEmailView />, { store: signedIn() });
    expect(screen.getByTestId("changeEmail.header.back")).toHaveAttribute("href", "/settings");
  });
});

describe("ApplicantEmail", () => {
  it("names the address the standing link went to", async () => {
    server.use(account({ emailVerified: false, accountState: "APPLICANT", email: "noor@fieldmail.org" }));
    renderWithProviders(<ApplicantEmailView />, { store: signedIn() });
    await waitFor(() =>
      expect(screen.getByTestId("changeEmail.body")).toHaveTextContent(
        "Your email isn't verified yet, so the new address is all a change needs. A fresh link goes there, and the one sent to noor@fieldmail.org stops working.",
      ),
    );
    // seven_days_never_spoken
    expect(screen.getByTestId("changeEmail.body")).not.toHaveTextContent(/day/);
    expect(screen.queryByTestId("changeEmail.note")).not.toBeInTheDocument();
  });

  it("back_returns_to_settings — the origin it was opened from (G1)", () => {
    renderWithProviders(<ApplicantEmailView />, { store: signedIn() });
    const back = screen.getByTestId("changeEmail.header.back");
    expect(back).toHaveAttribute("href", "/settings");
    expect(back).toHaveAccessibleName("Back");
  });

  it("success_returns_to_settings_with_the_snackbar (G1) and no_code_goes_to_the_old_address", async () => {
    server.use(
      answer({
        ...OPENED,
        pendingEmailChange: { ...OPENED.pendingEmailChange, requiresCode: false },
      }),
    );
    renderWithProviders(<ApplicantEmailView />, { store: signedIn() });
    fill("noor@fieldnotes.org", "pw");
    press();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings?done=applicantSent"));
  });

  it("budget_line", async () => {
    server.use(answer("rateLimited"));
    renderWithProviders(<ApplicantEmailView />, { store: signedIn() });
    fill("noor@fieldnotes.org", "pw");
    press();
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent(
      "Too many tries. Wait a little, then try again.",
    );
  });

  it("offline_in_slot_keeps_the_address_on_file", async () => {
    server.use(answer("offline"));
    renderWithProviders(<ApplicantEmailView />, { store: signedIn() });
    fill("noor@fieldnotes.org", "pw");
    press();
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent("That didn't send. Try again.");
    expect(push).not.toHaveBeenCalled();
  });
});
