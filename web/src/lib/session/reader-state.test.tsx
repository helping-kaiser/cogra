// THE READER'S ACCOUNT STATE COMES FROM THE SESSION'S ONE ACCOUNT READ
// (`reader-state.ts`): the root layout's `AccountPreferencesSync` publishes
// what `me` answered, and every door reads it — no door, and no card, asks
// the server itself.

import { gql } from "@apollo/client";
import { act, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it } from "vitest";

import { fetchMe } from "@/lib/api/auth-api";
import { AccountPreferencesSync } from "@/lib/settings/account-preferences-sync";
import { BottomNav } from "@/lib/ui/bottom-nav";
import type { RegistrationFlow } from "@/lib/signing/registration-flow";
import type { RegistrationProgress } from "@/lib/signing/registration-signer";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { useReaderState } from "./reader-state";
import { createTokenStore } from "./token-store";

const server = startMswServer();

function meAnswering(accountState: "APPLICANT" | "MEMBER", reads: { count: number }) {
  return gqlLink.query("Me", () => {
    reads.count += 1;
    return HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle: "noor",
          displayName: { __typename: "ModeratedText", value: "Noor" },
          actorPubkey: null,
          accountState,
          hasReciprocated: false,
          vouchBackDismissed: false,
          invitedBy: null,
          preferences: { __typename: "UserPreferences", contentFilteringSeverityLevel: null },
        },
      },
    });
  });
}

function signedIn() {
  const store = createTokenStore();
  store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
  return store;
}

function Probe() {
  const { settled, accountState } = useReaderState();
  return <output data-testid="probe">{settled ? (accountState ?? "none") : "unsettled"}</output>;
}

describe("the reader's account state", () => {
  // The token store persists in localStorage: an earlier test's session must
  // not sign in the next one.
  beforeEach(() => window.localStorage.clear());

  it("an_applicants_one_account_read_locks_every_bar_on_the_page", async () => {
    const reads = { count: 0 };
    server.use(meAnswering("APPLICANT", reads));
    renderWithProviders(
      <>
        <AccountPreferencesSync />
        <BottomNav active="feed" signedIn node={{ path: "feed.bottomBar" }} />
        <BottomNav active="profile" signedIn node={{ path: "profile.bottomBar" }} />
        <Probe />
      </>,
      { store: signedIn() },
    );
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("APPLICANT"));
    for (const bar of ["feed", "profile"]) {
      expect(screen.getByTestId(`${bar}.bottomBar.composeSlot`).className).toContain(
        "opacity-[var(--state-disabled)]",
      );
    }
    // Two doors, one read.
    expect(reads.count).toBe(1);
  });

  it("a_members_read_leaves_the_doors_open", async () => {
    server.use(meAnswering("MEMBER", { count: 0 }));
    renderWithProviders(
      <>
        <AccountPreferencesSync />
        <BottomNav active="feed" signedIn node={{ path: "feed.bottomBar" }} />
        <Probe />
      </>,
      { store: signedIn() },
    );
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("MEMBER"));
    expect(screen.getByTestId("feed.bottomBar.composeSlot")).toHaveAttribute("href", "/compose");
  });

  it("an_unanswered_read_settles_with_no_state", async () => {
    server.use(gqlLink.query("Me", () => HttpResponse.error()));
    renderWithProviders(
      <>
        <AccountPreferencesSync />
        <Probe />
      </>,
      { store: signedIn() },
    );
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("none"));
  });

  it("signed_out_settles_with_no_state_and_reads_nothing", async () => {
    const reads = { count: 0 };
    server.use(meAnswering("APPLICANT", reads));
    renderWithProviders(
      <>
        <AccountPreferencesSync />
        <Probe />
      </>,
    );
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("none"));
    expect(reads.count).toBe(0);
  });
});

