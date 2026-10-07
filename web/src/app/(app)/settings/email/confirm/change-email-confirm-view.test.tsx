import { fireEvent, screen, waitFor } from "@testing-library/react";
import { delay, graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { ChangeEmailConfirmView, resendMessage } from "./change-email-confirm-view";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

const server = startMswServer();

const OLD = "sol@solferreira.art";
const NEW = "sol@ferreira.studio";

function pending(overrides: Record<string, unknown> = {}) {
  return {
    __typename: "PendingEmailChange",
    newEmail: NEW,
    requiresCode: true,
    codeConfirmed: false,
    linkConfirmed: false,
    expiresAt: "2026-10-08T12:00:00Z",
    ...overrides,
  };
}

function account(change: Record<string, unknown> | null = pending()) {
  return graphql.query("SettingsAccount", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle: "sol",
          email: OLD,
          emailVerified: true,
          accountState: "MEMBER",
          actorPubkey: "pk",
          passwordChangedAt: null,
          keyBackupCreatedAt: null,
          pendingEmailChange: change,
          preferences: null,
          sessions: [],
        },
      },
    }),
  );
}

function confirmAnswer(body: Record<string, unknown> | "offline", wait = 0) {
  return graphql.mutation("ConfirmEmailChange", async () => {
    if (wait > 0) await delay(wait);
    if (body === "offline") return HttpResponse.error();
    return HttpResponse.json({
      data: { confirmEmailChange: { __typename: "ConfirmEmailChangePayload", ...body } },
    });
  });
}

function refused(code: string, field: string[] | null = null) {
  return confirmAnswer({ user: null, userErrors: [{ __typename: "UserError", message: "x", code, field }] });
}

function rendered() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
  return renderWithProviders(<ChangeEmailConfirmView />, { store });
}

const code = () => screen.getByTestId("changeEmail.code.input");
const typeCode = (value: string) => fireEvent.change(code(), { target: { value } });
const press = () => fireEvent.click(screen.getByTestId("changeEmail.commit.action"));

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  server.use(account());
});

