`ReelRail` is the stream's action column — the post card's action row turned on its side and laid over the clip.

```jsx
<ReelRail
  author={{ handle: "mira", displayName: "Mira Voss", src: "inviter.jpg" }}
  score="7.40"
  comments={2}
  bottom={BAND_HEIGHT + 96}
/>
```

What holds:

- **The order is ruled**: author · opinion · comments · share · score. People lead — the author is the one item that is not an act — then the acts in the card's own order, and the **score last**, because it is the door out of the stream and a thumb reaching for the opinion must never pass over the exit.
- **What is deliberately absent**: topics, the reference count, the reader's ⋮. They belong to the detail view the score opens; a rail that carried everything would be a card drawn sideways.
- **It reads over any frame.** White glyphs at 28px with a soft shadow, counts beneath. Nothing takes a token colour — on photography "quiet" and "invisible" are the same thing — and nothing takes a plate, because five plates down a frame is a wall of chrome.
- **The opinion control is the real one** (`StanceControl overMedia`), not a picture of one: the same tap, the same press-and-hold, the same pad over the paused clip, the same seal. Its unset state is a line face at the rail's weight; an opinion already given shows its own face.
- **`bottom` clears whatever the surface puts below it** — the bottom bar and the caption on the stream.
- **The score door has three faces and is always a door.** The figure the card wears, what the latest fetch of the post found — the reader's own last feed fetch, or the trace's since; `—` where that fetch found none; and, still settling, the bare glyph with `Still settling` under it (`settling`). The bare slot is settling's alone and zero is severance's — neither stands in for the other.
- **A row line stands beside the face** (`stanceLine`): a hold that did not sign, or the write rule's quiet refusal, on a `ReelPlate` to the face's left — the row the card would carry it on does not exist over a clip.
- **`ReelPlate` is the stream's one ground for words**: the wash's black at 60 % behind a line the stream owes the reader. It stands until answered and never fades.
