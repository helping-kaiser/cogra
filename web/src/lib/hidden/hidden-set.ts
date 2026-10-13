// THE READER'S HIDDEN SET, AS THE TAP LEFT IT (hidden-actors packet §5.1).
//
// The feed filter is the reader's own and runs on the device (feed-ranking.md
// §9.1: hard exclusions are post-rank frontend filters), so the whole set has
// to be here: it is read whole — every page of `me.hiddenActors` — at page
// load, at every feed open and pull, and on return to the tab. The Settings row
// reads its count from it and the Hidden accounts sheet reads its rows from it
// without a fetch of its own.
//
// HIDE AND UNHIDE ARE READ-SIDE COMFORTS (RowSigning.md: "save, unsave, hide,
// undo and unhide answer at the tap and revert on failure"): the set changes at
// the tap and the request goes out behind it, ONE IN FLIGHT PER ACTOR, THE
// LAST INTENT WINS — the same queue `SavedWrites` keeps, for the same reason: a
// hide, its Undo and a second hide tapped in a row reach the server in that
// order, and an intent a newer one supersedes is never sent.
//
// A FAILURE IS SAID ON THE ROW THE GESTURE WAS MADE FROM (RowSigning.md:13-21;
// design digest item 55): the set reverts to what the server last confirmed,
// and the failure is recorded against its ORIGIN — the card, page or sheet row
// the reader tapped — so that row, and only that row, carries the line. When
// the revert would take that row away (an Undo of a hide that did not go
// through: the person is still hidden), the row comes back anyway, carrying
// the line, until Retry or the next fresh load.
//
// Plain TypeScript with no React in it, so the law is tested as a state
// machine rather than through a screen.

/** Who is hidden, as the sheet draws them. */
export type HiddenPerson = {
  readonly id: string;
  /** Null for a deleted account, whose handle is never served (ER-G10). */
  readonly handle: string | null;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  /** A deleted account: the reserved disc and `Deleted account` (design digest item 56). */
  readonly redacted: boolean;
};

export type HiddenEntry = HiddenPerson & { readonly hiddenAt: string };

/** Which comfort did not go through — what its row line's Retry asks again. */
export type HiddenComfort = "hide" | "unhide" | "undoHide" | "undoUnhide";

export type HiddenFailure = {
  readonly kind: HiddenComfort;
  readonly person: HiddenEntry;
  /** Asks the same comfort again; signs nothing (RowSigning.md:23). */
  readonly retry: () => void;
};

export type HiddenIo = {
  /** Every page of the reader's hidden accounts; null on a fault. */
  load(): Promise<readonly HiddenEntry[] | null>;
  /** `hideActor`: the moment the server holds, or null on a fault. */
  hide(actor: string, at: string | null): Promise<string | null>;
  /** `unhideActor`: whether it went through. */
  unhide(actor: string): Promise<boolean>;
};

type Intent = { readonly kind: "hide"; readonly at: string | null } | { readonly kind: "unhide" };

type ActorState = {
  /** What the server last confirmed (null: not hidden). */
  confirmed: HiddenEntry | null;
  shown: HiddenEntry | null;
  inFlight: boolean;
  queued: { intent: Intent; kind: HiddenComfort; origin: string } | null;
};

/** Listens for a comfort that reverted — the host clears the snackbar that announced it. */
export type HiddenRevertListener = (actor: string, origin: string) => void;

export type HiddenStatus = "unread" | "reading" | "read" | "failed";

/** The snackbar cause a hide or unhide raised from `origin` wears, so its revert clears it. */
export function hideCause(origin: string): string {
  return `hide:${origin}`;
}

export class HiddenSet {
  private server = new Map<string, HiddenEntry>();
  private readonly acts = new Map<string, ActorState>();
  private readonly failures = new Map<string, HiddenFailure>();
  private readonly listeners = new Set<() => void>();
  private readonly revertListeners = new Set<HiddenRevertListener>();
  private reading: Promise<boolean> | null = null;
  private state: HiddenStatus = "unread";
  private generation = 0;
  private version = 0;

