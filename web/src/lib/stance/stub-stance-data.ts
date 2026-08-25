// A `StanceData` stand-in for tests: an in-memory store the control can
// be driven against without a network.
//
// It plays the BACKEND, not the client. The arithmetic below — the fold,
// and the inertness and severance flags read off it — is therefore the
// stand-in's own, which is exactly why the fold is injectable: no test
// depends on the guess. The client-side rule the seam exists to protect
// — the control never computes a delta, a projection, or a zero test of
// its own — is unaffected either way.

import { failed, success, type Outcome } from "@/lib/api/outcome";
import { clampPair, ORIGIN, type StancePair } from "./model";
import type {
  StanceBundle,
  StanceCommit,
  StanceData,
  StanceLanding,
  StanceReadOptions,
  StanceTarget,
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

/** The backend's own reading of its fold — "either axis at zero". */
function inertOf(pair: StancePair): boolean {
  return pair.pDirected === 0 || pair.pInterest === 0;
}

/** The backend's own reading of its fold — "both axes at zero". */
function severedOf(pair: StancePair): boolean {
  return pair.pDirected === 0 && pair.pInterest === 0;
}

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

    async bundle(target: StanceTarget, readOptions): Promise<Outcome<StanceBundle | null>> {
      if (options.offline === true) return OFFLINE();
      noteRead(readOptions);
      const records = recordsOf(target.id);
      if (records.length === 0) return success(null);
      const net = fold(records);
      return success({
        current: net,
        inert: inertOf(net),
        severed: severedOf(net),
        // One counter-record per live record: the real count is the
        // fold's to state, and the control only ever renders it.
        severance: { records: severedOf(net) ? 0 : records.length },
      });
    },

    async project(target: StanceTarget, pick, readOptions): Promise<Outcome<StanceLanding>> {
      if (options.offline === true) return OFFLINE();
      noteRead(readOptions);
      const net = fold([...recordsOf(target.id), pick]);
      return success({ landing: net, inert: inertOf(net), severed: severedOf(net) });
    },

    async commit(target: StanceTarget, pick): Promise<Outcome<StanceCommit>> {
      if (options.offline === true) return OFFLINE();
      sent.push({ target: target.id, pick });
      state.set(target.id, [...recordsOf(target.id), pick]);
      return success({ records: 1 });
    },

    async sever(target: StanceTarget): Promise<Outcome<StanceCommit>> {
      if (options.offline === true) return OFFLINE();
      const walked = recordsOf(target.id).length;
      severed.push(target.id);
      state.set(target.id, []);
      return success({ records: walked });
    },
  };
}
