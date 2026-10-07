import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { heldEmailChangeLink } from "@/lib/session/held-link";
import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { EmailChangeView } from "./email-change-view";

const push = vi.fn();
let search = new URLSearchParams("token=tok-1");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => search,
}));

const server = startMswServer();

const OLD = "sol@solferreira.art";
const NEW = "sol@ferreira.studio";

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
  return store;
}

function confirmed(user: Record<string, unknown> | null, code?: string) {
  return graphql.mutation("ConfirmEmailChange", () =>
    HttpResponse.json({
      data: {
        confirmEmailChange: {
          __typename: "ConfirmEmailChangePayload",
          user: user === null ? null : { __typename: "User", id: "u1", ...user },
          userErrors:
            code === undefined ? [] : [{ __typename: "UserError", message: "x", code, field: null }],
        },
      },
    }),
  );
}

function accountWith(email: string) {
  return graphql.query("SettingsAccount", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle: "sol",
          email,
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

const PENDING_CODE_OWED = {
  __typename: "PendingEmailChange",
  newEmail: NEW,
  requiresCode: true,
  codeConfirmed: false,
  linkConfirmed: true,
  expiresAt: "2026-10-08T12:00:00Z",
};

beforeEach(() => {
  push.mockReset();
  search = new URLSearchParams("token=tok-1");
  // The token store persists to localStorage; a signed-out case starts empty.
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("the link opened signed in", () => {
  it("first_side_reads_new_address_confirmed_and_enter_the_code", async () => {
    server.use(confirmed({ email: OLD, pendingEmailChange: PENDING_CODE_OWED }));
    renderWithProviders(<EmailChangeView />, { store: signedIn() });
    expect(await screen.findByTestId("changeEmail.title")).toHaveTextContent("New address confirmed");
    expect(screen.getByTestId("changeEmail.body")).toHaveTextContent(
      `One side left: the code we sent to ${OLD}. Your email moves once it's typed in.`,
    );
    expect(screen.getByTestId("changeEmail.onward")).toHaveTextContent("Enter the code");
    expect(screen.getByTestId("changeEmail.onward")).toHaveAttribute("href", "/settings/email/confirm");
    expect(screen.getByTestId("changeEmail.mark")).toBeInTheDocument();
  });

  it("last_side_reads_email_changed_and_back_to_settings", async () => {
    server.use(confirmed({ email: NEW, pendingEmailChange: null }));
    renderWithProviders(<EmailChangeView />, { store: signedIn() });
    expect(await screen.findByTestId("changeEmail.title")).toHaveTextContent("Email changed");
    expect(screen.getByTestId("changeEmail.body")).toHaveTextContent(
      `You sign in with ${NEW} from now on, and resets go there too.`,
    );
    expect(screen.getByTestId("changeEmail.onward")).toHaveTextContent("Back to settings");
  });

  it.each([
    ["canceled_link_landing", "EMAIL_CHANGE_CANCELED", OLD, `The change it belonged to was canceled. Your email is still ${OLD}.`],
    ["applied_again_landing", "EMAIL_CHANGE_ALREADY_APPLIED", NEW, `The change it belonged to already happened. Your email is now ${NEW}.`],
    ["ran_out_landing", "EMAIL_CHANGE_EXPIRED", OLD, `The change it belonged to ran out before both sides landed. Your email is still ${OLD}.`],
  ])("%s", async (_name, code, email, body) => {
    server.use(confirmed(null, code), accountWith(email));
    renderWithProviders(<EmailChangeView />, { store: signedIn() });
    expect(await screen.findByTestId("changeEmail.title")).toHaveTextContent("This link doesn't work anymore");
    await waitFor(() => expect(screen.getByTestId("changeEmail.body")).toHaveTextContent(body));
    expect(screen.getByTestId("changeEmail.onward")).toHaveTextContent("Back to settings");
    expect(screen.getByTestId("changeEmail.mark")).toBeInTheDocument();
  });

  it("the taken landing names the address-taken line and goes back to settings (G4)", async () => {
    server.use(confirmed(null, "EMAIL_IN_USE"), accountWith(OLD));
    renderWithProviders(<EmailChangeView />, { store: signedIn() });
    expect(await screen.findByTestId("changeEmail.title")).toHaveTextContent("That address is taken now");
    expect(screen.getByTestId("changeEmail.body")).toHaveTextContent(
      "That address now belongs to another account.",
    );
    expect(screen.getByTestId("changeEmail.onward")).toHaveTextContent("Back to settings");
  });

  it("other_account_landing_never_switches", async () => {
    const store = signedIn();
    server.use(confirmed(null, "EMAIL_CHANGE_OTHER_ACCOUNT"), accountWith(OLD));
    renderWithProviders(<EmailChangeView />, { store });
    expect(await screen.findByTestId("changeEmail.title")).toHaveTextContent("This link isn't for this account");
    expect(screen.getByTestId("changeEmail.body")).toHaveTextContent(
      "It confirms a new address for another account, so nothing changed here. Open it signed in as that account to finish the change.",
    );
    expect(screen.queryByTestId("changeEmail.mark")).not.toBeInTheDocument();
    expect(store.accessToken()).toBe("a");
  });

  it("signed_in_landing_never_calls_the_check", async () => {
    let checked = false;
    server.use(
      confirmed({ email: NEW, pendingEmailChange: null }),
      graphql.query("EmailChangeLinkCheck", () => {
        checked = true;
        return HttpResponse.json({ data: { emailChangeLinkCheck: null } });
      }),
    );
    renderWithProviders(<EmailChangeView />, { store: signedIn() });
    await screen.findByTestId("changeEmail.title");
    expect(checked).toBe(false);
  });

  it("landing_has_no_back_arrow", async () => {
    server.use(confirmed({ email: NEW, pendingEmailChange: null }));
    renderWithProviders(<EmailChangeView />, { store: signedIn() });
    await screen.findByTestId("changeEmail.title");
    expect(screen.queryByLabelText(/^Back/)).not.toBeInTheDocument();
  });
});

describe("the link opened signed out", () => {
  function check(answer: Record<string, unknown> | null) {
    return graphql.query("EmailChangeLinkCheck", () =>
      HttpResponse.json({
        data: {
          emailChangeLinkCheck: answer === null ? null : { __typename: "EmailChangeLinkCheck", ...answer },
        },
      }),
    );
  }

  it("signed_out_landing_names_the_new_address_from_the_check", async () => {
    server.use(check({ newEmail: NEW, state: "PENDING" }));
    renderWithProviders(<EmailChangeView />);
    expect(await screen.findByTestId("changeEmail.title")).toHaveTextContent("Sign in to finish the change");
    expect(screen.getByTestId("changeEmail.body")).toHaveTextContent(
      `This link confirms ${NEW} as your new address. It counts once you're signed in.`,
    );
    expect(screen.getByTestId("changeEmail.onward")).toHaveTextContent("Sign in");
    expect(screen.queryByTestId("changeEmail.mark")).not.toBeInTheDocument();
  });

  it("signed_out_landing_never_prints_the_current_address", async () => {
    server.use(check({ newEmail: NEW, state: "PENDING" }));
    renderWithProviders(<EmailChangeView />);
    await screen.findByTestId("changeEmail.body");
    expect(document.body).not.toHaveTextContent(OLD);
  });

  it("signed_out_landing_signs_in_holding_the_link", async () => {
    server.use(check({ newEmail: NEW, state: "PENDING" }));
    renderWithProviders(<EmailChangeView />);
    fireEvent.click(await screen.findByTestId("changeEmail.onward"));
    expect(push).toHaveBeenCalledWith("/login");
    expect(heldEmailChangeLink()).toBe("tok-1");
  });

  it("a dead or unknown link reads the dead-link heading over Sign in, with no address (G9)", async () => {
    server.use(check(null));
    renderWithProviders(<EmailChangeView />);
    expect(await screen.findByTestId("changeEmail.title")).toHaveTextContent("This link doesn't work anymore");
    expect(screen.queryByTestId("changeEmail.body")).not.toBeInTheDocument();
    expect(screen.getByTestId("changeEmail.onward")).toHaveTextContent("Sign in");
  });

  it("applies the held link once signed in again", async () => {
    search = new URLSearchParams();
    window.sessionStorage.setItem("cogra.heldEmailChangeLink", "tok-held");
    let sent: unknown = null;
    server.use(
      graphql.mutation("ConfirmEmailChange", ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            confirmEmailChange: {
              __typename: "ConfirmEmailChangePayload",
              user: { __typename: "User", id: "u1", email: NEW, pendingEmailChange: null },
              userErrors: [],
            },
          },
        });
      }),
    );
    renderWithProviders(<EmailChangeView />, { store: signedIn() });
    expect(await screen.findByTestId("changeEmail.title")).toHaveTextContent("Email changed");
    expect(sent).toEqual({ input: { code: "tok-held" } });
    expect(heldEmailChangeLink()).toBeNull();
  });
});
