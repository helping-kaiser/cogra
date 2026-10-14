// The payload envelope, read on the device (reference:
// crates/common/src/envelope/{pce,cogra,media}.rs; Android mirror:
// android/core/crypto Envelope.kt). The server builds every envelope and
// the device signs it; reading it here is what lets the intent check
// compare a payload's FIELDS against the form, rather than trusting the
// server's rendering of what it put inside.
//
// TWO LAYERS, TWO OWNERS. `decodeEnvelope` is the L1 team's Peer Content
// Envelope (PCE v0.1.0): the magic tag 55799, a deterministic CBOR map with
// a four-axis version vector at key 0, a text body at key 1, and an
// extension map at key 2 whose keys from 100 up belong to guilds. Its gates
// run in the reference's order — magic, shape, package version, top-level
// key set, the §4.2 reserved range, the §4.4 empty-by-omission rule — and
// canonicality is checked the way the reference checks it: what was read is
// re-serialized, and anything that does not reproduce its own bytes is
// refused. `decodeContent` and `decodeProfile` are CoGra's guild schema
// under key 49258, the manifest's per-asset map included.
//
// DECODE ONLY, BY DESIGN. Nothing on the device produces an envelope; the
// encoder half below exists for the canonicality check alone.
//
// REFUSALS SPEAK THE REFERENCE'S WORDS. Every refusal carries the sentence
// the Rust decoder's error displays, so `envelope-vectors.json` pins the
// two readers to the same verdict AND the same reason. A refusal from the
// CBOR layer itself reads `decode`: the codec's wording is not contract.
//
// The upload digest (manifest key 5) is read as optional: payloads landed
// before it existed carry none, and the refusal of an entry without it is
// the prepare's, not the reader's. The intent check, which knows what the
// device uploaded, refuses its absence in a payload being signed now.

import { toHex } from "./bytes";
import { CborDecodeError, CborDecoder, CborEncoder } from "./cbor";

/** The self-describe tag every envelope is wrapped in (PCE §1.1). */
export const MAGIC_TAG = 55799n;
/** CoGra's guild key: 0xC06A. */
export const COGRA_GUILD_KEY = 49258n;
export const MEDIA_DIGEST_LEN = 32;

/** One decoded extension value, tagged by its CBOR type. */
export type EnvelopeValue =
  | { readonly kind: "uint"; readonly value: bigint }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "bytes"; readonly value: Uint8Array }
  | { readonly kind: "bool"; readonly value: boolean }
  | { readonly kind: "array"; readonly items: readonly EnvelopeValue[] }
  | { readonly kind: "map"; readonly entries: readonly (readonly [bigint, EnvelopeValue])[] };

export type Envelope = {
  readonly version: readonly [bigint, bigint, bigint, bigint];
  readonly body: string;
  /** Ascending by key; empty when key 2 is absent. */
  readonly extensions: readonly (readonly [bigint, EnvelopeValue])[];
};

/** One manifest entry (guild key 5's array, or the avatar slot's one). */
export type MediaAsset = {
  /** The rendition digest — the bytes the asset serves (key 0). */
  readonly digest: Uint8Array;
  readonly mime: string;
  readonly altText: string | null;
  readonly cover: Uint8Array | null;
  readonly coverTaken: boolean;
  /** The upload digest — the bytes the device sent (key 5); null in landed history. */
  readonly uploadDigest: Uint8Array | null;
};

export type SensitiveMark = { readonly reason: string | null };

/** A Publish or Review payload's guild fields. */
export type CograContent = {
  /** The L2 node id, lowercase hyphenated. */
  readonly node: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly body: string | null;
  readonly media: readonly MediaAsset[];
  readonly sensitive: SensitiveMark | null;
};

/** The avatar slot: three-valued, each value one encoding. */
export type AvatarSlot =
  | { readonly state: "untouched" }
  | { readonly state: "cleared" }
  | { readonly state: "set"; readonly asset: MediaAsset };

/** A profile update's guild fields. */
export type CograProfile = {
  readonly node: string;
  readonly displayName: string | null;
  readonly bio: string | null;
  readonly websiteUrl: string | null;
  readonly avatar: AvatarSlot;
};

