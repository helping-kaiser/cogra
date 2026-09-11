Use `ActsCard` on every "What you sign" surface — the seal's list of what one signature commits. Extracted when the profile-picture seal became the third seal (after the post's and the reply's).

```jsx
<ActsCard
  rows={[
    { label: "Post", value: "Sunday at the tide market", count: "1" },
    { label: "Topics", value: <TopicChips />, count: "2" },
  ]}
  total="3 things, signed together"
/>
```

What holds:

- One row per act kind: quiet `label-small` label (76px column), the value (clipped, or any node — chips, a stance pair), the count on the right. The total is the footer row, always.
- The card is `surface-container-highest` at the medium rung — the same quiet summary surface the seals have always used.
- **On a multi-act seal, pass `note="They land together, or none does."`** — the quiet subline under the total. Omit it on a single-act seal. (It had drifted across the hand boards; the component is now its one home.)
