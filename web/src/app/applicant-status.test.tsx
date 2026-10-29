import { fireEvent, screen } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import type { RegistrationProgress } from "@/lib/signing/registration-signer";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeFlow } from "@/test/registration";
import { ApplicantStatus } from "./applicant-status";

const server = startMswServer();

function myApplication(fields: { rejectedAt: string | null }) {
  return gqlLink.query("MyApplication", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          askLink: "5d9e7a41-b062-4c38-8e5f-1a4703cbd926",
          application: {
            __typename: "Application",
            id: "a1",
            approvedAt: null,
            landedAt: null,
            ...fields,
            approver: { __typename: "User", id: "u9", handle: "mira" },
          },
        },
      },
    }),
  );
}

function accountWithEmail(email: string) {
  return gqlLink.query("SettingsAccount", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle: "noor",
          email,
          emailVerified: false,
          accountState: "APPLICANT",
          actorPubkey: null,
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

function approval(overrides: Partial<{
  emailVerified: boolean;
  keyAttached: boolean;
  keyOnDevice: boolean;
}> = {}): RegistrationProgress {
  return {
    kind: "awaitingApproval",
    emailVerified: false,
    keyAttached: false,
    keyOnDevice: false,
    ...overrides,
  };
}

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function renderStatus(progress: RegistrationProgress | null, flow = fakeFlow().flow) {
  return renderWithProviders(<ApplicantStatus progress={progress} />, {
    store: signedInStore(),
    flow,
  });
}

describe("ApplicantStatus", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows a loading line before the first pass", () => {
    renderStatus(null);
    expect(screen.getByTestId("home_status_loading")).toBeInTheDocument();
  });

  // ApplicantLanding.md: the landing card, titled, naming the approver, no control.
  it("the_landing_card_stands_once_approved_and_carries_no_control", async () => {
    server.use(myApplication({ rejectedAt: null }));
    renderStatus({ kind: "awaitingLanding" });
    expect(await screen.findByTestId("feed.application.title")).toHaveTextContent(
      "Approved — your registration is landing",
    );
    expect(screen.getByTestId("feed.application.body")).toHaveTextContent(
      "@mira approved your application. Nothing is needed from you while it lands.",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("leaves the restore prompt to the screen's collapsing top", () => {
    // The keyless read from the identity store renders the card in
    // the header region (feed-view/profile-view), not in this stack.
    renderStatus({ kind: "awaitingSigningKey" });
    expect(screen.queryByTestId("home_restore")).not.toBeInTheDocument();
  });

  it.each([
    ["rejectedByDevice", { kind: "rejectedByDevice", reason: "bad seal" }, "home_application_rejected"],
    ["refused", { kind: "refused", errors: [] }, "home_application_refused"],
    ["failed", { kind: "failed", cause: new Error("net") }, "home_application_offline"],
  ] as const)("renders the %s alert", (_name, progress, testId) => {
    renderStatus(progress as RegistrationProgress);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  // ApplicantFeed.md: the verify card prints the address, beside Wrong address?
  it("the_verify_card_prints_the_address_and_resends_to_it_with_the_sent_snackbar", async () => {
    let sentTo: unknown = null;
    server.use(
      accountWithEmail("noor@fieldmail.org"),
      gqlLink.mutation("ResendVerificationEmail", ({ variables }) => {
        sentTo = variables;
        return HttpResponse.json({
          data: {
            resendVerificationEmail: { __typename: "ResendVerificationEmailPayload", ok: true },
          },
        });
      }),
    );
    renderStatus(approval({ keyAttached: true, keyOnDevice: true }));
    expect(screen.getByTestId("feed.verifyCard.title")).toHaveTextContent("Verify your email");
    expect(screen.getByTestId("feed.verifyCard.body")).toHaveTextContent(
      "We sent you a verification link — open it to prove this email is yours.",
    );
    expect(await screen.findByText("Sent to noor@fieldmail.org")).toBeInTheDocument();
    expect(screen.getByTestId("feed.verifyCard.wrongAddress")).toHaveAttribute("href", "/settings/email/applicant");
    expect(screen.getByTestId("feed.verifyCard.note")).toHaveTextContent(
      "An account left unverified for seven days is removed — joining again then starts over.",
    );
    fireEvent.click(screen.getByTestId("feed.verifyCard.resend"));
    expect(await screen.findByText("Sent — the link is on its way to noor@fieldmail.org.")).toBeInTheDocument();
    expect(JSON.stringify(sentTo)).toContain("noor@fieldmail.org");
    expect(screen.getByTestId("feed.verifyCard")).toBeInTheDocument();
  });

  it("a_resend_without_an_answer_says_the_network_error", async () => {
    server.use(
      accountWithEmail("noor@fieldmail.org"),
      gqlLink.mutation("ResendVerificationEmail", () => HttpResponse.error()),
    );
    renderStatus(approval({ keyAttached: true, keyOnDevice: true }));
    await screen.findByText("Sent to noor@fieldmail.org");
    fireEvent.click(screen.getByTestId("feed.verifyCard.resend"));
    expect(await screen.findByText("That didn't send. Try again.")).toBeInTheDocument();
  });

  it("offers the ceremony when no key exists anywhere", async () => {
    server.use(myApplication({ rejectedAt: null }));
    renderStatus(approval());
    expect(await screen.findByTestId("feed.keyCard.create")).toHaveAttribute("href", "/key");
    expect(screen.getByTestId("feed.keyCard.create")).toHaveTextContent("Create my key");
    expect(screen.getByTestId("feed.keyCard.title")).toHaveTextContent("Create your key");
    expect(screen.getByTestId("feed.keyCard.body")).toHaveTextContent(
      "Your application needs a key on this browser before @mira can approve it.",
    );
    expect(screen.queryByTestId("home_restore")).not.toBeInTheDocument();
  });

  it("leaves the attached-elsewhere restore to the collapsing top", () => {
    renderStatus(approval({ keyAttached: true }));
    expect(screen.queryByTestId("home_restore")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feed.keyCard.create")).not.toBeInTheDocument();
  });

  it("names the foreign key when the browser's key was refused at the attach", () => {
    // keyOnDevice without keyAttached: another account's key sits in the
    // store and the silent repair-attach was refused (ACTOR_KEY_IN_USE).
    renderStatus(approval({ emailVerified: true, keyOnDevice: true }));
    expect(screen.getByTestId("home_key_elsewhere")).toBeInTheDocument();
    expect(screen.getByTestId("home_fresh_key")).toHaveAttribute("href", "/key");
    expect(screen.queryByTestId("feed.keyCard.create")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feed.application")).not.toBeInTheDocument();
  });

  it("stands the application card once both proofs are in (ApplicantWaiting.md:3)", async () => {
    server.use(myApplication({ rejectedAt: null }));
    renderStatus(approval({ emailVerified: true, keyAttached: true, keyOnDevice: true }));
    expect(await screen.findByTestId("feed.application.title")).toHaveTextContent("All set — waiting on @mira");
    fireEvent.click(screen.getByTestId("feed.application.dismiss"));
    expect(screen.queryByTestId("feed.application")).not.toBeInTheDocument();
  });
});
