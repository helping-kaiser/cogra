import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { useRegistrationProgress } from "@/lib/signing/provider";
import type { AttachFault, RegistrationProgress } from "@/lib/signing/registration-signer";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeCeremony, fakeFlow } from "@/test/registration";
import { ApplicantCardsHead, ApplicantStatus } from "./applicant-status";

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
  attachFault: AttachFault;
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

function renderStatus(progress: RegistrationProgress | null, flow = fakeFlow().flow, ceremony = fakeCeremony()) {
  return renderWithProviders(<ApplicantStatus progress={progress} />, {
    store: signedInStore(),
    flow,
    ceremony,
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
    // The landing card is its title alone while the key is here (seam 314;
    // ApplicantLanding, keyAt = here).
    expect(screen.queryByTestId("feed.application.body")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // ApplicantFeed.jsx: a list that heads with the cards takes them; the
  // stack's status lines stay where the stack is rendered.
  it("renders_the_cards_into_the_head_a_list_provides", async () => {
    const head = document.createElement("li");
    document.body.append(head);
    const placed = (progress: RegistrationProgress | null) =>
      renderWithProviders(
        <ApplicantCardsHead.Provider value={head}>
          <div data-testid="stack-place">
            <ApplicantStatus progress={progress} />
          </div>
        </ApplicantCardsHead.Provider>,
        { store: signedInStore(), flow: fakeFlow().flow, ceremony: fakeCeremony() },
      );
    const { unmount } = placed(approval({ keyOnDevice: true, keyAttached: true }));
    expect(head).toContainElement(screen.getByTestId("feed.verifyCard"));
    expect(screen.getByTestId("stack-place")).toBeEmptyDOMElement();
    unmount();

    placed(null);
    expect(screen.getByTestId("stack-place")).toContainElement(screen.getByTestId("home_status_loading"));
    expect(head).toBeEmptyDOMElement();
    head.remove();
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
    // No body under the title (seam 314; ApplicantFeed draws none).
    expect(screen.queryByTestId("feed.verifyCard.body")).toBeNull();
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
    renderStatus(approval({ emailVerified: true, keyOnDevice: true, attachFault: "keyInUse" }));
    expect(screen.getByTestId("home_key_elsewhere")).toBeInTheDocument();
    expect(screen.getByTestId("home_fresh_key")).toHaveAttribute("href", "/key");
    expect(screen.queryByTestId("feed.keyCard.create")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feed.application")).not.toBeInTheDocument();
  });

  // ApplicantFeed.md:19-21, 37-39 (round 66) — the applicant's own key, on
  // this browser, did not reach the application: `Attach your key`, the
  // house line and Retry in `Create my key`'s place; never a fresh key, never
  // "another account".
  describe("the key that did not attach", () => {
    const failed = () => approval({ emailVerified: true, keyOnDevice: true, attachFault: "failed" });

    it("reads_attach_your_key_with_the_fault_line_and_retry_in_create_my_keys_place", () => {
      renderStatus(failed());
      expect(screen.getByTestId("feed.keyCard.title")).toHaveTextContent("Attach your key");
      expect(screen.getByTestId("feed.keyCard.body")).toHaveTextContent(
        "Your key is on this browser. It hasn't reached your application yet.",
      );
      const fault = screen.getByTestId("feed.keyCard.attachFault");
      expect(fault).toHaveAttribute("data-testid-key", "attach");
      expect(fault).toHaveAttribute("role", "alert");
      expect(fault).toHaveTextContent("That didn't go through. Retry");
      expect(screen.queryByTestId("feed.keyCard.create")).toBeNull();
      expect(screen.queryByTestId("home_key_elsewhere")).toBeNull();
      expect(screen.queryByTestId("home_fresh_key")).toBeNull();
      expect(document.body).not.toHaveTextContent(/another account|fresh key/i);
    });

    it("retry_attaches_the_same_key_again_and_polls_now", async () => {
      const { flow } = fakeFlow();
      const ceremony = fakeCeremony();
      renderStatus(failed(), flow, ceremony);
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(flow.ensureAdvancing).toHaveBeenCalledTimes(1));
      expect(ceremony.attachActorKey).toHaveBeenCalledTimes(1);
      expect(ceremony.createActorKey).not.toHaveBeenCalled();
      // it went through: the fault line leaves; the card leaves with the pass
      expect(screen.queryByTestId("feed.keyCard.attachFault")).toBeNull();
    });

    it("the_card_leaves_once_the_pass_reads_the_key_attached", () => {
      const live = fakeFlow(failed());
      function Live() {
        return <ApplicantStatus progress={useRegistrationProgress()} />;
      }
      renderWithProviders(<Live />, { store: signedInStore(), flow: live.flow, ceremony: fakeCeremony() });
      expect(screen.getByTestId("feed.keyCard")).toBeInTheDocument();
      act(() => live.emit(approval({ emailVerified: true, keyOnDevice: true, keyAttached: true })));
      expect(screen.queryByTestId("feed.keyCard")).toBeNull();
    });

    it("a_retry_that_fails_again_keeps_the_line_and_retry", async () => {
      const ceremony = fakeCeremony({
        attachActorKey: vi.fn(() => Promise.resolve({ kind: "failed" as const, cause: new Error("net") })),
      });
      const { flow } = fakeFlow();
      renderStatus(failed(), flow, ceremony);
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(ceremony.attachActorKey).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).not.toHaveAttribute("aria-busy"));
      expect(screen.getByTestId("feed.keyCard.attachFault")).toHaveTextContent("That didn't go through.");
      expect(flow.ensureAdvancing).not.toHaveBeenCalled();
    });

    it("a_retry_the_server_refuses_as_another_accounts_key_moves_to_that_card", async () => {
      const ceremony = fakeCeremony({
        attachActorKey: vi.fn(() =>
          Promise.resolve({
            kind: "refused" as const,
            errors: [{ message: "in use", code: "ACTOR_KEY_IN_USE" as const, field: null }],
          }),
        ),
      });
      renderStatus(failed(), fakeFlow().flow, ceremony);
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(await screen.findByTestId("home_key_elsewhere")).toBeInTheDocument();
      expect(screen.queryByTestId("feed.keyCard")).toBeNull();
    });

    // nodes.json `ApplicantFeed`, round 66: the one new path, worn at its key.
    it("wears_every_keyCard_path_the_registry_gives_ApplicantFeed_at_attach_but_create", () => {
      const registry = JSON.parse(
        readFileSync(join(process.cwd(), "..", "design", "designs", "canonical", "nodes.json"), "utf8"),
      ) as { screens: Record<string, { nodes: Record<string, string[]> }> };
      const paths = Object.entries(registry.screens.ApplicantFeed!.nodes).filter(([path]) =>
        path.startsWith("feed.keyCard"),
      );
      expect(paths.map(([path]) => path)).toContain("feed.keyCard.attachFault");
      renderStatus(failed());
      for (const [path, keys] of paths) {
        if (path === "feed.keyCard.create") {
          expect(screen.queryByTestId(path)).toBeNull();
          continue;
        }
        const element = screen.getByTestId(path);
        for (const key of keys) expect(element).toHaveAttribute("data-testid-key", key);
      }
    });
  });

  it("stands the application card once both proofs are in (ApplicantWaiting.md:3)", async () => {
    server.use(myApplication({ rejectedAt: null }));
    renderStatus(approval({ emailVerified: true, keyAttached: true, keyOnDevice: true }));
    expect(await screen.findByTestId("feed.application.title")).toHaveTextContent("All set — waiting on @mira");
    fireEvent.click(screen.getByTestId("feed.application.dismiss"));
    expect(screen.queryByTestId("feed.application")).not.toBeInTheDocument();
  });
});
