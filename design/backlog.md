# Backlog

One ordered queue. A session pulls the top unstarted item, does it, and
ports back whatever it learned — a new component gets its `.d.ts`,
`.prompt.md`, and a `@dsCard`; a rule discovered while drawing goes into
`readme.md`. Then the item is struck here.

**Two kinds of item.** *System* items add or change something in this
folder. *Design* items are sessions that build screens — those live
outside the design system (their own file, not a card), and only the
reusable part comes back. Nothing on this list is a reason to put a
screen in the card grid.

**Standing constraints for every item:** mobile width only, light and
dark both designed with a toggle in the artifact, and no new colour, type
role, or radius rung without a separate decision.

---

### 1 · Core loop — feed → post detail → stance · *design* · **built**
`designs/core-loop/` — a design, not a card. Feed, one post's thread, the
stance gesture end to end, guest and member, light and dark, and the four
feed states. Ported back from it: `PostCard`/`CommentCard` now take
`taught` and `onCommit` (both are the shell's facts, not a card's),
`PageHeader` now owns a 48px band with a 48px back target, and
`StanceControl` re-syncs `taught`. See readme §11, *Small fixes*.
The spine everything else hangs off. Feed listing, one post's thread, the
stance control through its whole gesture (rest → coach mark → bloom →
park → Set), guest vs member framing, empty and loading states.
Still owed by this item, and deliberately deferred: replying (item 6),
the profile route off an author chip (item 5), and the score's screens
(item 13) — the affordances are live, the destinations are not.

### 2 · Screen-transition motion · *system* · **built**
`tokens/transitions.css` plus the Motion card *Screen transitions*.
Forward 300ms in from 12% with a fade; back is that motion reversed at
200ms; a sheet comes up over 400ms and goes back down over 200ms; a
dialog fades in place with an 8px rise. A dismissal exits the edge it
entered from, nothing inside an arriving screen animates, and reduced
motion keeps the swap without the travel. Wired into item 1's design.

### 3 · Bottom sheet · *system* · **built**
`components/core/BottomSheet.jsx` (+ `SheetItem`, `SheetTitle`) and the
*The bottom sheet* card. A drawer the reader opened and can drop: top
corners only at the 28px rung, covers the bottom bar, scrim and Escape
close it, nothing behind it is inert, never open beside the stance pad.
`OverflowMenu` now presents as a sheet by default.

### 4 · The feed's filter · *system* · **built**
`components/navigation/FeedFilter.jsx` with `Chip`/`TopicChip`, on the
card *What your feed shows*; `SegmentedFilter` stays for the narrow case
(two to four mutually exclusive options, equal segments) and now carries
order. Seven kinds of ranked content that combine, forms of post that
combine, one order that does not, and what else the feed admits — a
trigger reading the view back in words plus a sheet, applied live.
This supersedes the first pass, a three-segment Posts / Comments /
Stances row: a stance is not ranked, and the real set combines.

### 5 · Profile header + media avatars · *system* · **built**
`components/people/ProfileHeader.jsx`, plus a photo on `MonogramAvatar`
and `ActorChip`, on the People card. The stance on the person leads the
actions row; the counts read **"Stances on them"** and **"Stances they've
taken"** (the repo's own word for the link is banned on screen, and
"followers" would describe a different product); `own` changes the row,
not the layout; no cover image. The monogram stays the fallback.

### 6 · Compose + signing + pending · *design*
Writing, pricing shown before signing, the key-not-on-this-browser path,
and the pending marker arriving in the thread. Exercises `TextField`,
`LicenseChooser`, `RecoveryCode`, `SigningPending`, `PendingMarker` —
the honesty surfaces get their first real test here.

### 7 · Join / invite / applicant onboarding · *design* · **built**
`designs/canonical/` — the canonical canvas's Entry section (2026-08-27),
grown past this item's scope by jakob's direction: the landing is the
public feed from a borrowed vantage point (readme §13), plus invite
entry, the vouch screen, the key ceremony with its think-twice gate and
recovery-code trap, the applicant cards, the landing moment with the
first vouch on the pad, sign-in, reset, and restore. Ported back:
`Checkbox`, `BorrowedViewBand`, the `check` glyph, `RecoveryCode` at
`body-large`, and the §13 rulings (borrowed vantage point, pad above the
bar, per-control onboarding). The three-direction ideation lives on the
standalone "CoGra entry" canvas.
Applicant vs member expressed as cards in the same shell, never as
different navigation. Invitation, approval waiting, key creation and
restore.

### 8 · Topic / hashtag chip · *system* · **built**
`TopicChip` in `components/core/Chip.jsx`, built alongside the feed
filter's `Chip` — same pill, told apart by what they do. The `#` is part
of the word, not an icon.

### 9 · Search + results · *design*
Topics, post titles, usernames, item names. Produces a search field
variant of `TextField` and result-row treatments per node type — a
result list is a list of ranked nodes, so the row work is reused by the
feed later.

### 10 · Sensitive veil treatment · *system*, has open questions
Granularity is settled (blur only what is marked, reveal per post). Open
and to be decided in this item: blur radius, overlay wash, whether a
reveal survives leaving and returning to the post, what the veil says
when the author gave a reason, and how the reader's 0–10 severity setting
maps to blur-or-not. No `error` colouring, no warning glyph.

### 11 · Money & CGT figures · *system*
Balances, earnings, campaign amounts: how a figure is formatted, when it
carries a unit, and what it does at zero and negative. `payoutAddress`
moves off the profile in item 12, so settle the figure first.

### 12 · Wallet · *design*
Balance, where CGT came from, active campaigns, `payoutAddress`.

### 13 · Post Score drill-down · *design*
Four screens — FeedEntry → RankPath → RankHop → raw records — each
carrying a small cover of the post it came from. The register is graph,
paths, connections; never statistics, never a chart. Its five parts
(`ScoreOrigin`, `PathTrace`, `PathSummary`, `StepSummary`, `ActionLog`)
were removed from the system on purpose: they serve one flow, so they
belong to the design. Rebuild them there. Still open: whether level one
pages past a handful of paths, and the empty state for a post whose paths
all moved long ago.

### 14 · Marketplace · *design*
Two entrances — your items on a profile, and the marketplace from the
feed or the wallet. Search by item name, ranked results, offers. The
profile is also a gate into it, so item 5 should be done first.

### 15 · Collective actor variant · *system*
Specified in the source, unimplemented, and a fair amount of work: an
actor that is a group changes the actor chip, the profile header, and
attribution on every card. Deliberately late.

### 16 · Explore · *design*
The graph as a navigable universe: a 3D view from your position, other
profiles as spheres varying in size, colour and brightness by their
weight. Mostly its own thing and mostly outside this system — last on
purpose.
