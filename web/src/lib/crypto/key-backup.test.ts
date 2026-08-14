// @vitest-environment node
// Mirrors android/core/crypto KeyBackupTest.kt over the v1 blob format.

import { expect, it } from "vitest";
import { randomBytes, toHex } from "./bytes";
import {
  KeyBackupError,
  openKeyBackup,
  RecoveryCode,
  RecoveryCodeLengthError,
  sealKeyBackup,
} from "./key-backup";

it("seal and open round-trip", async () => {
  const seed = randomBytes(32);
  const code = RecoveryCode.generate();
  const blob = await sealKeyBackup(seed, code);
  expect(toHex(await openKeyBackup(blob, code))).toBe(toHex(seed));
});

it("a wrong code does not open", async () => {
  const blob = await sealKeyBackup(randomBytes(32), RecoveryCode.generate());
  await expect(openKeyBackup(blob, RecoveryCode.generate())).rejects.toThrow(
    new KeyBackupError("the blob does not open under this code"),
  );
});

it("a tampered header does not open", async () => {
  const code = RecoveryCode.generate();
  const blob = await sealKeyBackup(randomBytes(32), code);
  blob[5] ^= 0x01;
  await expect(openKeyBackup(blob, code)).rejects.toThrow(
    new KeyBackupError("the blob does not open under this code"),
  );
});

it("a tampered ciphertext does not open", async () => {
  const code = RecoveryCode.generate();
  const blob = await sealKeyBackup(randomBytes(32), code);
  blob[blob.length - 1] ^= 0x01;
  await expect(openKeyBackup(blob, code)).rejects.toThrow(
    new KeyBackupError("the blob does not open under this code"),
  );
});

it("an unsupported version and truncation are refused", async () => {
  const code = RecoveryCode.generate();
  const blob = await sealKeyBackup(randomBytes(32), code);
  const wrongVersion = blob.slice();
  wrongVersion[0] = 0x02;
  await expect(openKeyBackup(wrongVersion, code)).rejects.toThrow(
    new KeyBackupError("unsupported blob version 2"),
  );
  await expect(openKeyBackup(blob.slice(0, 29), code)).rejects.toThrow(
    new KeyBackupError("blob too short"),
  );
});

it("seal rejects malformed inputs", async () => {
  const code = RecoveryCode.generate();
  await expect(sealKeyBackup(randomBytes(16), code)).rejects.toThrow(
    new RangeError("an actor seed is 32 bytes"),
  );
  await expect(sealKeyBackup(randomBytes(32), code, randomBytes(8))).rejects.toThrow(
    new RangeError("the HKDF salt is 16 bytes"),
  );
  await expect(sealKeyBackup(randomBytes(32), code, randomBytes(16), randomBytes(8))).rejects.toThrow(
    new RangeError("the AES-GCM nonce is 12 bytes"),
  );
  expect(() => new RecoveryCode(randomBytes(8))).toThrow(new RangeError("a recovery code is 16 bytes"));
});

it("the display groups and input normalizes", () => {
  const code = RecoveryCode.generate();
  const display = code.display();
  expect(display).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}-[0-9A-HJKMNP-TV-Z]{6}$/);
  const sloppy = display.toLowerCase().replaceAll("1", "l").replaceAll("0", "o").replaceAll("-", " - ");
  expect(toHex(RecoveryCode.fromInput(sloppy).bytes)).toBe(toHex(code.bytes));
});

it("input refuses wrong lengths and bad characters", () => {
  expect(() => RecoveryCode.fromInput("TOO-SHORT")).toThrow(
    new RecoveryCodeLengthError("a recovery code has 26 characters"),
  );
  expect(() => RecoveryCode.fromInput("U".repeat(26))).toThrow(
    new KeyBackupError("invalid recovery-code character `U`"),
  );
  const display = RecoveryCode.generate().display();
  const nonzeroPad = display.slice(0, display.length - 1) + "Z";
  expect(() => RecoveryCode.fromInput(nonzeroPad)).toThrow(new KeyBackupError("invalid recovery code"));
});

// Only the length is a shape complaint the reader can act on; a
// full-length input that will not decode is a wrong code, and saying
// "that isn't a code" about a one-character typo misleads.
it("only a wrong length reports as a shape problem", () => {
  expect(() => RecoveryCode.fromInput("TOO-SHORT")).toThrow(RecoveryCodeLengthError);

  const display = RecoveryCode.generate().display();
  const nonzeroPad = display.slice(0, display.length - 1) + "Z";
  for (const input of [nonzeroPad, "U".repeat(26)]) {
    expect(() => RecoveryCode.fromInput(input)).toThrow(KeyBackupError);
    expect(() => RecoveryCode.fromInput(input)).not.toThrow(RecoveryCodeLengthError);
  }
});