// A LATER ACCOUNT READ IS FRESHER THAN THE SESSION'S FIRST ONE: an applicant
// let in mid-session finds the doors open as soon as any surface's `me` read
// (the feed's, the profile's) answers member — through the Apollo cache that
// read writes into, never a poll.
describe("a fresher account read", () => {
  beforeEach(() => window.localStorage.clear());

  function meServing(state: { accountState: "APPLICANT" | "MEMBER" }) {
    return gqlLink.query("Me", () =>
      HttpResponse.json({
        data: {
          me: {
            __typename: "User",
            id: "u1",
            handle: "noor",
            displayName: { __typename: "ModeratedText", value: "Noor" },
            actorPubkey: null,
            accountState: state.accountState,
            hasReciprocated: false,
            vouchBackDismissed: false,
            invitedBy: null,
            preferences: { __typename: "UserPreferences", contentFilteringSeverityLevel: null },
          },
        },
      }),
    );
  }

  it("a_later_me_read_saying_member_lifts_the_locks_without_a_reload", async () => {
    const served = { accountState: "APPLICANT" as "APPLICANT" | "MEMBER" };
    server.use(meServing(served));
    const { client } = renderWithProviders(
      <>
        <AccountPreferencesSync />
        <BottomNav active="feed" signedIn node={{ path: "feed.bottomBar" }} />
        <Probe />
      </>,
      { store: signedIn() },
    );
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("APPLICANT"));
    // The applicant is let in; a surface reads `me` again, as the feed and
    // the profile do on their own arrival.
    served.accountState = "MEMBER";
    await act(async () => {
      await fetchMe(client);
    });
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("MEMBER"));
    expect(screen.getByTestId("feed.bottomBar.composeSlot")).toHaveAttribute("href", "/compose");
  });

  it("a_cache_write_that_leaves_the_account_state_alone_never_moves_it", async () => {
    // The landing settled the reader as member; a later write to the same
    // user's entry that does not touch `accountState` (a profile read, a
    // rename) must not hand the stale APPLICANT back.
    let progress: RegistrationProgress | null = { kind: "awaitingLanding" };
    const listeners = new Set<() => void>();
    const flow: RegistrationFlow = {
      progress: () => progress,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      ensureAdvancing: () => {},
      consumeLanded: () => false,
      reset: () => {},
    };
    server.use(meServing({ accountState: "APPLICANT" }));
    const { client } = renderWithProviders(
      <>
        <AccountPreferencesSync />
        <Probe />
      </>,
      { store: signedIn(), flow },
    );
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("APPLICANT"));
    act(() => {
      progress = { kind: "member" };
      for (const listener of listeners) listener();
    });
    expect(screen.getByTestId("probe")).toHaveTextContent("MEMBER");
    act(() => {
      client.cache.writeFragment({
        id: "User:u1",
        fragment: gql`
          fragment RenamedForTest on User {
            handle
          }
        `,
        data: { __typename: "User", handle: "noor_renamed" },
      });
    });
    // A tick for any broadcast the write raised.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByTestId("probe")).toHaveTextContent("MEMBER");
  });
});

// THE LANDING LETS THE READER IN WHERE THEY STAND (ApplicantLanding.md:17):
// the registration loop that saw it settles MEMBER, so the locked doors open
// with no second account read.
describe("the landing", () => {
  it("a_landing_the_loop_watched_settles_the_reader_as_member", async () => {
    let progress: RegistrationProgress | null = { kind: "awaitingLanding" };
    const listeners = new Set<() => void>();
    const flow: RegistrationFlow = {
      progress: () => progress,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      ensureAdvancing: () => {},
      consumeLanded: () => false,
      reset: () => {},
    };
    renderWithProviders(<Probe />, { store: signedIn(), reader: "APPLICANT", flow });
    expect(screen.getByTestId("probe")).toHaveTextContent("APPLICANT");
    act(() => {
      progress = { kind: "member" };
      for (const listener of listeners) listener();
    });
    expect(screen.getByTestId("probe")).toHaveTextContent("MEMBER");
  });
});

describe("the landing never demotes", () => {
  // The subscription only ever lets an applicant in: a member's reader state
  // is never set back by the loop's reports.
  it.each([{ kind: "awaitingApproval" }, { kind: "awaitingLanding" }, { kind: "member" }] as const)(
    "a_members_state_stands_whatever_the_loop_reports ($kind)",
    (report) => {
      let progress: RegistrationProgress | null = null;
      const listeners = new Set<() => void>();
      const flow: RegistrationFlow = {
        progress: () => progress,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        ensureAdvancing: () => {},
        consumeLanded: () => false,
        reset: () => {},
      };
      renderWithProviders(<Probe />, { store: signedIn(), reader: "MEMBER", flow });
      act(() => {
        progress = report as RegistrationProgress;
        for (const listener of listeners) listener();
      });
      expect(screen.getByTestId("probe")).toHaveTextContent("MEMBER");
    },
  );
});
