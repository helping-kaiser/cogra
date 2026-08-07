import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeFlow } from "@/test/registration";
import { VerifyView } from "./verify-view";

const { params } = vi.hoisted(() => ({ params: new Map<string, string>() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (key: string) => params.get(key) ?? null }),
}));

const server = startMswServer();

const verifyOk = graphql.mutation("VerifyEmail", () =>
  HttpResponse.json({
    data: { verifyEmail: { __typename: "VerifyEmailPayload", ok: true, userErrors: [] } },
  }),
);

const verifyInvalid = graphql.mutation("VerifyEmail", () =>
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
  });

  it("verifies the token and pokes the poll loop", async () => {
    server.use(verifyOk);
    const { flow } = fakeFlow();
    renderWithProviders(<VerifyView />, { flow });
    expect(await screen.findByTestId("verify_success")).toBeInTheDocument();
    expect(flow.ensureAdvancing).toHaveBeenCalled();
    expect(screen.getByTestId("verify_continue")).toHaveAttribute("href", "/");
  });

  it("covers the conflated failure and offers the resend", async () => {
    server.use(
      verifyInvalid,
      graphql.mutation("ResendVerificationEmail", () =>
        HttpResponse.json({
          data: {
            resendVerificationEmail: { __typename: "ResendVerificationEmailPayload", ok: true },
          },
        }),
      ),
    );
    renderWithProviders(<VerifyView />);
    expect(await screen.findByTestId("verify_error")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("resend_email"), {
      target: { value: "ada@example.org" },
    });
    fireEvent.click(screen.getByTestId("verify_resend"));
    expect(await screen.findByTestId("verify_resent")).toBeInTheDocument();
  });

  it("treats a missing token as a dead link", () => {
    params.delete("token");
    renderWithProviders(<VerifyView />);
    expect(screen.getByTestId("verify_error")).toBeInTheDocument();
  });

  it("offers a retry on a transport fault, which can then succeed", async () => {
    server.use(graphql.mutation("VerifyEmail", () => HttpResponse.error()));
    renderWithProviders(<VerifyView />);
    expect(await screen.findByTestId("verify_transport_error")).toBeInTheDocument();

    server.use(verifyOk);
    fireEvent.click(screen.getByTestId("verify_retry"));
    await waitFor(() => expect(screen.getByTestId("verify_success")).toBeInTheDocument());
  });
});
