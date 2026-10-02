The two upload notices. Most posts never show either — upload runs in the background from the moment a picture has its crop, and these appear only when the author outruns the network.

```jsx
<UploadStatusLine done={2} total={4} />   {/* above an ENABLED sign button — a press waits for the bytes */}
<UploadErrorLine onRetry={retry} onRemove={remove} />
<UploadErrorLine message={tooBig} onRemove={remove} />   {/* a refused file — no Retry */}
```

What holds:

- **`UploadStatusLine` is the seal's gate.** Nothing signs until the content it signs exists. While it runs the sign button stays enabled (jakob 2026-10-02): pressed, its label swaps in place to the in-flight word, and signing proceeds the moment the bytes land — no second press. The words are fixed, with the body's own noun: "Uploading n of m — signing waits for the pictures." — and for a clip (`media="video"`) "…signing waits for the video." An upload that fails while the seal waits takes `failed` (with `message` and `onRetry`): the fact in error ink, "Signing waits for it." and Retry — the sign button stays disabled.
- **`UploadErrorLine` carries the failure's words and its ways out** — the fact in `error` colour, Retry and Remove it in `primary`. The failed tile itself wears `MediaThumb`'s badge; tile and line always appear together.
- **The ways out follow the failure.** An upload that lost the network can be retried, so it offers both. A file the surface refuses — over its size cap, or a format nothing here reads — offers only Remove it: retrying cannot change the answer, and a control that would fail identically twice is not a way out. Omit `onRetry` and the link is gone, never disabled.
- Direction by words, never by colour alone — the `error` tint marks the fact, the links are ordinary primary actions.
