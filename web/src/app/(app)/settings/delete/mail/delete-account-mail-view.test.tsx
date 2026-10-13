import { fireEvent, screen, waitFor } from "@testing-library/react";
import { delay, graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountDeletionProvider } from "@/lib/deletion/deletion-status";
import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
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

function standing() {
  return graphql.query("AccountDeletion", () =>
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
      graphql.mutation("RequestAccountDeletion", ({ variables }) => {
        input = variables.input;
        return HttpResponse.json({
          data: { requestAccountDeletion: { __typename: "AccountDeletionPayload", accountDeletion: null, userErrors: [] } },
        });
      }),
    );
    renderScreen();
    fireEvent.click(await screen.findByTestId("deleteAccount.resend"));
    await waitFor(() => expect(input).toEqual({ includeContent: true }));
    expect(push).not.toHaveBeenCalled();
  });

  it("resending_reads_late_after_200ms", async () => {
    server.use(
      graphql.mutation("RequestAccountDeletion", async () => {
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
    server.use(graphql.mutation("RequestAccountDeletion", () => HttpResponse.error()));
    renderScreen();
    fireEvent.click(await screen.findByTestId("deleteAccount.resend"));
    expect(await screen.findByTestId("delete-account-mail-snackbar")).toHaveTextContent("That didn't send. Try again.");
  });
});
