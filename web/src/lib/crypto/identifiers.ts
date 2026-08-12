// Identifier algebra (reference: crates/common/src/l1/identifier.rs):
//   I ::= addr(a) | prof(a) | name(s) | mint(α)
// with α an authored-act identifier act(author, s_q, family). The
// canonical text encoding is the deployment's verbatim record-identifier
// form: `addr:<a>`, `prof:<a>`, `name:<s>`, `mint:<act>` with
// `<act> = act:<author-addr>:<seq>:<family>`.

import { U64_MAX } from "./cbor";

/** An identifier that does not parse under the algebra. */
export class IdentifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentifierError";
  }
}

/** The record families of the L1 edge census, by census wire name. */
export const FAMILIES = [
  "registration",
  "publish",
  "opinion",
  "affinity",
  "participant",
  "owner",
  "join-request",
  "accept",
  "ratify",
  "withdraw",
  "rescind",
  "leave",
  "tag",
  "review",
  "bid",
  "invitation",
  "de-invite",
  "send",
  "reference",
] as const;

export type Family = (typeof FAMILIES)[number];

export function parseFamily(s: string): Family {
  const family = FAMILIES.find((f) => f === s);
  if (family === undefined) throw new IdentifierError(`unknown family \`${s}\``);
  return family;
}


/**
 * Charset for L0 addresses and Type names inside identifiers: ASCII
 * alphanumerics plus `-`, `_`, `.` — keeps the `:`-separated canonical
 * text encoding unambiguous.
 */
function requireAtom(s: string): string {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(s)) {
    throw new IdentifierError(`invalid atom \`${s}\`: must be 1-128 chars of [A-Za-z0-9._-]`);
  }
  return s;
}

/**
 * An authored-act identifier: act(author, s_q, family) — chosen by the
 * actor before submission, no host-assigned component.
 */
export class ActId {
  constructor(
    readonly author: string,
    readonly seq: bigint,
    readonly family: Family,
  ) {
    requireAtom(author);
    if (seq < 0n || seq > U64_MAX) {
      throw new RangeError("an act sequence is an unsigned 64-bit value");
    }
  }

  toString(): string {
    return `act:${this.author}:${this.seq}:${this.family}`;
  }

  static parse(s: string): ActId {
    if (!s.startsWith("act:")) throw new IdentifierError(`unparseable identifier \`${s}\``);
    const rest = s.slice("act:".length);
    const i = rest.indexOf(":");
    const j = i < 0 ? -1 : rest.indexOf(":", i + 1);
    if (i < 0 || j < 0) throw new IdentifierError(`unparseable identifier \`${s}\``);
    const seqText = rest.slice(i + 1, j);
    if (!/^[0-9]+$/.test(seqText) || BigInt(seqText) > U64_MAX) {
      throw new IdentifierError(`invalid sequence value \`${seqText}\``);
    }
    return new ActId(rest.slice(0, i), BigInt(seqText), parseFamily(rest.slice(j + 1)));
  }
}

/**
 * A node identifier, classed by outermost constructor: grounded
 * (`addr`, `prof`), named (`name`), minted (`mint`).
 */
export abstract class NodeId {
  abstract toString(): string;

  static parse(s: string): NodeId {
    if (s.startsWith("addr:")) return new AddrId(s.slice("addr:".length));
    if (s.startsWith("prof:")) return new ProfId(s.slice("prof:".length));
    if (s.startsWith("name:")) return new NameId(s.slice("name:".length));
    if (s.startsWith("mint:")) return new MintId(ActId.parse(s.slice("mint:".length)));
    throw new IdentifierError(`unparseable identifier \`${s}\``);
  }
}

/** Actor — grounded in an L0 address. */
export class AddrId extends NodeId {
  constructor(readonly address: string) {
    super();
    requireAtom(address);
  }

  toString(): string {
    return `addr:${this.address}`;
  }
}

/** Profile — one atom, two identifiers with its Actor. */
export class ProfId extends NodeId {
  constructor(readonly address: string) {
    super();
    requireAtom(address);
  }

  toString(): string {
    return `prof:${this.address}`;
  }
}

/** Type — a commons compared by exact byte equality. */
export class NameId extends NodeId {
  constructor(readonly name: string) {
    super();
    requireAtom(name);
  }

  toString(): string {
    return `name:${this.name}`;
  }
}

/** Minted node — names its genesis act, never itself. */
export class MintId extends NodeId {
  constructor(readonly act: ActId) {
    super();
  }

  toString(): string {
    return `mint:${this.act}`;
  }
}
