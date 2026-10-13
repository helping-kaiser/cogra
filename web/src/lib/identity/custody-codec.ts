// The plaintext form of one locked custody record (sign-out-custody §3.5).
//
// A lock encrypts bytes, while the records it locks are structured values
// holding bytes of their own — a parked handshake's pre-signature, a draft's
// pictures. JSON carries the structure; the byte fields ride as tagged base64
// so they come back as the same type they left as (`Uint8Array` stays a view,
// `ArrayBuffer` stays a buffer — the draft's stored shape uses both).
//
// The form never leaves this browser: a locked record is opened only here,
// by this build or a later one, so it is a local storage format and not a
// wire format. Nothing in it is pinned by the golden vectors; the encryption
// around it is.

import { fromBase64, toBase64 } from "@/lib/crypto/bytes";

const U8 = "$u8";
const AB = "$ab";

function replacer(this: unknown, key: string, value: unknown): unknown {
  // `JSON.stringify` hands a replacer the value AFTER `toJSON`, and neither
  // byte type has one, so the raw object arrives here.
  const raw = (this as Record<string, unknown>)[key];
  if (raw instanceof Uint8Array) return { [U8]: toBase64(raw) };
  if (raw instanceof ArrayBuffer) return { [AB]: toBase64(new Uint8Array(raw)) };
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1) {
      const tagged = value as Record<string, unknown>;
      if (typeof tagged[U8] === "string") return fromBase64(tagged[U8]);
      if (typeof tagged[AB] === "string") return fromBase64(tagged[AB]).buffer;
    }
  }
  return value;
}

export function encodeCustody(value: unknown): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(new TextEncoder().encode(JSON.stringify(value, replacer)));
}

export function decodeCustody<T>(bytes: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(bytes), reviver) as T;
}
