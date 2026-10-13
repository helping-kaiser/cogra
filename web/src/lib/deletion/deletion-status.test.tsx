import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { delay, graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { BorrowedViewBand } from "@/lib/ui/borrowed-view-band";
import { CograBand } from "@/lib/ui/cogra-band";
import { PageHeader } from "@/lib/ui/page-header";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";

import { AccountDeletionProvider, BARE_VIEW, useAccountDeletion } from "./deletion-status";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
let pathname = "/settings";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => pathname,
}));

const server = startMswServer();

const DAY = 86_400_000;

function standing(accountDeletion: unknown, deletionPath = "BY_LINK") {
  return graphql.query("AccountDeletion", () =>
    HttpResponse.json({ data: { me: { __typename: "User", id: "u1", deletionPath, accountDeletion } } }),
  );
}

function grace(days: number, includesContent = false) {
  return {
    __typename: "AccountDeletion",
    scheduledFor: new Date(Date.now() + days * DAY).toISOString(),
    includesContent,
  };
}

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function renderUnder(ui: React.ReactNode, store = signedIn()) {
  return renderWithProviders(<AccountDeletionProvider>{ui}</AccountDeletionProvider>, { store });
}

beforeEach(() => {
  window.localStorage.clear();
  replace.mockReset();
  pathname = "/settings";
});

describe("the deletion band", () => {
  it("rides_under_an_inner_header_while_the_grace_runs", async () => {
    server.use(standing(grace(6)));
    renderUnder(<PageHeader title="Settings" deletionBand={{ path: "settings.deletionBand" }} />);
    expect(await screen.findByTestId("settings.deletionBand.line")).toHaveTextContent(
      "Your account is deleted in 6 days.",
    );
  });

  it("rides_a_roots_band_and_names_the_sweep", async () => {
    server.use(standing(grace(6, true)));
    renderUnder(<CograBand deletionBandNode={{ path: "feed.deletionBand" }} />);
    expect(await screen.findByTestId("feed.deletionBand.line")).toHaveTextContent(
      "Your account and everything you posted are deleted in 6 days.",
    );
  });

  it("stands_nowhere_before_the_link_is_confirmed", async () => {
    let asked = false;
    server.use(
      graphql.query("AccountDeletion", () => {
        asked = true;
        return HttpResponse.json({ data: { me: { __typename: "User", id: "u1", deletionPath: "BY_LINK", accountDeletion: null } } });
      }),
    );
    renderUnder(<PageHeader title="Settings" />);
    await waitFor(() => expect(asked).toBe(true));
    expect(screen.queryByTestId("deletion-band")).not.toBeInTheDocument();
  });

  it("steps_aside_on_the_deletions_own_page", async () => {
    server.use(standing(grace(6)));
    renderUnder(
      <>
        <PageHeader title="Delete account" deletionBand={false} />
        <PageHeader title="Other" />
      </>,
    );
    // The band the second header carries proves the read landed.
    expect(await screen.findAllByTestId("deletion-band")).toHaveLength(1);
  });

  it("is_not_read_signed_out", async () => {
    renderUnder(<PageHeader title="About" />, createTokenStore());
    await act(async () => {});
    expect(screen.queryByTestId("deletion-band")).not.toBeInTheDocument();
  });

  it("cancel_clears_the_band_and_says_so_without_undo", async () => {
    server.use(
      standing(grace(6)),
      graphql.mutation("CancelAccountDeletion", () =>
        HttpResponse.json({
          data: { cancelAccountDeletion: { __typename: "AccountDeletionPayload", accountDeletion: null, userErrors: [] } },
        }),
      ),
    );
    renderUnder(<CograBand deletionBandNode={{ path: "feed.deletionBand" }} />);
    fireEvent.click(await screen.findByTestId("feed.deletionBand.cancel"));
    expect(await screen.findByTestId("deletion-snackbar")).toHaveTextContent(
      "Canceled — your account stays, and nothing was deleted.",
    );
    expect(screen.queryByTestId("feed.deletionBand")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("cancel_with_no_answer_says_the_network_error_and_the_band_stays", async () => {
    server.use(
      standing(grace(6)),
      graphql.mutation("CancelAccountDeletion", async () => {
        await delay(1);
        return HttpResponse.error();
      }),
    );
    renderUnder(<CograBand deletionBandNode={{ path: "feed.deletionBand" }} />);
    fireEvent.click(await screen.findByTestId("feed.deletionBand.cancel"));
    expect(await screen.findByTestId("deletion-snackbar")).toHaveTextContent("That didn't send. Try again.");
    expect(screen.getByTestId("feed.deletionBand")).toBeInTheDocument();
  });
});

describe("the band arbitration (ER-G4)", () => {
  it("the_deletion_band_wins_over_the_borrowed_view_band_while_the_grace_runs", async () => {
    server.use(standing(grace(6)));
    renderUnder(
      <CograBand deletionBandNode={{ path: "feed.deletionBand" }}>
        <BorrowedViewBand handle="ada" line="Borrowed from @ada." />
      </CograBand>,
    );
    expect(await screen.findByTestId("feed.deletionBand")).toBeInTheDocument();
    expect(screen.queryByTestId("borrowed-view")).not.toBeInTheDocument();
  });

  it("the_borrowed_view_band_stands_when_no_deletion_does", async () => {
    let asked = false;
    server.use(
      graphql.query("AccountDeletion", () => {
        asked = true;
        return HttpResponse.json({ data: { me: { __typename: "User", id: "u1", deletionPath: "BY_LINK", accountDeletion: null } } });
      }),
    );
    renderUnder(
      <CograBand deletionBandNode={{ path: "feed.deletionBand" }}>
        <BorrowedViewBand handle="ada" line="Borrowed from @ada." />
      </CograBand>,
    );
    await waitFor(() => expect(asked).toBe(true));
    expect(screen.getByTestId("borrowed-view")).toBeInTheDocument();
    expect(screen.queryByTestId("feed.deletionBand")).not.toBeInTheDocument();
  });
});

describe("the band under a padded host's header", () => {
  it("bleeds_through_the_gutter_full_width_rather_than_inset_like_a_card", async () => {
    server.use(standing(grace(6)));
    renderUnder(
      <main className="px-6">
        <PageHeader title="Invites" inGutter />
        <PageHeader title="Settings" />
      </main>,
    );
    const [padded, flush] = await screen.findAllByTestId("deletion-band");
    expect(padded).toHaveClass("-mx-6");
    expect(flush).not.toHaveClass("-mx-6");
    // One block with its header, so no host gap opens between them.
    expect(padded.previousElementSibling?.tagName).toBe("HEADER");
  });
});

function Leave() {
  const status = useAccountDeletion();
  return (
    <button type="button" onClick={status.leaveDeleted}>
      leave
    </button>
  );
}

describe("leaving after an applicant's deletion", () => {
  it("ends_the_session_and_lands_on_the_bare_view_with_its_snackbar", async () => {
    server.use(standing(null, "IMMEDIATE"));
    const { store } = renderUnder(<Leave />);
    fireEvent.click(screen.getByRole("button", { name: "leave" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(BARE_VIEW));
    expect(store.hasSession()).toBe(false);
    expect(screen.getByTestId("deletion-snackbar")).toHaveTextContent("Your account is deleted.");
    expect(replace).not.toHaveBeenCalledWith("/login");
  });
});
