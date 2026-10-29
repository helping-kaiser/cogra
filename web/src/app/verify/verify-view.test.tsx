import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeFlow } from "@/test/registration";
import { VerifyView } from "./verify-view";

const { params } = vi.hoisted(() => ({ params: new Map<string, string>() }));
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (key: string) => params.get(key) ?? null }),
  useRouter: () => ({ replace }),
}));

const server = startMswServer();

const verifyOk = gqlLink.mutation("VerifyEmail", () =>
  HttpResponse.json({
    data: { verifyEmail: { __typename: "VerifyEmailPayload", ok: true, userErrors: [] } },
  }),
);

const verifyInvalid = gqlLink.mutation("VerifyEmail", () =>
  HttpResponse.json({
    data: {
      verifyEmail: {
        __typename: "VerifyEmailPayload",
        ok: false,
        userErrors: [
          {
            __typename: "UserError",
            message: "invalid",
            code: "VERIFICATION_TOKEN_INVALID",
            field: null,
          },
        ],
      },
    },
  }),
);

describe("VerifyView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    params.clear();
    params.set("token", "token-1");
    replace.mockClear();
  });

  it("verifies the token and pokes the poll loop", async () => {
    server.use(verifyOk);
    const { flow } = fakeFlow();
    renderWithProviders(<VerifyView />, { flow });
    expect(await screen.findByTestId("verify_success")).toBeInTheDocument();
    expect(flow.ensureAdvancing).toHaveBeenCalled();
    // Verified.md: the heading and line, and Back to CoGra — the sign-in without a session.
    expect(screen.getByTestId("verify_success")).toHaveTextContent("Email verified");
    expect(
      screen.getByText("Your application moved a step. You can go back to the app — it already knows."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to CoGra" }));
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("covers the conflated failure and offers the resend", async () => {
    server.use(
      verifyInvalid,
      gqlLink.mutation("ResendVerificationEmail", () =>
        HttpResponse.json({
          data: {
            resendVerificationEmail: { __typename: "ResendVerificationEmailPayload", ok: true },
          },
        }),
      ),
    );
    renderWithProviders(<VerifyView />);
    expect(await screen.findByTestId("verify.title")).toHaveTextContent("This link doesn't work anymore");
    expect(screen.getByTestId("verify.body")).toHaveTextContent(
      "It may have expired or already been used. Send yourself a fresh one — if your account is still waiting on its email, the new link picks it back up.",
    );
    // VerifyExpired.md: without a session the first press opens the field and sends nothing.
    expect(screen.queryByTestId("resend_email")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("verify.resend"));
    expect(screen.getByTestId("resend_email")).toBeInTheDocument();
    expect(screen.queryByTestId("verify_resent")).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId("resend_email"), {
      target: { value: "ada@example.org" },
    });
    fireEvent.click(screen.getByTestId("verify.resend"));
    expect(await screen.findByTestId("verify_resent")).toHaveTextContent(
      "If that address has an account still waiting on its email, a fresh link is on its way.",
    );
    expect(screen.getByTestId("verify.onward")).toHaveTextContent("Sign in");
    fireEvent.click(screen.getByTestId("verify.onward"));
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("renders a rate-limited verify as a backoff — not an invalid link, not connectivity", async () => {
    server.use(
      gqlLink.mutation("VerifyEmail", () =>
        HttpResponse.json({
          errors: [{ message: "too many attempts", extensions: { code: "RATE_LIMITED" } }],
        }),
      ),
    );
    renderWithProviders(<VerifyView />);
    expect(await screen.findByTestId("verify_rate_limited")).toHaveTextContent(
      "Too many tries. Wait a little, then try again.",
    );
    expect(screen.queryByTestId("verify.title")).not.toBeInTheDocument();
    expect(screen.queryByTestId("verify_transport_error")).not.toBeInTheDocument();
    // The token may still be good — the retry stays available.
    expect(screen.getByTestId("verify_retry")).toBeInTheDocument();
  });

  // A dev double-invoke re-runs the effect without a second request; the one
  // answer must still land (it stood on Verifying… for ever).
  it("the_one_answer_lands_under_strict_mode", async () => {
    server.use(verifyInvalid);
    renderWithProviders(
      <StrictMode>
        <VerifyView />
      </StrictMode>,
    );
    expect(await screen.findByTestId("verify.title")).toHaveTextContent("This link doesn't work anymore");
  });

  it("treats a missing token as a dead link", () => {
    params.delete("token");
    renderWithProviders(<VerifyView />);
    expect(screen.getByTestId("verify.title")).toBeInTheDocument();
  });

  it("offers a retry on a transport fault, which can then succeed", async () => {
    server.use(gqlLink.mutation("VerifyEmail", () => HttpResponse.error()));
    renderWithProviders(<VerifyView />);
    expect(await screen.findByTestId("verify_transport_error")).toBeInTheDocument();

    server.use(verifyOk);
    fireEvent.click(screen.getByTestId("verify_retry"));
    await waitFor(() => expect(screen.getByTestId("verify_success")).toBeInTheDocument());
  });

  // VerifyExpired.md, given a session: the account's own address, the feed as the way on.
  it("given_a_session_the_resend_goes_to_the_accounts_address_and_the_way_on_is_the_feed", async () => {
    let sentTo: unknown = null;
    server.use(
      verifyInvalid,
      gqlLink.query("SettingsAccount", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "u1",
              handle: "noor",
              email: "noor@fieldmail.org",
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
      ),
      gqlLink.mutation("ResendVerificationEmail", ({ variables }) => {
        sentTo = variables;
        return HttpResponse.json({
          data: { resendVerificationEmail: { __typename: "ResendVerificationEmailPayload", ok: true } },
        });
      }),
    );
    const store = createTokenStore();
    store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
    renderWithProviders(<VerifyView />, { store });
    expect(await screen.findByTestId("verify.onward")).toHaveTextContent("Go to the feed");
    fireEvent.click(screen.getByTestId("verify.resend"));
    expect(screen.queryByTestId("resend_email")).not.toBeInTheDocument();
    expect(await screen.findByTestId("verify_resent")).toHaveTextContent(
      "If your account is still waiting on its email, a fresh link is on its way to noor@fieldmail.org.",
    );
    expect(JSON.stringify(sentTo)).toContain("noor@fieldmail.org");
  });

  it("a_resend_without_an_answer_says_so_above_the_pair", async () => {
    server.use(verifyInvalid, gqlLink.mutation("ResendVerificationEmail", () => HttpResponse.error()));
    renderWithProviders(<VerifyView />);
    fireEvent.click(await screen.findByTestId("verify.resend"));
    fireEvent.change(screen.getByTestId("resend_email"), { target: { value: "a@b.c" } });
    fireEvent.click(screen.getByTestId("verify.resend"));
    expect(await screen.findByRole("alert")).toHaveTextContent("That didn't send. Try again.");
    expect(screen.queryByTestId("verify_resent")).not.toBeInTheDocument();
  });
});