/** The device refused a payload; `refusal` is the reference's own sentence. */
export class EnvelopeError extends Error {
  constructor(readonly refusal: string) {
    super(refusal);
    this.name = "EnvelopeError";
  }
}

function guild(message: string): EnvelopeError {
  return new EnvelopeError(`cogra guild schema: ${message}`);
}

function shape(message: string): EnvelopeError {
  return new EnvelopeError(`malformed envelope: ${message}`);
}

const NON_CANONICAL = "non-canonical envelope encoding";

// ---- the PCE layer ---------------------------------------------------------

function decodeValue(d: CborDecoder): EnvelopeValue {
  switch (d.peekMajor()) {
    case 0:
      return { kind: "uint", value: d.uint() };
    case 2:
      return { kind: "bytes", value: d.bytes() };
    case 3:
      return { kind: "text", value: d.text() };
    case 7:
      return { kind: "bool", value: d.bool() };
    case 4: {
      // Never pre-sized from the declared count: the count is the sender's,
      // the bytes behind it are not, so growth stays bounded by what is there.
      const len = d.array();
      const items: EnvelopeValue[] = [];
      for (let i = 0n; i < len; i++) items.push(decodeValue(d));
      return { kind: "array", items };
    }
    case 5: {
      const len = d.map();
      const entries: (readonly [bigint, EnvelopeValue])[] = [];
      let last: bigint | null = null;
      for (let i = 0n; i < len; i++) {
        const k = d.uint();
        if (last !== null && k <= last) throw new EnvelopeError(NON_CANONICAL);
        last = k;
        entries.push([k, decodeValue(d)]);
      }
      return { kind: "map", entries };
    }
    default:
      throw shape("unsupported extension value type");
  }
}

function encodeValue(e: CborEncoder, v: EnvelopeValue): void {
  switch (v.kind) {
    case "uint":
      e.uint(v.value);
      return;
    case "text":
      e.text(v.value);
      return;
    case "bytes":
      e.bytes(v.value);
      return;
    case "bool":
      e.bool(v.value);
      return;
    case "array":
      e.array(BigInt(v.items.length));
      for (const item of v.items) encodeValue(e, item);
      return;
    case "map":
      e.map(BigInt(v.entries.length));
      for (const [k, item] of v.entries) {
        e.uint(k);
        encodeValue(e, item);
      }
      return;
  }
}

/** The canonical serialization of a decoded envelope (PCE §5). */
export function encodeEnvelope(envelope: Envelope): Uint8Array<ArrayBuffer> {
  const e = new CborEncoder();
  e.tag(MAGIC_TAG);
  e.map(envelope.extensions.length === 0 ? 2n : 3n);
  e.uint(0n).array(4n);
  for (const axis of envelope.version) e.uint(axis);
  e.uint(1n).text(envelope.body);
  if (envelope.extensions.length > 0) {
    e.uint(2n).map(BigInt(envelope.extensions.length));
    for (const [k, v] of envelope.extensions) {
      e.uint(k);
      encodeValue(e, v);
    }
  }
  return e.finish();
}

function isEmptyRegistered(v: EnvelopeValue): boolean {
  return (v.kind === "text" && v.value.length === 0) || (v.kind === "bytes" && v.value.length === 0);
}

