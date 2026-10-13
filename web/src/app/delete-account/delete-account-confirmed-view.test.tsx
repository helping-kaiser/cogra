import { fireEvent, screen, waitFor } from "@testing-library/react";
import { delay, graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountDeletionProvider } from "@/lib/deletion/deletion-status";
import { createTokenStore } from "@/lib/session/token-store";
import { dateline } from "@/lib/ui/timestamp";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";

import { DeleteAccountConfirmedView } from "./delete-account-confirmed-view";

const push = vi.fn();
const replace = vi.fn();
let search = new URLSearchParams("token=tok-1");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => search,
  usePathname: () => "/delete-account",
}));

const server = startMswServer();

const SEVEN_DAYS = new Date(Date.now() + 7 * 86_400_000).toISOString();

function confirmed(includesContent: boolean, scheduledFor = SEVEN_DAYS) {
  return {
    data: {
      confirmAccountDeletion: {
        __typename: "AccountDeletionPayload",
        accountDeletion: { __typename: "AccountDeletion", scheduledFor, includesContent },
        userErrors: [],
      },
    },
  };
}

function standing() {
  return graphql.query("AccountDeletion", () =>
    HttpResponse.json({ data: { me: { __typename: "User", id: "u1", deletionPath: "BY_LINK", accountDeletion: null } } }),
  );
}

function renderLanding({ signedIn = false } = {}) {
  const store = createTokenStore();
  if (signedIn) store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return renderWithProviders(
    <AccountDeletionProvider>
      <DeleteAccountConfirmedView />
    </AccountDeletionProvider>,
    { store },
  );
}

beforeEach(() => {
  window.localStorage.clear();
  push.mockReset();
  replace.mockReset();
  search = new URLSearchParams("token=tok-1");
  server.use(standing());
});

