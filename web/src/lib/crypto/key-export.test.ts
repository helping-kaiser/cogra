// @vitest-environment node
// Mirrors android/core/crypto KeyExportTest.kt. Both clients pin to RFC
// 8410 §10.3's own Ed25519 private-key example — the standard's vector,
// so neither client is merely reproducing the other's bytes.

import { expect, it } from "vitest";
import { fromHex, toHex } from "./bytes";
import { exportActorSeed } from "./key-export";

const RFC8410_SEED = fromHex("d4ee72dbf913584ad5b6d8f1f769f8ad3afe7c28cbf1d4fbe097a88f44755842");

const RFC8410_PEM = [
  "-----BEGIN PRIVATE KEY-----",
  "MC4CAQAwBQYDK2VwBCIEINTuctv5E1hK1bbY8fdp+K06/nwoy/HU++CXqI9EdVhC",
  "-----END PRIVATE KEY-----",
].join("\n");

it("the seed encodes to the standard's own PEM", () => {
  expect(exportActorSeed(RFC8410_SEED).pem).toBe(RFC8410_PEM);
});

it("the hex form is the raw seed", () => {
  expect(exportActorSeed(RFC8410_SEED).hex).toBe(toHex(RFC8410_SEED));
});

it("the PEM carries the key itself", () => {
  const pem = exportActorSeed(RFC8410_SEED).pem;
  const der = Buffer.from(pem.split("\n").slice(1, -1).join(""), "base64");
  expect(der).toHaveLength(48);
  expect(toHex(new Uint8Array(der.subarray(16)))).toBe(toHex(RFC8410_SEED));
});

it("a non-seed length is refused", () => {
  expect(() => exportActorSeed(new Uint8Array(31))).toThrow(RangeError);
});