function decodePce(bytes: Uint8Array): Envelope {
  if (bytes.length < 3 || bytes[0] !== 0xd9 || bytes[1] !== 0xd9 || bytes[2] !== 0xf7) {
    throw new EnvelopeError("not a content envelope (missing magic tag)");
  }
  const d = new CborDecoder(bytes);
  if (d.tag() !== MAGIC_TAG) throw new EnvelopeError("not a content envelope (missing magic tag)");
  const pairs = d.map();
  if (pairs < 2n || pairs > 3n) throw shape("top-level map must have 2–3 keys");
  if (d.uint() !== 0n) throw shape("first key must be 0 (version)");
  if (d.array() !== 4n) throw shape("version vector must have 4 axes");
  const version: [bigint, bigint, bigint, bigint] = [d.uint(), d.uint(), d.uint(), d.uint()];
  if (version[0] !== 1n) throw new EnvelopeError(`unknown package version ${version[0]}`);
  if (d.uint() !== 1n) throw shape("second key must be 1 (body)");
  const body = d.text();
  const extensions: (readonly [bigint, EnvelopeValue])[] = [];
  if (pairs === 3n) {
    const key = d.uint();
    if (key !== 2n) {
      throw new EnvelopeError(`top-level key ${key} is not allowed at package version 1`);
    }
    const len = d.map();
    if (len === 0n) throw new EnvelopeError("empty value for optional key 2 must be omitted");
    let last: bigint | null = null;
    for (let i = 0n; i < len; i++) {
      const k = d.uint();
      if (last !== null && k <= last) throw new EnvelopeError(NON_CANONICAL);
      last = k;
      const v = decodeValue(d);
      if (k >= 4n && k < 100n) throw new EnvelopeError(`reserved extension key ${k} is not allocated`);
      if (k < 4n && isEmptyRegistered(v)) {
        throw new EnvelopeError(`empty value for optional key ${k} must be omitted`);
      }
      extensions.push([k, v]);
    }
  }
  d.finish();
  const envelope: Envelope = { version, body, extensions };
  const again = encodeEnvelope(envelope);
  if (again.length !== bytes.length || again.some((b, i) => b !== bytes[i])) {
    throw new EnvelopeError(NON_CANONICAL);
  }
  return envelope;
}

/**
 * Decodes and admission-checks one envelope — the PCE gates the reference
 * runs (crates/common/src/envelope/pce.rs `Envelope::decode`).
 */
export function decodeEnvelope(bytes: Uint8Array): Envelope {
  try {
    return decodePce(bytes);
  } catch (e) {
    if (e instanceof CborDecodeError) throw new EnvelopeError("decode");
    throw e;
  }
}

// ---- CoGra's guild schema ---------------------------------------------------

function lookup(
  entries: readonly (readonly [bigint, EnvelopeValue])[],
  key: bigint,
): EnvelopeValue | undefined {
  return entries.find(([k]) => k === key)?.[1];
}

type GuildMap = readonly (readonly [bigint, EnvelopeValue])[];

/** The admission both families run first: v1 vector, empty body, one guild key, schema 1. */
function cograGuildMap(envelope: Envelope): GuildMap {
  if (envelope.version.some((axis) => axis !== 1n)) throw guild("unsupported version vector");
  if (envelope.body.length > 0) throw guild("key-1 body must be empty");
  if (envelope.extensions.length !== 1) throw guild("exactly one guild key expected");
  const map = lookup(envelope.extensions, COGRA_GUILD_KEY);
  if (map?.kind !== "map") throw guild("missing cogra guild map");
  const version = lookup(map.entries, 0n);
  if (version?.kind !== "uint" || version.value !== 1n) {
    throw guild("unsupported cogra schema version");
  }
  return map.entries;
}

