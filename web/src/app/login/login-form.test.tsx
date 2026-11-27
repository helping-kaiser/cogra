import { fireEvent, screen, waitFor } from "@testing-library/react";
import { delay } from "msw/utils/delay";
import { HttpResponse } from "msw/http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LogInMutationVariables } from "@/__generated__/graphql";
import type { DeviceLockEngine } from "@/lib/identity/device-lock";
import { markSessionEnded } from "@/lib/session/ended-session";
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
  fireEvent.change(screen.getByTestId("signIn.email.input"), { target: { value: email } });
  fireEvent.change(screen.getByTestId("signIn.password.input"), { target: { value: password } });
  fireEvent.click(screen.getByTestId("signIn.commit.action"));
}

beforeEach(() => {
  window.localStorage.clear();
  replace.mockClear();
});

describe("LoginForm", () => {
  it("gates submit on both fields", () => {
    renderWithProviders(<LoginForm />);
    const submit = screen.getByTestId("signIn.commit.action");
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByTestId("signIn.email.input"), { target: { value: "a@b.c" } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByTestId("signIn.password.input"), { target: { value: "p" } });
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

  // FeedSecurityNotice.md:9 — delivered exactly once: the notice is on the
  // device for the account signing in before the session is saved, so a tab
  // closed before the shell paints does not lose it; and it is that
  // account's, not the one active when the press began.
  it("keeps the reuse notice on this device for the signing-in account before the save", async () => {
    server.use(loginSuccessWithNotice("2026-08-10T09:30:00Z"));
    const before = createTokenStore();
    before.save({ accessToken: "a-0", refreshToken: "r-0", accountId: "acct-0" });
    const notices = createSecurityNotices();
    const saved: (string | null)[] = [];
    const { store } = renderWithProviders(<LoginForm notices={notices} />, { store: before });
    const save = store.save.bind(store);
    vi.spyOn(store, "save").mockImplementation((auth) => {
      saved.push(window.localStorage.getItem("cogra.securityNotice.acct-1"));
      save(auth);
    });
    fillAndSubmit();
    await waitFor(() => expect(store.activeAccountId()).toBe("acct-1"));
    expect(saved).toEqual(["2026-08-10T09:30:00Z"]);
    expect(window.localStorage.getItem("cogra.securityNotice.acct-0")).toBeNull();
    expect(createSecurityNotices().reuseDetectedAt()).toBe("2026-08-10T09:30:00Z");
  });

  it("posts nothing on a refused sign-in", async () => {
    server.use(loginRefused);
    const notices = createSecurityNotices();
    const { store } = renderWithProviders(<LoginForm notices={notices} />);
    fillAndSubmit();
    await screen.findByTestId("signIn.fault");
    expect(store.hasSession()).toBe(false);
    expect(
      Object.keys(window.localStorage).filter((key) => key.startsWith("cogra.securityNotice.")),
    ).toEqual([]);
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
    await screen.findByTestId("signIn.fault");
    expect(setEphemeral).not.toHaveBeenCalled();
  });

  it("renders a refusal distinctly from a transport failure", async () => {
    server.use(loginRefused);
    renderWithProviders(<LoginForm />);
    fillAndSubmit();
    expect(await screen.findByTestId("signIn.fault")).toHaveTextContent(
      "That email and password don't match.",
    );
    expect(screen.queryByText("That didn't send. Try again.")).not.toBeInTheDocument();
  });

  it("a refusal stands while typing, until the next press of Sign in", async () => {
    server.use(loginRefused);
    renderWithProviders(<LoginForm />);
    fillAndSubmit();
    await screen.findByTestId("signIn.fault");
    fireEvent.change(screen.getByTestId("signIn.email.input"), { target: { value: "b@c.d" } });
    // SignInError.md: typing in either field never takes the line away.
    expect(screen.getByTestId("signIn.fault")).toHaveTextContent("That email and password don't match.");
    expect(screen.getByTestId("signIn.email.input")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByTestId("signIn.password.input")).not.toHaveAttribute("aria-invalid");
  });

  it("says a transport failure in the same slot, as the no-answer line", async () => {
    server.use(gqlLink.mutation("LogIn", () => HttpResponse.error()));
    renderWithProviders(<LoginForm />);
    fillAndSubmit();
    expect(await screen.findByTestId("signIn.fault")).toHaveTextContent("That didn't send. Try again.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
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
    expect(await screen.findByTestId("signIn.fault")).toHaveTextContent(
      "Too many tries in a row. Wait a moment, then try again.",
    );
    expect(screen.queryByText("That didn't send. Try again.")).not.toBeInTheDocument();
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
      expect(await screen.findByTestId("signIn.fault")).toHaveTextContent(
        "That didn't send. Try again.",
      );
      expect(store.hasSession()).toBe(false);
      // The fields kept what was typed; Sign in is the retry.
      expect(screen.getByTestId("signIn.email.input")).toHaveValue("user@example.com");
      fireEvent.click(screen.getByTestId("signIn.commit.action"));
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
      await screen.findByTestId("signIn.fault");
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
      await screen.findByTestId("signIn.fault");
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
      await screen.findByTestId("signIn.fault");
      expect(notices.lockLost()).toBe(false);
      fireEvent.click(screen.getByTestId("signIn.commit.action"));
      await waitFor(() => expect(store.hasSession()).toBe(true));
      expect(notices.lockLost()).toBe(true);
    });
  });

  it("a_dead_lock_seen_for_one_account_is_never_told_to_another_signing_in_here", async () => {
    // auth.md "Multi-account device custody": the dead lock is acct-1's; a
    // changed credential then signs in acct-2, which is not told of it.
    let logins = 0;
    server.use(
      gqlLink.mutation("LogIn", () => {
        logins += 1;
        return HttpResponse.json({
          data: {
            logIn: {
              __typename: "LogInPayload",
              auth: {
                __typename: "AuthSession",
                accessToken: `access-${logins}`,
                refreshToken: `refresh-${logins}`,
                user: { __typename: "User", id: `acct-${logins}` },
              },
              reuseDetectedAt: null,
              userErrors: [],
            },
          },
        });
      }),
    );
    const notices = createSecurityNotices();
    const leg = fakeLeg([
      { ready: false, lockLost: true },
      { ready: true, lockLost: false },
    ]);
    const { store } = renderWithProviders(<LoginForm notices={notices} deviceLock={leg} />);
    fillAndSubmit();
    await screen.findByTestId("signIn.fault");
    fillAndSubmit("other@example.com", "another password");
    await waitFor(() => expect(store.activeAccountId()).toBe("acct-2"));
    expect(notices.lockLost()).toBe(false);
  });

  it("offers the Android app as a download from the served APK path", () => {
    renderWithProviders(<LoginForm />);
    const link = screen.getByTestId("signIn.apk");
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

// SignInExpired.jsx / SignInExpired.md: a session ended mid-use opens the
// sign-in itself, with the one calm sentence under the heading.
describe("the sign-in after a session ended mid-use (SignInExpired)", () => {
  afterEach(() => window.sessionStorage.clear());

  it("says_youve_been_signed_out_under_the_heading_in_the_secondary_ink", async () => {
    markSessionEnded();
    renderWithProviders(<LoginForm />);
    const body = await screen.findByTestId("signIn.body");
    expect(body).toHaveTextContent("You've been signed out.");
    expect(body).toHaveClass("text-on-surface-variant");
    expect(body).not.toHaveAttribute("role", "alert");
    // Every control is SignIn's: the fields wait empty, Sign in waits.
    expect(screen.getByTestId("signIn.commit.action")).toBeDisabled();
    expect(screen.queryByTestId("signIn.fault")).not.toBeInTheDocument();
  });

  it("says_the_sentence_once_and_never_on_a_plain_visit", async () => {
    markSessionEnded();
    const first = renderWithProviders(<LoginForm />);
    await screen.findByTestId("signIn.body");
    first.unmount();
    renderWithProviders(<LoginForm />);
    expect(screen.getByTestId("signIn.title")).toBeInTheDocument();
    expect(screen.queryByTestId("signIn.body")).not.toBeInTheDocument();
  });
});

// SignIn.jsx / SignIn.md: the drawn anatomy, line for line.
describe("the sign-in screen (SignIn)", () => {
  // nodes.json `SignIn`: every registered path is worn, verbatim.
  it("wears_every_node_the_registry_names_for_the_board", () => {
    renderWithProviders(<LoginForm />);
    for (const path of [
      "signIn.apk",
      "signIn.browse",
      "signIn.commit",
      "signIn.commit.action",
      "signIn.email",
      "signIn.email.input",
      "signIn.email.label",
      "signIn.forget",
      "signIn.forget.box",
      "signIn.forget.label",
      "signIn.forgot",
      "signIn.header",
      "signIn.header.back",
      "signIn.invite",
      "signIn.password",
      "signIn.password.input",
      "signIn.password.label",
      "signIn.password.reveal",
      "signIn.title",
    ]) {
      expect(screen.getByTestId(path)).toBeInTheDocument();
    }
    expect(screen.queryByTestId("signIn.fault")).not.toBeInTheDocument();
    expect(screen.queryByTestId("signIn.body")).not.toBeInTheDocument();
  });

  it("heads with Back to the bare view and the title, with no line under it", () => {
    renderWithProviders(<LoginForm />);
    const back = screen.getByRole("link", { name: "Back" });
    expect(back).toHaveAttribute("href", "/feed");
    expect(screen.getByRole("heading", { level: 1, name: "Sign in to CoGra" })).toBeInTheDocument();
    expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
  });

  it("sign_in_stands_disabled_with_its_waiting_line_until_both_fields_hold_a_character", () => {
    renderWithProviders(<LoginForm />);
    expect(screen.getByText("Waiting for your email and password")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("signIn.email.input"), { target: { value: "a" } });
    expect(screen.getByText("Waiting for your email and password")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("signIn.password.input"), { target: { value: "p" } });
    expect(screen.queryByText("Waiting for your email and password")).not.toBeInTheDocument();
    expect(screen.getByTestId("signIn.commit.action")).toBeEnabled();
  });

  it("don't_remember_stands_unticked_and_flips_alone", () => {
    renderWithProviders(<LoginForm />);
    const box = screen.getByLabelText("Don't remember this account on this device");
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(screen.getByTestId("signIn.commit.action")).toBeDisabled();
  });

  it("the_reveal_control_names_what_it_does", () => {
    renderWithProviders(<LoginForm />);
    const reveal = screen.getByRole("button", { name: "Show password" });
    fireEvent.click(reveal);
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
    expect(screen.getByTestId("signIn.password.input")).toHaveAttribute("type", "text");
  });

  it("the_link_stack_reads_in_order_with_its_doors", () => {
    renderWithProviders(<LoginForm />);
    const rows = ["signIn.forgot", "signIn.invite", "signIn.browse", "signIn.apk"].map((id) =>
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

  // SignIn.md: "ALWAYS the screen's ways out refuse a press, undimmed and
  // unchanged in face, from 200ms after the press of Sign in until its
  // answer comes".
  it("the_ways_out_refuse_a_press_from_200ms_after_sign_in_until_the_answer", async () => {
    let answer: () => void = () => {};
    server.use(
      gqlLink.mutation("LogIn", async () => {
        await new Promise<void>((resolve) => {
          answer = resolve;
        });
        return HttpResponse.error();
      }),
    );
    renderWithProviders(<LoginForm />);
    const exits = ["signIn.header.back", "signIn.forgot", "signIn.invite", "signIn.browse", "signIn.apk"].map(
      (id) => screen.getByTestId(id),
    );
    const faces = exits.map((exit) => exit.className);
    fillAndSubmit();
    for (const exit of exits) expect(exit).not.toHaveAttribute("aria-disabled");
    expect(await screen.findByText("Signing in…")).toBeInTheDocument();
    for (const exit of exits) {
      expect(exit).toHaveAttribute("aria-disabled", "true");
      expect(fireEvent.click(exit)).toBe(false);
    }
    expect(exits.map((exit) => exit.className)).toEqual(faces);
    answer();
    expect(await screen.findByTestId("signIn.fault")).toHaveTextContent("That didn't send. Try again.");
    for (const exit of exits) expect(exit).not.toHaveAttribute("aria-disabled");
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
    const submit = screen.getByTestId("signIn.commit.action");
    // Never within 200ms.
    expect(submit).toHaveTextContent("Sign in");
    await waitFor(() => expect(submit).toHaveTextContent("Signing in…"));
    expect(submit).toBeEnabled();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(await screen.findByTestId("signIn.fault")).toHaveTextContent(
      "That didn't send. Try again.",
    );
  });
});

// SIGNIN OVER THE JOIN LAYER (SignIn.md:7-11; Join.md:33): opened from the
// join form standing over a signed-in account, SignIn stands rather than
// sending the signed-in visit away, and a sign-in taken here switches this
// device exactly as Create account does.
describe("LoginForm over the join layer", () => {
  const LAYER = "/join/0198c9a2-1f6b-7c31-9d70-3a4f5b6c7d8e";

  function signedInElsewhere() {
    const store = createTokenStore();
    store.save({ accessToken: "access-0", refreshToken: "refresh-0", accountId: "acct-0" });
    return store;
  }

  it("tap_sign_in_on_join_given_join_opened_over_the_signed_in_state_opens_sign_in_over_the_layer", async () => {
    renderWithProviders(<LoginForm joinLayer={LAYER} />, { store: signedInElsewhere() });
    expect(screen.getByTestId("signIn.email.input")).toBeInTheDocument();
    // Signed in, yet never sent on to the app.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(replace).not.toHaveBeenCalled();
  });

  it("press_the_back_arrow_given_sign_in_opened_from_the_join_layer_brings_the_layer_back", () => {
    renderWithProviders(<LoginForm joinLayer={LAYER} />, { store: signedInElsewhere() });
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", LAYER);
  });

  it("the_sign_in_taken_over_the_join_layer_switches_this_device_and_opens_where_app_open_lands", async () => {
    let revoked = 0;
    server.use(
      loginSuccess(),
      gqlLink.mutation("RevokeSession", () => {
        revoked += 1;
        return HttpResponse.error();
      }),
    );
    const store = signedInElsewhere();
    renderWithProviders(<LoginForm joinLayer={LAYER} />, { store });
    fillAndSubmit();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(store.activeAccountId()).toBe("acct-1");
    expect(store.refreshToken()).toBe("refresh-1");
    expect(revoked).toBe(0);
  });

  it("not_from_the_join_layer_the_arrow_links_to_the_bare_view", () => {
    renderWithProviders(<LoginForm />);
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/feed");
  });
});
