import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { BodyRegion, sensitiveSignature } from "@/lib/ui/post-media";
import { forgetReveals } from "@/lib/ui2/media/reveal";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { AccountPreferencesSync } from "./account-preferences-sync";
import { accountFilterLevel, setAccountFilterLevel, unveilsSensitive } from "./sensitive-content";

// THE VEIL'S PREDICATE (settings packet §3.1a): veiled = the node is
// sensitive AND the account does not always unveil. `BodyRegion` is the one
// entry every body veil passes through — the feed's card, the detail and its
// pinned clip, the comments sheet — so the predicate is pinned there.

const server = startMswServer();

const MARKED = { attachmentsStatus: "SENSITIVE", moderationStatus: "NORMAL" };

function Surface({ nodeId, testId }: { nodeId: string; testId: string }) {
  return (
    <BodyRegion veiled testId={testId} nodeId={nodeId} signature={sensitiveSignature(MARKED)}>
      <p>{`the body of ${nodeId}`}</p>
    </BodyRegion>
  );
}

beforeEach(() => {
  forgetReveals();
  setAccountFilterLevel(null);
});

describe("the account's sensitive-content threshold", () => {
  it("reads one threshold: 0 unveils, null or 1–10 keeps the veil", () => {
    expect(unveilsSensitive(0)).toBe(true);
    expect(unveilsSensitive(null)).toBe(false);
    expect(unveilsSensitive(undefined)).toBe(false);
    expect(unveilsSensitive(1)).toBe(false);
    expect(unveilsSensitive(10)).toBe(false);
  });

  it("unveil_on_shows_sensitive_content_unveiled_wherever_the_account_reads", () => {
    setAccountFilterLevel(0);
    // Two surfaces that share no tree — a card and a detail — both read the
    // body unveiled, with no tap.
    render(
      <>
        <Surface nodeId="post-1" testId="card" />
        <Surface nodeId="post-2" testId="detail" />
      </>,
    );
    expect(screen.queryByTestId("card-veil")).not.toBeInTheDocument();
    expect(screen.queryByTestId("detail-veil")).not.toBeInTheDocument();
    expect(screen.getByText("the body of post-1")).toBeVisible();
    expect(screen.getByText("the body of post-2")).toBeVisible();
  });

  it("a flip answers every mounted veil at once", () => {
    render(<Surface nodeId="post-1" testId="card" />);
    expect(screen.getByTestId("card-veil")).toBeInTheDocument();
    act(() => setAccountFilterLevel(0));
    expect(screen.queryByTestId("card-veil")).not.toBeInTheDocument();
    act(() => setAccountFilterLevel(null));
    expect(screen.getByTestId("card-veil")).toBeInTheDocument();
  });

  it("unveil_off_keeps_the_veil_until_tapped", () => {
    render(
      <>
        <Surface nodeId="post-1" testId="one" />
        <Surface nodeId="post-2" testId="two" />
      </>,
    );
    expect(screen.getByTestId("one-veil")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("one-veil-reveal"));
    // The session's single reveal is unchanged: it answers that node alone.
    expect(screen.queryByTestId("one-veil")).not.toBeInTheDocument();
    expect(screen.getByTestId("two-veil")).toBeInTheDocument();
  });

  it("a level between 1 and 10 keeps the veil — the gradient is post-MVP", () => {
    setAccountFilterLevel(5);
    render(<Surface nodeId="post-1" testId="card" />);
    expect(screen.getByTestId("card-veil")).toBeInTheDocument();
  });
});

describe("the account's read (me.preferences)", () => {
  function me(level: number | null) {
    return graphql.query("Me", () =>
      HttpResponse.json({
        data: {
          me: {
            __typename: "User",
            id: "u1",
            handle: "sol",
            displayName: { __typename: "ModeratedText", value: "Sol" },
            actorPubkey: "pk",
            accountState: "MEMBER",
            hasReciprocated: true,
            vouchBackDismissed: false,
            invitedBy: null,
            preferences: { __typename: "UserPreferences", contentFilteringSeverityLevel: level },
          },
        },
      }),
    );
  }

  function signedIn() {
    const store = createTokenStore();
    store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
    return store;
  }

  it("a_choice_made_on_another_device_reads_here — the app reads the account, not the device", async () => {
    server.use(me(0));
    renderWithProviders(
      <>
        <AccountPreferencesSync />
        <Surface nodeId="post-1" testId="card" />
      </>,
      { store: signedIn() },
    );
    await waitFor(() => expect(screen.queryByTestId("card-veil")).not.toBeInTheDocument());
    expect(accountFilterLevel()).toBe(0);
    expect(JSON.stringify({ ...window.localStorage })).not.toMatch(/unveil|severity/i);
  });

  it("an account whose level is not 0 reads veiled", async () => {
    server.use(me(3));
    renderWithProviders(
      <>
        <AccountPreferencesSync />
        <Surface nodeId="post-1" testId="card" />
      </>,
      { store: signedIn() },
    );
    await waitFor(() => expect(accountFilterLevel()).toBe(3));
    expect(screen.getByTestId("card-veil")).toBeInTheDocument();
  });

  it("signed_out_reader_sees_the_veil — and forgets the last account's choice", async () => {
    setAccountFilterLevel(0);
    renderWithProviders(
      <>
        <AccountPreferencesSync />
        <Surface nodeId="post-1" testId="card" />
      </>,
    );
    await waitFor(() => expect(screen.getByTestId("card-veil")).toBeInTheDocument());
    expect(accountFilterLevel()).toBeNull();
  });
});
