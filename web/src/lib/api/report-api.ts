// The content report, lifted into an outcome (api-spec.md `sendReport`).
// Needs a session; a spent daily budget is a transport-tier RATE_LIMITED,
// which the outcome lifts into a refusal like every other budget.

import type { ApolloClient } from "@apollo/client";

import { SendReportDocument } from "@/__generated__/graphql";
import { payloadOutcome, type Outcome } from "./outcome";

/** Reports one post, comment or profile; succeeds with when it was sent. */
export function sendReport(client: ApolloClient, target: string): Promise<Outcome<string>> {
  return payloadOutcome(
    () => client.mutate({ mutation: SendReportDocument, variables: { target } }),
    (data) => data.sendReport.userErrors,
    (data) => data.sendReport.reportedAt ?? null,
  );
}
