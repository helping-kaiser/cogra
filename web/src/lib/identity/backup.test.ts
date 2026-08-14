// @vitest-environment node

// The settings backup legs over real crypto and MSW: enable-late seals
// the retained seed, rekey re-proves the current code first. AES-GCM
// and HKDF need Node's crypto.subtle, hence the node environment.

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import type { AuthGuard } from "@/lib/session/guard";
import { fromBase64, randomBytes, toBase64 } from "@/lib/crypto/bytes";
import { sha256Tagged, verify } from "@/lib/crypto/hashing";
import {
  openKeyBackup,
  RecoveryCode,
  sealKeyBackup,
  UPLOAD_PROOF_TAG,
} from "@/lib/crypto/key-backup";
import { createIdentityStore, type IdentityStore } from "./store";
import { createBackupManager, type BackupManager } from "./backup";
import { startMswServer } from "@/test/msw";

const server = startMswServer();

const passThroughGuard: AuthGuard = { run: (block) => block() };

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

/** What the server sees of one upload — the proof included. */
type UploadSink = { blob: string | null; challenge?: string; signature?: string };

const CHALLENGE = toBase64(new Uint8Array(32).fill(0x71));

function challengeHandler() {
  return graphql.mutation("CreateKeyBackupChallenge", () =>
    HttpResponse.json({
      data: {
        createKeyBackupChallenge: {
          __typename: "KeyBackupChallengePayload",
          challenge: CHALLENGE,
          userErrors: [],
        },
      },
    }),
  );
}

function uploadHandler(sink: UploadSink) {
  return graphql.mutation("UploadKeyBackup", ({ variables }) => {
    const input = (variables as { input: { blob: string; challenge: string; signature: string } })
      .input;
    sink.blob = input.blob;
    sink.challenge = input.challenge;
    sink.signature = input.signature;
    return HttpResponse.json({
      data: { uploadKeyBackup: { __typename: "UploadKeyBackupPayload", ok: true, userErrors: [] } },
    });
  });
}

/** The server's check, run client-side: does the proof bind these bytes? */
async function proofVerifies(sink: UploadSink, publicKey: Uint8Array): Promise<boolean> {
  const challenge = fromBase64(sink.challenge as string);
  const blob = fromBase64(sink.blob as string);
  return verify(
    publicKey,
    UPLOAD_PROOF_TAG,
    await sha256Tagged(UPLOAD_PROOF_TAG, [challenge, blob]),
    fromBase64(sink.signature as string),
  );
}

function keyBackupHandler(blob: string | null) {
  return graphql.query("KeyBackup", () =>
    HttpResponse.json({
      data: { me: { __typename: "User", id: "u1", keyBackup: blob } },
    }),
  );
}

