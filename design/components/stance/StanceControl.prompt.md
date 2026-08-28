`StanceControl` is the one way a reader expresses anything in CoGra. It belongs on every post card, every comment, and every other actor's profile header — one per rateable thing, outside any link so it acts rather than navigates.

```jsx
<StanceControl targetLabel="this post" bundle={bundle} signedIn={signedIn} />
<StanceControl targetLabel="@ada" bundle={bundle} />
```

Never redesign this control. The rules it encodes:

- **At rest it shows the standing** — the face and the exact pair. No standing yet is a muted, translucent 😐, never a bare word and never 🤷 (that means severed). The anchor's words are not drawn beside it; they ride the button's `aria-label`.
- **Tap = (+0.1, +0.1).** The first tap ever teaches instead, and signs nothing.
- **Hold 500ms** blooms the pad at the **lower centre of the viewport** — always the same place, never anchored to the target.
- **Release never commits.** `Set` commits, `Cancel` or an outside press stages nothing.
- The pad shows the pick's face and pair live, the standing above, the landing below, a `?`, and a route to `Sever` — which appears only once there is a stance to walk away from.
- A statically rendered board shows the parked pad via `defaultOpen`/`defaultPick` (never a hand copy of the card), lifts it above a bottom bar with `padInset`, and may speak once through `padNote` (the first vouch's coaching lines).
- **`Choose your stance`** is always in the DOM beside the target — visually hidden until focused, so keyboard, switch, and screen-reader users reach the non-drag equivalent in one tab without it being printed beside every stance in a feed.
- It never refuses a choice, and it never lets its touches reach the card behind it.

Do not add a second loud surface to a screen that carries this control: the knob and the compose action already own `primaryContainer`.
