# Staged surfaces · `reg:design:staged-surfaces`

Every surface the first release ships staged: a door that opens a
coming-soon page, a kind or a row held back from a list, a label held
to what the build does, a control that waits for its slice, and a
placeholder that swaps at publication. The canvas draws the whole app
and each release builds its slice (readme §2); this file is what that
costs on screen, in one list. Implementation checks every row against
the build at each release cut: never a dead control, never a lying
label.

The list is append-only. A row whose surface ships is struck through
with the date and the round that lifted it, never deleted. A row under
*Unresolved* does not gate until jakob rules it.

## Coming-soon doors

A slot or icon whose absence would deform the shell keeps its place and
opens a coming-soon door (readme §13, *The V1.0 scope cut*). Each door
offers no action and names no date (copy-voice, *The coming-soon
surfaces*).

| Control | Where it stands | Opens | On screen |
|---|---|---|---|
| The bottom bar's Wallet slot (`nav · Wallet`, 60 edges) | every bottom bar, every reader state, guests included | `WalletComingSoon` | `Wallet — coming soon.` · `Your earnings will be here.` |
| The band's chats icon (`chats`, 25 edges) | every root band, signed-in readers; a guest's band (`Main`, `FeedBare`, `WalletComingSoon`) sends it to `GuestGate` | `ChatsComingSoon` | `Chats — coming soon.` · `Your conversations will be here.` |
| `Message` (4 edges) | `ProfileOther`, `ProfileOtherHeld`, `ProfilePosts`, `ProfileComments` | `ChatsComingSoon` | the same page, back arrow `Back to the profile` |
| The Sky card | `Explore` at rest, between the search field and Your topics | nothing — an announcement, no flow number | `The Sky — coming soon` · `Your sky — every account a star, sized by your own paths to it.` |

The edge counts are `graph.json`'s today: every edge whose outcome is
the door's board. A new board that carries the bar or the band adds
edges, not rows.

## Kinds and rows V1.0 does not serve

A kind list or row set shows only served kinds, never a dead chip
(readme §13, *The V1.0 scope cut*).

| Surface | What is held back | What the release shows |
|---|---|---|
| The feed's and search's filters (`FeedSheet`, `ExploreFilter`, `SettingsReading`; `FEED_KINDS`) | chats, messages, proposals, items, campaigns, offers | four kinds: Posts, Comments, Profiles, Tags |
| Search results (`ExploreSearch`) | item, offer and message rows | posts, profiles and tags; comments only in a scoped query |
| Search with Comments on and no scope (`ExploreUnscoped`) | unscoped comment results (readme §13, *The indirect kinds are scope-served*) | `Found through people and tags — start with @handle or #tag.` |
| References (`RefsSheet`, `ReferencePicker`) | tag and message references | a person, a post or a comment; the picker's footnote drops `#tag` and messages, and the citing help names the three kinds (copy-voice) |
| History doors (the change-histories round, post-MVP) | every door into a version history | the `Edited` marker is a plain marker, the stance readout carries no built-tail, a `StanceRow` value opens nothing |
| The reader's menus (`ReaderPostMenu`, `ProfileMenu`, `CommentMenu`) | a content report row (readme §13, *The menus round*) | no Report row |
| An applicant's comment foot and `Reply` (`ReplyEntry`, `ProfileComments`) | commenting before approval (readme §13, *The applicant's life round*) | both stay drawn and answer in place: `You can comment once you're in.` |

## Copy held to what V1.0 does

Words that would claim something the release does not do (readme §13,
*The V1.0 scope cut*).

| Copy | Held back | Source |
|---|---|---|
| Money words, everywhere a signed thing's cost is spoken | who pays: neither the member nor a pool is named | copy-voice, the lines marked payer-neutral |
| The deletion page (`DeleteAccount`) | "cover" and "messages" | it names what exists |
| The editing help | version removal | removal targets the whole post |
| The citing help | citable kinds beyond a person, a post and a comment | copy-voice, *Citing*; the end-state wording returns with its kinds |

