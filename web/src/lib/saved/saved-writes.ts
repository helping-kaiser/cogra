// THE READER'S KEPT STATE, AS THE TAP LEFT IT (saved-surface packet, "The save
// action"; RowSigning.md: "save, unsave, hide, undo and unhide answer at the
// tap and revert on failure").
//
// A save is a read-side comfort: the menu answers at the tap and the request
// goes out behind it. So the truth on screen is not the last read — it is the
// last read with the reader's own acts laid over it, and that overlay has to
// be ONE store, or a post saved from the feed would still read `Save` on its
// detail and still stand in the Saved list it was just dropped from (SG-10:
// "own mutations applied in place on return to Saved").
//
// ONE WRITE IN FLIGHT PER NODE, AND THE LAST INTENT WINS (the packet's
// optimistic write queue; Apollo's documented optimistic-mutation pattern, in
// its single-flight form). A save, an unsave and an Undo tapped in a row must
// reach the server in that order, never racing, and a queued intent that a
// newer one supersedes is never sent at all — the newer one says where the
// reader wants the node to end up. A failure reverts to what the server last
// confirmed, which is exactly what is true.
//
// Plain TypeScript with no React in it, so the ordering law is tested as a
// state machine rather than through a screen.

/** When the reader kept a node, or null for not kept. */
export type Kept = string | null;

/** What the reader asked for, last. */
export type Intent =
  | { readonly kind: "keep"; readonly at: string | null }
  | { readonly kind: "drop" };

/** Which comfort did not go through — what its row line's Retry asks again. */
export type ComfortKind = "save" | "unsave" | "restore";

/** A comfort that did not go through, standing on its target's row. */
export type Failure = {
  readonly kind: ComfortKind;
  /** Asks the same comfort again; signs nothing (RowSigning.md:23). */
  readonly retry: () => void;
};

/** The server's answer to one write: the kept state it now holds, or a fault. */
export type SendResult = { readonly ok: true; readonly kept: Kept } | { readonly ok: false };

export type Send = (node: string, intent: Intent) => Promise<SendResult>;

type NodeState = {
  /** What the server last confirmed; undefined until something was sent. */
  confirmed: Kept | undefined;
  /** What the screen shows. */
  shown: Kept;
  inFlight: boolean;
  /** The newest intent waiting behind the one in flight. */
  queued: { intent: Intent; kind: ComfortKind } | null;
};

/** Listens for a comfort that reverted — the host clears the snackbar that announced it (SG-9). */
export type RevertListener = (node: string, kind: ComfortKind) => void;

export class SavedWrites {
  private readonly nodes = new Map<string, NodeState>();
  private readonly failures = new Map<string, Failure>();
  private readonly listeners = new Set<() => void>();
  private readonly revertListeners = new Set<RevertListener>();
  private version = 0;

  constructor(
    private readonly send: Send,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  // ---- reading -------------------------------------------------------------

  /** What the screen shows for `node`: the reader's own acts over `server`. */
  kept(node: string, server: Kept): Kept {
    const state = this.nodes.get(node);
    return state === undefined ? server : state.shown;
  }

  /** Whether the reader has acted on `node` since the read that served `server`. */
  touched(node: string): boolean {
    return this.nodes.has(node);
  }

  failure(node: string): Failure | null {
    return this.failures.get(node) ?? null;
  }

  /** A counter that moves with every change, for `useSyncExternalStore`. */
  snapshot = (): number => this.version;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  onRevert(listener: RevertListener): () => void {
    this.revertListeners.add(listener);
    return () => this.revertListeners.delete(listener);
  }

  // ---- acting --------------------------------------------------------------

  /** Keep `node` — now, or at `at` (an Undo restoring a removed row's place). */
  keep(node: string, server: Kept, at: string | null = null, kind: ComfortKind = "save"): void {
    this.act(node, server, { kind: "keep", at }, at ?? this.now(), kind);
  }

  /** Drop `node` from Saved. */
  drop(node: string, server: Kept): void {
    this.act(node, server, { kind: "drop" }, null, "unsave");
  }

  /**
   * A fresh load of a surface: its rows' lines go (RowSigning.md:17) and the
   * overlay steps aside for what the read now says, except where a write is
   * still on its way.
   */
  settle(): void {
    this.failures.clear();
    for (const [node, state] of this.nodes) {
      if (!state.inFlight && state.queued === null) this.nodes.delete(node);
    }
    this.bump();
  }

  /** Signing out or switching accounts: nothing of the last reader's survives. */
  reset(): void {
    this.nodes.clear();
    this.failures.clear();
    this.bump();
  }

  private act(node: string, server: Kept, intent: Intent, shown: Kept, kind: ComfortKind): void {
    // Another act on the same target clears its line (RowSigning.md:17).
    this.failures.delete(node);
    let state = this.nodes.get(node);
    if (state === undefined) {
      state = { confirmed: server, shown: server, inFlight: false, queued: null };
      this.nodes.set(node, state);
    }
    state.shown = shown;
    if (state.inFlight) {
      state.queued = { intent, kind };
    } else {
      this.dispatch(node, state, intent, kind);
    }
    this.bump();
  }

  private dispatch(node: string, state: NodeState, intent: Intent, kind: ComfortKind): void {
    state.inFlight = true;
    void this.send(node, intent).then((result) => {
      state.inFlight = false;
      if (result.ok) state.confirmed = result.kept;
      const next = state.queued;
      state.queued = null;
      if (next !== null) {
        // The newer intent is where the reader wants the node to end up; it
        // goes whatever became of this one.
        this.dispatch(node, state, next.intent, next.kind);
        this.bump();
        return;
      }
      if (result.ok) {
        state.shown = result.kept;
      } else {
        state.shown = state.confirmed ?? null;
        this.failures.set(node, {
          kind,
          retry: () => this.act(node, state.confirmed ?? null, intent, retryShown(intent, this.now()), kind),
        });
        for (const listener of this.revertListeners) listener(node, kind);
      }
      this.bump();
    });
  }

  private bump(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}

function retryShown(intent: Intent, now: string): Kept {
  return intent.kind === "keep" ? (intent.at ?? now) : null;
}
