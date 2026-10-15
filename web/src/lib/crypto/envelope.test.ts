// @vitest-environment node
// The envelope decoder, pinned to the repo-root `envelope-vectors.json`
// exported from the Rust reference (`crates/common/tests/envelope_vectors.rs`):
// the same bytes, decoded to the same fields, refused for the same reasons
// Android's EnvelopeVectorsTest reads. Never transcribe a vector value.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { fromHex, toHex } from "./bytes";
import {
  decodeContent,
  decodeEnvelope,
  decodeProfile,
  encodeEnvelope,
  EnvelopeError,
  type CograContent,
  type CograProfile,
  type EnvelopeValue,
  type MediaAsset,
} from "./envelope";

type Rendered = unknown;

type EnvelopeVectors = {
  version: number;
  values: { name: string; hex: string; envelope: Rendered }[];
  content: { name: string; hex: string; admittedAtPrepare: boolean; content: Rendered }[];
  profile: { name: string; hex: string; profile: Rendered }[];
  refusals: { name: string; layer: "envelope" | "content" | "profile"; hex: string; refusal: string }[];
};

const vectors = JSON.parse(
  readFileSync(new URL("../../../../envelope-vectors.json", import.meta.url), "utf-8"),
) as EnvelopeVectors;

// The reference's own rendering (envelope_vectors.rs), so a decode is
// compared field for field rather than through this decoder's types.

function valueJson(v: EnvelopeValue): Rendered {
  switch (v.kind) {
    case "uint":
      return { uint: Number(v.value) };
    case "text":
      return { text: v.value };
    case "bytes":
      return { bytes: toHex(v.value) };
    case "bool":
      return { bool: v.value };
    case "array":
      return { array: v.items.map(valueJson) };
    case "map":
      return { map: v.entries.map(([k, item]) => [Number(k), valueJson(item)]) };
  }
}

function assetJson(a: MediaAsset): Rendered {
  return {
    digest: toHex(a.digest),
    mime: a.mime,
    altText: a.altText,
    cover: a.cover === null ? null : toHex(a.cover),
    coverTaken: a.coverTaken,
    uploadDigest: a.uploadDigest === null ? null : toHex(a.uploadDigest),
  };
}

function contentJson(c: CograContent): Rendered {
  return {
    node: c.node,
    title: c.title,
    description: c.description,
    body: c.body,
    media: c.media.map(assetJson),
    sensitive: c.sensitive === null ? null : { reason: c.sensitive.reason },
  };
}

function profileJson(p: CograProfile): Rendered {
  return {
    node: p.node,
    displayName: p.displayName,
    bio: p.bio,
    websiteUrl: p.websiteUrl,
    avatar:
      p.avatar.state === "set"
        ? { state: "set", asset: assetJson(p.avatar.asset) }
        : { state: p.avatar.state },
  };
}

function refusalOf(decode: () => unknown): string {
  try {
    decode();
  } catch (e) {
    if (e instanceof EnvelopeError) return e.refusal;
    throw e;
  }
  throw new Error("decoded what the reference refuses");
}

describe("the envelope vectors", () => {
  it("are the version this decoder reads", () => {
    expect(vectors.version).toBe(1);
  });

  it("the_device_decodes_every_envelope_vector_exactly_as_the_server_does", () => {
    for (const v of vectors.values) {
      const decoded = decodeEnvelope(fromHex(v.hex));
      expect(
        {
          version: decoded.version.map(Number),
          body: decoded.body,
          extensions: decoded.extensions.map(([k, item]) => [Number(k), valueJson(item)]),
        },
        v.name,
      ).toEqual(v.envelope);
    }
    for (const v of vectors.content) {
      expect(contentJson(decodeContent(fromHex(v.hex))), v.name).toEqual(v.content);
    }
    for (const v of vectors.profile) {
      expect(profileJson(decodeProfile(fromHex(v.hex))), v.name).toEqual(v.profile);
    }
  });

  it("a_re_encoded_decode_reproduces_the_envelope_bytes", () => {
    for (const v of [...vectors.values, ...vectors.content, ...vectors.profile]) {
      expect(toHex(encodeEnvelope(decodeEnvelope(fromHex(v.hex)))), v.name).toBe(v.hex);
    }
  });

  it("the_device_refuses_every_negative_envelope_vector", () => {
    for (const v of vectors.refusals) {
      const bytes = fromHex(v.hex);
      const decode =
        v.layer === "envelope"
          ? () => decodeEnvelope(bytes)
          : v.layer === "content"
            ? () => decodeContent(bytes)
            : () => decodeProfile(bytes);
      expect(refusalOf(decode), v.name).toBe(v.refusal);
    }
  });

  it("an_envelope_with_an_unknown_guild_field_is_refused_on_device", () => {
    const provenance = vectors.refusals.find((v) => v.name === "the unbuilt provenance key");
    expect(provenance).toBeDefined();
    expect(refusalOf(() => decodeContent(fromHex(provenance!.hex)))).toBe(
      "cogra guild schema: unknown cogra field",
    );
  });

  it("a_manifest_entry_with_an_unknown_key_is_refused_on_device", () => {
    const unknown = vectors.refusals.find((v) => v.name === "a manifest entry with an unknown key");
    expect(unknown).toBeDefined();
    expect(refusalOf(() => decodeContent(fromHex(unknown!.hex)))).toBe(
      "cogra guild schema: unknown media entry field",
    );
  });

  it("landed_history_without_an_upload_digest_still_reads", () => {
    const landed = vectors.content.filter((v) => !v.admittedAtPrepare);
    expect(landed.length).toBeGreaterThan(0);
    for (const v of landed) {
      const decoded = decodeContent(fromHex(v.hex));
      expect(decoded.media.some((asset) => asset.uploadDigest === null), v.name).toBe(true);
    }
  });

  it("every_manifest_entry_carries_both_the_rendition_and_the_upload_digest", () => {
    for (const v of vectors.content.filter((c) => c.admittedAtPrepare)) {
      for (const asset of decodeContent(fromHex(v.hex)).media) {
        expect(asset.uploadDigest, v.name).not.toBeNull();
      }
    }
  });
});
