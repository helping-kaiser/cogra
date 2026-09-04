// The key-backup blob, format v1 (auth.md "Blob format (v1)"): the
// actor seed sealed on-device under a generated recovery code. One
// format across every client — a blob sealed on the phone must open in
// the browser; the golden vectors pin every byte.

import type { ActorKey } from "./actor-key";
import { concat, randomBytes } from "./bytes";
import { CborDecodeError, CborDecoder, CborEncoder } from "./cbor";
import { sha256Tagged } from "./hashing";

/** A blob that will not open: wrong code, tampered bytes, or bad format. */
export class KeyBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyBackupError";
  }
}

/**
 * The input is not a recovery code's length. It is the one parse
 * failure a reader can act on — characters are missing or spare. Every
 * other rejection of a full-length input, an unusable character or the
 * trailing pad bits, is a code that will not open, which is what the
 * GCM tag would have said a moment later.
 */
export class RecoveryCodeLengthError extends KeyBackupError {
  constructor(message: string) {
    super(message);
    this.name = "RecoveryCodeLengthError";
  }
}

const VERSION = 0x01;
const CODE_LEN = 16;
const HKDF_SALT_LEN = 16;
const AES_NONCE_LEN = 12;
const HKDF_INFO = "cogra:key-backup:v1";
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * What a typed or pasted code may carry between its characters, as THE
 * REFERENCE defines it: a hyphen, every character Unicode gives the
 * `White_Space` property, and U+FEFF — a byte-order mark rides along on
 * a paste often enough to be worth naming.
 *
 * The class is STATED rather than inherited from a language's shorthand,
 * because no two of the three clients spell "whitespace" the same.
 * JavaScript's `\s` is `White_Space` minus U+0085 plus U+FEFF; Kotlin's
 * `Char.isWhitespace` adds U+001C-U+001F and drops U+0085. Writing
 * `\p{White_Space}` says what is meant in one term, and the two ends it
 * pins down are real: a code pasted with a next-line separator (U+0085)
 * opens, and one carrying a unit separator (U+001C, which Unicode does
 * NOT call white space) is refused rather than silently repaired.
 *
 * Built from a source string so the file stays ASCII: a literal BOM in
 * a character class is invisible to every reader of this line.
 */
const SEPARATORS = new RegExp("[-\\p{White_Space}\\uFEFF]", "gu");

/**
 * The upload proof's domain tag. Storing a blob is an L2 operation, not
 * an L1 act, so it carries this module's `cogra:key-backup:*` prefix
 * rather than one of the `cogra-l1:` act tags.
 */
export const UPLOAD_PROOF_TAG = "cogra:key-backup-upload:v1";

/** A 16-byte recovery code and its display/normalization rules. */
export class RecoveryCode {
  constructor(readonly bytes: Uint8Array) {
    if (bytes.length !== CODE_LEN) {
      throw new RangeError(`a recovery code is ${CODE_LEN} bytes`);
    }
  }

  /** The display form: 26 Crockford characters grouped 5-5-5-5-6. */
  display(): string {
    let bits = 0;
    let nbits = 0;
    let chars = "";
    for (const b of this.bytes) {
      bits = (bits << 8) | b;
      nbits += 8;
      while (nbits >= 5) {
        nbits -= 5;
        chars += CROCKFORD[(bits >> nbits) & 31];
      }
    }
    if (nbits > 0) chars += CROCKFORD[(bits << (5 - nbits)) & 31];
    if (chars.length !== 26) throw new Error("16 code bytes encode to 26 characters");
    return [
      [0, 5],
      [5, 10],
      [10, 15],
      [15, 20],
      [20, 26],
    ]
      .map(([from, to]) => chars.slice(from, to))
      .join("-");
  }

  static generate(): RecoveryCode {
    return new RecoveryCode(randomBytes(CODE_LEN));
  }

  /**
   * The reading rule for anything a user typed: uppercase, `I`/`L` →
   * `1`, `O` → `0`, {@link SEPARATORS} stripped. Applies to a fragment
   * as much as to a whole code, which is what lets the write-it-down
   * confirmation compare a typed code against the one on screen.
   */
  static normalize(input: string): string {
    return input
      .toUpperCase()
      .replaceAll("I", "1")
      .replaceAll("L", "1")
      .replaceAll("O", "0")
      .replace(SEPARATORS, "");
  }

