**Proposed, not shipped.** Media does not exist in the product yet; this is the part of `design.md` §6 that is decided, built early so no layout is designed without reserved space.

```jsx
<MediaAttachment src={photo} alt="A wet street under a streetlight" />
<MediaGallery items={[{ src: a, alt: "…" }, { src: b }, { src: c }, { src: d }]} />
```

What holds:

- **Space is reserved before load, always.** The tile owns an `aspect-ratio`, so content never jumps. This is the whole reason to build it now.
- The tile is `surfaceContainerHigh` at the medium rung — one step above the card it sits in, so an unloaded tile reads as a reserved region rather than a hole.
- **Alt text is authored or absent.** Never generate a description; a tile without alt is `aria-hidden`.
- **The gallery is a pager** (2026-08-31): one frame at the post's one crop shape, swiped, dots below — dots only, never a `1/n` count pill. Every frame shows whole, exactly as the author cropped it, and the height is one frame's height regardless of count. The cap is authoring-side: at most ten pictures, or one video (with its cover). Uncropped sets (a comment's pictures) pass a fixed `square` frame and fit whole frames inside it.
- **A post fits the screen.** Media is capped at `--media-max-height`: viewport, less the top safe area, the bottom bar, and `--post-chrome-height` — the **worst-case** non-media chrome, measured on the heaviest post the system can produce (title, two-line caption, opener, honesty marker, affordance row, padding). Budgeting for the average ships a layout that fits four posts in five, and the fifth is the one with something to say. A short post never reaches the cap; it is a maximum, not a target. A capped tile fits its frame rather than cropping to obey the cap.
- **The ratio vocabulary is the crop ruling's** — `tall` 4:5, `square` 1:1, `wide` 1.91:1 — and `tall` is the cap, bounding the TILE, not the picture. A taller frame is fitted inside it and the reserved surface shows at the sides; the layout never decides the author's crop. A 9:16 tile would eat a phone screen whole, which is why the cap exists. The bars stay plain `surfaceContainerHigh` — never a blurred enlargement of the photo, which invents image where there is none.
- **Video autoplays, muted, while at least half of it is on screen**, and the mute decision is global and sticky: `useGlobalMute()` is shared by every video on every surface, so a reader decides "sound on" once. A video wears exactly one control — sound. Never draw play/pause: presence on screen is the policy.
- The sound toggle is `volume_up`/`volume_off` showing the **current** state, on a 36px `surfaceInverse` disc — the one icon button in the system with a background, because it sits on photography where a bare glyph vanishes. Its accessible name says what the tap will do.

For the full-size view use `MediaViewer`: in a post's **detail** view a tap on media opens it; in the **feed** a tap opens the post instead, because a reader scrolling is choosing between posts, not looking at one picture.

The **sensitive veil** wraps the whole gallery, never one picture of it (2026-08-31) — the card composes `SensitiveVeil` around `MediaGallery`; nothing here draws it.

Real photography for mocks lives in `assets/photos/` — ten photographs at true ratios. Use those rather than inventing imagery; a `src`-less tile is still the correct placeholder for a real empty slot.
