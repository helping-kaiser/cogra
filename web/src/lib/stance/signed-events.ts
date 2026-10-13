// A STANCE WAS JUST SIGNED, somewhere on the page — the one fact the
// borrowed-view band has to hear about (VouchBack.md:21): the member's first
// opinion ends the borrowing toward ANY target and from ANY surface, so the
// band cannot learn it from its own screen. Every stance control announces
// each signing it had taken; the band re-reads `borrowedView` on hearing it.
//
// It carries no payload on purpose. Whether the signing ended the borrowing
// is the contract's call — an Affinity never does (VouchBack.md:25), an
// Opinion on anyone does — and the band asks the contract rather than
// re-deriving the rule from what was signed.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Hears every stance signing taken from now on; returns the unsubscribe. */
export function onStanceSigned(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Says a stance signing was just taken. */
export function announceStanceSigned(): void {
  for (const listener of [...listeners]) listener();
}
