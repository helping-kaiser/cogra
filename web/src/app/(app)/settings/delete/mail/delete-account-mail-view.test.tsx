import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { delay } from "msw/utils/delay";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountDeletionProvider } from "@/lib/deletion/deletion-status";
import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";

import { DeleteAccountMailView } from "./delete-account-mail-view";

const push = vi.fn();
const replace = vi.fn();
let search = new URLSearchParams("content=0");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => search,
  usePathname: () => "/settings/delete/mail",
}));

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

function standing() {
  return gqlLink.query("AccountDeletion", () =>
    HttpResponse.json({ data: { me: { __typename: "User", id: "u1", deletionPath: "BY_LINK", accountDeletion: null } } }),
  );
}

function renderScreen() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return renderWithProviders(
    <AccountDeletionProvider>
      <DeleteAccountMailView />
    </AccountDeletionProvider>,
    { store },
  );
}

beforeEach(() => {
  window.localStorage.clear();
  push.mockReset();
  replace.mockReset();
  search = new URLSearchParams("content=0");
  server.use(account(), standing());
});

describe("DeleteAccountMail", () => {
  it("names_the_address_the_link_went_to_and_claims_no_expiry", async () => {
    renderScreen();
    expect(await screen.findByTestId("deleteAccount.body")).toHaveTextContent(
      "We sent a link to sol@solferreira.art. Opening it confirms the deletion and starts the seven days.",
    );
    expect(screen.getByTestId("deleteAccount.title")).toHaveTextContent("Check your mail");
    expect(screen.getByTestId("deleteAccount.note")).toHaveTextContent(
      "Until you open it nothing is scheduled and nothing has changed.",
    );
    // No band: nothing is confirmed (DeleteAccountMail.md:11).
    expect(screen.queryByTestId("deletion-band")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveTextContent(/expire|minutes|hours/i);
    expect(screen.getByTestId("deleteAccount.header.back")).toHaveAttribute("href", "/settings");
  });

  it("resend_carries_the_requests_recorded_sweep_choice", async () => {
    search = new URLSearchParams("content=1");
    let input: unknown = null;
    server.use(
      gqlLink.mutation("RequestAccountDeletion", ({ variables }) => {
        input = variables.input;
        return HttpResponse.json({
          data: { requestAccountDeletion: { __typename: "AccountDeletionPayload", accountDeletion: null, userErrors: [] } },
        });
      }),
    );
    renderScreen();
    await screen.findByTestId("deleteAccount.body");
    fireEvent.click(screen.getByTestId("deleteAccount.resend"));
    await waitFor(() => expect(input).toEqual({ includeContent: true }));
    expect(push).not.toHaveBeenCalled();
    // DeleteAccountMail.md:13 — the snackbar names the account's address.
    expect(await screen.findByTestId("delete-account-mail-snackbar")).toHaveTextContent(
      "Sent again — the link is on its way to sol@solferreira.art.",
    );
  });

  it("a_spent_mail_budget_says_too_many_tries_above_resend_and_sends_nothing", async () => {
    server.use(
      gqlLink.mutation("RequestAccountDeletion", () =>
        HttpResponse.json({ data: null, errors: [{ message: "x", extensions: { code: "RATE_LIMITED" } }] }),
      ),
    );
    renderScreen();
    await screen.findByTestId("deleteAccount.body");
    fireEvent.click(screen.getByTestId("deleteAccount.resend"));
    // DeleteAccountMail.md:15 — the line above Resend, which stays; never the Sent-again snackbar.
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent(
      "Too many tries. Wait a little, then try again.",
    );
    expect(screen.getByTestId("deleteAccount.resend")).toHaveTextContent("Resend the link");
    expect(screen.queryByText(/Sent again/)).not.toBeInTheDocument();
  });

  it("resending_reads_late_after_200ms", async () => {
    server.use(
      gqlLink.mutation("RequestAccountDeletion", async () => {
        await delay(600);
        return HttpResponse.json({
          data: { requestAccountDeletion: { __typename: "AccountDeletionPayload", accountDeletion: null, userErrors: [] } },
        });
      }),
    );
    renderScreen();
    const resend = await screen.findByTestId("deleteAccount.resend");
    fireEvent.click(resend);
    expect(resend).toHaveTextContent("Resend the link");
    await waitFor(() => expect(resend).toHaveTextContent("Resending the link…"), { timeout: 500 });
  });

  it("resend_offline_says_the_network_error", async () => {
    server.use(gqlLink.mutation("RequestAccountDeletion", () => HttpResponse.error()));
    renderScreen();
    fireEvent.click(await screen.findByTestId("deleteAccount.resend"));
    expect(await screen.findByTestId("delete-account-mail-snackbar")).toHaveTextContent("That didn't send. Try again.");
  });
});
