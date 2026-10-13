import { fireEvent, screen, waitFor } from "@testing-library/react";
import { delay, graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountDeletionProvider } from "@/lib/deletion/deletion-status";
import { createTokenStore } from "@/lib/session/token-store";
import { dateline } from "@/lib/ui/timestamp";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";

import { DeleteAccountPendingView } from "./delete-account-pending-view";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/settings/delete/pending",
}));

const server = startMswServer();

const DEADLINE = new Date(Date.now() + 6 * 86_400_000).toISOString();

function standing(accountDeletion: unknown) {
  return graphql.query("AccountDeletion", () =>
    HttpResponse.json({ data: { me: { __typename: "User", id: "u1", deletionPath: "BY_LINK", accountDeletion } } }),
  );
}

const GRACE = { __typename: "AccountDeletion", scheduledFor: DEADLINE, includesContent: false };

function cancelAnswers() {
  return graphql.mutation("CancelAccountDeletion", () =>
    HttpResponse.json({
      data: { cancelAccountDeletion: { __typename: "AccountDeletionPayload", accountDeletion: null, userErrors: [] } },
    }),
  );
}

function renderScreen() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return renderWithProviders(
    <AccountDeletionProvider>
      <DeleteAccountPendingView />
    </AccountDeletionProvider>,
    { store },
  );
}

beforeEach(() => {
  window.localStorage.clear();
  push.mockReset();
  replace.mockReset();
  server.use(standing(GRACE));
});

describe("DeleteAccountPending", () => {
  it("states_the_deadline_in_days_and_its_date_with_cancel_as_the_one_commitment", async () => {
    renderScreen();
    expect(await screen.findByTestId("deleteAccount.body")).toHaveTextContent(
      `Your account is deleted in 6 days, on ${dateline(DEADLINE)}. Until then nothing has changed, and canceling keeps everything as it is.`,
    );
    expect(screen.getByTestId("deleteAccount.title")).toHaveTextContent("Delete account");
    expect(screen.getByTestId("deleteAccount.cancel")).toHaveTextContent("Cancel");
  });

  it("the_band_steps_aside_on_this_page", async () => {
    renderScreen();
    await screen.findByTestId("deleteAccount.cancel");
    expect(screen.queryByTestId("deletion-band")).not.toBeInTheDocument();
  });

  it("cancel_returns_to_settings_with_the_canceled_snackbar_and_no_dialog", async () => {
    server.use(cancelAnswers());
    renderScreen();
    fireEvent.click(await screen.findByTestId("deleteAccount.cancel"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings?done=deletionCanceled"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("canceling_reads_late_after_200ms", async () => {
    server.use(
      graphql.mutation("CancelAccountDeletion", async () => {
        await delay(600);
        return HttpResponse.json({
          data: { cancelAccountDeletion: { __typename: "AccountDeletionPayload", accountDeletion: null, userErrors: [] } },
        });
      }),
    );
    renderScreen();
    const cancel = await screen.findByTestId("deleteAccount.cancel");
    fireEvent.click(cancel);
    await waitFor(() => expect(cancel).toHaveTextContent("Canceling…"), { timeout: 500 });
  });

  it("cancel_offline_says_the_network_error_and_the_deletion_stands", async () => {
    server.use(graphql.mutation("CancelAccountDeletion", () => HttpResponse.error()));
    renderScreen();
    fireEvent.click(await screen.findByTestId("deleteAccount.cancel"));
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent("That didn't send. Try again.");
    expect(screen.getByTestId("deleteAccount.body")).toHaveTextContent("Your account is deleted in 6 days");
    expect(push).not.toHaveBeenCalled();
  });

  it("back_returns_to_settings_under_the_band", async () => {
    renderScreen();
    expect(await screen.findByTestId("deleteAccount.header.back")).toHaveAttribute("href", "/settings");
  });

  it("with_nothing_standing_settings_says_where_it_is", async () => {
    server.use(standing(null));
    renderScreen();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/settings"));
  });
});
