import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LogInMutationVariables } from "@/__generated__/graphql";
import { createSecurityNotices } from "@/lib/session/security-notices";
import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { LoginForm } from "./login-form";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const server = startMswServer();

const loginSuccess = (capture?: (variables: LogInMutationVariables) => void) =>
  loginSuccessWithNotice(null, capture);

const loginSuccessWithNotice = (
  reuseDetectedAt: string | null,
  capture?: (variables: LogInMutationVariables) => void,
) =>
  graphql.mutation("LogIn", ({ variables }) => {
    capture?.(variables as LogInMutationVariables);
    return HttpResponse.json({
      data: {
        logIn: {
          __typename: "LogInPayload",
          auth: {
            __typename: "AuthSession",
            accessToken: "access-1",
            refreshToken: "refresh-1",
            user: { __typename: "User", id: "acct-1" },
          },
          reuseDetectedAt,
          userErrors: [],
        },
      },
    });
  });

const loginRefused = graphql.mutation("LogIn", () =>
  HttpResponse.json({
    data: {
      logIn: {
        __typename: "LogInPayload",
        auth: null,
        reuseDetectedAt: null,
        userErrors: [
          {
            __typename: "UserError",
            code: "INVALID_CREDENTIALS",
            message: "email / password pair did not match",
            field: null,
          },
        ],
      },
    },
  }),
);

function fillAndSubmit(email = "user@example.com", password = "correct horse battery") {
  fireEvent.change(screen.getByTestId("login_email"), { target: { value: email } });
  fireEvent.change(screen.getByTestId("login_password"), { target: { value: password } });
  fireEvent.click(screen.getByTestId("login_submit"));
}

beforeEach(() => {
  window.localStorage.clear();
  replace.mockClear();
});

describe("LoginForm", () => {
  it("gates submit on both fields", () => {
    renderWithProviders(<LoginForm />);
    const submit = screen.getByTestId("login_submit");
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByTestId("login_email"), { target: { value: "a@b.c" } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByTestId("login_password"), { target: { value: "p" } });
    expect(submit).toBeEnabled();
  });

  it("saves the session on success; the phase flip navigates home", async () => {
    let seen: LogInMutationVariables | undefined;
    server.use(loginSuccess((variables) => (seen = variables)));
    const { store } = renderWithProviders(<LoginForm />);
    fillAndSubmit("  user@example.com  ");
    await waitFor(() => expect(store.hasSession()).toBe(true));
    expect(store.accessToken()).toBe("access-1");
    expect(store.activeAccountId()).toBe("acct-1");
    expect(seen?.input.email).toBe("user@example.com");
    expect(seen?.input.deviceLabel).toEqual(expect.any(String));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("posts a delivered reuse notice to the store before navigating", async () => {
    server.use(loginSuccessWithNotice("2026-08-10T09:30:00Z"));
    const notices = createSecurityNotices();
    const { store } = renderWithProviders(<LoginForm notices={notices} />);
    fillAndSubmit();
    await waitFor(() => expect(store.hasSession()).toBe(true));
    expect(notices.reuseDetectedAt()).toBe("2026-08-10T09:30:00Z");
  });

  it("posts nothing on a clean login", async () => {
    server.use(loginSuccess());
    const notices = createSecurityNotices();
    const { store } = renderWithProviders(<LoginForm notices={notices} />);
    fillAndSubmit();
    await waitFor(() => expect(store.hasSession()).toBe(true));
    expect(notices.reuseDetectedAt()).toBeNull();
  });

  it("flags the account ephemeral when don't-remember is checked", async () => {
    server.use(loginSuccess());
    const identity = fakeIdentityStore();
    const setEphemeral = vi.spyOn(identity, "setEphemeral");
    renderWithProviders(<LoginForm identity={identity} />);
    // The checkbox is reachable by its label (web.md § Accessibility).
    fireEvent.click(screen.getByLabelText(/don't remember this account/i));
    fillAndSubmit();
    await waitFor(() => expect(setEphemeral).toHaveBeenCalledWith(true));
  });

  it("clears any earlier ephemeral flag on a default login", async () => {
    server.use(loginSuccess());
    const identity = fakeIdentityStore({ ephemeral: true });
    const setEphemeral = vi.spyOn(identity, "setEphemeral");
    renderWithProviders(<LoginForm identity={identity} />);
    fillAndSubmit();
    await waitFor(() => expect(setEphemeral).toHaveBeenCalledWith(false));
  });

  it("leaves custody untouched on a refused login", async () => {
    server.use(loginRefused);
    const identity = fakeIdentityStore();
    const setEphemeral = vi.spyOn(identity, "setEphemeral");
    renderWithProviders(<LoginForm identity={identity} />);
    fillAndSubmit();
    await screen.findByTestId("login_error");
    expect(setEphemeral).not.toHaveBeenCalled();
  });

  it("renders a refusal distinctly from a transport failure", async () => {
    server.use(loginRefused);
    renderWithProviders(<LoginForm />);
    fillAndSubmit();
    expect(await screen.findByTestId("login_error")).toBeInTheDocument();
    expect(screen.queryByTestId("login_transport_error")).not.toBeInTheDocument();
  });

  it("clears the refusal when the user types again", async () => {
    server.use(loginRefused);
    renderWithProviders(<LoginForm />);
    fillAndSubmit();
    await screen.findByTestId("login_error");
    fireEvent.change(screen.getByTestId("login_email"), { target: { value: "b@c.d" } });
    expect(screen.queryByTestId("login_error")).not.toBeInTheDocument();
  });

  it("keeps transport failures in their own slot", async () => {
    server.use(graphql.mutation("LogIn", () => HttpResponse.error()));
    renderWithProviders(<LoginForm />);
    fillAndSubmit();
    expect(await screen.findByTestId("login_transport_error")).toBeInTheDocument();
    expect(screen.queryByTestId("login_error")).not.toBeInTheDocument();
  });

  it("renders an errors-array rate limit as a backoff, not a connectivity failure", async () => {
    // The backend rate-limits logIn on the transport tier; the outcome
    // layer synthesizes it into a refusal so this copy is reachable.
    server.use(
      graphql.mutation("LogIn", () =>
        HttpResponse.json({
          errors: [{ message: "too many attempts", extensions: { code: "RATE_LIMITED" } }],
        }),
      ),
    );
    renderWithProviders(<LoginForm />);
    fillAndSubmit();
    expect(await screen.findByTestId("login_error")).toHaveTextContent(
      "Too many attempts — wait a moment and try again.",
    );
    expect(screen.queryByTestId("login_transport_error")).not.toBeInTheDocument();
  });

  it("offers the Android app as a download from the served APK path", () => {
    renderWithProviders(<LoginForm />);
    const link = screen.getByTestId("login_android_apk");
    expect(link).toHaveAttribute("href", "/downloads/app-debug.apk");
    // `download` keeps the browser from trying to render the binary.
    expect(link).toHaveAttribute("download");
  });

  it("redirects an already-signed-in visit home", async () => {
    const store = createTokenStore();
    store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
    renderWithProviders(<LoginForm />, { store });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});
