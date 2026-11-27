// When the intro opens by itself, and what it sets when it does
// (design/designs/canonical/behavior/OnboardingSteps.md:3–5, :29).

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { answerLog } from "@/test/answers";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";

import { FirstIntro, ReplayIntro } from "./intro-gate";

const server = startMswServer();

type Actor = { handle: string; displayName: string };

function actor({ handle, displayName }: Actor) {
  return {
    __typename: "User",
    id: `${handle}-id`,
    handle,
    displayName: { __typename: "ModeratedText", value: displayName },
    avatar: null,
  };
}

const reads = answerLog();
const marks = { n: 0 };

function account({
  seen,
  invitedBy = null,
  approver = null,
}: {
  seen: boolean;
  invitedBy?: Actor | null;
  approver?: Actor | null;
}) {
  server.use(
    gqlLink.query("IntroAccount", () => {
      reads.answer();
      return HttpResponse.json({
        data: {
          me: {
            __typename: "User",
            id: "acct-1",
            preferences: { __typename: "UserPreferences", hasSeenOnboarding: seen },
            invitedBy: invitedBy === null ? null : actor(invitedBy),
            application:
              approver === null
                ? null
                : { __typename: "Application", id: "app-1", approver: actor(approver) },
          },
        },
      });
    }),
    gqlLink.mutation("MarkIntroSeen", () => {
      marks.n += 1;
      return HttpResponse.json({
        data: {
          setPreferences: {
            __typename: "SetPreferencesPayload",
            preferences: { __typename: "UserPreferences", hasSeenOnboarding: true },
            userErrors: [],
          },
        },
      });
    }),
  );
}

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

beforeEach(() => {
  marks.n = 0;
  window.history.replaceState(null, "");
});

afterEach(async () => {
  // An intro closed in place takes its history entries with it on a timer
  // (`stage-history.ts`); that traversal lands before the next test opens.
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 50));
});

describe("FirstIntro", () => {
  it("opens over the feed at the first card while the account's flag is unset", async () => {
    account({ seen: false, invitedBy: { handle: "mira", displayName: "Mira Voss" } });
    renderWithProviders(<FirstIntro />, { store: signedInStore() });
    expect(await screen.findByTestId("intro")).toHaveAttribute("data-card", "steps");
  });

  it("sets the flag the moment it shows, never waiting for Skip or Start reading (:29)", async () => {
    account({ seen: false, invitedBy: { handle: "mira", displayName: "Mira Voss" } });
    renderWithProviders(<FirstIntro />, { store: signedInStore() });
    await screen.findByTestId("intro");
    await vi.waitFor(() => expect(marks.n).toBe(1));
    expect(screen.getByTestId("intro")).toBeInTheDocument();
  });

  it("never opens by itself once the flag is set, on any device (:5)", async () => {
    account({ seen: true, invitedBy: { handle: "mira", displayName: "Mira Voss" } });
    renderWithProviders(<FirstIntro />, { store: signedInStore() });
    await reads.answered();
    expect(screen.queryByTestId("intro")).toBeNull();
    expect(marks.n).toBe(0);
  });

  it("Skip leaves for the feed it opened over", async () => {
    account({ seen: false, invitedBy: { handle: "mira", displayName: "Mira Voss" } });
    renderWithProviders(<FirstIntro />, { store: signedInStore() });
    fireEvent.click(await screen.findByTestId("onboarding.skip"));
    expect(screen.queryByTestId("intro")).toBeNull();
  });

  it("an applicant's fifth card wears their link issuer (OnboardingVouch.md:9)", async () => {
    account({ seen: false, approver: { handle: "tobias", displayName: "Tobias Lindqvist" } });
    renderWithProviders(<FirstIntro />, { store: signedInStore() });
    await screen.findByTestId("intro");
    for (let step = 1; step < 5; step++) fireEvent.click(screen.getByTestId("onboarding.next"));
    expect(screen.getByTestId("onboarding.stage.inviterCaption")).toHaveTextContent("@tobias");
  });
});

describe("ReplayIntro", () => {
  it("opens at the first card whatever the flag, and sets nothing (OnboardingSteps.md:7)", async () => {
    account({ seen: true, invitedBy: { handle: "mira", displayName: "Mira Voss" } });
    let left = 0;
    renderWithProviders(<ReplayIntro onLeave={() => (left += 1)} />, { store: signedInStore() });
    expect(screen.getByTestId("intro")).toHaveAttribute("data-card", "steps");
    await reads.answered();
    for (let step = 1; step < 5; step++) fireEvent.click(screen.getByTestId("onboarding.next"));
    expect(screen.getByTestId("onboarding.stage.inviterCaption")).toHaveTextContent("@mira");
    fireEvent.click(screen.getByTestId("onboarding.next"));
    expect(left).toBe(1);
    expect(marks.n).toBe(0);
  });
});
