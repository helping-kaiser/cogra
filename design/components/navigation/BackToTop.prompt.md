Use `BackToTop` on the feed, and nowhere else. It is the way out of a long scroll: a pill reading `Back to top` that rides in with the returning collapsing band and jumps the list to the top.

```jsx
<CograBand trailing={<FeedFilter />} />
<BackToTop onPress={scrollToTop} />
<FeedList>…</FeedList>
```

What holds:

- **It appears with the returning band, and it leaves with it.** The collapsing top returns after about a third of a screen of accumulated upward scroll; the pill arrives on that same signal, centred directly under the band, and goes when the band hides again or the top is reached. One trigger, not two — a second rule for when the pill shows would be a second rule to keep in step with the first.
- **It needs about three screens of depth.** Shallower than that a returning band is already the whole way back: the top is a flick away, and a control offering to save one flick is a control in the way. The pill is for the reader who has genuinely travelled.
- **The tap is the ladder's third rung**, animated, so the jump reads as travel over a list the reader still owns. The bottom bar's re-tap does the same thing from the same place; this is that rung given a control that says itself, and neither replaces the other.
- **Feed only.** Every full-screen scrolling root carries the pull-down and the re-tap; only the feed has a top the reader is actually trying to get back to, because only the feed loads what is new there.
- **It is FIXED, never a child of `CollapsingTop`.** This is the rule to keep. The region hides once half its own slot has scrolled past, so its threshold is a function of its own height — adding the pill to the collapsing block would move the band's collapse point on the feed alone, and a taller block is what **re-clamps the list**: the leftover scroll reads back as "at the top", and the region returns the instant it left (backlog item 45.3, found by Android's W1 lane). A fixed element takes no layout space, so the block measures the same with the pill as without it. The same trap eats the pill's own depth reading — a list that re-clamps reports a scroll position it does not have, so the pill would blink out at the moment it was most useful.
- **It slides under the band, never over it** — `zIndex` 19 to the region's 20, the same 200ms `translateY` and the same easing. Two things leaving together should leave as one thing.
- **Plain words, no glyph.** `Back to top` names the destination and the direction. There is no up arrow in the inlined icon set and §5 forbids drawing one, and an icon-only control here would be a guess for a reader and the bare word "button" for a listener.
- **The ground is tonal.** `surface-container-highest` at `radius-full`, 32px of ink in a 48px target. Not filled `primary`: that is the one committing action on a surface, and this commits nothing.
