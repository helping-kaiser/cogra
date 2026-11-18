import { fireEvent, screen, waitFor } from "@testing-library/react";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { gql } from "@apollo/client";

import type { RegisterMutationVariables } from "@/__generated__/graphql";
import { createTokenStore } from "@/lib/session/token-store";
import { gqlLink, startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { forgetTyped, JoinView } from "./join-view";

const { replace, push } = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
}));

const server = startMswServer();

const ID = "0198c9a2-1f6b-7c31-9d70-3a4f5b6c7d8e";

const GRACE = {
  __typename: "User",
  handle: "grace",
  displayName: { __typename: "ModeratedText", value: "Grace Hopper" },
  avatar: { __typename: "MediaAttachment", url: "https://media.test/grace.webp", status: "NORMAL" },
};

const checkWith = (inviter: unknown) =>
  gqlLink.query("InviteLinkCheck", () =>
    HttpResponse.json({
      data: {
        inviteLinkCheck: {
          __typename: "InviteLinkCheck",
          usable: true,
          inviterHandle: "grace",
          inviter,
          expiresAt: "2026-08-08T00:00:00Z",
        },
      },
    }),
  );

const usableCheck = checkWith(GRACE);

function fillForm({
  handle = "ada",
  email = "ada@example.org",
  password = "correct horse battery",
  repeat = password,
}: { handle?: string; email?: string; password?: string; repeat?: string } = {}) {
  fireEvent.change(screen.getByTestId("join.handle.input"), { target: { value: handle } });
  fireEvent.change(screen.getByTestId("join.email.input"), { target: { value: email } });
  fireEvent.change(screen.getByTestId("join.password.input"), { target: { value: password } });
  fireEvent.change(screen.getByTestId("join.confirm.input"), { target: { value: repeat } });
}

const typeIn = (field: "handle" | "email" | "password" | "confirm", value: string) =>
  fireEvent.change(screen.getByTestId(`join.${field}.input`), { target: { value } });
const createAccount = () => fireEvent.click(screen.getByTestId("join.commit.action"));
const MISMATCH = "The two passwords don't match.";

const refusal = (code: string, field: string[] | null) =>
  gqlLink.mutation("Register", () =>
    HttpResponse.json({
      data: {
        register: {
          __typename: "RegisterPayload",
          auth: null,
          expiresAt: null,
          userErrors: [{ __typename: "UserError", message: code, code, field }],
        },
      },
    }),
  );

/** A read the other account left in the cache. */
const OLD_READ = gql`
  query JoinSwitchCacheProbe {
    me {
      id
      handle
    }
  }
`;

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" });
  return store;
}

function meHandler(accountState: "APPLICANT" | "MEMBER") {
  return gqlLink.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle: "ada",
          displayName: { __typename: "ModeratedText", value: null },
          accountState,
          hasReciprocated: true,
          vouchBackDismissed: false,
          invitedBy: null,
        },
      },
    }),
  );
}

