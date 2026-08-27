**Proposed, not shipped.** Media does not exist in the product yet; this is the part of `design.md` §6 that is decided, built early so no layout is designed without reserved space.

```jsx
<MediaAttachment src={photo} alt="A wet street under a streetlight" />
<MediaGallery items={[{ src: a, alt: "…" }, { src: b }, { src: c }, { src: d }]} />
```

What holds:

- **Space is reserved before load, always.** The tile owns an `aspect-ratio`, so content never jumps. This is the whole reason to build it now.
- The tile is `surfaceContainerHigh` at the medium rung — one step above the card it sits in, so an unloaded tile reads as a reserved region rather than a hole.
- **Alt text is authored or absent.** Never generate a description; a tile without alt is `aria-hidden`.
- Gallery layout is one lead tile plus up to two squares and a `+n` remainder. Reserved height is a function of the count alone.

- **A post fits the screen.** Media is capped at `--media-max-height`: viewport, less the top safe area, the bottom bar, and `--post-chrome-height` — the **worst-case** non-media chrome, measured on the heaviest post the system can produce (title, two-line caption, opener, honesty marker, affordance row, padding). Budgeting for the average ships a layout that fits four posts in five, and the fifth is the one with something to say. A short post never reaches the cap; it is a maximum, not a target. A gallery splits the budget ~60/40 between lead and strip, and a capped tile fits its frame rather than cropping to obey the cap.
- **Portrait caps at 4:5, and the cap bounds the TILE, not the picture.** A taller frame is fitted inside it and the reserved surface shows at the sides; the layout never decides the author's crop. A 9:16 tile would eat a phone screen whole, which is why the cap exists. The bars stay plain `surfaceContainerHigh` — never a blurred enlargement of the photo, which invents image where there is none.
- **Only a gallery's secondary squares crop** (`fit="cover"`), because they are an index into the set rather than the media itself. The lead tile and any single attachment show the whole frame, and the viewer is one tap away.
- **Video autoplays, muted, while at least half of it is on screen**, and the mute decision is global and sticky: `useGlobalMute()` is shared by every video on every surface, so a reader decides "sound on" once. A video wears exactly one control — sound. Never draw play/pause: presence on screen is the policy.
- The sound toggle is `volume_up`/`volume_off` showing the **current** state, on a 36px `surfaceInverse` disc — the one icon button in the system with a background, because it sits on photography where a bare glyph vanishes. Its accessible name says what the tap will do.

For the full-size view use `MediaViewer`: in a post's **detail** view a tap on media opens it; in the **feed** a tap opens the post instead, because a reader scrolling is choosing between posts, not looking at one picture.

What you must not fill in from here: the **sensitive blur** treatment (§9) — radius, overlay, and reveal stickiness are undesigned. Its granularity is settled: blur only what is marked, one attachment or one field at a time.

Real photography for mocks lives in `assets/photos/` — ten photographs at true ratios. Use those rather than inventing imagery; a `src`-less tile is still the correct placeholder for a real empty slot.
