`StanceReadout` is the stance vocabulary: the twenty-anchor table, the number formatting, the standing/landing copy, and the two live-region blocks that sit above and below the pad's field. Reach for it any time a design shows a stance value.

```jsx
<StanceStanding pick={pick} bundle={bundle} targetLabel="this post" />
<StanceLandingLine landing={localLanding(bundle.rawSum, pick)} />
```

Rules you must not break:

- **Three labelled readouts, never merged.** `Current stance` sits above the field, `Your pick` sits between it and the field, `Resulting stance` sits below. Each is a label with the face and the numbers on the line beneath it, formatted identically so the eye compares them without reading. The middle one reads the **pick**, not the bundle.
- **The pair is default, not optional.** `+0.40 / +0.20`, always signed, always two decimals, valence first.
- **Face and pair — never the anchor's words as well.** Three encodings of one value is two too many; the words were the redundant one. But they stay in the accessibility tree on every readout: an emoji's own accessible name is "slightly smiling face", not "Like this", so the visible parts are `aria-hidden` and a `SR_ONLY` span carries `"Like this, How you stand +0.55, In your world +0.20"`. Dropping the words from the DOM entirely would turn this into colour-alone signalling, which §10 forbids.
- **(0, 0) never speaks through the table** — it gets 🤷 with severed / no-standing wording. A control with no standing at rest gets 😐, muted.
- On screen the axes are **"For or against"** and **"How much reaches you"**, with their ends named `Against`/`For` and `Less`/`More`. Never valence, connection, `p_d`, `p_i`, weight, or parameter.
- The **snackbar keeps its words**: a transient line is read away from the pad, so it *is* the accessible text and has no visual redundancy to carry them.
