// Canonical serialization for seam objects — the deterministic subset of
// CBOR (RFC 8949) the deployment fixed: definite lengths only,
// shortest-form integer heads, IEEE 754 double-precision floats, field
// order fixed by the encoder, no maps. Byte-for-byte the encoding of
// crates/common/src/l1/encoding.rs (Android mirror:
// android/core/crypto Cbor.kt); the golden vectors pin the layout.

import { concat } from "./bytes";

const U64_MAX = 0xffff_ffff_ffff_ffffn;

/** A decode failure over the deterministic subset. */
export class CborDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CborDecodeError";
  }
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

/** Deterministic CBOR writer over the subset the seam needs. */
export class CborEncoder {
  private readonly chunks: Uint8Array[] = [];

  finish(): Uint8Array<ArrayBuffer> {
    return concat(...this.chunks);
  }

  private head(major: number, value: bigint): void {
    if (value < 0n || value > U64_MAX) {
      throw new RangeError("a CBOR head value is unsigned 64-bit");
    }
    const m = major << 5;
    if (value <= 23n) {
      this.chunks.push(Uint8Array.of(m | Number(value)));
    } else if (value <= 0xffn) {
      this.chunks.push(Uint8Array.of(m | 24, Number(value)));
    } else if (value <= 0xffffn) {
      const b = new Uint8Array(3);
      b[0] = m | 25;
      new DataView(b.buffer).setUint16(1, Number(value));
      this.chunks.push(b);
    } else if (value <= 0xffff_ffffn) {
      const b = new Uint8Array(5);
      b[0] = m | 26;
      new DataView(b.buffer).setUint32(1, Number(value));
      this.chunks.push(b);
    } else {
      const b = new Uint8Array(9);
      b[0] = m | 27;
      new DataView(b.buffer).setBigUint64(1, value);
      this.chunks.push(b);
    }
  }

  uint(v: bigint): CborEncoder {
    this.head(0, v);
    return this;
  }

  bytes(b: Uint8Array): CborEncoder {
    this.head(2, BigInt(b.length));
    this.chunks.push(b);
    return this;
  }

  text(s: string): CborEncoder {
    const utf8 = utf8Encoder.encode(s);
    this.head(3, BigInt(utf8.length));
    this.chunks.push(utf8);
    return this;
  }

  array(len: bigint): CborEncoder {
    this.head(4, len);
    return this;
  }

  /**
   * Doubles are always encoded in the 8-byte form — one representation
   * per value, no shortest-float search.
   */
  float(v: number): CborEncoder {
    const b = new Uint8Array(9);
    b[0] = 0xfb;
    new DataView(b.buffer).setFloat64(1, v);
    this.chunks.push(b);
    return this;
  }

  nul(): CborEncoder {
    this.chunks.push(Uint8Array.of(0xf6));
    return this;
  }
}

/**
 * Reader over the same deterministic subset the {@link CborEncoder}
 * writes. Decoding is lenient about head widths — the signing bases are
 * always re-encoded canonically from the decoded values, so wire-level
 * canonicality is never load-bearing.
 */
export class CborDecoder {
  private pos = 0;

  constructor(private readonly input: Uint8Array) {}

  private byte(): number {
    if (this.pos >= this.input.length) {
      throw new CborDecodeError(`unexpected end of input at byte ${this.pos}`);
    }
    return this.input[this.pos++];
  }

  private take(n: number): Uint8Array<ArrayBuffer> {
    if (n < 0 || this.pos + n > this.input.length) {
      throw new CborDecodeError(`unexpected end of input at byte ${this.pos}`);
    }
    const slice = this.input.slice(this.pos, this.pos + n);
    this.pos += n;
    return slice;
  }

  private head(major: number, expected: string): bigint {
    const at = this.pos;
    const b = this.byte();
    if (b >> 5 !== major) {
      throw new CborDecodeError(`expected ${expected} at byte ${at}, found major type ${b >> 5}`);
    }
    const info = b & 0x1f;
    if (info <= 23) return BigInt(info);
    if (info === 24) return BigInt(this.byte());
    if (info === 25 || info === 26 || info === 27) {
      const width = info === 25 ? 2 : info === 26 ? 4 : 8;
      let acc = 0n;
      for (const x of this.take(width)) acc = (acc << 8n) | BigInt(x);
      return acc;
    }
    throw new CborDecodeError(`unsupported head byte 0x${b.toString(16).padStart(2, "0")}`);
  }

  uint(): bigint {
    return this.head(0, "uint");
  }

  bytes(): Uint8Array<ArrayBuffer> {
    const len = this.head(2, "bytes");
    return this.take(this.lengthToInt(len));
  }

  text(): string {
    const len = this.head(3, "text");
    const raw = this.take(this.lengthToInt(len));
    try {
      return utf8Decoder.decode(raw);
    } catch {
      throw new CborDecodeError("invalid UTF-8 in text item");
    }
  }

  array(): bigint {
    return this.head(4, "array");
  }

  float(): number {
    const at = this.pos;
    const b = this.byte();
    if (b !== 0xfb) {
      throw new CborDecodeError(`expected float at byte ${at}, found major type ${b >> 5}`);
    }
    const raw = this.take(8);
    return new DataView(raw.buffer, raw.byteOffset, 8).getFloat64(0);
  }

  /** A text item or the null sentinel. */
  textOrNull(): string | null {
    if (this.pos < this.input.length && this.input[this.pos] === 0xf6) {
      this.pos += 1;
      return null;
    }
    return this.text();
  }

  /** Asserts the input is fully consumed. */
  finish(): void {
    const rest = this.input.length - this.pos;
    if (rest !== 0) throw new CborDecodeError(`${rest} bytes of trailing input`);
  }

  private lengthToInt(len: bigint): number {
    if (len > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new CborDecodeError(`unexpected end of input at byte ${this.pos}`);
    }
    return Number(len);
  }
}