  constructor(
    private readonly io: HiddenIo,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  // ---- reading -------------------------------------------------------------

  get status(): HiddenStatus {
    return this.state;
  }

  /** Whether `actor` is hidden, as the screen shows it. */
  has(actor: string): boolean {
    return this.entry(actor) !== null;
  }

  entry(actor: string): HiddenEntry | null {
    const act = this.acts.get(actor);
    return act === undefined ? (this.server.get(actor) ?? null) : act.shown;
  }

  /** Most recently hidden first (SettingsHidden.md:11). */
  list(): HiddenEntry[] {
    const shown = new Map(this.server);
    for (const [actor, act] of this.acts) {
      if (act.shown === null) shown.delete(actor);
      else shown.set(actor, act.shown);
    }
    return [...shown.values()].sort(newestFirst);
  }

  get count(): number {
    return this.list().length;
  }

  /** The failure whose row line stands on `origin`'s row. */
  failure(origin: string): HiddenFailure | null {
    return this.failures.get(origin) ?? null;
  }

  /** Every standing failure, by origin. */
  failed(): ReadonlyMap<string, HiddenFailure> {
    return this.failures;
  }

  /** A counter that moves with every change, for `useSyncExternalStore`. */
  snapshot = (): number => this.version;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  onRevert(listener: HiddenRevertListener): () => void {
    this.revertListeners.add(listener);
    return () => this.revertListeners.delete(listener);
  }

  // ---- loading -------------------------------------------------------------

  /** Reads the set once; a set already read answers at once. */
  ensure(): Promise<boolean> {
    if (this.state === "read") return Promise.resolve(true);
    return this.refetch();
  }

  /**
   * Reads the set again — a feed open or pull, a return to the tab. A fresh
   * read is a fresh load: its rows' lines go (RowSigning.md:17), and the
   * reader's own acts step aside for what it says, except where a write is
   * still on its way.
   */
  refetch(): Promise<boolean> {
    if (this.reading !== null) return this.reading;
    const generation = this.generation;
    if (this.state !== "read") this.state = "reading";
    const reading = this.io.load().then((entries) => {
      this.reading = null;
      // An account change meanwhile: the answer was the last reader's.
      if (generation !== this.generation) return false;
      if (entries === null) {
        if (this.state !== "read") this.state = "failed";
        this.bump();
        return false;
      }
      this.server = new Map(entries.map((entry) => [entry.id, entry]));
      this.state = "read";
      this.settle();
      return true;
    });
    this.reading = reading;
    this.bump();
    return reading;
  }

  // ---- acting --------------------------------------------------------------

  /**
   * Hide `person` from `origin` — now, or at `at` (an Undo of an unhide puts
   * the row back in its place with its age).
   */
  hide(person: HiddenPerson, origin: string, at: string | null = null, kind: HiddenComfort = "hide"): void {
    const shown: HiddenEntry = { ...person, hiddenAt: at ?? this.now() };
    this.act(person.id, { kind: "hide", at }, shown, kind, origin);
  }

  /** Unhide `actor` from `origin`. */
  unhide(actor: string, origin: string, kind: HiddenComfort = "unhide"): void {
    this.act(actor, { kind: "unhide" }, null, kind, origin);
  }

  /** Signing out or switching accounts: nothing of the last reader's survives. */
  reset(): void {
    this.generation += 1;
    this.server = new Map();
    this.acts.clear();
    this.failures.clear();
    this.reading = null;
    this.state = "unread";
    this.bump();
  }

  private settle(): void {
    this.failures.clear();
    for (const [actor, act] of this.acts) {
      if (!act.inFlight && act.queued === null) this.acts.delete(actor);
    }
    this.bump();
  }

  private act(actor: string, intent: Intent, shown: HiddenEntry | null, kind: HiddenComfort, origin: string) {
    // Another act on the same target clears its line (RowSigning.md:17).
    this.failures.delete(origin);
    let state = this.acts.get(actor);
    if (state === undefined) {
      const server = this.server.get(actor) ?? null;
      state = { confirmed: server, shown: server, inFlight: false, queued: null };
      this.acts.set(actor, state);
    }
    state.shown = shown;
    if (state.inFlight) {
      state.queued = { intent, kind, origin };
    } else {
      this.dispatch(actor, state, intent, kind, origin);
    }
    this.bump();
  }

  private dispatch(actor: string, state: ActorState, intent: Intent, kind: HiddenComfort, origin: string): void {
    state.inFlight = true;
    const generation = this.generation;
    const wanted = state.shown;
    const sent: Promise<HiddenEntry | null | undefined> =
      intent.kind === "hide"
        ? this.io.hide(actor, intent.at).then((at) => (at === null ? undefined : { ...wanted!, hiddenAt: at }))
        : this.io.unhide(actor).then((ok) => (ok ? null : undefined));
    void sent.then((result) => {
      if (generation !== this.generation) return;
      state.inFlight = false;
      const ok = result !== undefined;
      if (ok) state.confirmed = result;
      const next = state.queued;
      state.queued = null;
      if (next !== null) {
        this.dispatch(actor, state, next.intent, next.kind, next.origin);
        this.bump();
        return;
      }
      if (ok) {
        state.shown = result;
      } else {
        state.shown = state.confirmed;
        const person = wanted ?? state.confirmed ?? this.server.get(actor);
        if (person !== undefined && person !== null) {
          this.failures.set(origin, {
            kind,
            person,
            retry: () =>
              intent.kind === "hide"
                ? this.hide(person, origin, intent.at, kind)
                : this.unhide(actor, origin, kind),
          });
        }
        for (const listener of this.revertListeners) listener(actor, origin);
      }
      this.bump();
    });
  }

  private bump(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}

/** The server's own order (`hidden_at DESC, hidden_id DESC`), by instant — not by string. */
function newestFirst(a: HiddenEntry, b: HiddenEntry): number {
  const byTime = Date.parse(b.hiddenAt) - Date.parse(a.hiddenAt);
  if (byTime !== 0) return byTime;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}
