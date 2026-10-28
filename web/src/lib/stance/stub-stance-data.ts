// A `StanceData` stand-in for tests: an in-memory store the control can
// be driven against without a network.
//
// It plays the BACKEND, not the client. The arithmetic below — the fold,
// and the inertness and severance flags read off it — is therefore the
// stand-in's own, which is exactly why the fold is injectable: no test
// depends on the guess. The client-side rule the seam exists to protect
// — the control never computes a delta, a projection, or a zero test of
// its own — is unaffected either way.

import { failed, refused, success, type Outcome, type UserError } from "@/lib/api/outcome";
import { fallbackPreview, type KeptTargetPreview } from "./kept-preview";
import { clampPair, ORIGIN, type StancePair } from "./model";
import type {
  StanceBundle,
  StanceCommit,
  StanceData,
  StanceProjection,
  StanceReadOptions,
  StanceTarget,
} from "./stance-data";

/** The records one viewer has authored toward one target, oldest first. */
export type StubTargetState = {
  readonly records: readonly StancePair[];
};

export type StubFold = (records: readonly StancePair[]) => StancePair;

/** The unclipped sum of the records — the bundle's raw sums (§8.3). */
export function rawSumOf(records: readonly StancePair[]): StancePair {
  return records.reduce(
    (net, record) => ({
      pDirected: net.pDirected + record.pDirected,
      pInterest: net.pInterest + record.pInterest,
    }),
    ORIGIN,
  );
}

/** Sum the picks and bound the result — a stand-in, replaced at the seam. */
export const sumFold: StubFold = (records) => clampPair(rawSumOf(records));

/** The backend's own reading of its fold — "either axis at zero". */
function inertOf(pair: StancePair): boolean {
  return pair.pDirected === 0 || pair.pInterest === 0;
}

/** "Both axes at zero" — the LANDING's reading (`StanceProjection.severed`). */
function atZero(pair: StancePair): boolean {
  return pair.pDirected === 0 && pair.pInterest === 0;
}

/**
 * The BUNDLE's reading (`StanceBundle.severed`, PR #283): walked back to
 * nothing — it nets to `(0, 0)` and its newest record said something. A
 * bundle of no records is not severed, and neither is one an empty sign
 * left at `(0, 0)`.
 */
function bundleSevered(records: readonly StancePair[], net: StancePair): boolean {
  const newest = records[records.length - 1];
  return newest !== undefined && atZero(net) && !atZero(newest);
}

/**
 * What the walk-back would stage (`severanceCost`): nothing where nothing
 * stands or it is already walked back; one record over an empty sign's
 * `(0, 0)`; otherwise the stand-in's own count, one per record.
 */
function severanceCostOf(records: readonly StancePair[], net: StancePair): number {
  if (records.length === 0 || bundleSevered(records, net)) return 0;
  return atZero(net) ? 1 : records.length;
}

export type StubStanceOptions = {
  /** Seed standing, by target id. */
  readonly seed?: Readonly<Record<string, StubTargetState>>;
  readonly fold?: StubFold;
  /**
   * The raw sums the bundle serves, independently of the fold. The two
   * are separate on the wire precisely because one cannot be recovered
   * from the other (§8.3), so a fixture that wants to prove which one a
   * surface reads sets them apart.
   */
  readonly rawSum?: StubFold;
  /**
   * Refuse every signing with this code — the write rule's notice
   * (`WRITE_RULE_FAILED`) is a refusal, not a fault.
   */
  readonly refuse?: UserError["code"];
  /** The signing key is not on this device (PadKeyAbsent). */
  readonly keyAbsent?: boolean;
  /** The account has no recovery backup (KeyElsewhereNoBackup). */
  readonly noBackup?: boolean;
  /** The live previews a kept pick's row reads, by target id; others fall back to the kind. */
  readonly previews?: Readonly<Record<string, KeptTargetPreview>>;
  /** Fail every call, for the transport-fault branches. */
  readonly offline?: boolean;
};

export type StubStanceData = StanceData & {
  /** What the last commit sent — the raw-edge assertion's witness. */
  readonly sent: readonly { target: string; pick: StancePair }[];
  /** Targets `sever` was called on. */
  readonly severed: readonly string[];
  /** `includePending` as each read received it. */
  readonly pendingFlags: readonly boolean[];
  /** `fresh` as each STANDING read received it — the post-write witness. */
  readonly freshFlags: readonly boolean[];
  recordsOf(target: string): readonly StancePair[];
  /** The key arrives on, or leaves, this device. */
  setKeyAbsent(absent: boolean): void;
  /** Each batch `commitBatch` signed, in order. */
  readonly batches: readonly (readonly { target: string; pick: StancePair }[])[];
};

