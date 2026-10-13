import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  cancelAccountDeletion,
  confirmAccountDeletion,
  deleteApplicantAccount,
  fetchDeletionStanding,
  requestAccountDeletion,
} from "./deletion-api";
import { hasCode } from "./outcome";
import { startMswServer } from "@/test/msw";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

const DELETION = { __typename: "AccountDeletion", scheduledFor: "2026-10-20T12:00:00Z", includesContent: false };

function userError(code: string, field: string[] | null = null) {
  return { __typename: "UserError", message: "refused", code, field };
}

function deletionPayload(field: string, accountDeletion: unknown, userErrors: unknown[] = []) {
  return HttpResponse.json({
    data: { [field]: { __typename: "AccountDeletionPayload", accountDeletion, userErrors } },
  });
}

describe("fetchDeletionStanding", () => {
  it("reads_the_servers_path_and_the_grace", async () => {
    server.use(
      graphql.query("AccountDeletion", () =>
        HttpResponse.json({
          data: { me: { __typename: "User", id: "u1", deletionPath: "BY_LINK", accountDeletion: DELETION } },
        }),
      ),
    );
    const outcome = await fetchDeletionStanding(client());
    expect(outcome).toMatchObject({
      kind: "success",
      value: { path: "BY_LINK", deletion: { scheduledFor: DELETION.scheduledFor, includesContent: false } },
    });
  });

  it("reads_no_viewer_as_unauthenticated", async () => {
    server.use(graphql.query("AccountDeletion", () => HttpResponse.json({ data: { me: null } })));
    expect(hasCode(await fetchDeletionStanding(client()), "UNAUTHENTICATED")).toBe(true);
  });
});

describe("requestAccountDeletion", () => {
  it("sends_the_sweep_choice_and_reads_a_null_deletion_as_success", async () => {
    let sent: unknown = null;
    server.use(
      graphql.mutation("RequestAccountDeletion", ({ variables }) => {
        sent = variables.input;
        return deletionPayload("requestAccountDeletion", null);
      }),
    );
    expect(await requestAccountDeletion(client(), true)).toEqual({ kind: "success", value: null });
    expect(sent).toEqual({ includeContent: true });
  });

  it("lifts_a_spent_budget_to_rate_limited", async () => {
    server.use(
      graphql.mutation("RequestAccountDeletion", () =>
        HttpResponse.json({ errors: [{ message: "slow down", extensions: { code: "RATE_LIMITED" } }] }),
      ),
    );
    expect(hasCode(await requestAccountDeletion(client(), false), "RATE_LIMITED")).toBe(true);
  });
});

describe("confirmAccountDeletion", () => {
  it("omits_include_content_unless_adding_the_sweep", async () => {
    const inputs: unknown[] = [];
    server.use(
      graphql.mutation("ConfirmAccountDeletion", ({ variables }) => {
        inputs.push(variables.input);
        return deletionPayload("confirmAccountDeletion", DELETION);
      }),
    );
    expect((await confirmAccountDeletion(client(), "tok")).kind).toBe("success");
    expect((await confirmAccountDeletion(client(), "tok", true)).kind).toBe("success");
    expect(inputs).toEqual([{ deletionToken: "tok" }, { deletionToken: "tok", includeContent: true }]);
  });

  it("refuses_a_dead_link_with_token_invalid", async () => {
    server.use(
      graphql.mutation("ConfirmAccountDeletion", () =>
        deletionPayload("confirmAccountDeletion", null, [userError("DELETION_TOKEN_INVALID", ["deletionToken"])]),
      ),
    );
    expect(hasCode(await confirmAccountDeletion(client(), "dead"), "DELETION_TOKEN_INVALID")).toBe(true);
  });

  it("treats_a_confirm_without_a_deletion_as_a_contract_break", async () => {
    server.use(graphql.mutation("ConfirmAccountDeletion", () => deletionPayload("confirmAccountDeletion", null)));
    expect((await confirmAccountDeletion(client(), "tok")).kind).toBe("failed");
  });
});

describe("cancelAccountDeletion", () => {
  it("is_idempotent_a_null_answer_is_success", async () => {
    server.use(graphql.mutation("CancelAccountDeletion", () => deletionPayload("cancelAccountDeletion", null)));
    expect(await cancelAccountDeletion(client())).toEqual({ kind: "success", value: true });
  });
});

describe("deleteApplicantAccount", () => {
  it("answers_ok", async () => {
    server.use(
      graphql.mutation("DeleteApplicantAccount", () =>
        HttpResponse.json({
          data: { deleteApplicantAccount: { __typename: "DeleteApplicantAccountPayload", ok: true, userErrors: [] } },
        }),
      ),
    );
    expect(await deleteApplicantAccount(client())).toEqual({ kind: "success", value: true });
  });

  it("lifts_a_funded_applicants_forbidden", async () => {
    server.use(
      graphql.mutation("DeleteApplicantAccount", () =>
        HttpResponse.json({ errors: [{ message: "no", extensions: { code: "FORBIDDEN" } }] }),
      ),
    );
    expect(hasCode(await deleteApplicantAccount(client()), "FORBIDDEN")).toBe(true);
  });
});
