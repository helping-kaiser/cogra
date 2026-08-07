import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { ResetForm } from "./reset-form";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const server = startMswServer();

const requestOk = graphql.mutation("RequestPasswordReset", () =>
  HttpResponse.json({
    data: { requestPasswordReset: { __typename: "RequestPasswordResetPayload", ok: true } },
  }),
);

const confirmOk = graphql.mutation("ConfirmPasswordReset", () =>
  HttpResponse.json({
    data: {
      confirmPasswordReset: {
        __typename: "ConfirmPasswordResetPayload",
        ok: true,
        userErrors: [],
      },
    },
  }),
);

const confirmRefused = (code: string) =>
  graphql.mutation("ConfirmPasswordReset", () =>
    HttpResponse.json({
      data: {
        confirmPasswordReset: {
          __typename: "ConfirmPasswordResetPayload",
          ok: null,
          userErrors: [
            { __typename: "UserError", code, message: "refused", field: ["resetToken"] },
          ],
        },
      },
    }),
  );

function fillConfirm(token = "token-1", password = "long enough password") {
  fireEvent.change(screen.getByTestId("reset_token"), { target: { value: token } });
  fireEvent.change(screen.getByTestId("reset_password"), { target: { value: password } });
  fireEvent.click(screen.getByTestId("reset_confirm"));
}

beforeEach(() => {
  window.localStorage.clear();
  nav.replace.mockClear();
  nav.search = "";
});

describe("ResetForm", () => {
  it("pre-fills the token from ?token=", () => {
    nav.search = "token=mailed-token";
    renderWithProviders(<ResetForm />);
    expect(screen.getByTestId("reset_token")).toHaveValue("mailed-token");
  });

  it("gates both halves on their inputs", () => {
    renderWithProviders(<ResetForm />);
    expect(screen.getByTestId("reset_request")).toBeDisabled();
    expect(screen.getByTestId("reset_confirm")).toBeDisabled();
    fireEvent.change(screen.getByTestId("reset_email"), { target: { value: "a@b.c" } });
    expect(screen.getByTestId("reset_request")).toBeEnabled();
    fireEvent.change(screen.getByTestId("reset_token"), { target: { value: "t" } });
    fireEvent.change(screen.getByTestId("reset_password"), { target: { value: "p" } });
    expect(screen.getByTestId("reset_confirm")).toBeEnabled();
  });

  it("reports the request as on its way — no account enumeration", async () => {
    server.use(requestOk);
    renderWithProviders(<ResetForm />);
    fireEvent.change(screen.getByTestId("reset_email"), { target: { value: "a@b.c" } });
    fireEvent.click(screen.getByTestId("reset_request"));
    expect(await screen.findByTestId("reset_requested")).toBeInTheDocument();
  });

  it("keeps a request transport failure distinct", async () => {
    server.use(graphql.mutation("RequestPasswordReset", () => HttpResponse.error()));
    renderWithProviders(<ResetForm />);
    fireEvent.change(screen.getByTestId("reset_email"), { target: { value: "a@b.c" } });
    fireEvent.click(screen.getByTestId("reset_request"));
    expect(await screen.findByTestId("reset_transport_error")).toBeInTheDocument();
    expect(screen.queryByTestId("reset_requested")).not.toBeInTheDocument();
  });

  it("routes to login after a confirmed reset — every session was revoked", async () => {
    server.use(confirmOk);
    renderWithProviders(<ResetForm />);
    fillConfirm();
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/login"));
  });

  it("renders the backend's VERIFICATION_TOKEN_INVALID refusal", async () => {
    server.use(confirmRefused("VERIFICATION_TOKEN_INVALID"));
    renderWithProviders(<ResetForm />);
    fillConfirm();
    expect(await screen.findByTestId("reset_error")).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("renders a WEAK_PASSWORD refusal", async () => {
    server.use(confirmRefused("WEAK_PASSWORD"));
    renderWithProviders(<ResetForm />);
    fillConfirm();
    expect(await screen.findByTestId("reset_error")).toBeInTheDocument();
  });

  it("typing clears the refusal but keeps the transport flag", async () => {
    server.use(graphql.mutation("ConfirmPasswordReset", () => HttpResponse.error()));
    renderWithProviders(<ResetForm />);
    fillConfirm();
    await screen.findByTestId("reset_transport_error");
    fireEvent.change(screen.getByTestId("reset_token"), { target: { value: "t2" } });
    expect(screen.getByTestId("reset_transport_error")).toBeInTheDocument();
    expect(screen.queryByTestId("reset_error")).not.toBeInTheDocument();
  });
});
