// The device lock, format v1 (auth.md "Device lock"): one locked custody
// record sealed under a key derived from a server-held secret. The Rust
// reference is `crates/common/src/l1/device_lock.rs`; the golden vectors
// (`client-crypto-vectors.json` `deviceLock`) pin every byte.
//
// HKDF-SHA-256 over the secret with a fresh 16-byte salt and the info
// `cogra:device-lock:v1`, then AES-256-GCM with a fresh 12-byte nonce. The
// record is `0x01 ‖ salt ‖ nonce ‖ ciphertext`, and its associated data is
// that header, then the account's 16 UUID bytes, then the record's kind and
// key — each framed by its big-endian u64 length — so a locked record cannot
// be moved into another account's slot or swapped for another record.
//
// THE SECRET IS HELD AS A NON-EXTRACTABLE HKDF BASE KEY (sign-out-custody
// §3.4): script running while the account is signed in can derive with it but
// never read it out, the same reasoning that keeps the actor key
// non-extractable (web.md "Key custody").

import { concat, fromHex, randomBytes } from "./bytes";

const VERSION = 0x01;
export const LOCK_SECRET_LEN = 32;
const HKDF_SALT_LEN = 16;
const AES_NONCE_LEN = 12;
const HEADER_LEN = 1 + HKDF_SALT_LEN + AES_NONCE_LEN;
const HKDF_INFO = Uint8Array.from(new TextEncoder().encode("cogra:device-lock:v1"));

/** A record that will not open under this lock and binding, or a malformed container. */
export class DeviceLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeviceLockError";
  }
}

/** Where a locked record belongs: its account, the kind of custody it holds, its name within that kind. */
export type LockBinding = {
  readonly account: string;
  readonly kind: string;
  readonly key: string;
};

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** A UUID's 16 bytes, as `Uuid::as_bytes` gives them. */
export function uuidBytes(uuid: string): Uint8Array<ArrayBuffer> {
  if (!UUID.test(uuid)) throw new RangeError("not a UUID");
  return fromHex(uuid.replaceAll("-", ""));
}

function lengthFramed(part: Uint8Array): Uint8Array<ArrayBuffer> {
  const length = new Uint8Array(8);
  new DataView(length.buffer).setBigUint64(0, BigInt(part.length), false);
  return concat(length, part);
}

/** The associated data a record seals under (the reference's `associated_data`). */
export function associatedData(header: Uint8Array, binding: LockBinding): Uint8Array<ArrayBuffer> {
  const utf8 = new TextEncoder();
  return concat(
    header,
    uuidBytes(binding.account),
    lengthFramed(utf8.encode(binding.kind)),
    lengthFramed(utf8.encode(binding.key)),
  );
}

/**
 * The secret as the device holds it: a non-extractable HKDF base key. The
 * bytes the caller passed are not kept anywhere by this function.
 */
export function importLockSecret(secret: Uint8Array): Promise<CryptoKey> {
  if (secret.length !== LOCK_SECRET_LEN) {
    throw new RangeError(`a device-lock secret is ${LOCK_SECRET_LEN} bytes`);
  }
  return crypto.subtle.importKey("raw", secret.slice(), "HKDF", false, ["deriveKey"]);
}

function lockKey(base: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: salt.slice(), info: HKDF_INFO },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Seals one record. The salt and nonce parameters exist for the golden
 * vectors; production callers use the random defaults.
 */
export async function sealLockRecord(
  base: CryptoKey,
  binding: LockBinding,
  plaintext: Uint8Array,
  salt: Uint8Array = randomBytes(HKDF_SALT_LEN),
  nonce: Uint8Array = randomBytes(AES_NONCE_LEN),
): Promise<Uint8Array<ArrayBuffer>> {
  if (salt.length !== HKDF_SALT_LEN) throw new RangeError(`the HKDF salt is ${HKDF_SALT_LEN} bytes`);
  if (nonce.length !== AES_NONCE_LEN) throw new RangeError(`the AES-GCM nonce is ${AES_NONCE_LEN} bytes`);
  const header = concat(Uint8Array.of(VERSION), salt, nonce);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce.slice(), additionalData: associatedData(header, binding), tagLength: 128 },
    await lockKey(base, salt),
    plaintext.slice(),
  );
  return concat(header, new Uint8Array(ciphertext));
}

/** Opens one record under its lock and binding; a failing GCM tag refuses. */
export async function openLockRecord(
  base: CryptoKey,
  record: Uint8Array,
  binding: LockBinding,
): Promise<Uint8Array<ArrayBuffer>> {
  if (record.length <= HEADER_LEN) throw new DeviceLockError("malformed device-lock record");
  if (record[0] !== VERSION) throw new DeviceLockError(`unsupported device-lock version ${record[0]}`);
  const salt = record.slice(1, 1 + HKDF_SALT_LEN);
  const nonce = record.slice(1 + HKDF_SALT_LEN, HEADER_LEN);
  const header = record.slice(0, HEADER_LEN);
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce, additionalData: associatedData(header, binding), tagLength: 128 },
        await lockKey(base, salt),
        record.slice(HEADER_LEN),
      ),
    );
  } catch {
    throw new DeviceLockError("the record does not open under this lock and binding");
  }
}
