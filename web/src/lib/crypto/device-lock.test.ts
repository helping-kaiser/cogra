// @vitest-environment node

// The device lock against the Rust reference's golden vectors
// (`client-crypto-vectors.json` `deviceLock`) — read from the file, never
// copied (web/CLAUDE.md "Crypto").

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { fromBase64, fromHex, toHex } from "./bytes";
import {
  associatedData,
  DeviceLockError,
  importLockSecret,
  openLockRecord,
  sealLockRecord,
  uuidBytes,
} from "./device-lock";

type DeviceLockVectors = {
  accountId: string;
  aesNonceHex: string;
  associatedDataHex: string;
  hkdfInfoUtf8: string;
  hkdfSaltHex: string;
  lockKeyHex: string;
  plaintextHex: string;
  recordHex: string;
  recordKeyUtf8: string;
  recordKindUtf8: string;
  refusedBindings: { accountId: string; recordKeyUtf8: string; recordKindUtf8: string }[];
  secretBase64: string;
  secretHex: string;
};

const v = (
  JSON.parse(
    readFileSync(new URL("../../../../client-crypto-vectors.json", import.meta.url), "utf-8"),
  ) as { deviceLock: DeviceLockVectors }
).deviceLock;

const binding = { account: v.accountId, kind: v.recordKindUtf8, key: v.recordKeyUtf8 };

describe("device lock (format v1)", () => {
  it("seals the reference's record byte for byte and opens it back", async () => {
    expect(toHex(fromBase64(v.secretBase64))).toBe(v.secretHex);
    expect(v.hkdfInfoUtf8).toBe("cogra:device-lock:v1");
    const base = await importLockSecret(fromHex(v.secretHex));
    const record = await sealLockRecord(
      base,
      binding,
      fromHex(v.plaintextHex),
      fromHex(v.hkdfSaltHex),
      fromHex(v.aesNonceHex),
    );
    expect(toHex(record)).toBe(v.recordHex);
    expect(toHex(await openLockRecord(base, fromHex(v.recordHex), binding))).toBe(v.plaintextHex);
  });

  it("derives the reference's lock key and associated data", async () => {
    const ikm = await crypto.subtle.importKey("raw", fromHex(v.secretHex), "HKDF", false, ["deriveBits"]);
    const key = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: fromHex(v.hkdfSaltHex),
        info: new TextEncoder().encode(v.hkdfInfoUtf8),
      },
      ikm,
      256,
    );
    expect(toHex(new Uint8Array(key))).toBe(v.lockKeyHex);
    const header = fromHex(v.recordHex).slice(0, 29);
    expect(toHex(associatedData(header, binding))).toBe(v.associatedDataHex);
  });

  it("lock_ciphertext_is_bound_to_its_account_and_record", async () => {
    const base = await importLockSecret(fromHex(v.secretHex));
    for (const refused of v.refusedBindings) {
      await expect(
        openLockRecord(base, fromHex(v.recordHex), {
          account: refused.accountId,
          kind: refused.recordKindUtf8,
          key: refused.recordKeyUtf8,
        }),
      ).rejects.toBeInstanceOf(DeviceLockError);
    }
  });

  it("another secret never opens the record", async () => {
    const other = fromHex(v.secretHex);
    other[0] ^= 0x01;
    await expect(
      openLockRecord(await importLockSecret(other), fromHex(v.recordHex), binding),
    ).rejects.toBeInstanceOf(DeviceLockError);
  });

  it("the held secret is never extractable", async () => {
    const base = await importLockSecret(fromHex(v.secretHex));
    expect(base.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", base)).rejects.toBeDefined();
  });

  it("refuses a malformed record and a foreign version", async () => {
    const base = await importLockSecret(fromHex(v.secretHex));
    await expect(openLockRecord(base, new Uint8Array(29), binding)).rejects.toBeInstanceOf(
      DeviceLockError,
    );
    const foreign = fromHex(v.recordHex);
    foreign[0] = 0x02;
    await expect(openLockRecord(base, foreign, binding)).rejects.toBeInstanceOf(DeviceLockError);
  });

  it("reads a UUID as its 16 bytes", () => {
    expect(toHex(uuidBytes(v.accountId))).toBe(v.accountId.replaceAll("-", ""));
    expect(() => uuidBytes("not-a-uuid")).toThrow(RangeError);
  });
});
