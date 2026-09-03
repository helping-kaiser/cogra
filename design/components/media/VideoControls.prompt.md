**Proposed, not shipped.** `VideoTransport` and `SeekLine` are the two rungs of the video control ladder that sit above a feed card's sound disc.

```jsx
// the post detail view — the clip pinned at the top, watched deliberately
<MediaAttachment kind="video" ratio="portrait" controls="transport"
                 elapsed="0:14" duration="0:41" progress={0.34} src={clip} />

// the stream — sound, and a hairline at the very bottom edge
<SeekLine progress={0.34} elapsed="0:14" duration="0:41" />
```

Which rung a surface is on:

- **A feed card**: neither. The sound disc, and nothing else — presence on screen is the policy, and a card is a place you are passing through.
- **The detail view and the fullscreen viewer**: the **full transport**. The reader opened this clip on purpose, so give them a way to stop it and a way to move inside it. The sound control rides the bar; a disc beside a bar is two pieces of chrome for one clip.
- **The stream**: `SeekLine` alone. A full transport there would be chrome over the one thing the reader came for.

What holds:

- **Uniform for every clip.** Never "controls for long videos, none for short ones": a reader who learns a control on one clip has to find it on the next, and a rule with a threshold is a rule nobody can predict.
- **The timeline is a slider, not a progress bar.** It takes a tap anywhere along it and a drag along it, so it carries the knob and the `slider` role rather than a filled track.
- **The chrome auto-hides**, and a tap on the video brings it back. Boards draw the revealed state, because a board of the hidden state is a board of a video.
- **Nothing else.** No fullscreen button (the clip itself opens the viewer), no speed menu, no settings gear.
- **Times are formatted by the caller.** The component never does arithmetic, so a board and the product can put the same strings in it.
