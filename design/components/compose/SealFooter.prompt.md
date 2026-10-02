The foot of every signing surface: the commit and the way back.

```jsx
<SealFooter signLabel="Sign and publish" onSign={sign} onBack={back}/>
<SealFooter signLabel="Sign and publish" busyLabel="Signing and publishing…" onSign={sign} onBack={back}/>
```

**Name the verb.** "Sign and publish", "Sign the change", "Sign comment" — a seal that says only "Sign" makes the author scroll back up to find out what for. `Back` is the same word everywhere and takes no argument.

**Back goes up one stage; it never leaves the flow.** Leaving is the header's X, and keeping those two apart is what lets a seal afford a Back at all. Both buttons are full width so the pair reads as one block, not a button with a link stuck under it.

**The upload's gate leaves the commit enabled** (jakob 2026-10-02). Nothing signs until the content it signs exists, and `UploadStatusLine` directly above says so; a press while it shows is inert at once and goes `busy` past 200ms — the label swapped in place — and signing proceeds the moment the bytes land, with no second press. **`disabled` is the failed upload's, never a validation state**: with nothing left to wait for, the commit stops until Retry. A disabled commit with no line explaining it is the one shape this must never take.

**`busy` is the signing in flight.** Past 200ms without an answer the commit reads its present participle and goes inert — `<SealFooter signLabel="Sign and publish" busy busyLabel="Signing and publishing…"/>` — never dimmed, never a spinner. A fault that comes back takes the commit's place (`NetworkError`); a success leaves the seal.

Put the acts above it: `ActsCard` where the surface has room, `ActsFooter` where it does not.