describe("JoinView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    replace.mockClear();
    push.mockClear();
    forgetTyped();
  });

  it("shows who is vouching and the apply form on a usable invite", async () => {
    server.use(usableCheck);
    renderWithProviders(<JoinView linkId={ID} />);
    expect(await screen.findByTestId("join.title")).toHaveTextContent("Grace Hopper invited you");
    expect(screen.getByTestId("join.handle.input")).toBeInTheDocument();
  });

  it("refuses an unknown invite before the form", async () => {
    server.use(
      gqlLink.query("InviteLinkCheck", () => HttpResponse.json({ data: { inviteLinkCheck: null } })),
    );
    renderWithProviders(<JoinView linkId={ID} />);
    expect(await screen.findByRole("heading", { name: "This invite can't be used anymore" })).toBeInTheDocument();
    expect(screen.queryByTestId("join.handle.input")).not.toBeInTheDocument();
  });

  it("refuses an unusable invite before the form", async () => {
    server.use(
      gqlLink.query("InviteLinkCheck", () =>
        HttpResponse.json({
          data: {
            inviteLinkCheck: {
              __typename: "InviteLinkCheck",
              usable: false,
              inviterHandle: "grace",
              expiresAt: "2026-08-08T00:00:00Z",
            },
          },
        }),
      ),
    );
    renderWithProviders(<JoinView linkId={ID} />);
    expect(await screen.findByRole("heading", { name: "This invite can't be used anymore" })).toBeInTheDocument();
    // JoinInvalid.md: the field and its ways out stand as the door's.
    expect(screen.getByTestId("invite_input")).toBeInTheDocument();
  });

  it("flags a path segment with no invite in it without a network call", () => {
    renderWithProviders(<JoinView linkId="not-an-invite" />);
    expect(screen.getByRole("heading", { name: "This invite can't be used anymore" })).toBeInTheDocument();
  });

  it("surfaces a transport fault on the check", async () => {
    server.use(gqlLink.query("InviteLinkCheck", () => HttpResponse.error()));
    renderWithProviders(<JoinView linkId={ID} />);
    expect(await screen.findByTestId("invite_transport_error")).toBeInTheDocument();
  });

  it("registers, stores the session, and goes home", async () => {
    const captured: RegisterMutationVariables[] = [];
    server.use(
      usableCheck,
      gqlLink.mutation("Register", ({ variables }) => {
        captured.push(variables as RegisterMutationVariables);
        return HttpResponse.json({
          data: {
            register: {
              __typename: "RegisterPayload",
              auth: {
                __typename: "AuthSession",
                accessToken: "access-1",
                refreshToken: "refresh-1",
                user: { __typename: "User", id: "acct-1" },
              },
              expiresAt: "2026-08-08T00:00:00Z",
              userErrors: [],
            },
          },
        });
      }),
    );
    const { store } = renderWithProviders(<JoinView linkId={ID} />);
    await screen.findByTestId("join.handle.input");

    fillForm({ handle: "Ada" });
    fireEvent.click(screen.getByTestId("join.commit.action"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(store.hasSession()).toBe(true);
    // The handle is lowercased on entry and the invite rides the input.
    expect(captured[0]?.input).toMatchObject({ handle: "ada", inviteLink: ID });
  });

  it("a_short_password_answers_on_the_press_and_nothing_goes_out", async () => {
    let calls = 0;
    server.use(
      usableCheck,
      gqlLink.mutation("Register", () => {
        calls += 1;
        return HttpResponse.error();
      }),
    );
    renderWithProviders(<JoinView linkId={ID} />);
    await screen.findByTestId("join.handle.input");
    fillForm({ password: "short" });
    // Typing never marks a field before the press.
    expect(screen.queryByText("A password is at least 12 characters.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("join.commit.action"));
    expect(await screen.findByText("A password is at least 12 characters.")).toBeInTheDocument();
    expect(screen.getByTestId("join.password.input")).toHaveAttribute("aria-invalid", "true");
    expect(calls).toBe(0);
    // The local line re-checks as the text changes.
    fireEvent.change(screen.getByTestId("join.password.input"), { target: { value: "correct horse battery" } });
    expect(screen.queryByText("A password is at least 12 characters.")).not.toBeInTheDocument();
  });

  it("pins a registration refusal to the form", async () => {
    server.use(
      usableCheck,
      gqlLink.mutation("Register", () =>
        HttpResponse.json({
          data: {
            register: {
              __typename: "RegisterPayload",
              auth: null,
              expiresAt: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "taken",
                  code: "HANDLE_TAKEN",
                  field: ["handle"],
                },
              ],
            },
          },
        }),
      ),
    );
    renderWithProviders(<JoinView linkId={ID} />);
    await screen.findByTestId("join.handle.input");
    fillForm();
    fireEvent.click(screen.getByTestId("join.commit.action"));
    // Join.md: the line reads in place of the hint, and the field takes the error state.
    expect(await screen.findByText("That handle is taken.")).toBeInTheDocument();
    expect(screen.getByTestId("join.handle.input")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("3–30 characters: a–z, 0–9, _")).not.toBeInTheDocument();
  });

  it("renders a rate-limited registration as a backoff, not a connectivity failure", async () => {
    server.use(
      usableCheck,
      gqlLink.mutation("Register", () =>
        HttpResponse.json({
          errors: [{ message: "too many attempts", extensions: { code: "RATE_LIMITED" } }],
        }),
      ),
    );
    renderWithProviders(<JoinView linkId={ID} />);
    await screen.findByTestId("join.handle.input");
    fillForm();
    fireEvent.click(screen.getByTestId("join.commit.action"));
    expect(await screen.findByTestId("apply_error")).toHaveTextContent(
      "Too many tries. Wait a little, then try again.",
    );
    expect(screen.queryByText("That didn't send. Try again.")).not.toBeInTheDocument();
  });

  // JOIN OVER THE SIGNED-IN STATE (Join.md:7, :21, :59, :87): an invite link
  // ignores sign-in — an applicant, a member, a member whose account read
  // never answered all get the same form, a layer over that account.
  for (const [who, me] of [
    ["an applicant", () => meHandler("APPLICANT")],
    ["a member", () => meHandler("MEMBER")],
    ["a reader whose account read never answers", () => gqlLink.query("Me", () => HttpResponse.error())],
  ] as const) {
    it(`a_live_invite_link_opened_while_signed_in_opens_join_as_a_layer — ${who}`, async () => {
      server.use(usableCheck, me());
      renderWithProviders(<JoinView linkId={ID} />, { store: signedInStore() });
      expect(await screen.findByTestId("join.handle.input")).toBeInTheDocument();
      expect(screen.getByTestId("join.commit.action")).toBeInTheDocument();
      expect(screen.queryByText(/isn.t for you/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Invites page/)).not.toBeInTheDocument();
    });
  }

  it("press_the_back_arrow_given_the_form_opened_over_the_signed_in_state_closes_onto_it", async () => {
    server.use(usableCheck);
    const store = signedInStore();
    renderWithProviders(<JoinView linkId={ID} />, { store });
    await screen.findByTestId("join.handle.input");
    // The arrow links to the signed-in feed; nothing about the account moved.
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/feed");
    expect(store.activeAccountId()).toBe("acct-1");
    expect(store.refreshToken()).toBe("refresh-1");
  });

  it("already_have_an_account_sign_in_stands_over_the_signed_in_state_and_opens_sign_in_over_the_layer", async () => {
    server.use(usableCheck);
    renderWithProviders(<JoinView linkId={ID} />, { store: signedInStore() });
    const door = await screen.findByTestId("join.signInDoor");
    expect(door).toHaveAttribute("href", `/login?from=join&invite=${ID}`);
  });

  it("signed_out_the_sign_in_door_is_the_plain_sign_in", async () => {
    server.use(usableCheck);
    renderWithProviders(<JoinView linkId={ID} />);
    expect(await screen.findByTestId("join.signInDoor")).toHaveAttribute("href", "/login");
  });

  it("the_account_created_over_the_signed_in_state_switches_this_device_and_revokes_nothing", async () => {
    let revoked = 0;
    server.use(
      usableCheck,
      gqlLink.mutation("RevokeSession", () => {
        revoked += 1;
        return HttpResponse.error();
      }),
      gqlLink.mutation("Register", () =>
        HttpResponse.json({
          data: {
            register: {
              __typename: "RegisterPayload",
              auth: {
                __typename: "AuthSession",
                accessToken: "access-2",
                refreshToken: "refresh-2",
                user: { __typename: "User", id: "acct-2" },
              },
              expiresAt: "2026-08-08T00:00:00Z",
              userErrors: [],
            },
          },
        }),
      ),
    );
    const store = signedInStore();
    const { client } = renderWithProviders(<JoinView linkId={ID} />, { store });
    await screen.findByTestId("join.handle.input");
    // What the other account left in the cache must not be read as the new one.
    client.cache.writeQuery({ query: OLD_READ, data: { me: { __typename: "User", id: "u-old", handle: "old" } } });
    fillForm();
    createAccount();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(store.activeAccountId()).toBe("acct-2");
    expect(store.refreshToken()).toBe("refresh-2");
    expect(store.accessToken()).toBe("access-2");
    expect(client.cache.readQuery({ query: OLD_READ })).toBeNull();
    expect(revoked).toBe(0);
  });

  // Join.jsx / Join.md, line for line.
  describe("the form's anatomy (Join)", () => {
    it("heads with a plain Back, the About CoGra dot, the inviter and the lead", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      expect(await screen.findByTestId("join.title")).toHaveTextContent("Grace Hopper invited you");
      expect(screen.getByRole("link", { name: "Back" })).toBeInTheDocument();
      expect(
        screen.getByText("CoGra is invite-only — a member vouches for you, and @grace's approval brings you in."),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "About CoGra" }));
      expect(push).toHaveBeenCalledWith(`/about?from=join&invite=${ID}`);
    });

    // Join.md:9 — the face and the name over the form are the inviter's.
    it("the_face_and_the_name_over_the_form_are_the_links_inviters", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      expect(await screen.findByTestId("join.title")).toHaveTextContent("Grace Hopper invited you");
      const face = screen.getByTestId("join.avatar");
      expect(face.querySelector("img")).toHaveAttribute("src", "https://media.test/grace.webp");
      expect(screen.getByTestId("join.body")).toHaveTextContent(
        "CoGra is invite-only — a member vouches for you, and @grace's approval brings you in.",
      );
    });

    it("an_inviter_with_no_written_name_or_picture_reads_by_handle_under_the_monogram", async () => {
      server.use(
        checkWith({
          ...GRACE,
          displayName: { __typename: "ModeratedText", value: "  " },
          avatar: null,
        }),
      );
      renderWithProviders(<JoinView linkId={ID} />);
      expect(await screen.findByTestId("join.title")).toHaveTextContent("grace invited you");
      expect(screen.getByTestId("join.avatar").querySelector("img")).toBeNull();
    });

    it("a_redacted_picture_never_shows_and_the_monogram_stands_in", async () => {
      server.use(
        checkWith({
          ...GRACE,
          avatar: { __typename: "MediaAttachment", url: "https://media.test/grace.webp", status: "REDACTED" },
        }),
      );
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.title");
      expect(screen.getByTestId("join.avatar").querySelector("img")).toBeNull();
    });

    // Join.md:13 — pasted at the invite door, Back returns to it.
    it("press_the_back_arrow_given_the_link_was_pasted_at_the_invite_door_opens_invite_entry", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} origin="door" />);
      await screen.findByTestId("join.title");
      expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/join");
      // The "?" carries the door along, so About's Back finds this same form.
      fireEvent.click(screen.getByRole("button", { name: "About CoGra" }));
      expect(push).toHaveBeenCalledWith(`/about?from=join&invite=${ID}&door=1`);
    });

    // Join.md:15 — the link held from the arrival: Back returns to the
    // borrowed view, never to a door the reader never used.
    it("press_the_back_arrow_given_the_link_was_held_from_the_arrival_brings_the_borrowed_view_back", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.title");
      expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/feed");
    });

    it("the hints read until a line takes their place", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      expect(screen.getByText("3–30 characters: a–z, 0–9, _")).toBeInTheDocument();
      expect(screen.getByText("At least 12 characters.")).toBeInTheDocument();
    });

    // Join.md: the commit stands disabled with no line above it and its
    // spoken description reads Waiting for a handle, your email and a
    // password until all four fields hold a character (design 80fd29912).
    it("create_account_stands_disabled_with_its_spoken_wait_until_all_four_fields_hold_a_character", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      const reason = "Waiting for a handle, your email and a password";
      expect(screen.getByTestId("join.commit.action")).toHaveAccessibleDescription(reason);
      expect(screen.getByText(reason)).toHaveClass("sr-only");
      expect(screen.getByTestId("join.commit.action")).toBeDisabled();
      typeIn("handle", "a");
      typeIn("email", "b");
      typeIn("password", "x");
      expect(screen.getByTestId("join.commit.action")).toBeDisabled();
      expect(screen.getByTestId("join.commit.action")).toHaveAccessibleDescription(reason);
      typeIn("confirm", "y");
      expect(screen.queryByText(reason)).not.toBeInTheDocument();
      expect(screen.getByTestId("join.commit.action")).toBeEnabled();
    });

    // Join.md: "ALWAYS a second field, Repeat password, stands under
    // Password, masked like it, with its own reveal control and no hint".
    it("a_second_field_repeat_password_stands_under_password_masked_with_its_own_reveal_and_no_hint", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      const inputs = screen.getAllByTestId(/^join\.[a-z]+\.input$/).map((el) => el.getAttribute("data-testid"));
      expect(inputs).toEqual(["join.handle.input", "join.email.input", "join.password.input", "join.confirm.input"]);
      expect(screen.getByTestId("join.confirm.label")).toHaveTextContent("Repeat password");
      const confirm = screen.getByTestId("join.confirm.input");
      expect(confirm).toHaveAttribute("type", "password");
      expect(confirm).toHaveAttribute("autocomplete", "new-password");
      expect(confirm).toHaveAttribute("enterkeyhint", "go");
      expect(screen.getByTestId("join.password.input")).toHaveAttribute("enterkeyhint", "next");
      expect(screen.queryByTestId("join.confirm.support")).not.toBeInTheDocument();
      expect(confirm).not.toHaveAttribute("aria-describedby");
      fireEvent.click(screen.getByTestId("join.confirm.reveal"));
      expect(confirm).toHaveAttribute("type", "text");
      expect(screen.getByTestId("join.confirm.reveal")).toHaveAccessibleName("Hide password");
      expect(screen.getByTestId("join.password.input")).toHaveAttribute("type", "password");
      fireEvent.click(screen.getByTestId("join.confirm.reveal"));
      expect(confirm).toHaveAttribute("type", "password");
      expect(screen.getByTestId("join.confirm.reveal")).toHaveAccessibleName("Show password");
    });

    // Join.md: "WHEN press Create account GIVEN Repeat password differs from
    // Password -> the Repeat password field's line reads The two passwords
    // don't match. AND the field takes the error state".
    it("a_repeat_that_differs_reads_on_the_repeat_field_and_nothing_goes_out", async () => {
      let calls = 0;
      server.use(
        usableCheck,
        gqlLink.mutation("Register", () => {
          calls += 1;
          return HttpResponse.error();
        }),
      );
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      fillForm({ repeat: "correct horse batery" });
      expect(screen.queryByText(MISMATCH)).not.toBeInTheDocument();
      createAccount();
      expect(await screen.findByTestId("join.confirm.support")).toHaveTextContent(MISMATCH);
      expect(screen.getByTestId("join.confirm.input")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByTestId("join.confirm.label")).toHaveClass("text-error");
      expect(screen.getByTestId("join.password.support")).toHaveTextContent("At least 12 characters.");
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(calls).toBe(0);
    });

    // JoinErrors.md: "WHEN press Create account GIVEN the handle is taken and
    // the password is shorter than 12 characters and Repeat password differs
    // from it -> …" · "ALWAYS each field is checked on its own at the press,
    // so Repeat password's mismatch line stands beside Password's own line".
    it("each_field_is_checked_on_its_own_so_the_mismatch_stands_beside_the_password_line", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      fillForm({ password: "fieldday", repeat: "fielday" });
      createAccount();
      expect(await screen.findByTestId("join.confirm.support")).toHaveTextContent(MISMATCH);
      expect(screen.getByTestId("join.password.support")).toHaveTextContent("A password is at least 12 characters.");
      expect(screen.getByTestId("join.email.input")).not.toHaveAttribute("aria-invalid");
    });

    // Join.md / JoinErrors.md: "WHEN typing in Password or Repeat password
    // GIVEN Repeat password carries The two passwords don't match. -> the
    // line re-checks as the text changes AND it goes once the two passwords
    // match AND NEVER a hint takes its place".
    it("the_mismatch_line_rechecks_as_either_field_changes_and_goes_once_they_match", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      fillForm({ repeat: "correct horse" });
      createAccount();
      expect(await screen.findByTestId("join.confirm.support")).toHaveTextContent(MISMATCH);
      typeIn("confirm", "correct horse batt");
      expect(screen.getByTestId("join.confirm.support")).toHaveTextContent(MISMATCH);
      typeIn("password", "correct horse batt");
      expect(screen.queryByTestId("join.confirm.support")).not.toBeInTheDocument();
      expect(screen.getByTestId("join.confirm.input")).not.toHaveAttribute("aria-invalid");
      // Gone, it never comes back by typing alone.
      typeIn("confirm", "correct horse bat");
      expect(screen.queryByTestId("join.confirm.support")).not.toBeInTheDocument();
    });

    // Join.md: "ALWAYS the header's arrow, the "?" and Already have an
    // account? Sign in refuse a press, never dimmed, while Create account
    // waits on its answer" · "WHEN press Create account -> Create account
    // refuses a second press until the registration answers AND NEVER Create
    // account dims".
    it("the_exits_refuse_a_press_never_dimmed_while_create_account_waits", async () => {
      let calls = 0;
      let release: () => void = () => {};
      const answered = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        usableCheck,
        gqlLink.mutation("Register", async () => {
          calls += 1;
          await answered;
          return HttpResponse.error();
        }),
      );
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      fillForm();
      createAccount();
      const back = screen.getByTestId("join.header.back");
      const help = screen.getByTestId("join.header.help");
      const signIn = screen.getByTestId("join.signInDoor");
      await waitFor(() => expect(back).toHaveAttribute("aria-disabled", "true"));
      expect(help).toHaveAttribute("aria-disabled", "true");
      expect(signIn).toHaveAttribute("aria-disabled", "true");
      expect(fireEvent.click(back)).toBe(false);
      expect(fireEvent.click(signIn)).toBe(false);
      fireEvent.click(help);
      expect(push).not.toHaveBeenCalled();
      createAccount();
      const commit = screen.getByTestId("join.commit.action");
      expect(commit).toBeEnabled();
      expect(commit).toHaveAttribute("aria-busy", "true");
      release();
      expect(await screen.findByTestId("apply_error")).toHaveTextContent("That didn't send. Try again.");
      expect(calls).toBe(1);
      expect(back).not.toHaveAttribute("aria-disabled");
      expect(signIn).not.toHaveAttribute("aria-disabled");
      expect(help).not.toHaveAttribute("aria-disabled");
      fireEvent.click(help);
      expect(push).toHaveBeenCalledWith(`/about?from=join&invite=${ID}`);
    });

    it("the_board_names_its_nodes_on_the_form", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      for (const path of [
        "join.header",
        "join.header.back",
        "join.header.help",
        "join.handle.label",
        "join.handle.support",
        "join.email.label",
        "join.password.reveal",
        "join.confirm",
        "join.terms",
        "join.terms.open",
        "join.commit",
        "join.signInDoor",
        "join.privacy",
        "join.privacy.open",
      ]) {
        expect(screen.getByTestId(path)).toBeInTheDocument();
      }
      expect(screen.getByTestId("join.header.help")).toHaveAccessibleName("About CoGra");
    });

    it("the terms line stands directly above Create account and the privacy notice at the foot", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      const terms = screen.getByText(/By creating your account you accept the/);
      expect(terms).toHaveTextContent("By creating your account you accept the Terms.");
      const privacy = screen.getByText(/How CoGra handles your data: the/);
      expect(privacy).toHaveTextContent("How CoGra handles your data: the Privacy Policy.");
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      const commit = screen.getByTestId("join.commit.action");
      expect(terms.compareDocumentPosition(commit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(commit.compareDocumentPosition(privacy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByTestId("join.signInDoor")).toHaveTextContent("Already have an account? Sign in");
    });

    it("a_malformed_handle_and_email_answer_on_the_press", async () => {
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      fillForm({ handle: "a!", email: "nope" });
      fireEvent.click(screen.getByTestId("join.commit.action"));
      expect(await screen.findByText("A handle is 3–30 characters: a–z, 0–9, _.")).toBeInTheDocument();
      expect(screen.getByText("That doesn't look like an email address.")).toBeInTheDocument();
    });

    it("a_taken_email_reads_on_its_field_and_stands_while_typing", async () => {
      server.use(usableCheck, refusal("EMAIL_IN_USE", ["email"]));
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      fillForm();
      fireEvent.click(screen.getByTestId("join.commit.action"));
      expect(await screen.findByText("That email already has an account.")).toBeInTheDocument();
      fireEvent.change(screen.getByTestId("join.email.input"), { target: { value: "ada2@example.org" } });
      expect(screen.getByText("That email already has an account.")).toBeInTheDocument();
    });

    it("a_breached_password_reads_on_its_field", async () => {
      server.use(usableCheck, refusal("WEAK_PASSWORD", ["password"]));
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      fillForm();
      fireEvent.click(screen.getByTestId("join.commit.action"));
      expect(
        await screen.findByText("That password has turned up in a data breach — pick another one."),
      ).toBeInTheDocument();
    });

    it("no_answer_keeps_the_fields_and_says_it_above_create_account", async () => {
      server.use(usableCheck, gqlLink.mutation("Register", () => HttpResponse.error()));
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      fillForm();
      fireEvent.click(screen.getByTestId("join.commit.action"));
      expect(await screen.findByTestId("apply_error")).toHaveTextContent("That didn't send. Try again.");
      expect(screen.getByTestId("join.handle.input")).toHaveValue("ada");
      expect(screen.getByTestId("join.commit.action")).toBeEnabled();
    });

    it("a_link_spent_while_the_form_stood_reads_join_invalid", async () => {
      server.use(usableCheck, refusal("INVITE_UNUSABLE", null));
      renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      fillForm();
      fireEvent.click(screen.getByTestId("join.commit.action"));
      expect(await screen.findByRole("heading", { name: "This invite can't be used anymore" })).toBeInTheDocument();
    });

    it("the_handle_and_email_outlive_a_way_out_and_both_passwords_do_not", async () => {
      server.use(usableCheck);
      const first = renderWithProviders(<JoinView linkId={ID} />);
      await screen.findByTestId("join.handle.input");
      fillForm({ handle: "kept", email: "kept@example.org" });
      first.unmount();
      server.use(usableCheck);
      renderWithProviders(<JoinView linkId={ID} />);
      expect(await screen.findByTestId("join.handle.input")).toHaveValue("kept");
      expect(screen.getByTestId("join.email.input")).toHaveValue("kept@example.org");
      expect(screen.getByTestId("join.password.input")).toHaveValue("");
      expect(screen.getByTestId("join.confirm.input")).toHaveValue("");
    });
  });
});