describe("backup manager", () => {
  let store: IdentityStore;
  let manager: BackupManager;

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    store = createIdentityStore({ activeAccountId: () => "acct-1" });
    manager = createBackupManager({ client: client(), guard: passThroughGuard, store });
  });

  it("enable seals the retained seed, uploads, and wipes it", async () => {
    const seed = randomBytes(32);
    await store.saveActor(seed, true);
    const sink: UploadSink = { blob: null };
    server.use(challengeHandler(), uploadHandler(sink));

    const result = await manager.enable();
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;

    // The uploaded blob opens under the returned code, back to the seed.
    expect(sink.blob).not.toBeNull();
    const opened = await openKeyBackup(
      fromBase64(sink.blob as string),
      RecoveryCode.fromInput(result.code),
    );
    expect(opened).toEqual(seed);

    // Custody is the CryptoKey alone now (web.md "Key custody").
    expect(await store.actorSeed()).toBeNull();
    expect(await store.pendingBackupBlob()).toBeNull();
    const key = await store.actorKey();
    expect(key).not.toBeNull();

    // The upload carried a proof binding the server's challenge to
    // exactly these bytes (auth.md "Key recovery").
    expect(sink.challenge).toBe(CHALLENGE);
    expect(await proofVerifies(sink, key!.publicKeyBytes())).toBe(true);
  });

  it("enable drops a stale parked ceremony blob on success", async () => {
    await store.saveActor(randomBytes(32), true);
    await store.savePendingBackupBlob(randomBytes(64));
    server.use(challengeHandler(), uploadHandler({ blob: null }));

    expect((await manager.enable()).kind).toBe("created");
    expect(await store.pendingBackupBlob()).toBeNull();
  });

  it("enable without a seed reports noSeed", async () => {
    await store.saveActor(randomBytes(32), false);
    expect(await manager.enable()).toEqual({ kind: "noSeed" });
  });

  it("a failed upload keeps the seed — nothing changed server-side", async () => {
    const seed = randomBytes(32);
    await store.saveActor(seed, true);
    server.use(challengeHandler(), graphql.mutation("UploadKeyBackup", () => HttpResponse.error()));

    expect((await manager.enable()).kind).toBe("failed");
    expect(await store.actorSeed()).toEqual(seed);
  });

  it("rekey re-seals under a fresh code without persisting the seed", async () => {
    const seed = randomBytes(32);
    const currentCode = RecoveryCode.generate();
    const currentBlob = toBase64(await sealKeyBackup(seed, currentCode));
    await store.saveActor(seed, false);
    const sink: UploadSink = { blob: null };
    server.use(challengeHandler(), keyBackupHandler(currentBlob), uploadHandler(sink));

    const result = await manager.rekey(currentCode.display());
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;

    expect(result.code).not.toBe(currentCode.display());
    const opened = await openKeyBackup(
      fromBase64(sink.blob as string),
      RecoveryCode.fromInput(result.code),
    );
    expect(opened).toEqual(seed);
    // The old code no longer opens the replacement blob.
    await expect(
      openKeyBackup(fromBase64(sink.blob as string), currentCode),
    ).rejects.toThrow();
    expect(await store.actorSeed()).toBeNull();

    // Rekey signs with the key recovered from the blob, not a stored seed.
    const key = await store.actorKey();
    expect(await proofVerifies(sink, key!.publicKeyBytes())).toBe(true);
  });

  it("a refused challenge stops the upload and keeps the seed", async () => {
    const seed = randomBytes(32);
    await store.saveActor(seed, true);
    server.use(
      graphql.mutation("CreateKeyBackupChallenge", () =>
        HttpResponse.json({
          data: {
            createKeyBackupChallenge: {
              __typename: "KeyBackupChallengePayload",
              challenge: null,
              userErrors: [
                { __typename: "UserError", message: "no", code: "FORBIDDEN", field: null },
              ],
            },
          },
        }),
      ),
    );

    expect((await manager.enable()).kind).toBe("refused");
    expect(await store.actorSeed()).toEqual(seed);
  });

  it("rekey rejects a malformed code before touching the network", async () => {
    expect(await manager.rekey("not a code")).toEqual({ kind: "malformedCode" });
  });

  it("rekey reports a wrong code", async () => {
    const blob = toBase64(await sealKeyBackup(randomBytes(32), RecoveryCode.generate()));
    server.use(keyBackupHandler(blob));
    expect(await manager.rekey(RecoveryCode.generate().display())).toEqual({ kind: "wrongCode" });
  });

  it("rekey reports a missing server blob", async () => {
    server.use(keyBackupHandler(null));
    expect(await manager.rekey(RecoveryCode.generate().display())).toEqual({ kind: "noBackup" });
  });

  it("rekey surfaces an upload refusal", async () => {
    const seed = randomBytes(32);
    const currentCode = RecoveryCode.generate();
    server.use(
      challengeHandler(),
      keyBackupHandler(toBase64(await sealKeyBackup(seed, currentCode))),
      graphql.mutation("UploadKeyBackup", () =>
        HttpResponse.json({
          data: {
            uploadKeyBackup: {
              __typename: "UploadKeyBackupPayload",
              ok: null,
              userErrors: [
                { __typename: "UserError", message: "bad", code: "BAD_INPUT", field: ["blob"] },
              ],
            },
          },
        }),
      ),
    );
    const result = await manager.rekey(currentCode.display());
    expect(result.kind).toBe("refused");
  });
});
