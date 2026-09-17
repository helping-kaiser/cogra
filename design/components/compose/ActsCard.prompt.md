Use `ActsCard` on every "What you sign" surface — the seal's list of what one signature commits. Extracted when the profile-picture seal became the third seal (after the post's and the reply's).

```jsx
<ActsCard
  rows={[
    { label: "Post", value: "Sunday at the tide market", count: "1", countNoun: "post" },
    { label: "Tags", value: <TopicChips />, count: "2", countNoun: "tag" },
  ]}
  total="3 things, signed together"
/>
```

What holds:

- One row per act kind: quiet `label-small` label (76px column), the value (clipped, or any node — chips, a stance pair), the count on the right. The total is the footer row, always.
- The card is `surface-container-highest` at the medium rung — the same quiet summary surface the seals have always used.
- **On a multi-act seal, pass `note="They land together, or none does."`** — the quiet subline under the total. Omit it on a single-act seal. (It had drifted across the hand boards; the component is now its one home.)
- **A fact row that counts a collection takes `onOpen` + `openLabel`** and becomes a door: `{ label: "References", value: "3 cited", count: "3", onOpen, openLabel: "Manage the 3 citations" }`. The whole row is the control — no chevron, no trailing word — so the accessible name is the only thing that says so. A count the reader cannot open is a number they cannot check.
- **The door's name folds the count in.** An `aria-label` replaces everything inside the box it names — the hidden digit's reading included — so a door called "Manage the citations" takes the number away from the listener the row drew it for. Give the name the bare count and the row's own noun, the same regular plural `countNoun` gets: "Manage the 3 citations", and at one "Manage the 1 citation".
- **A row's count is that row's own, bare** — `3` for three citations, not "3 actions". The signature's total is the footer and already says in words what it counts.
- **Every counted row carries `countNoun`, its singular noun** — `"citation"` on References, `"tag"` on Tags, `"post"` on Post. The eye keeps the bare digit; the ear gets "3 citations", because a number read alone says nothing. The noun is the board's to give: the label is a heading, not the unit. Omit it only where the count is already words (`"1 more"` on an action row).
- **A counting row on a seal folds WHOLLY, and that differs from the reader's line on purpose** (backlog item 96, ruled the batch-rulings round). `TopicsLine` keeps sample chips beside its remainder because a reader's glance wants scent — enough of the list to judge whether to look. A seal is a read-back before a signature, so the Tags row drops its names for "N tags" and its door (`TagsSheet`) shows the complete list, exactly as References and `CitedSheet` already do. One surface is being skimmed, the other is being checked; a single fold would serve one of them badly.
