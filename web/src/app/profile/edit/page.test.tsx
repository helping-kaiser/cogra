import { fireEvent, screen, waitFor } from "@testing-library/react";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { startMswServer } from "@/test/msw";
import { renderWithProviders } from "@/test/providers";
import { fakeWriteSigner } from "@/test/registration";
import ProfileEditPage from "./page";

const { push, replace } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

const server = startMswServer();

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "u1" });
  return store;
}

function myProfileHandler() {
  return graphql.query("MyProfile", () =>
    HttpResponse.json({
      data: {
        me: {
          __typename: "User",
          id: "u1",
          handle: "ada",
          displayName: { __typename: "ModeratedText", value: "Ada", status: "NORMAL" },
          bio: { __typename: "ModeratedText", value: "Old bio", status: "NORMAL" },
          websiteUrl: { __typename: "ModeratedText", value: null, status: "NORMAL" },
        },
      },
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  push.mockClear();
});

describe("ProfileEditPage", () => {
  it("prefills the form from the current version", async () => {
    server.use(myProfileHandler());
    renderWithProviders(<ProfileEditPage />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    expect(await screen.findByTestId("profile-edit-display-name")).toHaveValue("Ada");
    expect(screen.getByTestId("profile-edit-bio")).toHaveValue("Old bio");
    expect(screen.getByTestId("profile-edit-website")).toHaveValue("");
  });

  it("refuses a blanked display name locally", async () => {
    server.use(myProfileHandler());
    renderWithProviders(<ProfileEditPage />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    const name = await screen.findByTestId("profile-edit-display-name");
    fireEvent.change(name, { target: { value: "  " } });
    fireEvent.click(screen.getByTestId("profile-edit-save"));
    expect(await screen.findByTestId("profile-edit-empty-name")).toBeInTheDocument();
  });

  it("signs the update and returns to the profile; a blanked bio clears", async () => {
    let variables: unknown;
    server.use(
      myProfileHandler(),
      graphql.mutation("PrepareProfileUpdate", ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({
          data: {
            prepareProfileUpdate: {
              __typename: "PreparePayload",
              writes: [
                {
                  __typename: "PreparedWrite",
                  id: "w1",
                  family: "REGISTRATION",
                  canonicalProposal: "cHJvcG9zYWw=",
                  gcAfterEpochs: 8,
                },
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    const signer = fakeWriteSigner();
    renderWithProviders(<ProfileEditPage />, { store: signedInStore(), writeSigner: signer });

    const bio = await screen.findByTestId("profile-edit-bio");
    fireEvent.change(bio, { target: { value: "" } });
    fireEvent.change(screen.getByTestId("profile-edit-website"), {
      target: { value: "https://ada.example" },
    });
    fireEvent.click(screen.getByTestId("profile-edit-save"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/profile"));
    expect(signer.signStaged).toHaveBeenCalledTimes(1);
    // The form holds the full field set: a blanked bio rides null —
    // the wire's explicit clear (api-spec.md "Content authoring").
    expect(variables).toEqual({
      input: { displayName: "Ada", bio: null, websiteUrl: "https://ada.example" },
    });
  });

  it("surfaces a refused prepare without navigating", async () => {
    server.use(
      myProfileHandler(),
      graphql.mutation("PrepareProfileUpdate", () =>
        HttpResponse.json({
          data: {
            prepareProfileUpdate: {
              __typename: "PreparePayload",
              writes: null,
              userErrors: [
                {
                  __typename: "UserError",
                  code: "BAD_INPUT",
                  message: "an update must change at least one field",
                  field: ["input"],
                },
              ],
            },
          },
        }),
      ),
    );
    renderWithProviders(<ProfileEditPage />, {
      store: signedInStore(),
      writeSigner: fakeWriteSigner(),
    });
    await screen.findByTestId("profile-edit-display-name");
    fireEvent.click(screen.getByTestId("profile-edit-save"));
    expect(await screen.findByTestId("profile-edit-refused")).toHaveTextContent(
      "at least one field",
    );
    expect(push).not.toHaveBeenCalled();
  });
});
