import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { ProfileScreen } from "./profile-view";

const server = startMswServer();

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "u1" });
  return store;
}

function moderated(value: string | null) {
  return { __typename: "ModeratedText", value, status: "NORMAL" };
}

function profile(id: string, handle: string, bio: string | null = "Curious.") {
  return {
    __typename: "User",
    id,
    handle,
    displayName: moderated("Ada L"),
    bio: moderated(bio),
    websiteUrl: moderated("https://ada.example"),
  };
}

function meHandler(accountState: "APPLICANT" | "MEMBER" = "MEMBER") {
  return graphql.query("Me", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle: "ada",
          displayName: { __typename: "ModeratedText", value: null },
          accountState,
          hasReciprocated: true,
          invitedBy: null,
        },
      },
    }),
  );
}

function recordsHandler(
  rows: { id: string; family: string; targetId?: string; postId?: string }[],
) {
  return graphql.query("AuthorRecords", () =>
    HttpResponse.json({
      data: {
        records: {
          __typename: "RecordConnection",
          edges: rows.map((row) => ({
            __typename: "RecordEdge",
            node: {
              __typename: "Record",
              id: row.id,
              family: row.family,
              targetId: row.targetId ?? `mint:${row.id}`,
              terminalId: null,
              target: row.postId
                ? {
                    __typename: "Post",
                    id: row.postId,
                    title: { __typename: "ModeratedText", value: "Hello world" },
                    content: { __typename: "ModeratedText", value: "Body" },
                  }
                : null,
              terminal: null,
            },
          })),
          pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
        },
      },
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("ProfileScreen", () => {
  it("renders a public profile by handle with its chronicle", async () => {
    server.use(
      graphql.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([{ id: "act:a:1:publish", family: "PUBLISH", postId: "p1" }]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    expect(await screen.findByTestId("profile-display-name")).toHaveTextContent("Ada L");
    expect(screen.getByTestId("profile-handle")).toHaveTextContent("@ada");
    expect(screen.getByTestId("profile-bio")).toHaveTextContent("Curious.");
    expect(screen.getByTestId("profile-website")).toHaveAttribute("href", "https://ada.example");
    // Another actor's profile carries no own affordances.
    expect(screen.queryByTestId("profile-edit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("profile-settings")).not.toBeInTheDocument();
    // The chronicle row labels and links to the touched post.
    const row = await screen.findByTestId("chronicle-row");
    expect(row).toHaveTextContent("Published a post");
    expect(row).toHaveTextContent("Hello world");
  });

  it("makes the stance the header's primary action on another actor", async () => {
    server.use(
      graphql.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    // The interpersonal stance is the same generic gesture a post takes
    // (design.md §6 "Profile header"; api-spec.md "The generic stance").
    expect(await screen.findByTestId("profile-stance")).toBeInTheDocument();
  });

  it("offers no stance on one's own profile", async () => {
    server.use(
      meHandler(),
      graphql.query("MyProfile", () => HttpResponse.json({ data: { me: profile("u1", "ada") } })),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle={null} />, { store: signedInStore() });
    expect(await screen.findByTestId("profile-edit")).toBeInTheDocument();
    expect(screen.queryByTestId("profile-stance")).not.toBeInTheDocument();
  });

  it("shows not-found for an unknown handle", async () => {
    server.use(
      graphql.query("UserProfile", () => HttpResponse.json({ data: { user: null } })),
    );
    renderWithProviders(<ProfileScreen handle="nobody" />);
    expect(await screen.findByTestId("profile-not-found")).toBeInTheDocument();
  });

  it("offers edit, settings, and invites on the own profile", async () => {
    server.use(
      meHandler(),
      graphql.query("MyProfile", () =>
        HttpResponse.json({ data: { me: profile("u1", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle={null} />, { store: signedInStore() });
    expect(await screen.findByTestId("profile-edit")).toHaveAttribute("href", "/profile/edit");
    expect(screen.getByTestId("profile-settings")).toHaveAttribute("href", "/settings");
    expect(screen.getByTestId("profile-invites")).toHaveAttribute("href", "/invites");
    expect(screen.getByTestId("profile-chronicle-empty")).toBeInTheDocument();
  });

  it("locks the invites entry for an applicant and explains on tap", async () => {
    server.use(
      meHandler("APPLICANT"),
      graphql.query("MyProfile", () =>
        HttpResponse.json({ data: { me: profile("u1", "ada") } }),
      ),
      recordsHandler([]),
    );
    renderWithProviders(<ProfileScreen handle={null} />, { store: signedInStore() });
    const invites = await screen.findByTestId("profile-invites");
    // Visible but locked (auth.md "Application"): a button, not a link.
    expect(invites).not.toHaveAttribute("href");
    fireEvent.click(invites);
    expect(screen.getByTestId("profile-invites-locked")).toBeInTheDocument();
  });

  it("switches the chronicle filter and refetches", async () => {
    const families: (string | null)[] = [];
    server.use(
      graphql.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      graphql.query("AuthorRecords", ({ variables }) => {
        families.push((variables as { family: string | null }).family);
        return HttpResponse.json({
          data: {
            records: {
              __typename: "RecordConnection",
              edges: [],
              pageInfo: { __typename: "PageInfo", hasNextPage: false, endCursor: null },
            },
          },
        });
      }),
    );
    renderWithProviders(<ProfileScreen handle="ada" />);
    await screen.findByTestId("profile-display-name");
    // Every visitor lands on Posts (decision 2026-08-18).
    await waitFor(() => expect(families).toEqual(["PUBLISH"]));
    fireEvent.click(screen.getByTestId("profile-filter-everything"));
    await waitFor(() => expect(families).toEqual(["PUBLISH", null]));
  });

  it("offers a retry on the nothing-loaded transport fault", async () => {
    server.use(graphql.query("UserProfile", () => HttpResponse.error()));
    renderWithProviders(<ProfileScreen handle="ada" />);
    expect(await screen.findByTestId("profile-transport-error")).toBeInTheDocument();
    server.use(
      graphql.query("UserProfile", () =>
        HttpResponse.json({ data: { user: profile("u2", "ada") } }),
      ),
      recordsHandler([]),
    );
    fireEvent.click(screen.getByTestId("profile-retry"));
    expect(await screen.findByTestId("profile-display-name")).toBeInTheDocument();
  });
});