function uuidOf(b: Uint8Array): string {
  const h = toHex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function nodeId(map: GuildMap): string {
  const v = lookup(map, 1n);
  if (v?.kind !== "bytes") throw guild("missing node id");
  if (v.value.length !== 16) throw guild("node id must be 16 bytes");
  return uuidOf(v.value);
}

function textField(map: GuildMap, key: bigint): string | null {
  const v = lookup(map, key);
  if (v === undefined) return null;
  if (v.kind !== "text") throw guild("text field with non-text value");
  return v.value;
}

function sizedDigest(value: Uint8Array, message: string): Uint8Array {
  if (value.length !== MEDIA_DIGEST_LEN) throw guild(message);
  return value;
}

/** One entry's admission (media.rs `MediaAsset::decode`). */
function decodeAsset(value: EnvelopeValue): MediaAsset {
  if (value.kind !== "map") throw guild("media entry must be a map");
  const map = value.entries;
  if (map.some(([k]) => k > 5n)) throw guild("unknown media entry field");
  const digest = lookup(map, 0n);
  if (digest?.kind !== "bytes") throw guild("missing media digest");
  const rendition = sizedDigest(digest.value, "media digest must be 32 bytes");
  const mime = lookup(map, 1n);
  if (mime?.kind !== "text") throw guild("missing media mime");
  if (mime.value.length === 0) throw guild("media mime must not be empty");
  const alt = lookup(map, 2n);
  let altText: string | null = null;
  if (alt !== undefined) {
    if (alt.kind !== "text") throw guild("media alt text must be text");
    if (alt.value.length === 0) throw guild("empty media alt text must be omitted");
    altText = alt.value;
  }
  const coverValue = lookup(map, 3n);
  let cover: Uint8Array | null = null;
  if (coverValue !== undefined) {
    if (coverValue.kind !== "bytes") throw guild("media cover must be a digest");
    cover = sizedDigest(coverValue.value, "media cover must be 32 bytes");
  }
  const taken = lookup(map, 4n);
  let coverTaken = false;
  if (taken !== undefined) {
    if (cover === null) throw guild("media cover-taken requires a cover");
    if (taken.kind !== "bool") throw guild("media cover-taken must be a boolean");
    if (!taken.value) throw guild("media cover-taken must be omitted rather than false");
    coverTaken = true;
  }
  const upload = lookup(map, 5n);
  let uploadDigest: Uint8Array | null = null;
  if (upload !== undefined) {
    if (upload.kind !== "bytes") throw guild("media upload digest must be a digest");
    uploadDigest = sizedDigest(upload.value, "media upload digest must be 32 bytes");
  }
  return { digest: rendition, mime: mime.value, altText, cover, coverTaken, uploadDigest };
}

const CONTENT_KEYS: readonly bigint[] = [0n, 1n, 2n, 3n, 4n, 5n, 13n, 14n];
const PROFILE_KEYS: readonly bigint[] = [0n, 1n, 7n, 8n, 9n, 11n];
const RETIRED_COVER_KEY = 12n;

function guildMedia(map: GuildMap): MediaAsset[] {
  const v = lookup(map, 5n);
  if (v === undefined) return [];
  if (v.kind !== "array") throw guild("media manifest must be an array");
  if (v.items.length === 0) throw guild("empty media manifest must be omitted");
  return v.items.map(decodeAsset);
}

function guildSensitive(map: GuildMap): SensitiveMark | null {
  const reason = textField(map, 14n);
  const mark = lookup(map, 13n);
  if (mark === undefined) {
    if (reason !== null) throw guild("sensitive reason without the mark");
    return null;
  }
  if (mark.kind === "uint" && mark.value === 1n) return { reason };
  throw guild("sensitive mark with an unexpected value");
}

function guildAvatar(map: GuildMap): AvatarSlot {
  const v = lookup(map, 11n);
  if (v === undefined) return { state: "untouched" };
  if (v.kind !== "array") throw guild("a profile image must be an array");
  if (v.items.length === 0) return { state: "cleared" };
  if (v.items.length > 1) throw guild("a profile image is a single asset");
  return { state: "set", asset: decodeAsset(v.items[0]) };
}

/** A Publish/Review payload: envelope gates, then the content family's admission. */
export function decodeContent(bytes: Uint8Array): CograContent {
  const map = cograGuildMap(decodeEnvelope(bytes));
  if (map.some(([k]) => !CONTENT_KEYS.includes(k))) throw guild("unknown cogra field");
  const node = nodeId(map);
  const title = textField(map, 2n);
  const description = textField(map, 3n);
  const body = textField(map, 4n);
  const media = guildMedia(map);
  const sensitive = guildSensitive(map);
  return { node, title, description, body, media, sensitive };
}

/** A profile update's payload: envelope gates, then the profile family's admission. */
export function decodeProfile(bytes: Uint8Array): CograProfile {
  const map = cograGuildMap(decodeEnvelope(bytes));
  for (const [k] of map) {
    if (k === RETIRED_COVER_KEY) throw guild("retired cogra profile field");
    if (!PROFILE_KEYS.includes(k)) throw guild("unknown cogra profile field");
  }
  const node = nodeId(map);
  const displayName = textField(map, 7n);
  const bio = textField(map, 8n);
  const websiteUrl = textField(map, 9n);
  const avatar = guildAvatar(map);
  return { node, displayName, bio, websiteUrl, avatar };
}
