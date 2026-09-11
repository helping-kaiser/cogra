**Proposed, not shipped.** Media does not exist in the product yet; this is the part of `design.md` §6 that is decided, built early so no layout is designed without reserved space.

```jsx
<MediaAttachment src={photo} alt="A wet street under a streetlight" />
<MediaGallery items={[{ src: a, alt: "…" }, { src: b }, { src: c }, { src: d }]} />
```

What holds:

- **Space is reserved before load, always.** The tile owns an `aspect-ratio`, so content never jumps. This is the whole reason to build it now.
- The tile is `surfaceContainerHigh` at the medium rung — one step above the card it sits in, so an unloaded tile reads as a reserved region rather than a hole.
- **Alt text is authored or absent.** Never generate a description; a tile without alt is `aria-hidden`.
- **The gallery is a pager** (2026-08-31): one frame at the post's one crop shape, swiped, dots below — dots only, never a `1/n` count pill. Every frame shows whole, exactly as the author cropped it, and the height is one frame's height regardless of count. The cap is authoring-side: at most ten pictures, or one video (with its cover). Uncropped sets (a comment's pictures) pass a fixed `square` frame and display-crop to it — a pager whose height changed per swipe would bounce the card under the reader's thumb.
- **A tile stands at its true shape, at full width** (2026-09-11). Nothing bounds a card tile's height but the crop vocabulary's 4:5, and that is a shape rather than a ceiling: on a 390px phone a wide tile is 219px, a square one 390, a tall one 487. A tile shrunk to keep its card on one screen would show every reader less of the picture than its author shaped.
- **Which scopes "a post fits the screen" to wide and square.** A card at those shapes sits inside the phone whole, affordance row included. A vertical post runs past the fold and the reader scrolls to reach the affordances; that is ruled acceptable.
- **The ratio vocabulary is the crop ruling's** — `tall` 4:5, `square` 1:1, `wide` 1.91:1 — and `tall` is the clamp: nothing in a card is drawn taller than it, because a 9:16 tile eats the phone screen the feed is supposed to scroll. Nothing is letterboxed — a tile is filled, never fitted, so an uncropped picture display-crops to its frame, centred, and the whole frame is one tap away in the viewer.
- **Video autoplays, muted, while at least half of it is on screen**, and the mute decision is global and sticky: `useGlobalMute()` is shared by every video on every surface, so a reader decides "sound on" once. A video wears exactly one control — sound. Never draw play/pause: presence on screen is the policy.
- The sound toggle is `volume_up`/`volume_off` showing the **current** state, on a 36px `surfaceInverse` disc — the one icon button in the system with a background, because it sits on photography where a bare glyph vanishes. Its accessible name says what the tap will do.

For the full-size view use `MediaViewer`: in a post's **detail** view a tap on media opens it; in the **feed** a tap opens the post instead, because a reader scrolling is choosing between posts, not looking at one picture.

The **sensitive veil** wraps the whole gallery, never one picture of it (2026-08-31) — the card composes `SensitiveVeil` around `MediaGallery`; nothing here draws it.

Real photography for mocks lives in `assets/photos/` — ten photographs at true ratios. Use those rather than inventing imagery; a `src`-less tile is still the correct placeholder for a real empty slot.
