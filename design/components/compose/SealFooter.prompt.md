The foot of every signing surface: the commit and the way back.

```jsx
<SealFooter signLabel="Sign and publish" onSign={sign} onBack={back}/>
<SealFooter signLabel="Sign and publish" disabled onSign={sign} onBack={back}/>
```

**Name the verb.** "Sign and publish", "Sign the change", "Sign comment" — a seal that says only "Sign" makes the author scroll back up to find out what for. `Back` is the same word everywhere and takes no argument.

**Back goes up one stage; it never leaves the flow.** Leaving is the header's X, and keeping those two apart is what lets a seal afford a Back at all. Both buttons are full width so the pair reads as one block, not a button with a link stuck under it.

**`disabled` is the upload's gate, never a validation state.** Nothing signs until the content it signs exists, so a seal still uploading wears it — with `UploadStatusLine` directly above saying why. A disabled commit with no line explaining it is the one shape this must never take.

Put the acts above it: `ActsCard` where the surface has room, `ActsFooter` where it does not.
