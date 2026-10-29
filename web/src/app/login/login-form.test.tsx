import { fireEvent, screen, waitFor } from "@testing-library/react";
import { delay } from "msw/utils/delay";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LogInMutationVariables } from "@/__generated__/graphql";
import type { DeviceLockEngine } from "@/lib/identity/device-lock";
import { createSecurityNotices } from "@/lib/session/security-notices";
import { createTokenStore } from "@/lib/session/token-store";
import { fakeIdentityStore } from "@/test/identity";
import { gqlLink, startMswServer } from "@/test/msw";
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
  gqlLink.mutation("LogIn", ({ variables }) => {
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

const loginRefused = gqlLink.mutation("LogIn", () =>
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

/**
 * The device lock's sign-in leg, scripted per press: each entry answers one
 * press in turn (the last repeats). The engine itself is covered by
 * `device-lock.test.ts`; here only what the form does with its answer.
 */
function fakeLeg(
  answers: { ready: boolean; lockLost: boolean }[] = [{ ready: true, lockLost: false }],
  during?: () => void,
): DeviceLockEngine {
  let press = 0;
  const unused = () => Promise.reject(new Error("not part of the sign-in leg"));
  return {
    signIn: vi.fn(async () => {
      during?.();
      return answers[Math.min(press++, answers.length - 1)]!;
    }),
    ensureHeld: unused,
    discard: unused,
    lock: unused,
    endLocalSession: unused,
    unlock: unused,
    recover: unused,
  };
}

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
    renderWithProviders(<LoginForm identity={identity} deviceLock={fakeLeg()} />);
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

  it("a refusal stands while typing, until the next press of Sign in", async () => {
    server.use(loginRefused);
    renderWithProviders(<LoginForm />);
    fillAndSubmit();
    await screen.findByTestId("login_error");
    fireEvent.change(screen.getByTestId("login_email"), { target: { value: "b@c.d" } });
    // SignInError.md: typing in either field never takes the line away.
    expect(screen.getByTestId("login_error")).toHaveTextContent("That email and password don't match.");
    expect(screen.getByTestId("login_email")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByTestId("login_password")).not.toHaveAttribute("aria-invalid");
  });

  it("keeps transport failures in their own slot", async () => {
    server.use(gqlLink.mutation("LogIn", () => HttpResponse.error()));
    renderWithProviders(<LoginForm />);
    fillAndSubmit();
    expect(await screen.findByTestId("login_transport_error")).toBeInTheDocument();
    expect(screen.queryByTestId("login_error")).not.toBeInTheDocument();
  });

  it("renders an errors-array rate limit as a backoff, not a connectivity failure", async () => {
    // The backend rate-limits logIn on the transport tier; the outcome
    // layer synthesizes it into a refusal so this copy is reachable.
    server.use(
      gqlLink.mutation("LogIn", () =>
        HttpResponse.json({
          errors: [{ message: "too many attempts", extensions: { code: "RATE_LIMITED" } }],
        }),
      ),
    );
    renderWithProviders(<LoginForm />);
    fillAndSubmit();
    expect(await screen.findByTestId("login_error")).toHaveTextContent(
      "Too many tries in a row. Wait a moment, then try again.",
    );
    expect(screen.queryByTestId("login_transport_error")).not.toBeInTheDocument();
  });

  describe("the device lock's leg (sign-out-custody §3.5)", () => {
    it("sign_in_with_current_credentials_unlocks_before_the_shell_renders", async () => {
      server.use(loginSuccess());
      const store = createTokenStore();
      const sessionDuringLeg: boolean[] = [];
      const leg = fakeLeg(undefined, () => sessionDuringLeg.push(store.hasSession()));
      renderWithProviders(<LoginForm deviceLock={leg} />, { store });
      fillAndSubmit();
      await waitFor(() => expect(store.hasSession()).toBe(true));
      // The leg ran with the fresh session in hand and NOT committed.
      expect(sessionDuringLeg).toEqual([false]);
      expect(leg.signIn).toHaveBeenCalledWith("acct-1", "correct horse battery", "access-1", false);
    });

    it("sign_in_unlock_without_an_answer_reads_didnt_send_and_retries_without_a_second_login", async () => {
      let logins = 0;
      server.use(loginSuccess(() => (logins += 1)));
      const leg = fakeLeg([
        { ready: false, lockLost: false },
        { ready: true, lockLost: false },
      ]);
      const { store } = renderWithProviders(<LoginForm deviceLock={leg} />);
      fillAndSubmit();
      expect(await screen.findByTestId("login_transport_error")).toHaveTextContent(
        "That didn't send. Try again.",
      );
      expect(store.hasSession()).toBe(false);
      // The fields kept what was typed; Sign in is the retry.
      expect(screen.getByTestId("login_email")).toHaveValue("user@example.com");
      fireEvent.click(screen.getByTestId("login_submit"));
      await waitFor(() => expect(store.hasSession()).toBe(true));
      expect(logins).toBe(1);
      expect(leg.signIn).toHaveBeenCalledTimes(2);
    });

    it("a_forget_on_sign_in_refuses_to_complete_until_the_lock_is_held", async () => {
      // PR-61: a ticked box whose lock did not arrive leaves the reader signed out.
      server.use(loginSuccess());
      const identity = fakeIdentityStore();
      const setEphemeral = vi.spyOn(identity, "setEphemeral");
      const leg = fakeLeg([{ ready: false, lockLost: false }]);
      const { store } = renderWithProviders(<LoginForm identity={identity} deviceLock={leg} />);
      fireEvent.click(screen.getByLabelText(/don't remember this account/i));
      fillAndSubmit();
      await screen.findByTestId("login_transport_error");
      expect(leg.signIn).toHaveBeenCalledWith("acct-1", "correct horse battery", "access-1", true);
      expect(store.hasSession()).toBe(false);
      expect(setEphemeral).not.toHaveBeenCalled();
    });

    it("a changed credential drops the held session and logs in again", async () => {
      let logins = 0;
      server.use(loginSuccess(() => (logins += 1)));
      const leg = fakeLeg([
        { ready: false, lockLost: false },
        { ready: true, lockLost: false },
      ]);
      renderWithProviders(<LoginForm deviceLock={leg} />);
      fillAndSubmit();
      await screen.findByTestId("login_transport_error");
      fillAndSubmit("user@example.com", "another password");
      await waitFor(() => expect(logins).toBe(2));
    });

    it("a_dead_lock_completes_the_sign_in_and_posts_its_notice_once", async () => {
      // PR-62: the leg reports the dead lock on its first press; the notice
      // posts at the commit, even when that commit is a later press.
      server.use(loginSuccess());
      const notices = createSecurityNotices();
      const leg = fakeLeg([
        { ready: false, lockLost: true },
        { ready: true, lockLost: false },
      ]);
      const { store } = renderWithProviders(<LoginForm notices={notices} deviceLock={leg} />);
      fillAndSubmit();
      await screen.findByTestId("login_transport_error");
      expect(notices.lockLost()).toBe(false);
      fireEvent.click(screen.getByTestId("login_submit"));
      await waitFor(() => expect(store.hasSession()).toBe(true));
      expect(notices.lockLost()).toBe(true);
    });
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

  // ChangeEmailLinkedSignedOut.md: the sign-in opens holding the link, and
  // once signed in the link's landing follows.
  it("goes back to a held email-change link once signed in", async () => {
    window.sessionStorage.setItem("cogra.heldEmailChangeLink", "tok-held");
    const store = createTokenStore();
    store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
    renderWithProviders(<LoginForm />, { store });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/email-change"));
    window.sessionStorage.clear();
  });
});

// SignIn.jsx / SignIn.md: the drawn anatomy, line for line.
describe("the sign-in screen (SignIn)", () => {
  it("heads with Back to the bare view, the title and the welcome line", () => {
    renderWithProviders(<LoginForm />);
    const back = screen.getByRole("link", { name: "Back" });
    expect(back).toHaveAttribute("href", "/feed");
    expect(screen.getByRole("heading", { level: 1, name: "Sign in to CoGra" })).toBeInTheDocument();
    expect(screen.getByText("Welcome back — your feed is where you left it.")).toBeInTheDocument();
  });

  it("sign_in_stands_disabled_with_its_waiting_line_until_both_fields_hold_a_character", () => {
    renderWithProviders(<LoginForm />);
    expect(screen.getByText("Waiting for your email and password")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("login_email"), { target: { value: "a" } });
    expect(screen.getByText("Waiting for your email and password")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("login_password"), { target: { value: "p" } });
    expect(screen.queryByText("Waiting for your email and password")).not.toBeInTheDocument();
    expect(screen.getByTestId("login_submit")).toBeEnabled();
  });

  it("don't_remember_stands_unticked_and_flips_alone", () => {
    renderWithProviders(<LoginForm />);
    const box = screen.getByLabelText("Don't remember this account on this device");
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(screen.getByTestId("login_submit")).toBeDisabled();
  });

  it("the_reveal_control_names_what_it_does", () => {
    renderWithProviders(<LoginForm />);
    const reveal = screen.getByRole("button", { name: "Show password" });
    fireEvent.click(reveal);
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
    expect(screen.getByTestId("login_password")).toHaveAttribute("type", "text");
  });

  it("the_link_stack_reads_in_order_with_its_doors", () => {
    renderWithProviders(<LoginForm />);
    const rows = ["login_forgot", "login_join", "login_browse", "login_android_apk"].map((id) =>
      screen.getByTestId(id),
    );
    expect(rows.map((row) => row.textContent)).toEqual([
      "Forgot password?",
      "New here? Enter your invite",
      "Just looking? Browse the feed →",
      "On Android? Download the app (APK)",
    ]);
    expect(rows.map((row) => row.getAttribute("href"))).toEqual([
      "/reset",
      "/join",
      "/feed",
      "/downloads/app-debug.apk",
    ]);
  });

  it("sign_in_reads_signing_in_after_200ms_and_never_spins", async () => {
    server.use(
      gqlLink.mutation("LogIn", async () => {
        await delay(400);
        return HttpResponse.error();
      }),
    );
    renderWithProviders(<LoginForm />);
    fillAndSubmit();
    const submit = screen.getByTestId("login_submit");
    // Never within 200ms.
    expect(submit).toHaveTextContent("Sign in");
    await waitFor(() => expect(submit).toHaveTextContent("Signing in…"));
    expect(submit).toBeEnabled();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(await screen.findByTestId("login_transport_error")).toHaveTextContent(
      "That didn't send. Try again.",
    );
  });
});
