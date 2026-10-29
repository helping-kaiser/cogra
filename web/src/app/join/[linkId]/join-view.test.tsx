import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RegisterMutationVariables } from "@/__generated__/graphql";
import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { forgetTyped, JoinView } from "./join-view";

const { replace, push } = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
}));

const server = startMswServer();

const ID = "0198c9a2-1f6b-7c31-9d70-3a4f5b6c7d8e";

const usableCheck = gqlLink.query("InviteLinkCheck", () =>
  HttpResponse.json({
    data: {
      inviteLinkCheck: {
        __typename: "InviteLinkCheck",
        usable: true,
        inviterHandle: "grace",
        expiresAt: "2026-08-08T00:00:00Z",
      },
    },
  }),
);

function fillForm({
  handle = "ada",
  email = "ada@example.org",
  password = "correct horse battery",
}: { handle?: string; email?: string; password?: string } = {}) {
  fireEvent.change(screen.getByTestId("apply_handle"), { target: { value: handle } });
  fireEvent.change(screen.getByTestId("apply_email"), { target: { value: email } });
  fireEvent.change(screen.getByTestId("apply_password"), { target: { value: password } });
}

const refusal = (code: string, field: string[] | null) =>
  gqlLink.mutation("Register", () =>
    HttpResponse.json({
      data: {
        register: {
          __typename: "RegisterPayload",
          auth: null,
          expiresAt: null,
          userErrors: [{ __typename: "UserError", message: code, code, field }],
        },
      },
    }),
  );

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function meHandler(accountState: "APPLICANT" | "MEMBER") {
  return gqlLink.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle: "ada",
          displayName: { __typename: "ModeratedText", value: null },
          accountState,
          hasReciprocated: true,
          vouchBackDismissed: false,
          invitedBy: null,
        },
      },
    }),
  );
}

