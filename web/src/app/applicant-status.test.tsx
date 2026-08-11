import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import type { RegistrationProgress } from "@/lib/signing/registration-signer";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeFlow } from "@/test/registration";
import { ApplicantStatus } from "./applicant-status";

const server = startMswServer();

const ID = "0198c9a2-1f6b-7c31-9d70-3a4f5b6c7d8e";

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

  it("shows the landing line once approved", () => {
    renderStatus({ kind: "awaitingLanding" });
    expect(screen.getByTestId("home_landing")).toBeInTheDocument();
  });

  it("prompts a restore when the key lives elsewhere", () => {
    renderStatus({ kind: "awaitingSigningKey" });
    expect(screen.getByTestId("home_restore")).toHaveAttribute("href", "/restore");
  });

  it.each([
    ["rejectedByDevice", { kind: "rejectedByDevice", reason: "bad seal" }, "home_application_rejected"],
    ["refused", { kind: "refused", errors: [] }, "home_application_refused"],
    ["failed", { kind: "failed", cause: new Error("net") }, "home_application_offline"],
  ] as const)("renders the %s alert", (_name, progress, testId) => {
    renderStatus(progress as RegistrationProgress);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it("offers verification with a resend while the email proof is missing", async () => {
    server.use(
      graphql.mutation("ResendVerificationEmail", () =>
        HttpResponse.json({
          data: {
            resendVerificationEmail: { __typename: "ResendVerificationEmailPayload", ok: true },
          },
        }),
      ),
    );
    renderStatus(approval({ keyAttached: true, keyOnDevice: true }));
    expect(screen.getByTestId("home_verify")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("resend_email"), { target: { value: "a@b.c" } });
    fireEvent.click(screen.getByTestId("verify_resend"));
    expect(await screen.findByTestId("verify_resent")).toBeInTheDocument();
  });

  it("offers the ceremony when no key exists anywhere", () => {
    renderStatus(approval());
    expect(screen.getByTestId("home_create_key")).toHaveAttribute("href", "/key");
    expect(screen.queryByTestId("home_restore")).not.toBeInTheDocument();
  });

  it("offers a restore when the key is attached but not on this browser", () => {
    renderStatus(approval({ keyAttached: true }));
    expect(screen.getByTestId("home_restore")).toBeInTheDocument();
    expect(screen.queryByTestId("home_create_key")).not.toBeInTheDocument();
  });

  it("names the foreign key when the browser's key was refused at the attach", () => {
    // keyOnDevice without keyAttached: another account's key sits in the
    // store and the silent repair-attach was refused (ACTOR_KEY_IN_USE).
    renderStatus(approval({ emailVerified: true, keyOnDevice: true }));
    expect(screen.getByTestId("home_key_elsewhere")).toBeInTheDocument();
    expect(screen.getByTestId("home_fresh_key")).toHaveAttribute("href", "/key");
    expect(screen.queryByTestId("home_create_key")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home_waiting")).not.toBeInTheDocument();
  });

  it("shows the dismissible waiting hint once both proofs are in", () => {
    renderStatus(approval({ emailVerified: true, keyAttached: true, keyOnDevice: true }));
    expect(screen.getByTestId("home_waiting")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("home_waiting_dismiss"));
    expect(screen.queryByTestId("home_waiting")).not.toBeInTheDocument();
  });

  it("re-arms with a pasted invite and pokes the loop", async () => {
    server.use(
      graphql.mutation("ApplyWithInvite", () =>
        HttpResponse.json({
          data: {
            applyWithInvite: {
              __typename: "ApplyWithInvitePayload",
              application: { __typename: "Application", id: "app-2" },
              userErrors: [],
            },
          },
        }),
      ),
    );
    const { flow } = fakeFlow();
    renderStatus({ kind: "needsInvite" }, flow);
    fireEvent.change(screen.getByTestId("rearm_input"), {
      target: { value: `https://cogra.example/join/${ID}` },
    });
    fireEvent.click(screen.getByTestId("rearm_submit"));
    await waitFor(() => expect(flow.ensureAdvancing).toHaveBeenCalled());
    expect(screen.getByTestId("rearm_input")).toHaveValue("");
  });

  it("flags a re-arm paste with no invite in it without a network call", () => {
    renderStatus({ kind: "needsInvite" });
    fireEvent.change(screen.getByTestId("rearm_input"), { target: { value: "junk" } });
    fireEvent.click(screen.getByTestId("rearm_submit"));
    expect(screen.getByTestId("rearm_error")).toBeInTheDocument();
  });

  it("surfaces a re-arm refusal for a dead link", async () => {
    server.use(
      graphql.mutation("ApplyWithInvite", () =>
        HttpResponse.json({
          data: {
            applyWithInvite: {
              __typename: "ApplyWithInvitePayload",
              application: null,
              userErrors: [
                { __typename: "UserError", message: "dead", code: "INVITE_UNUSABLE", field: null },
              ],
            },
          },
        }),
      ),
    );
    renderStatus({ kind: "needsInvite" });
    fireEvent.change(screen.getByTestId("rearm_input"), { target: { value: ID } });
    fireEvent.click(screen.getByTestId("rearm_submit"));
    expect(await screen.findByTestId("rearm_error")).toHaveTextContent(/can't be used/);
  });

  it("renders a rate-limited re-arm as a backoff", async () => {
    server.use(
      graphql.mutation("ApplyWithInvite", () =>
        HttpResponse.json({
          errors: [{ message: "too many attempts", extensions: { code: "RATE_LIMITED" } }],
        }),
      ),
    );
    renderStatus({ kind: "needsInvite" });
    fireEvent.change(screen.getByTestId("rearm_input"), { target: { value: ID } });
    fireEvent.click(screen.getByTestId("rearm_submit"));
    expect(await screen.findByTestId("rearm_error")).toHaveTextContent(
      "Too many attempts — wait a moment and try again.",
    );
  });
});
