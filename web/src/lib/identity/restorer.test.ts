// @vitest-environment node

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { randomBytes, toBase64 } from "@/lib/crypto/bytes";
import { RecoveryCode, sealKeyBackup } from "@/lib/crypto/key-backup";
import type { AuthGuard } from "@/lib/session/guard";
import { restoreActor } from "./restorer";
import { createIdentityStore, type IdentityStore } from "./store";
import { startMswServer } from "@/test/msw";

const server = startMswServer();

const passthroughGuard: AuthGuard = { run: (block) => block() };

function deps(store: IdentityStore) {
  return {
    client: new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({ uri: "http://localhost/graphql" }),
    }),
    guard: passthroughGuard,
    store,
  };
}

function serveBackup(blob: string | null) {
  return graphql.query("KeyBackup", () =>
    HttpResponse.json({
      data: { me: { __typename: "User", id: "u1", keyBackup: blob } },
    }),
  );
}

describe("restoreActor", () => {
  let store: IdentityStore;

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    store = createIdentityStore({ activeAccountId: () => "acct-1" });
  });

  it("restores the actor from the blob, seed not retained", async () => {
    const seed = randomBytes(32);
    const code = RecoveryCode.generate();
    server.use(serveBackup(toBase64(await sealKeyBackup(seed, code))));

    const result = await restoreActor(deps(store), code.display());
    expect(result).toEqual({ kind: "restored" });
    expect(await store.actorSeed()).toBeNull();
    const key = await store.actorKey();
    expect(key).not.toBeNull();
  });

  it("normalizes the pasted code on the way in", async () => {
    const seed = randomBytes(32);
    const code = RecoveryCode.generate();
    server.use(serveBackup(toBase64(await sealKeyBackup(seed, code))));

    const sloppy = code.display().toLowerCase().replace(/1/g, "l").replace(/0/g, "o");
    expect(await restoreActor(deps(store), sloppy)).toEqual({ kind: "restored" });
  });

  it("reports a malformed code without a network call", async () => {
    expect(await restoreActor(deps(store), "not-a-code")).toEqual({ kind: "malformedCode" });
  });

  // One mistyped character is a wrong code, not a shapeless input —
  // even when it is the last one, where the pad bits refuse it before
  // the blob is ever fetched.
  it("reports a one-character typo as a wrong code", async () => {
    const display = RecoveryCode.generate().display();
    const lastCharTypo = display.slice(0, display.length - 1) + "Z";
    expect(await restoreActor(deps(store), lastCharTypo)).toEqual({ kind: "wrongCode" });
  });

  it("reports a wrong code — the GCM tag refuses", async () => {
    const blob = await sealKeyBackup(randomBytes(32), RecoveryCode.generate());
    server.use(serveBackup(toBase64(blob)));
    const other = RecoveryCode.generate();
    expect(await restoreActor(deps(store), other.display())).toEqual({ kind: "wrongCode" });
    expect(await store.actorKey()).toBeNull();
  });

  it("reports the absence of any backup", async () => {
    server.use(serveBackup(null));
    const result = await restoreActor(deps(store), RecoveryCode.generate().display());
    expect(result).toEqual({ kind: "noBackup" });
  });

  it("maps a transport fault to failed", async () => {
    server.use(graphql.query("KeyBackup", () => HttpResponse.error()));
    const result = await restoreActor(deps(store), RecoveryCode.generate().display());
    expect(result.kind).toBe("failed");
  });

  it("maps a rate-limited backup read to rateLimited, not a transport fault", async () => {
    server.use(
      graphql.query("KeyBackup", () =>
        HttpResponse.json({
          errors: [{ message: "too many attempts", extensions: { code: "RATE_LIMITED" } }],
        }),
      ),
    );
    const result = await restoreActor(deps(store), RecoveryCode.generate().display());
    expect(result).toEqual({ kind: "rateLimited" });
  });
});