describe("JoinView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    replace.mockClear();
    push.mockClear();
    forgetTyped();
  });

  it("shows who is vouching and the apply form on a usable invite", async () => {
    server.use(usableCheck);
    renderWithProviders(<JoinView linkId={ID} />);
    expect(await screen.findByTestId("invite_inviter")).toHaveTextContent("@grace");
    expect(screen.getByTestId("apply_handle")).toBeInTheDocument();
  });

  it("refuses an unknown invite before the form", async () => {
    server.use(
      gqlLink.query("InviteLinkCheck", () => HttpResponse.json({ data: { inviteLinkCheck: null } })),
    );
    renderWithProviders(<JoinView linkId={ID} />);
    expect(await screen.findByRole("heading", { name: "This invite can't be used anymore" })).toBeInTheDocument();
    expect(screen.queryByTestId("apply_handle")).not.toBeInTheDocument();
  });

  it("refuses an unusable invite before the form", async () => {
    server.use(
      gqlLink.query("InviteLinkCheck", () =>
        HttpResponse.json({
          data: {
            inviteLinkCheck: {
              __typename: "InviteLinkCheck",
              usable: false,
              inviterHandle: "grace",
              expiresAt: "2026-08-08T00:00:00Z",
            },
          },
        }),
      ),
    );
    renderWithProviders(<JoinView linkId={ID} />);
    expect(await screen.findByRole("heading", { name: "This invite can't be used anymore" })).toBeInTheDocument();
    // JoinInvalid.md: the field and its ways out stand as the door's.
    expect(screen.getByTestId("invite_input")).toBeInTheDocument();
  });

  it("flags a path segment with no invite in it without a network call", () => {
    renderWithProviders(<JoinView linkId="not-an-invite" />);
    expect(screen.getByRole("heading", { name: "This invite can't be used anymore" })).toBeInTheDocument();
  });

  it("surfaces a transport fault on the check", async () => {
    server.use(gqlLink.query("InviteLinkCheck", () => HttpResponse.error()));
    renderWithProviders(<JoinView linkId={ID} />);
    expect(await screen.findByTestId("invite_transport_error")).toBeInTheDocument();
  });

  it("registers, stores the session, and goes home", async () => {
    const captured: RegisterMutationVariables[] = [];
    server.use(
      usableCheck,
      gqlLink.mutation("Register", ({ variables }) => {
        captured.push(variables as RegisterMutationVariables);
        return HttpResponse.json({
          data: {
            register: {
              __typename: "RegisterPayload",
              auth: {
                __typename: "AuthSession",
                accessToken: "access-1",
                refreshToken: "refresh-1",
                user: { __typename: "User", id: "acct-1" },
              },
              expiresAt: "2026-08-08T00:00:00Z",
              userErrors: [],
            },
          },
        });
      }),
    );
    const { store } = renderWithProviders(<JoinView linkId={ID} />);
    await screen.findByTestId("apply_handle");

    fireEvent.change(screen.getByTestId("apply_handle"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByTestId("apply_email"), { target: { value: "ada@example.org" } });
    fireEvent.change(screen.getByTestId("apply_password"), {
      target: { value: "correct horse battery" },
    });
    fireEvent.click(screen.getByTestId("apply_continue"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(store.hasSession()).toBe(true);
    // The handle is lowercased on entry and the invite rides the input.
    expect(captured[0]?.input).toMatchObject({ handle: "ada", inviteLink: ID });
  });

  it("a_short_password_answers_on_the_press_and_nothing_goes_out", async () => {
    let calls = 0;
    server.use(
      usableCheck,
      gqlLink.mutation("Register", () => {
        calls += 1;
        return HttpResponse.error();
      }),
    );
    renderWithProviders(<JoinView linkId={ID} />);
    await screen.findByTestId("apply_handle");
    fillForm({ password: "short" });
    // Typing never marks a field before the press.
    expect(screen.queryByText("A password is at least 12 characters.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("apply_continue"));
    expect(await screen.findByText("A password is at least 12 characters.")).toBeInTheDocument();
    expect(screen.getByTestId("apply_password")).toHaveAttribute("aria-invalid", "true");
    expect(calls).toBe(0);
    // The local line re-checks as the text changes.
    fireEvent.change(screen.getByTestId("apply_password"), { target: { value: "correct horse battery" } });
    expect(screen.queryByText("A password is at least 12 characters.")).not.toBeInTheDocument();
  });

  it("pins a registration refusal to the form", async () => {
    server.use(
      usableCheck,
      gqlLink.mutation("Register", () =>
        HttpResponse.json({
          data: {
            register: {
              __typename: "RegisterPayload",
              auth: null,
              expiresAt: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "taken",
                  code: "HANDLE_TAKEN",
                  field: ["handle"],
                },
              ],
            },
          },
        }),
      ),
    );
    renderWithProviders(<JoinView linkId={ID} />);
    await screen.findByTestId("apply_handle");
    fireEvent.change(screen.getByTestId("apply_handle"), { target: { value: "ada" } });
    fireEvent.change(screen.getByTestId("apply_email"), { target: { value: "ada@example.org" } });
    fireEvent.change(screen.getByTestId("apply_password"), {
      target: { value: "correct horse battery" },
    });
    fireEvent.click(screen.getByTestId("apply_continue"));
    // Join.md: the line reads in place of the hint, and the field takes the error state.
    expect(await screen.findByText("That handle is taken.")).toBeInTheDocument();
    expect(screen.getByTestId("apply_handle")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("3–30 characters: a–z, 0–9, _")).not.toBeInTheDocument();
  });

  it("renders a rate-limited registration as a backoff, not a connectivity failure", async () => {
    server.use(
      usableCheck,
      gqlLink.mutation("Register", () =>
        HttpResponse.json({
          errors: [{ message: "too many attempts", extensions: { code: "RATE_LIMITED" } }],
        }),
      ),
    );
    renderWithProviders(<JoinView linkId={ID} />);
    await screen.findByTestId("apply_handle");
    fireEvent.change(screen.getByTestId("apply_handle"), { target: { value: "ada" } });
    fireEvent.change(screen.getByTestId("apply_email"), { target: { value: "ada@example.org" } });
    fireEvent.change(screen.getByTestId("apply_password"), {
      target: { value: "correct horse battery" },
    });
    fireEvent.click(screen.getByTestId("apply_continue"));
    expect(await screen.findByTestId("apply_error")).toHaveTextContent(
      "Too many tries. Wait a little, then try again.",
    );
    expect(screen.queryByText("That didn't send. Try again.")).not.toBeInTheDocument();
  });

  it("offers a signed-in applicant neither the form nor the sign-in link", async () => {
    server.use(usableCheck, meHandler("APPLICANT"));
    renderWithProviders(<JoinView linkId={ID} />, { store: signedInStore() });
    expect(await screen.findByTestId("invite_inviter")).toBeInTheDocument();
    expect(screen.queryByTestId("apply_handle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("invite_login")).not.toBeInTheDocument();
  });

  it("offers a member no action — the invite is for someone new", async () => {
    server.use(usableCheck, meHandler("MEMBER"));
    renderWithProviders(<JoinView linkId={ID} />, { store: signedInStore() });
    expect(await screen.findByTestId("join_member_note")).toBeInTheDocument();
    expect(screen.getByTestId("join_member_invites")).toHaveAttribute("href", "/invites");
    expect(screen.queryByTestId("apply_handle")).not.toBeInTheDocument();
  });

  it("offers no action while the account state is unknown", async () => {
    server.use(usableCheck, gqlLink.query("Me", () => HttpResponse.error()));
    renderWithProviders(<JoinView linkId={ID} />, { store: signedInStore() });
    expect(await screen.findByTestId("invite_inviter")).toBeInTheDocument();
    expect(screen.queryByTestId("join_member_note")).not.toBeInTheDocument();
  });


  // Join.jsx / Join.md, line for line.
  describe("the form's anatomy (Join)", () => {
    it("heads with a plain Back, the About CoGra dot, the inviter and the lead", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      expect(await screen.findByTestId("invite_inviter")).toHaveTextContent("@grace invited you");
      expect(screen.getByRole("link", { name: "Back" })).toBeInTheDocument();
      expect(
        screen.getByText("CoGra is invite-only — a member vouches for you, and @grace's approval brings you in."),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "About CoGra" }));
      expect(push).toHaveBeenCalledWith(`/about?from=join&invite=${ID}`);
    });

    it("the hints read until a line takes their place", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("apply_handle");
      expect(screen.getByText("3–30 characters: a–z, 0–9, _")).toBeInTheDocument();
      expect(screen.getByText("At least 12 characters.")).toBeInTheDocument();
    });

    it("create_account_stands_disabled_with_its_waiting_line_until_all_three_fields_hold_a_character", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("apply_handle");
      const reason = "Waiting for a handle, your email and a password";
      expect(screen.getByText(reason)).toBeInTheDocument();
      expect(screen.getByTestId("apply_continue")).toBeDisabled();
      fillForm({ password: "x" });
      expect(screen.queryByText(reason)).not.toBeInTheDocument();
      expect(screen.getByTestId("apply_continue")).toBeEnabled();
    });

    it("the terms line stands directly above Create account and the privacy notice at the foot", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("apply_handle");
      const terms = screen.getByText(/By creating your account you accept the/);
      expect(terms).toHaveTextContent("By creating your account you accept the Terms.");
      const privacy = screen.getByText(/How CoGra handles your data: the/);
      expect(privacy).toHaveTextContent("How CoGra handles your data: the Privacy Policy.");
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      const commit = screen.getByTestId("apply_continue");
      expect(terms.compareDocumentPosition(commit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(commit.compareDocumentPosition(privacy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByTestId("invite_login")).toHaveTextContent("Already have an account? Sign in");
    });

    it("a_malformed_handle_and_email_answer_on_the_press", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("apply_handle");
      fillForm({ handle: "a!", email: "nope" });
      fireEvent.click(screen.getByTestId("apply_continue"));
      expect(await screen.findByText("A handle is 3–30 characters: a–z, 0–9, _.")).toBeInTheDocument();
      expect(screen.getByText("That doesn't look like an email address.")).toBeInTheDocument();
    });

    it("a_taken_email_reads_on_its_field_and_stands_while_typing", async () => {
      server.use(usableCheck, refusal("EMAIL_IN_USE", ["email"]));
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("apply_handle");
      fillForm();
      fireEvent.click(screen.getByTestId("apply_continue"));
      expect(await screen.findByText("That email already has an account.")).toBeInTheDocument();
      fireEvent.change(screen.getByTestId("apply_email"), { target: { value: "ada2@example.org" } });
      expect(screen.getByText("That email already has an account.")).toBeInTheDocument();
    });

    it("a_breached_password_reads_on_its_field", async () => {
      server.use(usableCheck, refusal("WEAK_PASSWORD", ["password"]));
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("apply_handle");
      fillForm();
      fireEvent.click(screen.getByTestId("apply_continue"));
      expect(
        await screen.findByText("That password has turned up in a data breach — pick another one."),
      ).toBeInTheDocument();
    });

    it("no_answer_keeps_the_fields_and_says_it_above_create_account", async () => {
      server.use(usableCheck, gqlLink.mutation("Register", () => HttpResponse.error()));
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("apply_handle");
      fillForm();
      fireEvent.click(screen.getByTestId("apply_continue"));
      expect(await screen.findByTestId("apply_error")).toHaveTextContent("That didn't send. Try again.");
      expect(screen.getByTestId("apply_handle")).toHaveValue("ada");
      expect(screen.getByTestId("apply_continue")).toBeEnabled();
    });

    it("a_link_spent_while_the_form_stood_reads_join_invalid", async () => {
      server.use(usableCheck, refusal("INVITE_UNUSABLE", null));
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("apply_handle");
      fillForm();
      fireEvent.click(screen.getByTestId("apply_continue"));
      expect(await screen.findByRole("heading", { name: "This invite can't be used anymore" })).toBeInTheDocument();
    });

    it("the_handle_and_email_outlive_a_way_out_and_the_password_does_not", async () => {
      server.use(usableCheck);
      const first = renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("apply_handle");
      fillForm({ handle: "kept", email: "kept@example.org" });
      first.unmount();
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      expect(await screen.findByTestId("apply_handle")).toHaveValue("kept");
      expect(screen.getByTestId("apply_email")).toHaveValue("kept@example.org");
      expect(screen.getByTestId("apply_password")).toHaveValue("");
    });
  });
});