describe("DeleteAccountConfirmed", () => {
  it("opening_the_link_confirms_without_a_session_and_states_the_deadline", async () => {
    const inputs: unknown[] = [];
    server.use(
      graphql.mutation("ConfirmAccountDeletion", ({ variables }) => {
        inputs.push(variables.input);
        return HttpResponse.json(confirmed(false));
      }),
    );
    renderLanding();
    expect(await screen.findByTestId("deleteAccount.title")).toHaveTextContent(/^Your account is deleted in 7 days$/);
    expect(screen.getByTestId("deleteAccount.body")).toHaveTextContent(
      `That's ${dateline(SEVEN_DAYS)}. Until then nothing changes, and you can cancel from any device.`,
    );
    expect(inputs).toEqual([{ deletionToken: "tok-1" }]);
    // No back arrow on a mail link's landing (`:11`).
    expect(screen.queryByRole("link", { name: /back/i })).not.toBeInTheDocument();
  });

  it("signed_out_says_the_link_was_the_proof_and_offers_sign_in", async () => {
    server.use(graphql.mutation("ConfirmAccountDeletion", () => HttpResponse.json(confirmed(false))));
    renderLanding();
    expect(await screen.findByTestId("delete-account-signed-out")).toHaveTextContent(
      "You're not signed in here, and you don't need to be — the link was the proof.",
    );
    expect(screen.getByTestId("deleteAccount.onward")).toHaveTextContent("Sign in");
    expect(screen.getByTestId("deleteAccount.onward")).toHaveAttribute("href", "/login");
  });

  it("signed_in_goes_to_the_feed", async () => {
    server.use(graphql.mutation("ConfirmAccountDeletion", () => HttpResponse.json(confirmed(false))));
    renderLanding({ signedIn: true });
    const onward = await screen.findByTestId("deleteAccount.onward");
    expect(onward).toHaveTextContent("Go to the feed");
    expect(screen.queryByTestId("delete-account-signed-out")).not.toBeInTheDocument();
    fireEvent.click(onward);
    expect(push).toHaveBeenCalledWith("/feed");
  });

  it("with_the_sweep_already_in_the_heading_is_the_longer_sentence_and_nothing_is_offered", async () => {
    server.use(graphql.mutation("ConfirmAccountDeletion", () => HttpResponse.json(confirmed(true))));
    renderLanding();
    expect(await screen.findByTestId("deleteAccount.title")).toHaveTextContent(
      "Your account and everything you posted are deleted in 7 days",
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByTestId("deleteAccount.add")).not.toBeInTheDocument();
  });

  it("a_reopened_link_counts_the_days_left", async () => {
    const later = new Date(Date.now() + 3 * 86_400_000).toISOString();
    server.use(graphql.mutation("ConfirmAccountDeletion", () => HttpResponse.json(confirmed(false, later))));
    renderLanding();
    expect(await screen.findByTestId("deleteAccount.title")).toHaveTextContent("Your account is deleted in 3 days");
  });

  it("adding_the_sweep_joins_it_takes_the_longer_heading_and_says_so", async () => {
    const inputs: unknown[] = [];
    server.use(
      graphql.mutation("ConfirmAccountDeletion", ({ variables }) => {
        inputs.push(variables.input);
        return HttpResponse.json(confirmed(inputs.length > 1));
      }),
    );
    renderLanding();
    const box = await screen.findByRole("checkbox", { name: "Also remove what I posted" });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    fireEvent.click(screen.getByTestId("deleteAccount.add"));
    expect(await screen.findByTestId("delete-account-snackbar")).toHaveTextContent("Added — what you posted goes too.");
    expect(screen.getByTestId("deleteAccount.title")).toHaveTextContent(
      "Your account and everything you posted are deleted in 7 days",
    );
    expect(screen.queryByTestId("deleteAccount.add")).not.toBeInTheDocument();
    expect(inputs[1]).toEqual({ deletionToken: "tok-1", includeContent: true });
  });

  it("adding_unticked_leaves_the_deletion_account_only", async () => {
    const inputs: unknown[] = [];
    server.use(
      graphql.mutation("ConfirmAccountDeletion", ({ variables }) => {
        inputs.push(variables.input);
        return HttpResponse.json(confirmed(false));
      }),
    );
    renderLanding();
    fireEvent.click(await screen.findByTestId("deleteAccount.add"));
    await waitFor(() => expect(inputs).toHaveLength(2));
    expect(inputs[1]).toEqual({ deletionToken: "tok-1" });
    expect(screen.getByTestId("deleteAccount.title")).toHaveTextContent(/^Your account is deleted in 7 days$/);
    expect(screen.queryByTestId("delete-account-snackbar")).not.toBeInTheDocument();
  });

  it("adding_reads_late_after_200ms", async () => {
    let calls = 0;
    server.use(
      graphql.mutation("ConfirmAccountDeletion", async () => {
        calls += 1;
        if (calls > 1) await delay(600);
        return HttpResponse.json(confirmed(calls > 1));
      }),
    );
    renderLanding();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Also remove what I posted" }));
    const add = screen.getByTestId("deleteAccount.add");
    fireEvent.click(add);
    await waitFor(() => expect(add).toHaveTextContent("Adding it to the deletion…"), { timeout: 500 });
  });

  it("adding_with_no_answer_keeps_the_tick_and_says_so", async () => {
    let calls = 0;
    server.use(
      graphql.mutation("ConfirmAccountDeletion", () => {
        calls += 1;
        return calls > 1 ? HttpResponse.error() : HttpResponse.json(confirmed(false));
      }),
    );
    renderLanding();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Also remove what I posted" }));
    fireEvent.click(screen.getByTestId("deleteAccount.add"));
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent("That didn't send. Try again.");
    expect(screen.getByRole("checkbox", { name: "Also remove what I posted" })).toBeChecked();
    expect(screen.getByTestId("deleteAccount.add")).toHaveTextContent("Add it to the deletion");
  });

  it("a_dead_link_draws_nothing_until_its_landing_is_ruled", async () => {
    // ER-G1 (gated): the dead-link landing is not this slice's.
    let answered = false;
    server.use(
      graphql.mutation("ConfirmAccountDeletion", () => {
        answered = true;
        return HttpResponse.json({
          data: {
            confirmAccountDeletion: {
              __typename: "AccountDeletionPayload",
              accountDeletion: null,
              userErrors: [
                { __typename: "UserError", message: "dead", code: "DELETION_TOKEN_INVALID", field: ["deletionToken"] },
              ],
            },
          },
        });
      }),
    );
    renderLanding();
    await waitFor(() => expect(answered).toBe(true));
    expect(screen.queryByTestId("deleteAccount.title")).not.toBeInTheDocument();
    expect(screen.queryByTestId("deleteAccount.onward")).not.toBeInTheDocument();
  });

  it("no_answer_says_so_and_tries_the_same_link_again", async () => {
    let calls = 0;
    server.use(
      graphql.mutation("ConfirmAccountDeletion", () => {
        calls += 1;
        return calls === 1 ? HttpResponse.error() : HttpResponse.json(confirmed(false));
      }),
    );
    renderLanding();
    fireEvent.click(await screen.findByTestId("delete-account-retry"));
    expect(await screen.findByTestId("deleteAccount.title")).toHaveTextContent("Your account is deleted in 7 days");
  });
});
