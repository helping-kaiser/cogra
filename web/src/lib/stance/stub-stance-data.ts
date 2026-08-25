// The stand-in behind the `StanceData` seam while slice 2.2's backend
// half is unmerged: an in-memory store the control can be driven against
// in tests and mounted against in the app.
//
// It plays the BACKEND, not the client. The arithmetic below is
// therefore the stand-in's, not a claim about L1's published fold, and it
// is injectable precisely so no test depends on the guess: the wiring
// follow-up deletes this file's fold along with the rest of it. The
// client-side rule the seam exists to protect — the control never
// computes a delta or a projection — is unaffected either way.

import { failed, success, type Outcome } from "@/lib/api/outcome";
import { clampPair, ORIGIN, type StancePair } from "./model";
import type {
  StanceBundle,
  StanceCommit,
  StanceData,
  StanceReadOptions,
} from "./stance-data";

/** The records one viewer has authored toward one target, oldest first. */
export type StubTargetState = {
  readonly records: readonly StancePair[];
};

export type StubFold = (records: readonly StancePair[]) => StancePair;

/** Sum the picks and bound the result — a stand-in, replaced at the seam. */
export const sumFold: StubFold = (records) =>
  clampPair(
    records.reduce(
      (net, record) => ({
        pDirected: net.pDirected + record.pDirected,
        pInterest: net.pInterest + record.pInterest,
      }),
      ORIGIN,
    ),
  );

export type StubStanceOptions = {
  /** Seed standing, by target id. */
  readonly seed?: Readonly<Record<string, StubTargetState>>;
  readonly fold?: StubFold;
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
  recordsOf(target: string): readonly StancePair[];
};

const OFFLINE = () => failed(new Error("stub stance data is offline"));

export function createStubStanceData(options: StubStanceOptions = {}): StubStanceData {
  const fold = options.fold ?? sumFold;
  const state = new Map<string, StancePair[]>(
    Object.entries(options.seed ?? {}).map(([target, seeded]) => [target, [...seeded.records]]),
  );
  const sent: { target: string; pick: StancePair }[] = [];
  const severed: string[] = [];
  const pendingFlags: boolean[] = [];

  const recordsOf = (target: string): StancePair[] => state.get(target) ?? [];

  const noteRead = (options?: StanceReadOptions) => {
    pendingFlags.push(options?.includePending ?? true);
  };

  return {
    sent,
    severed,
    pendingFlags,
    recordsOf,

    async bundle(target, readOptions): Promise<Outcome<StanceBundle | null>> {
      if (options.offline === true) return OFFLINE();
      noteRead(readOptions);
      const records = recordsOf(target);
      if (records.length === 0) return success(null);
      return success({
        current: fold(records),
        // One counter-record per live record: the real count is the
        // fold's to state, and the control only ever renders it.
        severance: { records: records.length },
      });
    },

    async project(target, pick, readOptions): Promise<Outcome<StancePair>> {
      if (options.offline === true) return OFFLINE();
      noteRead(readOptions);
      return success(fold([...recordsOf(target), pick]));
    },

    async commit(target, pick): Promise<Outcome<StanceCommit>> {
      if (options.offline === true) return OFFLINE();
      sent.push({ target, pick });
      state.set(target, [...recordsOf(target), pick]);
      return success({ records: 1 });
    },

    async sever(target): Promise<Outcome<StanceCommit>> {
      if (options.offline === true) return OFFLINE();
      const walked = recordsOf(target).length;
      severed.push(target);
      state.set(target, []);
      return success({ records: walked });
    },
  };
}