const OFFLINE = () => failed(new Error("stub stance data is offline"));
const REFUSED = (code: UserError["code"]) => refused([{ code, message: "stub refusal", field: null }]);

export function createStubStanceData(options: StubStanceOptions = {}): StubStanceData {
  const fold = options.fold ?? sumFold;
  const rawSum = options.rawSum ?? rawSumOf;
  const state = new Map<string, StancePair[]>(
    Object.entries(options.seed ?? {}).map(([target, seeded]) => [target, [...seeded.records]]),
  );
  const sent: { target: string; pick: StancePair }[] = [];
  const severed: string[] = [];
  const pendingFlags: boolean[] = [];
  const freshFlags: boolean[] = [];
  const batches: { target: string; pick: StancePair }[][] = [];
  let keyAbsent = options.keyAbsent === true;

  const recordsOf = (target: string): StancePair[] => state.get(target) ?? [];

  const noteRead = (options?: StanceReadOptions) => {
    pendingFlags.push(options?.includePending ?? true);
  };

  const standingOf = (target: StanceTarget): StanceBundle => {
    const records = recordsOf(target.id);
    const net = records.length === 0 ? ORIGIN : fold(records);
    return {
      current: net,
      rawSum: rawSum(records),
      // Every record counts, an empty sign's (0, 0) and every counter-record
      // of a walk-back included — the API never resets the count.
      records: records.length,
      inert: inertOf(net),
      severed: bundleSevered(records, net),
      // The real count is the fold's to state; the control only renders it.
      severance: { records: severanceCostOf(records, net) },
    };
  };

  return {
    sent,
    severed,
    pendingFlags,
    freshFlags,
    recordsOf,
    batches,

    setKeyAbsent(absent: boolean) {
      keyAbsent = absent;
    },

    async bundle(target: StanceTarget, readOptions): Promise<Outcome<StanceBundle>> {
      if (options.offline === true) return OFFLINE();
      noteRead(readOptions);
      freshFlags.push(readOptions?.fresh === true);
      return success(standingOf(target));
    },

    async project(target: StanceTarget, pick, readOptions): Promise<Outcome<StanceProjection>> {
      if (options.offline === true) return OFFLINE();
      noteRead(readOptions);
      const net = fold([...recordsOf(target.id), pick]);
      return success({
        landing: net,
        inert: inertOf(net),
        severed: atZero(net),
        // The standing rides the same read, as `viewerStance(pick:)` serves it.
        standing: standingOf(target),
      });
    },

    async commit(target: StanceTarget, pick): Promise<Outcome<StanceCommit>> {
      if (options.offline === true) return OFFLINE();
      if (options.refuse !== undefined) return REFUSED(options.refuse);
      sent.push({ target: target.id, pick });
      state.set(target.id, [...recordsOf(target.id), pick]);
      return success({ records: 1 });
    },

    async keyOnDevice(): Promise<boolean> {
      return !keyAbsent;
    },

    async keyBackedUp(): Promise<boolean | null> {
      return options.noBackup !== true;
    },

    async commitBatch(entries): Promise<Outcome<StanceCommit>> {
      if (options.offline === true) return OFFLINE();
      if (options.refuse !== undefined) return REFUSED(options.refuse);
      // All or nothing: every pick lands, or none does.
      batches.push(entries.map(({ target, pick }) => ({ target: target.id, pick })));
      for (const { target, pick } of entries) {
        sent.push({ target: target.id, pick });
        state.set(target.id, [...recordsOf(target.id), pick]);
      }
      return success({ records: entries.length });
    },

    async preview(target): Promise<Outcome<KeptTargetPreview>> {
      if (options.offline === true) return OFFLINE();
      return success(options.previews?.[target.id] ?? fallbackPreview(target));
    },

    async sever(target: StanceTarget): Promise<Outcome<StanceCommit>> {
      if (options.offline === true) return OFFLINE();
      if (options.refuse !== undefined) return REFUSED(options.refuse);
      const records = recordsOf(target.id);
      const cost = standingOf(target).severance.records;
      // Nothing standing — no record, or already walked back — is refused,
      // as `prepareSeverance` refuses it.
      if (cost === 0) return REFUSED("BAD_INPUT");
      severed.push(target.id);
      // THE WALK-BACK IS LAYERED, NEVER A RESET: its counter-records join
      // the bundle, `cost` of them, the last carrying the whole raw sum's
      // opposite so the sum lands on exactly (0, 0). Over an empty sign's
      // (0, 0) that is one (0, 0) record, as the API stages it (Q60).
      const sum = rawSumOf(records);
      const counter = { pDirected: -sum.pDirected + 0, pInterest: -sum.pInterest + 0 };
      const padding = Array.from({ length: cost - 1 }, () => ORIGIN);
      state.set(target.id, [...records, ...padding, counter]);
      return success({ records: cost });
    },
  };
}
