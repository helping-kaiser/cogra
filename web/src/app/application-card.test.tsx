// The applicant's own application card: behavior/ApplicantWaiting.md,
// ApplicantRejected.md and ProfileApplicant.md, the card's lines.

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { ApplicationCard } from "./application-card";

const server = startMswServer();
const ASK = "5d9e7a41-b062-4c38-8e5f-1a4703cbd926";

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function mine(fields: { approvedAt?: string | null; rejectedAt?: string | null; approver?: string }) {
  server.use(
    gqlLink.query("MyApplication", () =>
      HttpResponse.json({
        data: {
          me: {
            __typename: "User",
            id: "u1",
            askLink: ASK,
            application: {
              __typename: "Application",
              id: "a1",
              approvedAt: fields.approvedAt ?? null,
              rejectedAt: fields.rejectedAt ?? null,
              landedAt: null,
              approver: { __typename: "User", id: "u9", handle: fields.approver ?? "mira" },
            },
          },
        },
      }),
    ),
  );
}

function show(surface: "feed" | "profile", stepsDone = true) {
  return renderWithProviders(<ApplicationCard surface={surface} stepsDone={stepsDone} />, {
    store: signedInStore(),
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("the waiting card (behavior/ApplicantWaiting.md)", () => {
  it(":3-:11 stands once every step is done, names the member whose approval is in play, holds the ask link whole", async () => {
    mine({});
    show("feed");
    expect(await screen.findByTestId("feed.application.title")).toHaveTextContent("All set — waiting on @mira");
    const card = screen.getByTestId("feed.application");
    expect(card.textContent).not.toMatch(/inviter/i);
    expect(card.textContent).not.toMatch(/\d+ (days|hours)|expires/i);
    expect(screen.getByTestId("feed.application.link.label")).toHaveTextContent("Your ask link");
    expect(screen.getByTestId("feed.application.link.address")).toHaveTextContent(
      `${window.location.origin}/vouch/${ASK}`,
    );
    expect(screen.getByTestId("feed.application.link.caption")).toHaveTextContent("It does not expire.");
  });

  it(":3 does not stand while a step is still owed", async () => {
    mine({});
    show("feed", false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId("feed.application")).not.toBeInTheDocument();
  });

  it(":13 Copy your ask link lands it on the clipboard with Link copied", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    mine({});
    show("feed");
    fireEvent.click(await screen.findByTestId("feed.application.link.copy"));
    expect(screen.getByTestId("feed.application.link.copy")).toHaveAccessibleName("Copy your ask link");
    expect(await screen.findByTestId("feed-application-snackbar")).toHaveTextContent("Link copied");
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/vouch/${ASK}`);
  });

  it(":15 Got it puts the card away on this device, and it stays away", async () => {
    mine({});
    const first = show("feed");
    fireEvent.click(await screen.findByTestId("feed.application.dismiss"));
    expect(screen.queryByTestId("feed.application")).not.toBeInTheDocument();
    first.unmount();
    show("feed");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId("feed.application")).not.toBeInTheDocument();
  });

  it(":17 an approved application is the landing card's, not this one", async () => {
    mine({ approvedAt: "2026-09-15T12:00:00Z" });
    show("feed");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId("feed.application")).not.toBeInTheDocument();
  });
});

describe("the closed card (behavior/ApplicantRejected.md)", () => {
  it(":3-:9 titled by the member who closed it, no way to put it away, the ask link labelled by what to do", async () => {
    mine({ rejectedAt: "2026-09-15T12:00:00Z", approver: "kel" });
    show("feed", false);
    expect(await screen.findByTestId("feed.application.title")).toHaveTextContent("@kel closed your application");
    expect(screen.getByTestId("feed.application.body")).toHaveTextContent(
      "That was @kel's call, and it is the only thing it decides. Your account stays exactly as it is, you can keep reading, and any member you know can vouch you in instead.",
    );
    expect(screen.queryByTestId("feed.application.dismiss")).not.toBeInTheDocument();
    expect(screen.getByTestId("feed.application.link.label")).toHaveTextContent(
      "Ask someone you know to vouch for you",
    );
    expect(screen.getByTestId("feed.application.link.caption")).toHaveTextContent(
      "Send it to anyone who is already in. It does not expire, and it works however many people you send it to.",
    );
  });

  it(":17 flips in place when the read moves", async () => {
    let closed = false;
    server.use(
      gqlLink.query("MyApplication", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "u1",
              askLink: ASK,
              application: {
                __typename: "Application",
                id: "a1",
                approvedAt: null,
                rejectedAt: closed ? "2026-09-15T12:00:00Z" : null,
                landedAt: null,
                approver: { __typename: "User", id: "u9", handle: "kel" },
              },
            },
          },
        }),
      ),
    );
    function Host() {
      const [key, setKey] = useState(1);
      return (
        <>
          <button type="button" data-testid="bump" onClick={() => setKey((k) => k + 1)} />
          <ApplicationCard surface="feed" refreshKey={key} />
        </>
      );
    }
    renderWithProviders(<Host />, { store: signedInStore() });
    expect(await screen.findByTestId("feed.application.title")).toHaveTextContent("All set — waiting on @kel");
    closed = true;
    fireEvent.click(screen.getByTestId("bump"));
    await waitFor(() =>
      expect(screen.getByTestId("feed.application.title")).toHaveTextContent("@kel closed your application"),
    );
  });
});

describe("the profile's card (behavior/ProfileApplicant.md)", () => {
  it(":5-:9 Waiting on, its line, the ask link with its caption, never put away", async () => {
    mine({});
    show("profile", false);
    expect(await screen.findByTestId("profile.application.title")).toHaveTextContent("Waiting on @mira");
    expect(screen.getByTestId("profile.application.body")).toHaveTextContent(
      "Their approval brings you in. Until then, you can read everything.",
    );
    expect(screen.getByTestId("profile.application.link.label")).toHaveTextContent("Your ask link");
    expect(screen.getByTestId("profile.application.link.caption")).toHaveTextContent(
      "It does not expire. Anyone who holds your ask can let you in — the first vouch lands it.",
    );
    expect(screen.queryByTestId("profile.application.dismiss")).not.toBeInTheDocument();
  });

  it(":11-:13 once closed, the olive card in the closed words", async () => {
    mine({ rejectedAt: "2026-09-15T12:00:00Z" });
    show("profile");
    expect(await screen.findByTestId("profile.application.title")).toHaveTextContent(
      "@mira closed your application",
    );
    expect(screen.getByTestId("profile.application").getAttribute("style")).toContain("tertiary-container");
  });
});
