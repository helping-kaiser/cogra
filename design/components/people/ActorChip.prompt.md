Use `ActorChip` for every author attribution — feed cards, comments, replies. People lead: the chip sits **above** the content it authored, never below it as a byline.

```jsx
<ActorChip handle="ada" displayName="Ada Okonkwo" />
<MonogramAvatar name="Ada Okonkwo" size="lg" />
<ActorChip redacted />
```

**`redacted` is the deleted account, wherever it appears.** The actor is still there — still the author of what it signed, still carrying its standing — and only its identity payloads are gone, so the chip is still drawn and drawn without a name: an empty reserved disc, `Deleted account` in `text-secondary`, no handle. Use it on every surface that names an actor, because the treatment follows the actor and a per-surface version of it drifts. The moderation variant is a different wording on the same shape and is not blessed yet.

Avatars are monograms in `secondaryContainer`. Do not substitute stock photography or generated faces — media avatars land in a later slice, and a placeholder photo would misrepresent the product. The display name is `label-large`, the handle `label-medium` on `--text-secondary`.
