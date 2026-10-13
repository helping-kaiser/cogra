import { fireEvent, screen, waitFor } from "@testing-library/react";
import { delay, graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountDeletionProvider } from "@/lib/deletion/deletion-status";
import { createTokenStore } from "@/lib/session/token-store";
import { byNode } from "@/test/data-node";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";

import { DeleteAccountView, mailRoute } from "./delete-account-view";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/settings/delete",
}));

const server = startMswServer();

function standing(deletionPath: string, accountDeletion: unknown = null) {
  return graphql.query("AccountDeletion", () =>
    HttpResponse.json({ data: { me: { __typename: "User", id: "u1", deletionPath, accountDeletion } } }),
  );
}

function requestAnswers(accountDeletion: unknown = null) {
  return graphql.mutation("RequestAccountDeletion", () =>
    HttpResponse.json({
      data: { requestAccountDeletion: { __typename: "AccountDeletionPayload", accountDeletion, userErrors: [] } },
    }),
  );
}

function renderScreen() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return renderWithProviders(
    <AccountDeletionProvider>
      <DeleteAccountView />
    </AccountDeletionProvider>,
    { store },
  );
}

beforeEach(() => {
  window.localStorage.clear();
  push.mockReset();
  replace.mockReset();
});

describe("DeleteAccount, the member's case (BY_LINK)", () => {
  beforeEach(() => server.use(standing("BY_LINK")));

  it("says_what_goes_and_what_stays_with_the_sweep_unticked_and_one_commitment", async () => {
    renderScreen();
    expect(await screen.findByTestId("deleteAccount.body")).toHaveTextContent(/^This takes your name off CoGra\./);
    expect(screen.getByTestId("deleteAccount.title")).toHaveTextContent("Delete account");
    expect(screen.getByTestId("deleteAccount.goes.label")).toHaveTextContent("What goes");
    expect(screen.getByTestId("deleteAccount.stays.label")).toHaveTextContent("What stays");
    expect(screen.getByRole("checkbox", { name: "Also remove what I posted" })).not.toBeChecked();
    expect(screen.getByTestId(byNode("deleteAccount.commit", "member"))).toHaveTextContent("Send the confirmation link");
    expect(screen.queryByText("Delete my account")).not.toBeInTheDocument();
    expect(screen.getByTestId("deleteAccount.note")).toHaveTextContent(
      "Nothing is deleted until you open that link. After that it runs in seven days, and you can cancel from any device until it does.",
    );
    // No typed confirmation, no password (DeleteAccount.md:13).
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("deleteAccount.header.back")).toHaveAttribute("href", "/settings");
  });

  it("ticking_the_sweep_schedules_nothing", async () => {
    let requested = false;
    server.use(
      graphql.mutation("RequestAccountDeletion", () => {
        requested = true;
        return HttpResponse.json({ data: null });
      }),
    );
    renderScreen();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Also remove what I posted" }));
    expect(screen.getByRole("checkbox", { name: "Also remove what I posted" })).toBeChecked();
    expect(requested).toBe(false);
  });

  it("send_records_the_sweep_choice_and_opens_the_mail_screen", async () => {
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
    fireEvent.click(await screen.findByRole("checkbox", { name: "Also remove what I posted" }));
    fireEvent.click(screen.getByTestId(byNode("deleteAccount.commit", "member")));
    await waitFor(() => expect(push).toHaveBeenCalledWith(mailRoute(true)));
    expect(input).toEqual({ includeContent: true });
  });

  it("send_with_no_answer_keeps_the_choice_and_says_so_above_the_commit", async () => {
    server.use(graphql.mutation("RequestAccountDeletion", () => HttpResponse.error()));
    renderScreen();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Also remove what I posted" }));
    fireEvent.click(screen.getByTestId(byNode("deleteAccount.commit", "member")));
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent("That didn't send. Try again.");
    expect(screen.getByRole("checkbox", { name: "Also remove what I posted" })).toBeChecked();
    expect(screen.getByTestId(byNode("deleteAccount.commit", "member"))).toHaveTextContent("Send the confirmation link");
    expect(push).not.toHaveBeenCalled();
  });

  it("sending_reads_late_after_200ms_and_never_spins", async () => {
    server.use(
      graphql.mutation("RequestAccountDeletion", async () => {
        await delay(600);
        return HttpResponse.json({
          data: { requestAccountDeletion: { __typename: "AccountDeletionPayload", accountDeletion: null, userErrors: [] } },
        });
      }),
    );
    renderScreen();
    const commit = await screen.findByTestId(byNode("deleteAccount.commit", "member"));
    fireEvent.click(commit);
    expect(commit).toHaveTextContent("Send the confirmation link");
    await waitFor(() => expect(commit).toHaveTextContent("Sending the confirmation link…"), { timeout: 500 });
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("a_request_raced_into_a_confirmed_grace_opens_the_grace_page", async () => {
    server.use(
      requestAnswers({ __typename: "AccountDeletion", scheduledFor: "2030-01-01T00:00:00Z", includesContent: false }),
    );
    renderScreen();
    fireEvent.click(await screen.findByTestId(byNode("deleteAccount.commit", "member")));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/settings/delete/pending"));
    expect(push).not.toHaveBeenCalled();
  });
});

describe("DeleteAccount, the applicant's case (IMMEDIATE)", () => {
  beforeEach(() => server.use(standing("IMMEDIATE")));

  it("draws_one_sentence_and_delete_my_account_alone", async () => {
    renderScreen();
    expect(await screen.findByTestId("deleteAccount.body")).toHaveTextContent(
      "Nothing has landed yet — deleting removes your application and your account right away.",
    );
    expect(screen.getByTestId(byNode("deleteAccount.commit", "applicant"))).toHaveTextContent("Delete my account");
    expect(screen.queryByText("Send the confirmation link")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByTestId("deleteAccount.goes")).not.toBeInTheDocument();
  });

  it("delete_my_account_signs_out_onto_the_bare_view_with_its_snackbar", async () => {
    server.use(
      graphql.mutation("DeleteApplicantAccount", () =>
        HttpResponse.json({
          data: { deleteApplicantAccount: { __typename: "DeleteApplicantAccountPayload", ok: true, userErrors: [] } },
        }),
      ),
    );
    const { store } = renderScreen();
    fireEvent.click(await screen.findByTestId(byNode("deleteAccount.commit", "applicant")));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/feed"));
    expect(store.hasSession()).toBe(false);
    expect(screen.getByTestId("deletion-snackbar")).toHaveTextContent("Your account is deleted.");
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining("/settings/delete/mail"));
  });

  it("delete_with_no_answer_says_so_and_deletes_nothing", async () => {
    server.use(graphql.mutation("DeleteApplicantAccount", () => HttpResponse.error()));
    const { store } = renderScreen();
    fireEvent.click(await screen.findByTestId(byNode("deleteAccount.commit", "applicant")));
    expect(await screen.findByTestId("commit-fault")).toHaveTextContent("That didn't send. Try again.");
    expect(store.hasSession()).toBe(true);
    expect(screen.getByTestId(byNode("deleteAccount.commit", "applicant"))).toHaveTextContent("Delete my account");
  });
});

describe("DeleteAccount, where it does not belong", () => {
  it("a_locked_account_has_no_request_screen", async () => {
    server.use(standing("LOCKED"));
    renderScreen();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/settings"));
    expect(screen.queryByTestId("deleteAccount.body")).not.toBeInTheDocument();
  });

  it("a_deletion_in_its_grace_opens_its_own_page", async () => {
    server.use(
      standing("BY_LINK", { __typename: "AccountDeletion", scheduledFor: "2030-01-01T00:00:00Z", includesContent: false }),
    );
    renderScreen();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/settings/delete/pending"));
  });
});