## Waiting on a slice inside V1.0

Surfaces V1.0 carries whose full behaviour lands with a later slice of
the roadmap. Each row says what the build shows until its slice lands.

| Surface | Waits for | Until then |
|---|---|---|
| The default order — the feed's filter, search's filter, Settings' Reading default (`OrderSection`) | slice 3's ranker | the build serves `Newest` and the order section's default reads it; the drawn default `Ranked` takes over when the ranker ships (readme §13, *The audit answers* and *The settings round*; `SettingsReading.md`) — see *Unresolved* 1 |
| The guest and applicant feeds (`Main`, `FeedBare`, `ApplicantFeed` and its family) | slice 3's ranker | the band names the vantage and stands; the borrowed order, the invite-link vantage's contract field and the band's line about ranking wait, and the feed reads newest like every feed (readme §13, *The shell round's stops*) |
| The tag page's list and the comment thread | the ranker | newest first, with no order control and no label naming the order (readme §13, *The tag round*; backlog 115) |
| A portrait clip's tap on a feed card | slice 3's stream (`Reel`) | it opens the post detail, where every other media tap goes (readme §13, *The slice-2.5 rulings*) |

## Placeholders swapped at publication

Real-shaped values that no stranger can hold, swapped in one motion
when CoGra is on a server and in the Play Store (backlog 118).

| Placeholder | Where it shows | Swaps for |
|---|---|---|
| `reports@cogra.local` (`REPORT_ADDRESS`) | `ReportProblem`, `ReportProblemEmpty` | the real report address |
| `hello@cogra.local` (`CONTACT_ADDRESS`) | Settings' `Contact` row, on `Settings` and every board drawn over it | the real contact address |
| `STORE_LISTING_URL`, id `local.cogra.app` | `Update now` on `FeedNewerVersion` and `WhatsNewBehind` | CoGra's real Play Store listing |
| The web's `On Android? Download the app (APK)` | `Main`, `FeedBare`, `GuestGate`, `SignIn`, `SignInError`, `SignInExpired`, `SignInLimited`, `KeyCeremonyUnsupported` | nothing: the line retires once the listing is live |

## Out of the release

Drawn after the MVP or not at all, with nothing on screen in V1.0 but
the doors above: the wallet, chats, push notifications and change
histories (`designs/postmvp/`, the fifth canvas); the marketplace
(backlog 14); the Collective actor variant (backlog 15, readme §7); the
Sky itself (backlog 16); per-kind notification muting (readme §13, *The
notifications round*); the reader's sensitive gradient, read in V1.0 as
one show-sensitive threshold (readme §13, *The veil's scope*).

## Unresolved

Rows whose on-screen state needs a ruling before they can gate.

1. **The order swap before the ranker.** The build serves `Newest`, but
   every filter sheet draws the two-option `Ranked` / `Newest` swap
   (`OrderSection`; `FeedSheet.md`, `ExploreFilter.md`,
   `SettingsReading.md`), and the feed's and search's sidecars still
   state `Ranked` as the default. Nothing rules whether `Ranked` stands
   selectable, disabled with a reason, or absent while no ranker
   answers it — and a selectable `Ranked` that sorts newest is a lying
   label.
2. **The Feed score before the ranker.** Every post card carries
   `Feed score` and its number, and `FeedEntry` → `RankPath` →
   `RankHop` → `RankRecords` walk the paths behind it — a slice-3
   remainder (readme §13, *The score-and-opinions round*). Nothing rules
   what a release without the ranker shows in the score's place, or
   whether the drill-down ships.
3. **Topic holding before the topic feed.** The tag round records the
   roadmap's "topic follow is client-hidden until the topic feed lands";
   the V1.0 scope cut rules that topic follow ships whole, as slice-3
   sequencing inside V1.0; the topic round draws it as the stance
   gesture with no hiding condition. Whether a build without the topic
   feed hides the tag page's stance row, Explore's `Your topics` door,
   `YourTopics` and the filter's topic section — or shows them with the
   topic section alone held back — is unruled.
