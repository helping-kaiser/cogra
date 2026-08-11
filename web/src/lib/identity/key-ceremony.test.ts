// @vitest-environment node

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import type { AttachActorKeyMutationVariables } from "@/__generated__/graphql";
import { fromBase64, toBase64 } from "@/lib/crypto/bytes";
import { addressOf } from "@/lib/crypto/hashing";
import { openKeyBackup, RecoveryCode } from "@/lib/crypto/key-backup";
import type { AuthGuard } from "@/lib/session/guard";
import { createKeyCeremony, type KeyCeremony } from "./key-ceremony";
import { createIdentityStore, type IdentityStore } from "./store";
import { startMswServer } from "@/test/msw";

const server = startMswServer();

const passthroughGuard: AuthGuard = { run: (block) => block() };

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

function attachOk() {
  return graphql.mutation("AttachActorKey", () =>
    HttpResponse.json({
      data: {
        attachActorKey: {
          __typename: "AttachActorKeyPayload",
          user: { __typename: "User", id: "u1" },
          userErrors: [],
        },
      },
    }),
  );
}

function uploadOk() {
  return graphql.mutation("UploadKeyBackup", () =>
    HttpResponse.json({
      data: {
        uploadKeyBackup: { __typename: "UploadKeyBackupPayload", ok: true, userErrors: [] },
      },
    }),
  );
}

describe("key ceremony", () => {
  let store: IdentityStore;
  let ceremony: KeyCeremony;

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    store = createIdentityStore({ activeAccountId: () => "acct-1" });
    ceremony = createKeyCeremony({ client: client(), guard: passthroughGuard, store });
  });

  it("mints and persists an actor, seed retained", async () => {
    const identity = await ceremony.createActorKey();
    const key = await store.actorKey();
    expect(key).not.toBeNull();
    expect(toBase64(key?.publicKeyBytes() ?? new Uint8Array())).toBe(identity.publicKeyBase64);
    expect(identity.l0Address).toBe(await addressOf(fromBase64(identity.publicKeyBase64)));
    expect(await store.actorSeed()).not.toBeNull();
  });

  it("a re-mint overwrites the unbound key", async () => {
    const first = await ceremony.createActorKey();
    const second = await ceremony.createActorKey();
    expect(second.publicKeyBase64).not.toBe(first.publicKeyBase64);
    const key = await store.actorKey();
    expect(toBase64(key?.publicKeyBytes() ?? new Uint8Array())).toBe(second.publicKeyBase64);
  });

  it("attaches the public halves of the persisted key", async () => {
    const captured: AttachActorKeyMutationVariables[] = [];
    server.use(
      graphql.mutation("AttachActorKey", ({ variables: v }) => {
        captured.push(v as AttachActorKeyMutationVariables);
        return HttpResponse.json({
          data: {
            attachActorKey: {
              __typename: "AttachActorKeyPayload",
              user: { __typename: "User", id: "u1" },
              userErrors: [],
            },
          },
        });
      }),
    );
    const identity = await ceremony.createActorKey();
    expect(await ceremony.attachActorKey()).toEqual({ kind: "success", value: true });
    expect(captured[0]?.input).toEqual({
      actorPubkey: identity.publicKeyBase64,
      l0Address: identity.l0Address,
    });
  });

  it("refuses to attach without a key", async () => {
    await expect(ceremony.attachActorKey()).rejects.toThrow("no actor key");
  });

  it("parks a blob the recovery code opens over the seed", async () => {
    await ceremony.createActorKey();
    const seed = await store.actorSeed();
    const display = await ceremony.createPendingBackup();
    expect(display).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{6}$/);
    const blob = await store.pendingBackupBlob();
    expect(blob).not.toBeNull();
    const opened = await openKeyBackup(blob ?? new Uint8Array(), RecoveryCode.fromInput(display));
    expect(opened).toEqual(seed);
  });

  it("upload success clears the parked blob and wipes the seed", async () => {
    server.use(attachOk(), uploadOk());
    await ceremony.createActorKey();
    await ceremony.createPendingBackup();
    expect(await ceremony.uploadPendingBackup()).toBe(true);
    expect(await store.pendingBackupBlob()).toBeNull();
    expect(await store.actorSeed()).toBeNull();
    expect(await store.actorKey()).not.toBeNull();
  });

  it("a failed upload keeps the blob parked and the seed intact", async () => {
    server.use(graphql.mutation("UploadKeyBackup", () => HttpResponse.error()));
    await ceremony.createActorKey();
    await ceremony.createPendingBackup();
    expect(await ceremony.uploadPendingBackup()).toBe(false);
    expect(await store.pendingBackupBlob()).not.toBeNull();
    expect(await store.actorSeed()).not.toBeNull();
  });

  it("upload with nothing parked is trivially done", async () => {
    expect(await ceremony.uploadPendingBackup()).toBe(true);
  });

  it("declining is just never parking — the seed stays for a later backup", async () => {
    server.use(attachOk());
    await ceremony.createActorKey();
    await ceremony.attachActorKey();
    expect(await store.pendingBackupBlob()).toBeNull();
    expect(await store.actorSeed()).not.toBeNull();
  });
});
