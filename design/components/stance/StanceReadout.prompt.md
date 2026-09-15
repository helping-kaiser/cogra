`StanceReadout` is the stance vocabulary: the anchor tables, the number formatting, the current-opinion and landing copy, and the two live-region blocks that sit above and below the pad's field. Reach for it any time a design shows a stance value.

```jsx
<StanceStanding pick={pick} bundle={bundle} targetLabel="this post" />
<StanceLandingLine landing={localLanding(bundle.rawSum, pick)} />
```

Rules you must not break:

- **Three labelled readouts, never merged.** `Current opinion` sits above the field, `Your pick` sits between it and the field, `Resulting opinion` sits below. Each is a label with the face and the numbers on the line beneath it, formatted identically so the eye compares them without reading. The middle one reads the **pick**, not the bundle.
- **The face is the default reading; the pair is the geek one.** `+0.40 / +0.20`, always signed, always two decimals, valence first — always drawn, in a `cg-exact` span that paints only when the screen root carries `data-geek="on"` (readme §13). The severance confirm's raw-vs-fold numbers are the one exemption and paint in both modes.
- **Face and pair — never the anchor's words as well.** Three encodings of one value is two too many; the words were the redundant one. But they stay in the accessibility tree on every readout: an emoji's own accessible name is "slightly smiling face", not "Like this", so the visible parts are `aria-hidden` and a `SR_ONLY` span carries `"Like this, For or against +0.55, How much reaches you +0.20"`. Dropping the words from the DOM entirely would turn this into colour-alone signalling, which §10 forbids.
- **A one-axis pick reads through `VALENCE_SIX`, and shows one number.** `OwnStanceReadout` is the readout for an opinion on your own post: a post always reaches its author in full, so `pInterest` is not picked and a pair would draw a second figure nobody set. `nearestValenceAnchor` answers for the face over six ruled bands on `pDirected` — at a band's midpoint the milder face wins, and exactly `0.00` reads 🙂.
- **(0, 0) never speaks through the table** — it gets 🤷 with severed / no-opinion wording. A control with no opinion at rest gets 🫥, muted.
- On screen a **stance's** axes are **"For or against"** and **"How much reaches you"**, with their ends named `Against`/`For` and `Less`/`More`. Never valence, connection, `p_d`, `p_i`, weight, or parameter.
- **A different record family brings its own six words**, questions and ends alike, through the one `axes` object (`STANCE_AXES` is the default). An Affinity's are `How much you like it` — `Dislike`/`Like` — and `How close you want to be` — `Far away`/`Close to me`. Every readout takes the same object as `names`, so the spoken reading asks whatever the drawn one asks.
- The **snackbar keeps its words**: a transient line is read away from the pad, so it *is* the accessible text and has no visual redundancy to carry them.
