// Shared byte utilities for the crypto modules — platform-neutral over
// TextEncoder/TextDecoder and crypto.getRandomValues.

export function toHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

export function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new RangeError("invalid hex input");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  }
  return out;
}

export function concat(...parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  let length = 0;
  for (const p of parts) length += p.length;
  const out = new Uint8Array(length);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

// Standard base64 with padding — the wire form of every byte field the
// API carries (canonicalProposal, verifiedAct, signature, blob). Built
// on atob/btoa, which browsers and Node both provide; loops instead of
// String.fromCharCode.apply keep large blobs off the call stack.

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  let bin: string;
  try {
    bin = atob(s);
  } catch {
    throw new RangeError("invalid base64 input");
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