describe("ChangeEmailConfirm", () => {
  it("commit_reads_confirm_the_code", async () => {
    rendered();
    expect(await screen.findByTestId("changeEmail.commit.action")).toHaveTextContent("Confirm the code");
    expect(screen.getByTestId("changeEmail.commit.reason")).toHaveTextContent("Waiting for the code");
    expect(screen.getByTestId("changeEmail.title")).toHaveTextContent("Confirm the change");
    // The false "either message's code" line is gone.
    expect(document.body).not.toHaveTextContent("either message");
  });

  it("pair_names_both_addresses_still_waiting", async () => {
    rendered();
    expect(await screen.findByTestId("changeEmail.pair.label")).toHaveTextContent("Both have to land");
    expect(screen.getByTestId("changeEmail.pair.codeSide")).toHaveTextContent(`${OLD} — still waiting`);
    expect(screen.getByTestId("changeEmail.pair.linkSide")).toHaveTextContent(`${NEW} — still waiting`);
    expect(screen.getByTestId("changeEmail.code.support")).toHaveTextContent(`From the message to ${OLD}.`);
    expect(screen.getByTestId("changeEmail.cancel")).toHaveTextContent("Cancel the change");
  });

  it("code_field_is_numeric_one_time_code", async () => {
    rendered();
    await screen.findByTestId("changeEmail.code.input");
    expect(code()).toHaveAttribute("inputmode", "numeric");
    expect(code()).toHaveAttribute("autocomplete", "one-time-code");
    expect(code()).toHaveAttribute("enterkeyhint", "go");
    expect(code()).toHaveClass("font-mono");
  });

  it("reopen_lands_on_the_owed_side: the code landed, so the field and commit go (G3)", async () => {
    server.use(account(pending({ codeConfirmed: true })));
    rendered();
    expect(await screen.findByTestId("changeEmail.pair.codeSide")).toHaveTextContent(`${OLD} — confirmed`);
    expect(screen.queryByTestId("changeEmail.code.input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("changeEmail.commit.action")).not.toBeInTheDocument();
    expect(screen.getByTestId("changeEmail.pair.resend")).toBeInTheDocument();
  });

  it("right_code_with_link_done_moves_the_address_with_snackbar", async () => {
    server.use(
      account(pending({ linkConfirmed: true })),
      confirmAnswer({ user: { __typename: "User", id: "u1", email: NEW, pendingEmailChange: null }, userErrors: [] }),
    );
    rendered();
    await screen.findByTestId("changeEmail.code.input");
    typeCode("123456");
    press();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings?done=email"));
  });

  it("a right code with the link still owed keeps the page open on the link", async () => {
    server.use(
      confirmAnswer({
        user: { __typename: "User", id: "u1", email: OLD, pendingEmailChange: pending({ codeConfirmed: true }) },
        userErrors: [],
      }),
    );
    rendered();
    await screen.findByTestId("changeEmail.code.input");
    typeCode("123456");
    press();
    await waitFor(() =>
      expect(screen.getByTestId("changeEmail.pair.codeSide")).toHaveTextContent(`${OLD} — confirmed`),
    );
    expect(screen.queryByTestId("changeEmail.code.input")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("wrong_code_reads_that_code_doesnt_check_out", async () => {
    server.use(refused("VERIFICATION_TOKEN_INVALID", ["code"]));
    rendered();
    await screen.findByTestId("changeEmail.code.input");
    typeCode("000000");
    press();
    expect(await screen.findByTestId("changeEmail.code.support")).toHaveTextContent("That code doesn't check out.");
  });

  it("disabled_code_line_stands_until_a_fresh_code_is_sent", async () => {
    server.use(
      refused("EMAIL_CHANGE_CODE_DISABLED", ["code"]),
      graphql.mutation("ResendEmailChange", () =>
        HttpResponse.json({
          data: {
            resendEmailChange: {
              __typename: "ResendEmailChangePayload",
              pendingEmailChange: pending(),
              userErrors: [],
            },
          },
        }),
      ),
    );
    rendered();
    await screen.findByTestId("changeEmail.code.input");
    typeCode("000000");
    press();
    const line =
      "Too many tries — for safety we have disabled your current code. Resend sends a fresh one.";
    expect(await screen.findByTestId("changeEmail.code.support")).toHaveTextContent(line);
    typeCode("111111");
    expect(screen.getByTestId("changeEmail.code.support")).toHaveTextContent(line);
    fireEvent.click(screen.getByTestId("changeEmail.pair.resend"));
    await waitFor(() =>
      expect(screen.getByTestId("changeEmail.code.support")).toHaveTextContent(`From the message to ${OLD}.`),
    );
  });

  it("ran_out_fault_line_above_the_commit", async () => {
    server.use(refused("EMAIL_CHANGE_EXPIRED"));
    rendered();
    await screen.findByTestId("changeEmail.code.input");
    typeCode("123456");
    press();
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent(
      "This change ran out before both sides landed. Your email stays as it is — start again from settings.",
    );
  });

  it("taken_fault_line_and_retry_applies_when_freed", async () => {
    let tries = 0;
    server.use(
      graphql.mutation("ConfirmEmailChange", () => {
        tries += 1;
        return HttpResponse.json({
          data: {
            confirmEmailChange:
              tries === 1
                ? {
                    __typename: "ConfirmEmailChangePayload",
                    user: { __typename: "User", id: "u1", email: OLD, pendingEmailChange: pending({ linkConfirmed: true }) },
                    userErrors: [{ __typename: "UserError", message: "x", code: "EMAIL_IN_USE", field: null }],
                  }
                : {
                    __typename: "ConfirmEmailChangePayload",
                    user: { __typename: "User", id: "u1", email: NEW, pendingEmailChange: null },
                    userErrors: [],
                  },
          },
        });
      }),
    );
    rendered();
    await screen.findByTestId("changeEmail.code.input");
    typeCode("123456");
    press();
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent(
      "That address now belongs to another account.",
    );
    press();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings?done=email"));
  });

  it("confirming_the_code_label_after_200ms", async () => {
    server.use(
      confirmAnswer(
        { user: { __typename: "User", id: "u1", email: NEW, pendingEmailChange: null }, userErrors: [] },
        400,
      ),
    );
    rendered();
    await screen.findByTestId("changeEmail.code.input");
    typeCode("123456");
    press();
    await waitFor(() =>
      expect(screen.getByTestId("changeEmail.commit.action")).toHaveTextContent("Confirming the code…"),
    );
    // The delayed confirm must land inside THIS test: left in flight, its
    // `push` fires during whichever test runs next (CI caught it in
    // cancel_offline_keeps_the_change).
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings?done=email"));
  });

  it("confirm_ip_rate_limited_line", async () => {
    server.use(
      graphql.mutation("ConfirmEmailChange", () =>
        HttpResponse.json({ data: null, errors: [{ message: "x", extensions: { code: "RATE_LIMITED" } }] }),
      ),
    );
    rendered();
    await screen.findByTestId("changeEmail.code.input");
    typeCode("123456");
    press();
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent(
      "Too many tries. Wait a little, then try again.",
    );
  });

  it("resend_both_waiting_snackbar", async () => {
    server.use(
      graphql.mutation("ResendEmailChange", () =>
        HttpResponse.json({
          data: {
            resendEmailChange: { __typename: "ResendEmailChangePayload", pendingEmailChange: pending(), userErrors: [] },
          },
        }),
      ),
    );
    rendered();
    fireEvent.click(await screen.findByTestId("changeEmail.pair.resend"));
    expect(await screen.findByTestId("change-email-snackbar")).toHaveTextContent("Sent again — check both inboxes.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("resend_link_confirmed_mails_only_the_code and resend_code_confirmed_mails_only_the_link", () => {
    expect(resendMessage(OLD, pending({ linkConfirmed: true }) as never)).toBe(
      `Sent again — the code is on its way to ${OLD}.`,
    );
    expect(resendMessage(OLD, pending({ codeConfirmed: true }) as never)).toBe(
      `Sent again — the link is on its way to ${NEW}.`,
    );
  });

  it("resend_budget_spent_line_and_no_snackbar", async () => {
    server.use(
      graphql.mutation("ResendEmailChange", () =>
        HttpResponse.json({ data: null, errors: [{ message: "x", extensions: { code: "RATE_LIMITED" } }] }),
      ),
    );
    rendered();
    await screen.findByTestId("changeEmail.code.input");
    typeCode("123456");
    fireEvent.click(screen.getByTestId("changeEmail.pair.resend"));
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent(
      "Too many tries. Wait a little, then try again.",
    );
    expect(screen.getByTestId("change-email-snackbar-region")).toBeEmptyDOMElement();
  });

  it("resend_offline_opens_network_error", async () => {
    server.use(graphql.mutation("ResendEmailChange", () => HttpResponse.error()));
    rendered();
    fireEvent.click(await screen.findByTestId("changeEmail.pair.resend"));
    expect(await screen.findByTestId("change-email-snackbar")).toHaveTextContent("That didn't send. Try again.");
  });

  it("a resend with nothing pending reroutes by the settings row", async () => {
    server.use(
      graphql.mutation("ResendEmailChange", () =>
        HttpResponse.json({
          data: {
            resendEmailChange: {
              __typename: "ResendEmailChangePayload",
              pendingEmailChange: null,
              userErrors: [{ __typename: "UserError", message: "x", code: "NOT_FOUND", field: null }],
            },
          },
        }),
      ),
    );
    rendered();
    fireEvent.click(await screen.findByTestId("changeEmail.pair.resend"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/settings"));
  });

  it("cancel_returns_with_change_canceled_snackbar", async () => {
    server.use(
      graphql.mutation("CancelEmailChange", () =>
        HttpResponse.json({
          data: {
            cancelEmailChange: {
              __typename: "CancelEmailChangePayload",
              user: { __typename: "User", id: "u1", email: OLD, pendingEmailChange: null },
              userErrors: [],
            },
          },
        }),
      ),
    );
    rendered();
    fireEvent.click(await screen.findByTestId("changeEmail.cancel"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings?done=canceled"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancel_offline_keeps_the_change", async () => {
    server.use(graphql.mutation("CancelEmailChange", () => HttpResponse.error()));
    rendered();
    fireEvent.click(await screen.findByTestId("changeEmail.cancel"));
    expect(await screen.findByTestId("change-email-snackbar")).toHaveTextContent("That didn't send. Try again.");
    expect(push).not.toHaveBeenCalled();
  });

  it("back_keeps_the_change_live", async () => {
    rendered();
    expect(await screen.findByTestId("changeEmail.header.back")).toHaveAttribute("href", "/settings");
  });

  it("opens settings when nothing is pending any more", async () => {
    server.use(account(null));
    rendered();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/settings"));
  });
});
