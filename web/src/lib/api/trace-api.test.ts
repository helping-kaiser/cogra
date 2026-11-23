import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { describe, expect, it } from "vitest";

import { fetchTraceNodes, TRACE_NODES_CHUNK } from "./trace-api";
import { gqlLink, startMswServer } from "@/test/msw";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

function userRow(id: string) {
  return {
    __typename: "User",
    id,
    handle: `h-${id}`,
    displayName: { __typename: "ModeratedText", value: `Name ${id}` },
    avatar: null,
  };
}

const IDS = Array.from({ length: 250 }, (_, i) => `u-${i}`);

describe("fetchTraceNodes", () => {
  it("names the chunk size the server's price allows", () => {
    expect(TRACE_NODES_CHUNK).toBe(100);
  });

  it("sends 250 distinct ids in three requests of at most 100, none twice, and merges them whole", async () => {
    const asked: string[][] = [];
    server.use(
      gqlLink.query("TraceNodes", ({ variables }) => {
        const ids = variables.ids as string[];
        asked.push(ids);
        return HttpResponse.json({ data: { nodes: ids.map(userRow) } });
      }),
    );
    const withDuplicates = [...IDS.slice(0, 10), ...IDS, IDS[249]!, IDS[0]!];

    const outcome = await fetchTraceNodes(client(), withDuplicates);

    expect(asked).toHaveLength(3);
    for (const ids of asked) expect(ids.length).toBeLessThanOrEqual(100);
    const sent = asked.flat();
    expect(new Set(sent).size).toBe(sent.length);
    expect(sent).toEqual(IDS);
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect([...outcome.value.named.keys()]).toEqual(IDS);
    expect([...outcome.value.covers.keys()]).toEqual(IDS);
    expect(outcome.value.named.get("u-249")).toEqual({
      kind: "person",
      person: { id: "u-249", handle: "h-u-249", displayName: "Name u-249", avatarUrl: null },
    });
  });

  it("fails the whole read when one chunk fails, as a failed read fails", async () => {
    let call = 0;
    server.use(
      gqlLink.query("TraceNodes", ({ variables }) => {
        call += 1;
        const ids = variables.ids as string[];
        if (call === 2) {
          return HttpResponse.json({
            errors: [{ message: "the read failed", extensions: { code: "INTERNAL" } }],
            data: { nodes: null },
          });
        }
        return HttpResponse.json({ data: { nodes: ids.map(userRow) } });
      }),
    );

    const outcome = await fetchTraceNodes(client(), IDS);

    expect(outcome.kind).toBe("failed");
  });

  it("answers an empty list without a request", async () => {
    const outcome = await fetchTraceNodes(client(), []);
    expect(outcome).toEqual({ kind: "success", value: { named: new Map(), covers: new Map() } });
  });
});
