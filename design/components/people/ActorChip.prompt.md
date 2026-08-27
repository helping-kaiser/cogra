Use `ActorChip` for every author attribution — feed cards, comments, replies. People lead: the chip sits **above** the content it authored, never below it as a byline.

```jsx
<ActorChip handle="ada" displayName="Ada Okonkwo" />
<MonogramAvatar name="Ada Okonkwo" size="lg" />
```

Avatars are monograms in `secondaryContainer`. Do not substitute stock photography or generated faces — media avatars land in a later slice, and a placeholder photo would misrepresent the product. The display name is `label-large`, the handle `label-medium` on `--text-secondary`.
