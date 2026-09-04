// @vitest-environment node

// The signing primitives' boundary between "this signature is wrong" and
// "this runtime cannot answer" — a distinction the write path spends material
// on. Ed25519 needs Node's crypto.subtle, hence the node environment.

import { describe, expect, it, vi } from "vitest";

import { ActorKey } from "./actor-key";
import { randomBytes } from "./bytes";
import { CryptoUnavailableError, ed25519Available, sha256Tagged, Tags, verify } from "./hashing";

const MSG = new TextEncoder().encode("the message");

async function signedPair() {
  const key = await ActorKey.generate();
  const signature = await key.signTagged(Tags.APPROVAL, MSG);
  return { publicKey: key.publicKeyBytes(), signature };
}

describe("ed25519Available", () => {
  it("reports the capability of the runtime it runs in", async () => {
    expect(await ed25519Available()).toBe(true);
  });
});

describe("verify", () => {
  it("accepts a signature the key made, and refuses one it did not", async () => {
    const { publicKey, signature } = await signedPair();
    expect(await verify(publicKey, Tags.APPROVAL, MSG, signature)).toBe(true);

    const other = await signedPair();
    expect(await verify(publicKey, Tags.APPROVAL, MSG, other.signature)).toBe(false);
    // The tag is part of what was signed, so the same bytes under another tag
    // are a different message.
    expect(await verify(publicKey, Tags.HOST_SEAL, MSG, signature)).toBe(false);
  });

  it("refuses the wrong shapes without asking the runtime", async () => {
    const { publicKey, signature } = await signedPair();
    expect(await verify(new Uint8Array(31), Tags.APPROVAL, MSG, signature)).toBe(false);
    expect(await verify(publicKey, Tags.APPROVAL, MSG, new Uint8Array(63))).toBe(false);
  });

  // Key data the algorithm cannot parse is a real verdict about these bytes,
  // which is what `DataError` means in the WebCrypto spec.
  it("reads unparseable key material as a failed verification", async () => {
    const { signature } = await signedPair();
    const notAPoint = randomBytes(32);
    notAPoint.fill(0xff);
    expect(await verify(notAPoint, Tags.APPROVAL, MSG, signature)).toBe(false);
  });

  // THE CASE THAT USED TO SPEND WRITE MATERIAL. A browser without Ed25519
  // answered "false", which reached the write signer as an invalid host seal
  // and cleared the handshake — a verdict from a check that never ran.
  it("raises rather than answering false when the runtime cannot verify", async () => {
    const { publicKey, signature } = await signedPair();
    const importKey = vi
      .spyOn(crypto.subtle, "importKey")
      .mockRejectedValue(new DOMException("unsupported", "NotSupportedError"));

    await expect(verify(publicKey, Tags.APPROVAL, MSG, signature)).rejects.toBeInstanceOf(
      CryptoUnavailableError,
    );
    importKey.mockRestore();
  });

  it("raises when the verification itself cannot run", async () => {
    const { publicKey, signature } = await signedPair();
    const subtleVerify = vi
      .spyOn(crypto.subtle, "verify")
      .mockRejectedValue(new DOMException("nope", "OperationError"));

    await expect(verify(publicKey, Tags.APPROVAL, MSG, signature)).rejects.toBeInstanceOf(
      CryptoUnavailableError,
    );
    subtleVerify.mockRestore();
  });
});

describe("sha256Tagged", () => {
  it("separates the parts, so a moved byte is a different digest", async () => {
    const ab = await sha256Tagged("t", [new Uint8Array([1]), new Uint8Array([2, 3])]);
    const shifted = await sha256Tagged("t", [new Uint8Array([1, 2]), new Uint8Array([3])]);
    expect(Array.from(ab)).not.toEqual(Array.from(shifted));
  });
});
