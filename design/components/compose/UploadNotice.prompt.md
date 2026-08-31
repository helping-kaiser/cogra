The two upload notices. Most posts never show either — upload runs in the background from the moment a picture has its crop, and these appear only when the author outruns the network.

```jsx
<UploadStatusLine done={2} total={4} />   {/* above a DISABLED sign button */}
<UploadErrorLine onRetry={retry} onRemove={remove} />
```

What holds:

- **`UploadStatusLine` is the seal's gate.** While it shows, the sign button is disabled — nothing signs until the content it signs exists. The words are fixed: "Uploading n of m — signing waits for the pictures."
- **`UploadErrorLine` carries the failure's words and its ways out** — the fact in `error` colour, Retry and Remove it in `primary`. The failed tile itself wears `MediaThumb`'s badge; tile and line always appear together.
- Direction by words, never by colour alone — the `error` tint marks the fact, the links are ordinary primary actions.
