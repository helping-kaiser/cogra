`StanceControl` is the one way a reader expresses anything in CoGra. It belongs on every post card, every comment, and every other actor's profile header — one per rateable thing, outside any link so it acts rather than navigates.

```jsx
<StanceControl targetLabel="this post" bundle={bundle} signedIn={signedIn} />
<StanceControl targetLabel="@ada" bundle={bundle} />
```

Never redesign this control. The rules it encodes:

- **At rest it shows the current opinion** — the face, with the exact pair beside it in a `cg-exact` span that paints only in geek mode (readme §13). No opinion yet is a muted, translucent 🫥, never a bare word and never 🤷 (that means severed). The anchor's words are not drawn beside it; they ride the button's `aria-label`, in both modes.
- **Tap blooms the pad** at the **lower centre of the viewport** — always the same place, never anchored to the target — and signs nothing. The first open ever also carries the coach mark.
- **Hold 500ms = (+0.1, +0.1)**, signed without the pad. The light gesture opens, the held one spends.
- **Release never commits.** `Set` commits, `Cancel` or an outside press stages nothing.
- **A signed act waits for its signature, and a failed one re-raises its own surface** (the failure pack). `Set` keeps the pad open: past 200ms it reads `Setting…` and goes inert; a failure puts `That didn't send. Try again.` above the commit row and an outlined `Retry` in Set's slot. A hold moves the face only once signed: past 200ms the target's row says `Signing…` under the face, and a failure leaves the face where it was with `SigningPending`'s row line and `Retry`. Never a snackbar for a failure. The write rule's refusal is a notice, not a fault (`signing="writeRule"`): the row says `You can't sign right now.` quietly, with no Retry, and the pad shows `NoticePanel` — its own "?" included — where the landing line and the commit row stood, with `Not now` under it (`PadKeyAbsent`'s shape). Boards draw all of these through `signing`.
- The pad shows the pick's face and pair live, the current opinion above, the resulting one below, a `?`, and a route to `Walk it back` — which appears only once there is something to walk away from.
- **The `?` names its own pad** (jakob's ruling A7) — `helpLabel`, defaulting to `"How opinions work"` for the ordinary feed-card control. A board drawing a named pad passes that pad's own title instead (`ComposePad`'s `"Your opinion on your post"`, `ReplyPad`'s `"Toward what you answer"`, `VouchBackPad`'s `"Your first opinion"`).
- A statically rendered board shows the parked pad via `defaultOpen`/`defaultPick` (never a hand copy of the card), lifts it above a bottom bar with `padInset`, and may speak once through `padNote` (the first vouch's coaching lines).
- **`Choose your opinion on {targetLabel}`** is always in the DOM beside the target — visually hidden until focused, so keyboard, switch, and screen-reader users reach the non-drag equivalent in one tab without it being printed beside every stance control in a feed. It names its target from the same `targetLabel` the face's aria-label reads, so a page carrying more than one stance control never repeats the same unnamed link.
- It never refuses a choice, and it never lets its touches reach the card behind it.

Do not add a second loud surface to a screen that carries this control: the knob and the compose action already own `primaryContainer`.