  /**
   * Parses user input under {@link RecoveryCode.normalize}. No check
   * digit — AES-GCM's tag detects a mistyped code at unlock.
   */
  static fromInput(input: string): RecoveryCode {
    const normalized = RecoveryCode.normalize(input);
    if (normalized.length !== 26) {
      throw new RecoveryCodeLengthError("a recovery code has 26 characters");
    }
    let bits = 0;
    let nbits = 0;
    const out = new Uint8Array(CODE_LEN);
    let at = 0;
    for (const c of normalized) {
      const v = CROCKFORD.indexOf(c);
      if (v < 0) throw new KeyBackupError(`invalid recovery-code character \`${c}\``);
      bits = (bits << 5) | v;
      nbits += 5;
      if (nbits >= 8) {
        nbits -= 8;
        out[at++] = (bits >> nbits) & 0xff;
      }
    }
    // 26 chars carry 130 bits; the trailing 2 pad bits must be zero.
    if ((bits & ((1 << nbits) - 1)) !== 0) {
      throw new KeyBackupError("invalid recovery code");
    }
    return new RecoveryCode(out);
  }
}

const HKDF_INFO_BYTES = Uint8Array.from(new TextEncoder().encode(HKDF_INFO));

async function contentKey(code: RecoveryCode, salt: Uint8Array): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey("raw", code.bytes.slice(), "HKDF", false, ["deriveBits"]);
  const okm = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt.slice(), info: HKDF_INFO_BYTES },
    ikm,
    256,
  );
  return crypto.subtle.importKey("raw", okm, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/**
 * Seals the actor seed under the recovery code. The salt and nonce
 * parameters exist for the golden vectors; production callers use the
 * random defaults.
 */
export async function sealKeyBackup(
  seed: Uint8Array,
  code: RecoveryCode,
  salt: Uint8Array = randomBytes(HKDF_SALT_LEN),
  nonce: Uint8Array = randomBytes(AES_NONCE_LEN),
): Promise<Uint8Array<ArrayBuffer>> {
  if (seed.length !== 32) throw new RangeError("an actor seed is 32 bytes");
  if (salt.length !== HKDF_SALT_LEN) throw new RangeError(`the HKDF salt is ${HKDF_SALT_LEN} bytes`);
  if (nonce.length !== AES_NONCE_LEN) throw new RangeError(`the AES-GCM nonce is ${AES_NONCE_LEN} bytes`);
  const plaintext = new CborEncoder().array(2n).bytes(seed).uint(1n).finish();
  const header = concat(Uint8Array.of(VERSION), salt, nonce);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce.slice(), additionalData: header, tagLength: 128 },
    await contentKey(code, salt),
    plaintext,
  );
  return concat(header, new Uint8Array(ciphertext));
}

/**
 * Opens a blob with the recovery code, returning the actor seed. A
 * failing GCM tag — mistyped code or tampered blob — throws; so does
 * any malformed container.
 */
export async function openKeyBackup(
  blob: Uint8Array,
  code: RecoveryCode,
): Promise<Uint8Array<ArrayBuffer>> {
  const headerLen = 1 + HKDF_SALT_LEN + AES_NONCE_LEN;
  if (blob.length <= headerLen) throw new KeyBackupError("blob too short");
  if (blob[0] !== VERSION) throw new KeyBackupError(`unsupported blob version ${blob[0]}`);
  const salt = blob.slice(1, 1 + HKDF_SALT_LEN);
  const nonce = blob.slice(1 + HKDF_SALT_LEN, headerLen);
  const header = blob.slice(0, headerLen);
  let plaintext: Uint8Array;
  try {
    plaintext = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce, additionalData: header, tagLength: 128 },
        await contentKey(code, salt),
        blob.slice(headerLen),
      ),
    );
  } catch {
    throw new KeyBackupError("the blob does not open under this code");
  }
  try {
    const d = new CborDecoder(plaintext);
    if (d.array() !== 2n) throw new KeyBackupError("malformed blob container");
    const seed = d.bytes();
    if (d.uint() !== 1n) throw new KeyBackupError("unsupported blob container version");
    d.finish();
    if (seed.length !== 32) throw new KeyBackupError("malformed blob container");
    return seed;
  } catch (e) {
    if (e instanceof CborDecodeError) {
      throw new KeyBackupError(`malformed blob container: ${e.message}`);
    }
    throw e;
  }
}

/**
 * The upload proof (auth.md "Key recovery"): the actor key signs the
 * server's challenge bound to the exact blob bytes. Binding the blob is
 * what stops a captured signature from authorizing different
 * ciphertext; binding the challenge is what stops the whole pair from
 * being replayed.
 */
export async function signUpload(
  key: ActorKey,
  challenge: Uint8Array,
  blob: Uint8Array,
): Promise<Uint8Array> {
  return key.signTagged(UPLOAD_PROOF_TAG, await sha256Tagged(UPLOAD_PROOF_TAG, [challenge, blob]));
}
