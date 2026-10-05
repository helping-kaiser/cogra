# Copy and voice · `guide:design:copy-voice`

The rules of `design.md` §7, with the product's own examples. See
`readme.md` §3 for the condensed version.

## The two hard rules about numbers

**Numbers are in scope.** CoGra's ranking is not a black box, and the UI
must not behave as though it were. A post can show what it scored and why
it sits where it does, opening into the actual paths behind it. Showing
the number is the honest move; withholding it would be the opacity this
product exists to refuse.

Two rules keep that from becoming noise:

1. **Every number shown is explainable** — traceable, on demand, to what
   produced it. A figure with no path behind it is the black box again,
   just smaller.
2. **Detail is layered** — a calm surface by default, the arithmetic a
   tap away, with the density partly the reader's own choice.

## The register that stays off the screen

A voice, not a word list (jakob's ruling 2026-09-17). Copy never sounds
nerdy, geeky or mathematical about the product's own machinery. That
keeps out every word whose job is to describe how the thing is built:
**node, edge, vertex, tensor, weight, parameter, decentralized,
protocol, token, crypto**, and the repo's own *valence*, `p_d`, `p_i`.

**Graph, network and connection are ordinary English** and are welcome
used plainly — the blessed lines below say "stays on the graph" and
"Removed by the network" because those are the sentences a reader
understands. **Followers** is not forbidden either; it is steered
around because it misdescribes what CoGra's edges are, which is an
accuracy problem rather than a register one.

An **opinion's** two stance parameters are labelled `For or against` and
`How much reaches you` on screen, and nothing else. Another record family
filling the same two slots names them its own — a tag's pair editor says
`How much it is about this` / `How sure you are`, a citation's field
`Barely` / `Entirely`, an Affinity's `Dislike` / `Like`. The control
owns the geometry, the record family owns the words.

The rule is "as little as possible, as much as needed", not a word ban.
Where the format *is* the content, name it exactly: a key export that
won't say PEM, PKCS#8, hex, or Ed25519 is an export nobody can feed to
another tool. Codes, keys, and recovery are the reader's own vocabulary
on those surfaces. Plain language frames the block; the precise label
sits on it.

This is greppable and should be enforced as a check over Android's
`strings.xml` and the web copy, rather than left to review — the check
does not exist yet.

## Ages

One vocabulary for every timestamp, everywhere (ruled 2026-09-09): the
minutes/hours/days ladder — `now`, `35m`, `2h`, `3d` — up to 30 days,
and the date (`06.09.2024`) past it. No other words: no "today", no
weeks, no months. Recency is a feeling and gets the ladder; history is
a date. One exception, ruled by jakob for the post-MVP chats round
(2026-09-23): a chat's thread prints exact clock times on its bubbles,
with a day divider in the dateline's words wherever it crosses a day —
a thread is where people agree on when. The chats list keeps the ladder. The removal mark's `when` speaks this vocabulary like any
other timestamp — it is the redaction's own moment, not the content's
age.

The dateline form — `12 September`, the year added only when it is not
the current one — belongs to the chronicle's version datelines (*Change
histories*) and the already-published marker (*The already-published
marker*), where a date names a record rather than its age.

Forward-looking moments read the same ladder forward (ruled
2026-09-14): the relative form — `in 6 days`, `in 1 day`, then `in 5
hours` on the last day — is the future vocabulary. A far date, where
one is also shown, spells `dd.mm.yyyy` (`08.09.2026`), never an
abbreviated month. Blessed instances: `WalletCampaign`'s `Ends in 6
days · 08.09.2026`, `WalletCampaigns`' `In escrow · ends in 6 days`.

## Register

Write from the reader's side. Active voice. **A control says what will
happen; the confirmation says what happened.**

| Do | Don't |
|---|---|
| `Sign and publish` | `Submit` |
| `Signed — it's in the thread now, still settling.` | `Success!` |
| `That didn't send. Try again.` | `Error: request failed (500)` |
| `Nothing here yet — write the first post.` | `No results` |
| `You're browsing as a guest — sign in or join to post and vouch.` | `Sign up now to unlock CoGra!` |
| `It signs 3 things, each paid separately.` | `This may incur charges.` |
| `You can invite once you're in.` | `Feature locked` |

Sentence case everywhere. No title case, no all-caps, no exclamation
marks outside a genuine welcome (`Approved! Your registration is
landing`). Em dashes carry asides; `…` marks work in progress (*In-flight
labels*).

## Emoji

Used for one thing: rendering a value. The stance readout is where that
happens — twenty anchors, plus 🤷 for a zero opinion and 🫥 for a control
at rest — and a help, coach or snackbar line that speaks a pair leads
with the same face, because the sentence is a readout too and has to
hold for a reader who never turns the digits on. The tag table's
thirteen objects are the same thing for the other family. **Never** in
headings, buttons, marketing copy, empty states, or documentation of
features. The `→` in `Just looking? Browse the feed →` is the only other
glyph used as punctuation.

## Honesty phrasings to reuse verbatim

- `Still settling` — content authored, not yet ordered. The same words
  label the feed filter's *Also show* chip, on by default (blessed
  2026-10-01, jakob): switched off, the feed keeps to what has landed,
  and the trigger reads the deviation as `settled only` (blessed
  2026-10-01, jakob).
- `Edited` — an edit, marked softly.
- `Nothing was signed just now.` — the coach mark's first line.
- `Signing needs your key, which isn't in this browser — the write waits
  as pending.`
- `Your opinion of this post drops to nothing. It stops reaching
  your feed, you stop earning from it, and nothing passes on through
  you.`
- `A signing key can only ever back one account, so this account needs
  its own.`
- `This is the only way to restore your key.`
- `Replying also signs an opinion on what it answers.` — the reply
  seal's note, under the ruled block in every state, at a post or a
  comment. *An* opinion, never *your* opinion (jakob, 2026-09-30): the
  reply's own starts at the default and rides the reply, and "your
  opinion" reads as overwriting the one the reader already gave.
- `Reply to @tobias — 89 characters.` and `Reply to @tobias's comment`
  — the reply seal's read-back note and its act row when the reply
  answers a comment (`ReplySealComment`; the reply pack, 2026-09-30). A
  comment has no title, so it is named by its author's handle; only
  these two lines change with the target. *Blessed, jakob 2026-10-01.*

## Naming

The product is **CoGra** in prose. The wordmark is lowercase `cogra`.
Handles are shown with `@`. A person or group is an *actor* internally
and never on screen — on screen they have a name and a handle.

**A `#name` is a TAG on screen and a topic in the record** (jakob's
ruling, 2026-09-09). *Tags* is the word people already use for this;
*topic* is the L1 author's word for the node, and it belongs to the
contract, the docs and the graph — never to a label, a count, a
placeholder, an accessible name, or a "?" text. So the reader is shown
`Tags`, `+ Add a tag`, `23 tags`, `Tags & references`, `#tag` in a
search hint.

The law stops at the code's own names. `TopicChip`, `TopicsLine`,
`TopicRemovable`, the `topics` prop, `FEED_KINDS`' `topics` value,
`ReferenceRow`'s `kind="topic"`, the `NODE_GLYPHS` keys and the
`open-a-topic` / `add-a-topic` flow names all stay as they are: they
name the record, they are not read by anyone using the product, and
churning them would cost every cross-reference to the contract for
nothing. `FEED_KINDS` is where the two meet — value `topics`, label
`Tags` — and that pairing is the law in one line.

One word keeps its ordinary sense throughout: a help dialog's *topic*
is its subject, not a `#name`.

**What a reader gives is an OPINION; the record is a stance** (jakob's
ruling, 2026-09-11). *Opinion* is the word people already have for
saying what they think of something; *stance* is the repo's and the
contract's word for the two-parameter record, and it belongs to
`docs/`, the graph and the code. So the reader is shown `Give your
opinion`, `Your opinion on this post`, `Current opinion`, `Resulting
opinion`, `How opinions work`, `Opinion pad`, `Opinions on you`,
`Opinions by you`, `No opinion yet`, and the chronicle's `Gave an
opinion`. The verb is *give*, never *take*.

**An opinion that rides another act is *an* opinion, never *your*
opinion** (jakob's ruling, 2026-09-30). A reply and a citation each
sign a stance of their own, starting at the gentle default, and it is
not the opinion the reader's face shows on that post; `your opinion`
there reads as that one, or as overwriting it. So the reply's note,
its pad's "?" and the citing "?" say `an opinion`. *Your opinion*
stays where it IS the reader's own: the face and its control, the
opinion a vouch or an approval signs, one's own post or message, the
chat seals' pad, and every readout of an opinion already signed.

**"Standing" leaves the screen entirely.** `Current opinion` and
`Resulting opinion` say what it said, in the word a reader owns.

The law stops at the code's own names, exactly as the tag/topic law
does. `StanceControl`, `StancePad`, `StanceReadout`, `StanceRow`,
`StanceValue`, `StanceStanding`, `STANCE_ANCHORS`, `NO_STANDING_LABEL`,
`standingLine`, `standingParts`, the `stance` prop, `StanceReadout`'s
`kind="standing"` value, the stance record and its `api-spec` shape, the
flow-graph's `stance face` labels and the `ProfileStances` board name all
stay: they name the record, no one using the product reads them, and
churning them would cost every cross-reference to the contract for
nothing. The retired word survives in identifiers for the same reason
`topics` does — `NO_STANDING_LABEL`'s own value is `No opinion yet`, and
that pairing is the law in one line.

## The feed's way back up

**`Back to top`** — the pill that rides in with the returning collapsing
band when the reader is deep in the feed (jakob's ruling 2026-09-14). It
names the DESTINATION and, in the same two words, the direction: a
reader three screens down knows both what they will get and which way
the list is about to move. `Top` alone names a place with no promise
attached, and `Scroll to top` spends a word on the mechanism, which is
the one thing the reader can already see happening.

Plain words and no glyph, which is a decision and not an omission: the
inlined icon set carries no arrow that points up and §5 forbids drawing
one, but the words would win anyway — an arrow alone reaches a listener
as "button" and a reader as a guess, for a control that exists to be
obvious.

## The filter pill's state words

The trigger over a feed or search speaks how the view departs from the
reader's default, and it speaks each axis's **state**, never the
direction (jakob 2026-10-02, the residue round's Q2): a state reads the
same whether it departs from the app's default or back toward it. The
head names the kinds always; every other axis speaks only when it
departs, in lowercase after a `·`:

- **Kinds** (the head): one kind's name, `2 kinds`, `Nothing`; every
  kind on, `All kinds` (jakob 2026-10-02 — the state, never the count,
  at the full set).
- **Forms**: the forms held, `text + photos`; every form, `all forms`.
- **Order**: `newest`, `ranked`.
- **Seen**: `showing seen`; off, `hiding seen`.
- **Also show**: a chip on joins the `+` list, `+ sensitive` or
  `+ still settling`; `Sensitive` or `Removed` off, `hiding sensitive`
  or `hiding removed`; `Still settling` off, `settled only`.
- **Topic**: the tag's own name (*Topics*). A default never holds one,
  so it has no word for its absence.

*New 2026-10-02, blessed (jakob 2026-10-02):* `all forms`, `hiding
seen`, `+ still settling`, `hiding sensitive`, `hiding removed`,
`All kinds`. The rest are the trigger's words as already drawn.

## Platform nouns

The key lives on a device, and the device is named as the reader sees
it: **"this browser"** on web, **"this app"** on Android — never a bare
"device" where the concrete noun exists, and each noun carries its own
preposition. One line, two renderings:
`Your key isn't on this browser` · `Your key isn't in this app`.

**Where a sentence can be phrased without the platform noun, it is, so
both platforms share one string (jakob).** Push's settings talk about
*when*, not *where* (`Announce new notifications the moment they
arrive.`), and where the noun is unavoidable the one shared sentence
names both concretely (`…the notification settings of the browser or
phone itself`) rather than rendering twice. About's key topic is one of
these: `Everything you publish is signed by a key only you hold.` — no
noun, one string for both (jakob 2026-10-01, the bare "device" retired;
the wording **blessed (jakob 2026-10-02)**).

## The "?" dialogs

Compose keeps captions to one short line; the full explanation lives
behind a small "?" (at most one per screen, save the stopper exception:
a notice that stops the surface's one act carries its own beside the
header's — readme §13, *The compose flow*) opening a plain dialog:
title, at most two short paragraphs, Close. The texts, verbatim
(browser wording shown; the app variant swaps the platform noun):

- **How signing works** (the seal, post and reply): Each piece of a
  post — the post itself, every tag, every citation — is signed on
  its own, in your name. They sign together: all of them land, or
  none does. / Each signing is paid for — the cost is real, so each
  one still counts. *(Payer-neutral by the V1.0 scope cut, jakob
  2026-09-25: no copy names who pays until a pool that pays and
  members who pay past it exist.)*
- **The license**: Terms for anyone who reuses what you publish —
  credit, and a public record of use. They are not a statement about
  how you made it. / The license is set when the post is first signed
  and can never change, not even by an edit. Your default lives in
  settings — Public domain until you change it.
- **Marking as sensitive**: The mark veils the pictures and the
  words until a reader chooses to look. The title stays
  readable, so choosing is informed. / Your reason, if you give one,
  is shown on the veil. The mark is public and travels with the post.
- **Describing pictures** (the describe sheet): A description is
  read aloud by screen readers and shown when a picture can't load —
  plain words about what's there. It travels with the picture,
  public like the rest of the post. A video takes one description
  for the whole clip; its cover takes none of its own. / Nothing is
  described for you: a picture without a description is skipped by
  screen readers, never guessed at.
  *(The sheet and the describe row both carry the reason permanently,
  under the title and under the row: **`Read aloud to people who
  can't see it.`** — the "?" is for the reader who wants the rest,
  not for the one who needs to know why the field is there.)*
- **Your key** (key absent — the seal, the stance pad, and the two
  settings screens): Signing needs your key, and it isn't on this
  browser — nothing is signed without it. / A recovery code brings the
  key to any device. Until it's here, anything waiting on it stays on
  this device. *(One text for all four key-absent surfaces, the key-loss
  round: nothing in it assumes a write in progress.)*
- **Why signing waits** (the write rule's notice — the seal
  and the stance pad): There's a limit to how many signed actions can
  go through in a short time — it keeps the network safe from flooding.
  You've hit it for now. / Nothing was signed or spent, and your draft
  is kept. Try again in a little while. *(Blessed, jakob 2026-10-01 —
  the stopper exception's first dialog. One dialog, its draft clause
  true per surface: on the pad, which keeps no draft, the second
  paragraph reads `Nothing was signed or spent. Try again in a little
  while.`; from a reply's seal, which keeps none either, `Nothing was
  signed or spent, and your reply is still here. Try again in a little
  while.` Payer-neutral by the V1.0 scope cut.)*
- **Your opinion on your post** (the post's one-axis pad): Publishing
  also signs your opinion on your own post — for or against, from a
  gentle 🙂 *(+0.10)* by default. / Your own post always reaches you in
  full, so only for-or-against is yours to set. The face is the
  reading: six of them run from 😠 at one end to 😍 at the other, and
  the one you see is wherever your number lands. Nothing is signed
  until Set. Prefer sliders or exact numbers? Swap the input in
  settings.
- **Toward what you answer** (the reply's two-axis pad): Replying also
  signs an opinion on what you answer — for or against, and
  how much of it reaches you. It starts at a gentle 🙂 *(+0.10 / +0.10)*
  and rides the same signature as your reply. / Nothing is signed until
  Set. Swap the input in settings if you prefer sliders or numbers.
  *(An opinion, never "your opinion" — jakob 2026-09-30, see Naming.)*
- **Your vouch back** (the vouch-back pad): Vouching back signs your
  opinion of the person who vouched you in, and your feed grows from
  it. / The pad is how you shape what reaches you — for or against, and
  how much. Nothing is signed until Set. *(The title is blessed (jakob
  2026-10-02); the first paragraph is blessed (jakob 2026-10-05).)*

  *The italicised tails are the `cg-exact` spans: the face is drawn in
  both reading modes, the digits only when the reader has asked for
  them (readme §13), and a screen-reader twin says both either way.*
- **Editing**: An edit signs a full new version on top; earlier
  versions stay public under "Edited". An edit
  never bumps it as new. / Tag and citation changes ride the same signing,
  each as its own signed action. The license never changes.
- **Citing**: A citation is its own signed action and carries an
  opinion of what you cite. You can cite a post, a comment or a
  person. / A comment can also be cited from itself — open its menu
  and choose "Cite in a new post". *(Trimmed to V1.0's citable kinds,
  jakob 2026-09-25; the end-state wording returns with its kinds. An
  opinion, never "your opinion" — jakob 2026-09-30, see Naming.)*
- **Searching** (the Explore tab's results): Search reads names and
  titles, never bodies. Start with @handle to search one person's
  work — including their comments, found through what
  they point at. Start with #tag to search inside a tag. /
  Results put what's closest to you first — the numbers are your
  view, no one else's. Below the line, what's still beyond your
  reach, newest first. Your searches stay on this device.
- **What is CGT?** (the wallet's balance headline): CGT is CoGra's
  own money. Advertisers fund campaigns with it, and it pays the
  people whose posts and stances carried real reach — the small coin
  always means CGT. / It's yours the moment it lands: earnings are
  paid straight to you, held by your key, never by CoGra. Every
  amount can be traced to what paid it, and the ≈ value reads the
  public CGT–L-BTC market — it moves with the market and is never a
  promise.
- **Your wallet key** (the wallet's set-up moment): Your wallet gets
  its own key — created on this device, never held by CoGra,
  restored by the same recovery code as your signing key. One code,
  both keys. / Publishing your payout address is a signed action.
  The address is public, payouts and tips land there, and every
  change to it stays on your public record.
- **Changing your picture** (the profile-picture seal): Your profile
  is a public record, and changes to it are signed actions in your
  name — the picture changes the moment yours lands. / The signing is
  paid for, like your posts. The record that you changed it stays,
  like every signed action.
- **The filter** (the feed's and search's filter sheets): What you
  let in, and in what order — the kinds combine freely, ranked or
  newest is one choice, and what you've already seen stays out
  unless you ask for it back. Nothing changes until you press Done,
  and nothing here is signed or shared. / It lasts until you change it,
  on this device only. Reset brings back your defaults, to change
  them go to settings. *(The Reset
  sentence is jakob's own, blessed 2026-10-02: one sentence for the
  feed's, search's and the settings sheet.)*

**A "?" is named by the dialog it opens.** Its accessible name is that
dialog's own subject, so a listener hears which explanation the tap
brings: `Your key`, `License`, `Sensitive`, `How the filter works`,
`What is CGT?`. The three stance pads take theirs the same way —
`Your opinion on your post`, `Toward what you answer`, `Your vouch back`
— because one name across three surfaces says only that a dialog
exists. `How opinions work` is the opinion control's own help, where the
control itself is the subject.

The stream and the viewer earn no "?". The stream is the feed the
reader already knows, and the viewer is one picture with a way out —
a dialog explaining either would be explaining the obvious.

## Refused files

Drawn on *Reply · files refused* and *Pick · files refused*
(readme §13, *Comment video and the media error states*). Each line
names the cap it broke, because that is the only place a cap is named —
nothing announces the limits in advance. One line per surface, one way
out (*Remove it*; never *Retry* — retrying cannot change the answer):

- `That video is too big — a comment's video can be up to 50 MB.`
- `That video is too big — a post's video can be up to 100 MB.`
- `That picture is too big — a picture can be up to 10 MB.`
- `That file isn't a picture or a video CoGra can read.`
- `A post carries pictures or one video, not both.`
- `A comment carries pictures or one video, not both.`
- `That GIF moves, and CoGra can't take a moving GIF here. A still one
  is fine.`
- `That's more than a post carries — up to ten pictures.`
- `That's more than a comment carries — up to four pictures.`

**Screens say MB; the caps are MiB** — MB on every user-facing surface,
never MiB (jakob 2026-10-02). The limit enforced is the binary
one — 50 MiB is 52.4 MB — so the number on screen under-promises and
can never turn a file the product would have accepted into a refusal.
The reverse, writing MiB, would be exact and unreadable.

**A file is judged on its own before it is judged against the body.**
Size and format answer first, the grammar second — so a video too big
for a post is refused by its cap, and a video the product would have
taken is refused by the mixed-kind line. One file, one line, the
nearest reason.

Two removal marks, never interchangeable: `Removed by its author` —
"The words and pictures are gone. The post's place in the thread, and
every response, remain." — and `Removed under the platform's rules` —
"A passed proposal removed it. The decision is public."

At comment scale the author's mark swaps its noun and nothing else
(the comment-removal round; blessed, jakob 2026-10-01). The removed
comment's second line is `The comment's place in the thread, and every
response, remain.` (`CommentRemoved`). The confirm is titled `Remove
this comment?` over `The words and pictures leave every reader's view,
along with every earlier version's. A visible mark stays in their place
— "Removed by its author" — and the comment's spot in its thread stays
with it.` (`CommentRemoveConfirm`), then the post's own `This is
immediate and permanent.`, `Remove` and `Keep it`.

## Staging a video

**A video is the whole body** — the quiet line where the add control
used to be, once a clip is staged:

- `A video is the whole post. Its cover comes next.`
- `A video is the whole comment. Give it a cover below.`
- `A video is the whole post.` — the edit's trim of the staging
  line: the cover sits on the edit's own screen, so the second
  sentence goes (blessed 2026-09-14). **The vertical pick wears
  this same trim** (jakob 2026-09-24, backlog item 104): the
  second sentence previews the cover step, and the vertical path
  skips it — the shape keys the step (readme §13, the stored
  first frame) — so the promise would be false there. No vertical
  line of its own is minted.

**The add control carries the cap** — the established add grammar
gains the post scale's count (the comment scale already draws its
`· 1 of 4` twin; blessed 2026-09-14):

- `+ Add pictures · 2 of 10`

**A clip that didn't upload** — a fault, not a refusal, so it keeps
Retry (`UploadErrorLine` with both ways out):

- `That video didn't upload.`

  The transport voice would write it *That didn't upload. Try again.*;
  the line is drawn short because Retry stands beside it and the pair
  would say "try again" twice.

**The cover's own words** — the crop a gallery picture goes through,
and the way back to it from an edit:

- `The cover takes the video's shape.`
- `Add a cover`
- `Change the cover`

  The pair is one door in two states — the first where a clip has no
  face yet, the second where it has one. Neither says "cover photo" or
  "thumbnail": the cover is the video's own face, and naming it twice
  would make it a second picture.

## Editing a media post

The edit surface shows the gallery the post already has where the words
field would stand, and one line says why the field is not there:

- `A post's body is words or media, never both.`

It states the body's rule, never a lock on this post: an edit carries
the post's complete new content state, so it may flip the kind outright
— every picture replaced by words, or the words by a gallery.

The edit's Sensitive row binds only the author's own mark, never the
moderator's verdict, so a post the platform veiled and its author did
not reads `Not marked` with one quiet line under the row:

- `Also veiled by the platform's verdict` — blessed (jakob 2026-10-02) (jakob
  2026-10-01 ruled the line; the exact wording is the recommendation's).

## Accessible names

The words a reader hears where the screen carries none — glyph controls
whose accessible name is the only wording they have, and readouts whose
visible half is hidden from the accessibility tree and spoken instead.

**The transport**, one control one verb — each says what the tap will
DO, the way the sound toggle already does:

- `Play` · `Pause`
- `Seek` — the timeline's name; its value is spoken as
  "0:14 of 0:41", the two times the bar already shows.
- `Play this video` — the suppressed-autoplay card's disc. Longer than
  the transport's `Play` on purpose: it is the only one that appears
  beside a still frame, where "play" alone would not say what of.

**The stream and the viewer**:

- `Back to feed` — the stream's way out when it was opened from the
  feed (a post's pinned clip or a profile's posts name that origin
  instead; readme §13, *The nav-noun sweep*). Not "Close": the reader
  is going back to the feed the stream narrowed, not shutting a layer. The
  feed takes no article anywhere in this vocabulary (jakob 2026-09-15):
  it is a named surface, like Explore and settings, rather than a common
  noun like the post or the wallet — and it is the destination a reader
  meets most often, so one spelling serves `DetailHeader`, `Removed`,
  the profiles, `VouchAsk`, the tag page's origin table and the stream
  alike — and it is the cold entry's label on a post, a comment or a
  profile, whose root is Feed (readme §4, *Navigation*).
- `Close` — the viewer's X, which IS shutting a layer.

**The way back names where it goes** (readme §4, *Navigation*): on a
read drill-in the arrow's name is its origin's noun, from the screen's
table (readme §13, *The tag-page smalls* and *The navigation-and-sheets
round*). A named surface keeps its name, the feed's many states are one
noun, and a sheet is named by what it is a sheet of. Already blessed:
`Back to feed`, `Back to Explore`, `Back to the search`, `Back to Your
topics`, `Back to the post`, `Back to the comments`, `Back to the
profile`, `Back to #<thattag>`, `Back to your profile`, `Back to
settings`; the score's trace, the stream, the opinions page,
Notifications and About take their nouns from these, and Notifications
adds one: `Back to Wallet`, when the bell was tapped on Wallet's root —
a named surface by its title, not in the MVP and still a place to go
back to (jakob 2026-10-02, **blessed**). The entry funnel names no
origin: from the join form, About's arrow reads a plain `Back`, as the
form's own does.
Added by the post detail's and the profile's tables, each blessed (jakob 2026-10-02):

- `Back to Saved` · `Back to History` · `Back to Notifications` — the
  three named surfaces, by their titles.
- `Back to the stream` — from the reel (its score's door, an author
  chip), the stream's own common noun.
- `Back to the opinions` — from a profile's opinions list
  (`@ada · Opinions`), the list named by what it holds.
- `Share this post` — the share control everywhere it appears. The
  completed name, never a bare "Share": a glyph with one word beside it
  in the accessibility tree tells a listener the verb but not the
  object.

**The citation's pair** (`RefPair`), where the field and its readout are
`aria-hidden` and these words are what is said in their place:

- `The pair this citation signs` — the pad's own name. It says whose
  pair and what setting it does; a pad named for the instrument would
  leave a listener to work out what the two numbers are for.
- `How much it leans on this` — the relevance axis, spoken with its
  value. It is api-spec's own gloss said to a reader, and the other axis
  keeps `For or against`, the words a stance already uses for that slot.

**`Manage the N citations`** — the seal's "N cited" row, whose whole row
is the control and which carries no word saying so. `Manage the pictures`
(the details stage's picked row) said for the other collection: the verb
is what the row does, and naming it is the only way a listener learns
that a line reading "References · 3 cited · 3" is a door at all. **The
count rides inside the name**, because a door's name replaces everything
in it: a listener who hears "Manage the citations" has been given the
verb at the price of the number, and the number is the whole reason the
row exists. The count is bare and the noun is the row's — "Manage the 3
citations", and at one "Manage the 1 citation", the plural the acts
card's own reading spells.

**The acts card's count — `N <the row's noun>`** (jakob's ruling
2026-09-14). The seal's rows end in a bare digit, which an eye reads
against the label on the same line and an ear receives as nothing at
all. So the digit is hidden from the accessibility tree and the count
is spoken whole: `1 post`, `3 tags`, `3 citations`, `1 comment`,
`1 edit`, `1 picture`. The noun is the row's own, not its label's —
the References row counts CITATIONS — and it is given by the board
that staged them, because no rule turns "References" into "citation".
A count already made of words (`1 more`, on the rows that offer an
act) keeps them and says itself.

**A picker's staged row** speaks through its ×: `Remove saltmarsh`,
`StagedReference`'s own name for the control, once a pick has moved the row
above the list (the pickers' staged section, jakob 2026-10-01).

**A pick, and its undoing, said aloud** — the pickers' status message
(`PickAnnouncement`), polite and spoken only, since the row's move is all
the eye gets:

- `Added — in the staged list.` — on a pick.
- `Removed from the staged list.` — on a staged row's ×.

Both blessed (jakob 2026-10-01).

## The staged-act snackbar

An applicant's second tap of a kind already staged answers here instead
of opening the real surface again; one line per kind, same shape:

- `Your post waits with your application — it arrives with you.`
- `Your opinion waits with your application — it arrives with you.`
- `Your topic waits with your application — it arrives with you.` — the
  Affinity on a tag page, its own once-each kind. Drafted from the
  audit's recommendation (jakob 2026-10-01, "as recommended"); **blessed (jakob 2026-10-02)**.

The post's line is also the seal's answer for an applicant: `Sign and
publish` stages the post rather than landing it, so the wizard closes onto
the applicant's own feed with this line, never with `Signed — it's in the
thread now, still settling.` (jakob 2026-10-01). On the turned-down shell
no application is live for the post to wait with, so the seal's exit
says what it waits for instead: `Your post waits — it arrives when
someone vouches you in.` (jakob 2026-10-02, the tail his; the opening
kept from the staged-act line — *new 2026-10-02, blessed (jakob 2026-10-02)*).
The same line answers the post's second tap there, wherever it is made —
`New post` on the bar, and the menus' `Cite in a new post` and `Mention in
a new post` (jakob 2026-10-05).
The other two kinds answer a second tap on the turned-down shell in the
same grammar (jakob 2026-10-02, **blessed**):

- `Your opinion waits — it arrives when someone vouches you in.`
- `Your topic waits — it arrives when someone vouches you in.`

**Comments are not a kind that stages** (jakob 2026-10-01: applicants do
not comment in V1.0). A staged comment would wear `Still settling` for a
reply that cannot wait as pending, so the comment sheet's foot answers an
applicant in place. A guest gets the join prompt there instead.

**The applicant-foot family** — jakob's own words, picked 2026-10-02
(F7) and **blessed**: an applicant's locked control answers its tap with
what becomes possible, and when.

- `You can comment once you're in.` — the comment sheet's foot and a
  comment's `Reply`.
- `You can invite once you're in.` — the profile's `Invites`.
- `You can vouch once you're in.` — an applicant who opens someone's ask
  link, where app-open lands for them (jakob 2026-10-02, **blessed**).

Every control the family answers wears the locked look (auth.md):
visibly inactive, still tappable — the foot, `Reply` and `Invites` alike
(jakob 2026-10-02).

## In-flight labels

The failure pack (jakob, 2026-09-30). A commit whose answer has not
come back says what is happening in its own label. The verb takes its
present participle, the rest of the label stays, and `…` closes it.
The control goes inert, never dimmed, and no spinner is added. The
swap waits until the answer is 200ms late (readme §4, *Loading*), so
a quick answer never flashes a word.

- `Signing and publishing…` — the post seal's `Sign and publish`.
  **Drawn** on `SealSigning`.
- `Setting…` — the pad's `Set`, carried by `StanceControl`.
- `Walking it back…` and `Disconnecting…` — the severance dialog's
  commitment, in each family's own words.
- `Signing…` — the line under the face while a press-and-hold signs.
  A hold has no label to swap, so the target's row carries it, in the
  pending marker's quiet register. **Drawn** on `RowSigning`.

Every other commit follows the same construction and needs no separate
entry: `Sign comment` becomes `Signing comment…`, `Sign in` becomes
`Signing in…`, and `Create account` becomes `Creating account…`. *(All
of these arrived with the failure pack; blessed, jakob 2026-10-01.)*

A seal gated on its uploads keeps its commit enabled, and a press there
swaps to the same word while it waits for the bytes — `Signing and
publishing…` on `ComposeSealUploading`, `Signing comment…` on
`ReplySealUploading` — then signs with no second press (jakob
2026-10-02, the fix-fix round's 20; no new words). An edit that took new
pictures gates `Sign the edit` the same way, swapping to `Signing the
edit…` (jakob 2026-10-05; the construction's own word).

## Field errors

The lines the errored entry and profile boards carry — a field's own
supporting line, or a form-level fault line where the system genuinely
doesn't know which field is wrong.

**Drawn** — a board renders these verbatim:

- `That handle is taken.` — Join's Handle field, the server's answer.
- `A password is at least 12 characters.` — Join's Password field, a
  local format failure.
- `That email and password don't match.` — SignIn's form-level fault
  line, in the failure voice the register already writes in.
- `That code doesn't check out.` — Restore's recovery-code field, and
  every other field that asks for the current code (`SettingsBackup`,
  `YourKeyGate`).
- `A recovery code is 26 characters.` — Restore's recovery-code field,
  when the code is the wrong length once folded: the one shape problem a
  reader can act on (auth.md). Drawn on `RestoreLength`.
- `That doesn't match the code above.` — the key ceremony's confirm
  field, on RecoveryCodeMismatch.

**Copy-only** — named, not yet drawn on a board (no client-side format
validation exists yet to trigger them):

- `A handle is 3–30 characters: a–z, 0–9, _.` — Join's Handle field,
  a local format failure.
- `That doesn't look like an email address.` — Join's Email field, a
  local format failure.
- `That doesn't look like an invite link.` — the invite field's local
  format failure, in the email line's shape; it names the link because
  the field asks for a link. Drawn on `InviteEntryError`.

## Menu rows

The words the four overflow menus put in front of a reader, settled in
spelling — one `License terms` everywhere, never the British spelling:

- `License terms` — the one row, on a post's menu and a comment's
  alike. It closes both menus, the rarest read of the product sitting
  last, and opens the terms in a sheet over the surface the reader
  asked from.
- `Cite in a new post` — on a post's menu and a comment's alike.
- `Mention in a new post` — the same row on a person, and the same
  fact; only the far end of the reference differs.
- `Share this profile` — another's profile.
- `Share your profile` — your own, the row that closes the profile's ⋮
  under the two private lists.
- `Save` while a thing is not kept, `Unsave` while it is — one word
  either way (jakob 2026-09-11). It is the FIRST row of every menu that
  has it, a post's, a comment's, a person's and your own post's alike,
  so the thumb learns one position. A control says what the next tap
  will do (§3), which is why the kept state is a verb and never the
  word *Saved* sitting there as a status — and nothing outside the menu
  shows it, so this row is the only place a reader learns whether a
  thing is kept. `Unsave` is also the accessible name of the Saved
  list's own icon-only control, where the filled bookmark carries the
  act and no word is drawn at all: the glyph is a glyph, and the
  reader's word stays *save* — never *bookmark*, which is a filing word
  for a thing readers think of as keeping.

## The license block

**The readings the sheet gives a reuser.** The chooser's hints speak to
the author declaring the terms, so a read surface that reused them told
a reuser they were owed the credit they in fact owe. These address the
reuser instead. One per axis value:

- Credit — `Not required` · `Required for commercial use` ·
  `Required for every use`
- Public record of use — `Not logged` ·
  `Commercial uses logged publicly` · `Every use logged publicly`

**The author's own tier names**, in the chooser. Credit reads
`No credit` · `Credit commercially` · `Credit always`. The public
record of use reads `Not logged` · `Log commercial use` · `Log every
use` — verbs, because what the author is choosing is whether the
platform logs, not what kind of record exists. *Record* went because
it is the graph's own word for the thing every act already is, and a
tier called `No record` on a system where nothing is ever unrecorded
said the opposite of the truth.

**The block's own furniture**:

- `License terms` — the caption, the same words as the row that
  opened the sheet, so the answer names the question. It is the
  block's only heading; the sheet adds none.
- `Public domain` — the name of the both-axes-zero pair, on the
  caption line. The rows below still spell what it means; the name is
  what a reader already knows it by.
- `Credit` · `Public record of use` — the axis labels, the chooser's
  own legends, so a reader who published a post meets the same two
  words on both sides.

**The author's reading of a pair is one joining rule** (`licenseSummary`;
jakob 2026-10-01, the sheet law's round) — what the seal's License row,
the license sheets' foot and the settings default all read: the pair's
name, ` — `, the credit tier's hint and the record tier's hint joined by
`, and`, each hint lowercased at its head with its full stop dropped,
the whole closed by one full stop. The zero pair's name is `Public
domain`; every other pair is named by its two tier names joined by
` · `. So `Public domain — nobody owes you a name, and uses go
unlogged.` and `Credit always · Not logged — every use credits you, and
uses go unlogged.` The seal's row carries no `your default`: the
reading says what the post's terms are, wherever they came from. The
rule and the eight non-zero readings it composes are blessed (jakob 2026-10-02).

## Staged references

**A staged reference's remove control** takes the referenced thing's
own name as its accessible name — "Remove The long way home — @ada" —
because a row of citations wants each × to say which one it drops.

**The reply seal's reference row**, where a comment's citation shows up
among the acts one signature commits:

- `Reference` — the act row's label, singular, naming the edge staged
  rather than the block it sits in. The count beside it is bare — `1` —
  because the label has already said what was counted.
- `+ Cite something` — the affordance row, the same words the post
  wizard's details stage uses. It drops the gloss listing what can be
  cited: the staged row above it now shows a citation, and an example
  beats a list.

**`N cited`** — blessed 2026-09-14 (jakob), the seal's reading of two or
more staged citations: `3 cited`, one line, where one citation is read
back by name. The count is the whole value, because at two the name
stops being the shortest true answer and a stack of names stops the seal
being a read-back. `References` is the row's label there — plural,
naming the edges staged — and the row is a door into `Cited · 3`, the
sheet that lists them. Both seals say it, the post's and the reply's.

**A seal's trailing count is bare, and it counts its own row** — `3` for
three citations, the list's length and nothing else. One number, one
fact: the signature's total is the card's footer and says in words what
it counts ("6 things, signed together"). An act count dressed as
"3 actions" in a row whose label already said what it counts is the same
number said twice.

**`Cited · 3`** — the staged-citations sheet's title, `Picked · 3`'s
shape for the same job: a staged collection named by what it is and how
many. `Done` closes it, as it closes the picked sheet.

## Missing and unreachable

The dead ends and failed loads, blessed with the audit-states round.
The difference between the first two is the whole design — an answer
that was no, and no answer at all:

- `This profile doesn't exist.` — the terminal state, on
  `ProfileNotFound`. It carries no way on, because nothing about trying
  again makes a profile exist.
- `Can't reach the server — this profile can't load right now.` — the
  fault, on `ProfileUnreachable`, with an outlined Retry. The feed
  variant with the noun this surface is about; the long house line ends
  in "and try again", which beside a Retry says try again twice.
- `Couldn't load more` · `Retry` — the chronicle page that didn't
  arrive, on `ProfileMoreFailed`: the fact at body-medium
  `text-secondary` (rows are already on screen, so the missing page
  means stale, not gone), the way out an `InlineAction` ending the line.

## Faults by code

The failure pack (jakob, 2026-09-30). Every `ErrorCode` the contract
can return (api-spec, *Errors are tiered*) has one vehicle, which is
where the fault is said, and one sentence. The vehicles follow
`NetworkError`'s grammar: a fault is said where the thing it is about
stands, and the rest of the surface stays readable.

- **In place** — a fault about the whole act takes the commit's place,
  with `Retry`. On a seal that is the foot (`NetworkError`). On a pad
  the line stands above the commit row and `Retry` takes Set's slot
  (`PadFailed`). A dialog keeps its pair and its commitment reads
  `Retry`. A form keeps its fields and the line takes SignInError's
  slot.
- **On the row** — a cited post that never landed is said on its
  citation's row, with `Remove it` and no Retry (`SealFaultRow`). A
  hold, which has no surface of its own, says its fault on the target's
  row (`RowSigning`).
- **On the field** — a field's own line (*Field errors*, *Caps and
  their refusals*).
- **The surface** — a fault that leaves nothing to act on takes the
  whole screen (`ProfileNotFound`, `VerifyExpired`, `JoinInvalid`).
- **A notice** — not a fault at all: nothing was staged or spent, so
  the tertiary panel stands in the commit's place and no Retry is
  offered (`WriteRuleFailed`). A refusal that is our bug takes the same
  panel in its own words, with `Try again` (`SealFaultBug`).

Every line here is blessed (the failure pack's, the failure fixes' and
the review fixes' lines, jakob 2026-10-01), all of them (the last flags cleared 2026-10-02).
*Copy-only* marks a line no board draws yet.

**No answer at all** (offline; not a code):

- Seal, pad or dialog: `That didn't send. Try again.` **Drawn** on
  `NetworkError` and `PadFailed`; `SeveranceConfirm` carries it. A form
  says the same line in SignInError's slot above its submit, the fields
  keeping what was typed and the submit being the retry (jakob
  2026-10-05).
- A hold's row: `That didn't sign.` with `Retry`. **Drawn** on
  `RowSigning`.
- A read with nothing loaded: `Can't reach the server. Check your
  connection and try again.` A read with content on screen is written
  per surface (*Missing and unreachable*).

**A slow answer** (not a code, and not yet a fault): a signing past 5s
keeps `Signing and publishing…` on its commit, and the subline under the
seal's total reads `Still signing — the network is slow right now.` in the
olive `--tertiary` ink. No progress is feigned, because a signing cannot
measure its steps (jakob 2026-10-01). **Drawn** on `SealSigningSlow`. *New
2026-10-01, blessed (jakob 2026-10-02).*

**Transport faults:**

- `UNAUTHENTICATED`, `REFRESH_TOKEN_INVALID` mid-session — the
  surface: the sign-in screen, with the draft and any picks kept on
  the device. `You've been signed out. Sign in again to carry on.`
  **Drawn** on `SignInExpired`, where the welcome line stood, in its
  secondary ink.
- `INTERNAL`, `FORBIDDEN` — in place: `That didn't go through. Try
  again.` The house line says "can't reach the server", which is false
  for a fault the server answered.
- `EMAIL_NOT_VERIFIED` — in place: `Verify your email first — the link
  is in your inbox.` The client gates acting on verification, so this
  is the rare case that slips past the gate. *Copy-only.*
- `RATE_LIMITED` — in place, in SignInError's slot. Sign-in's login
  backoff says the drawn line, `Too many tries in a row. Wait a moment,
  then try again.` (`SignInLimited`); every other visible one — the
  registration, the reset, the token confirms — says `Too many tries.
  Wait a little, then try again.` (jakob 2026-10-05). The submit stays.
- `NOT_FOUND` — the surface. For a profile: `This profile doesn't
  exist.` **Drawn** on `ProfileNotFound`. Posts and comments take the
  same construction: `This post doesn't exist.` and `This comment
  doesn't exist.` **Drawn** on `PostNotFound` and `CommentNotFound`.
- `BAD_INPUT` — on the field, in the field's own words. Where no field
  is named, in place: `That didn't go through. Try again.`

**Expected refusals:**

- `INVALID_CREDENTIALS` — in place: `That email and password don't
  match.` **Drawn** on `SignInError`.
- `HANDLE_TAKEN` — on the field: `That handle is taken.` **Drawn** on
  `JoinErrors`.
- `EMAIL_IN_USE` — on the field: `That email already has an account.`
  *Copy-only.*
- `WEAK_PASSWORD` — on the field. The length half is `A password is at
  least 12 characters.` The breach half is `That password has turned up
  in a data breach — pick another one.` *The breach half is copy-only.*
  Past auth.md's cap the line reads `A password is at most 128
  characters.`, on the field, re-checked live like the length half
  (*blessed (jakob 2026-10-05)*; copy-only).
- `INVITE_UNUSABLE` — the surface: `This invite can't be used anymore`
  (`JoinInvalid`).
- `ASK_LINK_UNUSABLE` — the surface, in `JoinInvalid`'s construction.
  Its words are owed.
- `VERIFICATION_TOKEN_INVALID` — the surface: `This link doesn't work
  anymore` (`VerifyExpired`).
- `RESET_TOKEN_INVALID` — the surface, in `VerifyExpired`'s
  construction: `This link doesn't work anymore` (`ResetExpired`; *The
  collected rulings' entry lines*).
- `ACTOR_KEY_IN_USE` — in place: `A signing key can only ever back one
  account, so this account needs its own.`
- `CHALLENGE_EXPIRED` — in place, on the backup's upload, as a
  `NetworkError` outcome: `That didn't go through. Try again.` Retry
  asks for a fresh challenge.
- `SIGNATURE_INVALID` — in place: `That didn't go through. Try again.`
  Retry signs again.
- `STAGED_WRITE_EXPIRED` — the did-not-land notice in the shell: `Your
  post didn't land` (`ComposeExpired`).
- `WRITE_RULE_FAILED` — a notice. On a seal it is `You can't sign
  right now` over `Each signing is paid for, and there's only so much
  to go around at a time. Nothing was signed or spent — your draft is
  kept.`, with `Keep the draft, sign later` under it, and the panel's
  own "?" opening `Why signing waits` (*The "?" dialogs*). **Drawn** on
  `WriteRuleFailed`. Reached from a reply's seal, which keeps no draft
  (readme §13, *The reply pack*), the fact's last clause swaps to what is true
  there: `Nothing was signed or spent — your reply is still here.`,
  and the way out under the panel reads `Not now`, back to the reply's
  seal with the words still there (jakob 2026-10-01). Reached from the
  kept picks' seal, the same mirror: `Nothing was signed or spent — your
  picks are still kept.` and `Not now`, back to the review (jakob
  2026-10-02; *blessed (jakob 2026-10-02)*). The words name no payer (the V1.0 scope cut). On a pad the same panel stands where the
  landing line and Set were, in `PadKeyAbsent`'s shape: `You can't sign
  right now` over `Each signing is paid for, and there's only so much
  to go around at a time. Nothing was signed or spent.` — a pad has no
  draft — with the same "?" and `Not now` under it; the pick is not
  kept. **Drawn** on `PadWriteRule`. On a hold's row the quiet line
  reads `You can't sign right now.` in the pending marker's register,
  never the failure voice, with no Retry. **Drawn** on `RowWriteRule`.
- **One staged act refused** (the field-level refusal on
  `references.<index>.target`; jakob 2026-10-01). A target that landed
  never stops answering, so two cases exist, and they read nothing
  alike:
  - **A cited post that never landed** — picked while still settling,
    the reader's own or anyone else's, and its staged act expired. On
    the row: `This post didn't land, so it can't be cited.` with
    `Remove it`; a comment takes `This comment didn't land, so it can't
    be cited.` **Drawn** on `SealFaultRow`, where the line wraps to a
    second line on the row — accepted as drawn.
  - **Any other refusal** — a bug the picking stage should have
    blocked. A notice in the commit's place, never the failure voice:
    `This shouldn't have happened` over `That's a fault on our side,
    not yours. Nothing was signed or spent, and telling us helps us fix
    it.`, `Try again` in the panel, then `Report a problem` and `Discard
    the post` under it; the post-scale ask is `Discard this post?` · `The
    draft goes, with its pictures, tags and citations. Nothing was
    signed, so nothing else changes.` · `Discard it` · `Keep the draft`.
    **Drawn** on `SealFaultBug` and `SealDiscardConfirm`. At comment
    scale the way out names what is lost (jakob 2026-10-02): `Discard
    the reply` on a reply's seal, `Discard the edit` on a comment edit —
    never `Discard the post` — and it asks first, one grammar with the
    post scale: `DiscardConfirm`'s own ask, `Discard this reply?` or
    `Discard the changes?` over `Nothing is kept.`, with `Keep writing`
    and `Discard` (jakob 2026-10-02, the residue round's Q1). *`Discard the edit` new 2026-10-02, blessed (jakob 2026-10-02).*

**A read-side comfort that fails** (save, unsave, hide, undo, unhide;
not a code): it reverts, and the target's row says `That didn't go
through.` with `Retry`, in the hold's vehicle. **Drawn** on `RowSigning`'s
third card.

## The reset and verify landings

Blessed with the audit-states round:

- `Set a new password` · `New password` · `Set the new password` — the
  reset link's destination (`ResetNew`): heading, field label,
  commitment.
- `Setting a new password signs out every device. You sign in again
  with the new one.` — the consequence, said where the act happens
  (auth.md: password reset revokes every session).
- `Your application moved a step. The rest of it is waiting for you on
  the feed.` · `Go to the feed` — the app's verification landing
  (`VerifiedApp`); the way on names its destination.
- `This link doesn't work anymore` — the dead verify link's heading
  (`VerifyExpired`), in `JoinInvalid`'s idiom.
- `It may have expired or already been used. Send yourself a fresh one
  — if your account is still waiting on its email, the new link picks it
  back up.` — the two possibilities, the way forward, and the
  reassurance a reader who reads "expired" needs, kept to what is true:
  an account left unverified for seven days has been reaped (jakob
  2026-10-01, audit K3.3; blessed 2026-10-02).
- Signed out (audit K3.20), the dead link's way on reads `Sign in`, and
  `Resend the link` opens an `Email` field in place above the pair — the
  two existing words, so nothing new to bless; `Verified`'s `Back to
  CoGra` keeps its words and opens `SignIn`.

## The entry funnel's round

The audit's K3 blockers, ruled by jakob 2026-10-01 and drawn in one lane;
every line below was blessed by jakob 2026-10-02, unless it says it is new
in the fix round.

**The verify card prints the address and says the reap once**
(`ApplicantFeed`). Its blessed body stays; under it `Sent to
noor@fieldmail.org` with the door `Wrong address?`, then the
consequence, once and as a consequence rather than a clock: `An account
left unverified for seven days is removed — joining again then starts
over.` *Reworded in the fix round 2026-10-02 (the reap is seven days, jakob:
a day is short enough for a mail outage on our side to cost accounts),
blessed (jakob 2026-10-02).*

**Wrong address?** (`ApplicantEmail`) keeps `ChangeEmail`'s heading,
fields and commitment (`Change your email`, `New email`, `Current
password`, `Change email`) and says the carve-out in its own paragraph:
`Your email isn't verified yet, so the new address is all a change
needs. A fresh link goes there, and the one sent to noor@fieldmail.org
stops working.` Its snackbar: `Sent — the link is on its way to
noor@fieldnotes.org.`

**Sign in, too many tries** (`SignInLimited`): `Too many tries in a row.
Wait a moment, then try again.` No figure — the backoff grows and the
client is not told by how much — and no field accused.

**The security notice** (`FeedSecurityNotice`), a task card on the
landing: `We signed out every device` · `A sign-in this account had
already replaced was used again, which can mean someone else had a copy.
If your password might be known to anyone, change it.` · `Change
password` (blessed, the credential screen's commitment) · `Got it`
(blessed, the waiting card's). *We*, because the service did it; *a
sign-in*, never the token underneath it.

**An ask that can't be taken up** (`VouchAskUnusable`), in `JoinInvalid`'s
idiom, one pair per case:

- `@noor is already in` · `Someone has vouched them in already, so this
  ask has nothing left to do.` — then `See @noor's profile` (jakob
  2026-10-02, F4: the member came to vouch, so they will want to look;
  *new 2026-10-02, blessed (jakob 2026-10-02)*).
- `@noor is waiting on someone else` · `Another member is deciding on
  their application right now. If it ends without them getting in, this
  same link works again.` — the back arrow alone; nobody has a public
  profile before they land.

**The ask link's readers who cannot vouch through it** each hear a
snackbar — the applicant and the asker where app-open lands for them, the
member on `Invites`, where the row already is (jakob 2026-10-02):

- `You can vouch once you're in.` — an applicant, in the applicant-foot
  family's voice (jakob 2026-10-02, **blessed**).
- `That's your own ask link — send it to someone who's already in.` —
  the asker.
- `@noor is already waiting in your invites.` — a member who already has
  them queued.

### The fix round's entry lines — 2026-10-02

Applications never run out of time and an invite link ignores sign-in
(jakob 2026-10-02), so no line here speaks of a lapsed application or of
a second invite for an account that exists. Each line is *new in the fix
round*; every one blessed (jakob 2026-10-02).

- `This invite link has expired.` — the one snackbar a dead invite link's
  arrival hears, over the unchanged landing (`Main`, or `FeedBare` for a
  link that resolves to nothing). jakob's ruling, as recommended.
- `It may have expired or already been used. Ask the person who invited
  you for a new link.` — `JoinInvalid`'s paragraph. It promises nothing
  about an account made earlier, since an unverified one is reaped after
  seven days; `Already have an account? Sign in` stands right below it.
  *Blessed (jakob 2026-10-02).*
- `This ask link doesn't work` — the heading of an ask link that resolves
  to nobody (`VouchAskInvalid`), in `JoinInvalid`'s idiom. jakob's ruling,
  as recommended.
- `Check that the whole link came through, or ask the person who sent it
  for it again.` — its paragraph: what the reader can check, and who can
  help, with no guess at why the link resolves to nobody. *Blessed (jakob 2026-10-02).*

### The collected rulings' entry lines — 2026-10-05

- `Mira invited you` — `Join`'s heading (and `JoinErrors`'): the first
  screen says *invited*, never *vouched*, because no vouch exists until
  the inviter approves. *Blessed (jakob 2026-10-05).*
- The applicant's own profile once the application is closed
  (`ProfileApplicant`, the `application` chip at `closed`) takes the
  turned-down card's blessed words, the handle the approver's:
  `@mira closed your application` over its body, and the ask link
  labelled `Ask someone you know to vouch for you` with that card's
  caption. The chronicle's closing line reads `These wait — they arrive
  when someone vouches you in.` *Blessed (jakob 2026-10-05).*
- `Key made and backed up.` — the snackbar the ceremony's typed-back
  confirm answers with where the ceremony began (`RecoveryCode`), for
  the reason `KeyDecline`'s line exists: the task card leaves, and a
  silent close reads as nothing happened. *Blessed (jakob 2026-10-05).*
- The key boards' platform noun is the `wording` chip `KeyElsewhere`
  and `Restore` already carry (`KeyCeremony`, `KeyConfirm`,
  `KeyDecline`, `YourKey`, `YourKeyAbsent`). The app renderings: the
  pledge `Everything you publish is signed with a key that is created in
  this app and stays in your hands — CoGra never holds it and can never
  reissue it.`; `YourKey`'s `This key signs everything you publish, and
  it lives only in this app.` and `Nothing here is sent anywhere — the
  key is read from this app and shown.`; `YourKeyAbsent`'s `There is no
  key in this app to show.` under `KeyElsewhere`'s blessed `Your key
  isn't in this app`. *New 2026-10-05, flagged for blessing.*

## The settings page

Drawn on `Settings`, `SettingsBackup` and `YourKey`, blessed with the
settings round. Where the two apps had drifted, one line is chosen here
and both take it.

**Group headings** — short noun phrases, sentence case, naming what a
reader came for rather than what the system calls it: `Theme` ·
`Giving an opinion` · `Writing` · `Reading` · `Key backup` · `Sessions` ·
`Credentials`. The sign-out group carries no heading; it is the end of
the page, not a subject. `Writing` is the settled title — Android said
Writing, web said Signing, and the setting is about what a submit does,
not about the key.

**A row's second line is status, not description.** `Last created
12.08.2026` · `Last used 2d` · `This browser` · `Changed 21d`. Every
age on the page speaks the one ladder above — a settings row is not a
place the product changes vocabulary. A switch is the exception to
"status, not description", because its label alone cannot say what
turning it on does.

**Theme**: `Light` · `Dark` · `Auto`, and under them
`Auto follows your device's own setting, and the choice stays on this
device.` It is the one place a bare "device" is right: what Auto follows
is the device's own light-or-dark setting, which is neither the browser's
nor the app's.

**Giving an opinion** keeps the shipped readings and gives them the
hints the inverted gesture needs — `The pad` / `A tap opens it; drift to
where it feels right.`, `Sliders` / `One slider per side of the opinion.`,
`Typed values` / `Type both numbers exactly.` — over a footnote read
once for the group: `A tap opens this, everywhere. Press and hold
instead, and a small positive one is signed on the spot.`

**The multi-action switch**, merged from the two apps:
`Confirm multi-action submits` with
`Ask first when one submit signs more than one action.` Web's clause
about paying was the better fact and the worse place for it — a row is
scanned — so it moves to the group's footnote:
`Every signed action is paid for separately. A post's license is settled
when it is first signed and never changes.` Android's *Ask before
signing a submit that stages more than one action* loses on "stages",
which is the repo's word for it, not the reader's.

**The default license** row reads `Default license`, and its value is
the current default in the words the license block already uses —
`Public domain`. It opens the sheet the seal opens; that sheet's own
`Terms for anyone who reuses this.` is written for one post and is the
one line the settings route still owes a reading.

**Reading**: `What your feed shows` — the filter sheet's own accessible
name, so the row and the trigger cannot say different things — with the
default read back through the trigger's own words (`Posts`). Under it:
`Every feed starts from this. A change made inside a feed lasts until
you change it back, on that device only.`

**Key backup**: `Recovery code` and `Your key` are rows, not verbs — and,
only while kept picks wait unsigned with the key here, `3 kept picks
waiting` (*The key's lifecycle*, below; blessed (jakob 2026-10-02)). The
shipped *Create a new recovery code* and *Show my key* were controls
standing where a name belongs; the act keeps its words on the screen it
happens on. The group's footnote: `Your key signs everything you publish
and lives only in this browser. Your recovery code is the only way back.`

**Sessions** keeps `Revoke` and `Sign out everywhere else`, and says the
delay before it happens rather than only after:
`A device you sign out can stay signed in for up to 15 minutes.` The
current session's status is the platform noun — `This browser` on web,
`This phone` in the app — replacing Android's shipped *(this device)*.

**Credentials**: `Password`, `Handle`, `Email`, each showing where it
stands, with `Changing your password signs out every other device.`
under them — the fact `ResetNew` already says, moved in front of the act.

**About** — the support stack (jakob, 2026-10-01; every line here
blessed the same day). Three
rows join the group after `About CoGra`
and before `Privacy` and `Terms`, each one string for app and web:

- `What's new`, its value the version running here (`0.1.2`). It opens
  the release chronicle, titled by the row: each release's dateline
  reads `Version 0.1.2 · installed · 30.09.2026` for the running one and
  `Version 0.1.1 · 28.09.2026` for the rest, and the page's footnote
  reads `Newest first.` Each release's card ends in `See it on GitHub`,
  named `See version 0.1.2 on GitHub` for a listener — the patch notes'
  only door to the deeper level, that release's public page (jakob
  2026-10-02, blessed); the newest release's card in the behind state
  carries its own. A release's notes are written when it ships, never
  here. *`installed` and the footnote blessed (jakob 2026-10-02),
  2026-10-02.*
- **A running version behind the newest** (jakob 2026-10-01). Atop the
  chronicle, one quiet line: `A newer version exists.` ending in `Update
  now`, named `Update to version 0.1.3` for a listener; the newer release
  heads the list as `Version 0.1.3 · newest · 02.10.2026`, and the
  running one reads `installed` — never `current`, which a version
  behind the newest is not (`WhatsNewBehind`). And once per release, on
  a cold app open, one snackbar on the feed's arrival: `A newer version
  of CoGra is out.` with `Update now` as its action; a device-local seen
  flag per release means each release says it exactly once, and letting
  it pass costs nothing (`FeedNewerVersion`). **`Update now` leads to the
  download, never to the code** (jakob 2026-10-02) — the code is the
  release cards' door: in the app it opens
  CoGra's Play Store listing, on the web it reloads the page into the new
  version — one string, no platform noun. *`Update now`, `Update to
  version 0.1.3`, `installed` and `newest` blessed (jakob 2026-10-02),
  2026-10-02.*
- `Report a problem` opens the report: the heading `Report a problem`;
  `Say what happened, in your own words. Sending opens your email with
  everything below filled in — nothing goes until you send it there.`;
  the field `What happened`; then the four facts that travel with the
  words, as a read-back list — `To` · the address, `Version`, `Running
  on`, `Time` — and under them `That's all that goes with your words —
  no account, no key, nothing you've posted. It's sent from your own
  email, so we can write back.` The commitment is `Send by email`,
  because the press opens the reader's mail and sends nothing itself.
  With the field empty it stays visible and disabled, `Nothing to send
  yet` right above it — the edit foot's zero, `Nothing to sign yet`,
  with the report's verb (`ReportProblemEmpty`). Leaving with Back keeps
  the words.
- `Contact`, its value the address it writes to — a plain mail door,
  kept apart from the report so reports stay structured.

Both addresses (`reports@cogra.local`, `hello@cogra.local`) are
placeholders until CoGra is on a server, and swap then.

**Sign out** carries the login form's own line verbatim —
`Don't remember this account on this device` — with what it decides
underneath: `Your key and your draft are cleared from this browser when
you sign out.`

**A new recovery code** (`SettingsBackup`): the heading, then
`A new code re-encrypts your key and replaces the old backup — recovery
always uses the newest one. Your current code was made on 12.08.2026.`,
the field `Current recovery code`, the commitment `Create a new recovery
code`, and last: `The new code is shown once and never stored. Have
somewhere to write it down before you go on — the old code keeps working
until the new one is confirmed.` A refused current code wears Restore's
line, `That code doesn't check out.`, a code of the wrong length
`RestoreLength`'s, `A recovery code is 26 characters.` (jakob
2026-10-05), and under the field a browser that
lost its code is told where to go instead of retrying forever: `Lost it?
This browser can't make a new code without the current one. If the
Android app holds your key, make the new code there.`

**Your key** (`YourKey`) keeps web's body verbatim, and names the
formats exactly, which is §7's stated exception: `Your actor key` ·
`PEM (PKCS#8)` · `Raw hex — Ed25519 private key`. Each block's copy
control is named for what it copies — `Copy the PEM block`, `Copy the
raw hex` — because two controls reading "Copy" a thumb apart tell a
listener the verb and not the object. Under them:
`Nothing here is sent anywhere — the key is read from this browser and
shown.`

## The settings subpages

The six the round's review added. A sheet opened from settings is titled
by the row that opened it, so each heading below is a row's own words.

**The default license** (`SettingsLicense`) is titled `Default license`
and says what a default does, which the seal's sheet cannot: `Where
every new post starts. A post's terms settle when it is first signed, so
changing this never reaches one you have already published.` The seal's
`Terms for anyone who reuses this.` is written for the post in front of
it and stays there. The reading under the axes names the pair the way
the read surfaces do — `Public domain — nobody owes you a name, and uses
go unlogged.`, the two tier hints joined, so the word and what it means
arrive together.

**What your feed shows** (`SettingsReading`) is titled with the row and
the filter's accessible name, and carries the group footnote's first
sentence where a covering sheet hides the footnote: `Every feed starts
from this.` The second sentence stays under the row, where the reader
meets it first. The sections and hints are the feed's own, and so is the
foot: `Reset` in its corner and `Done`, the word both of the page's
sheets use, at its end. Here `Reset` brings back CoGra's own default —
the one place a reader gets back to it; on a feed's sheet the same word
brings back the reader's default (readme §13, *The filter-and-olive
round*).

**Every filter sheet's foot** — the feed's, search's and the settings
sheet's — is `Reset` and `Done`, nothing else: no read-back of the staged
filter, because a reading that holds two changes cannot hold six
(jakob 2026-10-02). `Reset` is plain (jakob, N3); what it restores is
the reader's default, the app's until they set their own in Settings.
*The foot's `Reset` at its new seat blessed (jakob 2026-10-02).*

**Change your password** (`ChangePassword`) opens with the row's
footnote said where the act is, plus the half it could not say there:
`Changing your password signs out every other device. This one stays
signed in.` `ResetNew`'s *every device* is not a drift — a reset
revokes the session doing it and a change does not, and the two lines
exist to keep that difference visible. Fields `Current password` and
`New password` with `At least 12 characters.`, the commitment `Change
password`, and last, the reason the first field is there at all:
`Your current password is asked for even though you are signed in: a
live session is not proof enough to change the credential behind it.`

**Change your handle** (`ChangeHandle`) says the calm part before the
costly one. `@sol is how people mention and find you. Everything you
have published stays yours — the handle is a name, not the account.`
The field is `New handle` with the rules where they are typed:
`3 to 30 characters: letters, numbers and underscore. Handles are always
lowercase.` — the fold is said because a reader who types capitals will
otherwise think the field ate them. The commitment is `Change handle`,
and the cost is last and unsoftened: `Links to your old handle stop
working the moment you change it, and anyone can claim it afterwards.`

**Change your email** (`ChangeEmail`) names why it is guarded: `Your
email signs you in, and it is the only way back if you lose your
password — so a change is proved from both ends.` Fields `New email` and
`Current password`, the commitment `Change email`, and what happens
next, with the address named rather than described: `A code goes to
sol@solferreira.art and a link to the new address. Your email is
unchanged until both have been answered.`

**Confirm the change** (`ChangeEmailConfirm`) replaces a shipped line
that is not true. Both apps say *Check both inboxes — either message's
code confirms the change*, which reads as one message being enough;
`auth.md` and `api-spec.md` say the change applies only once both sides
have landed, and that the two sides are not the same errand. The board
names the asymmetry first: `Two messages, two different errands — a
code to type here, and a link to open at the new address. Your email
moves when both have been answered, in either order.` Then it draws the
pair, captioned `Both have to land`, each side its address and its
state — `Code` / `sol@solferreira.art — still waiting` and `Link` /
`sol@ferreira.studio — still waiting`. `Still waiting` is the resting
state said the way `Still settling` says its own: what has not happened
yet, plainly, with no apology and no progress theatre. The field keeps
its shipped name, `Confirmation code`, with `From the message to
sol@solferreira.art.` under it so the reader knows which message to
open. The commitment is `Confirm the code`, which is what pressing it
does — *Confirm email change* is what a reader would have believed it
did, and a control says what will happen. Last: `Until both sides land
your account keeps the address it has, and a reset still goes there.`

**The change in flight, and its ends** (jakob 2026-10-01, audit K3.21;
*new 2026-10-01, blessed (jakob 2026-10-02)*, save the reused lines):

- A landed side's row reads `sol@solferreira.art — confirmed`, the
  counterpart of `— still waiting`.
- `Resend`, on the pair it re-sends; its snackbar `Sent again — check
  both inboxes.` And last on the page, `Cancel the change`, with
  `Change canceled — your email stays sol@solferreira.art.` over
  settings.
- A wrong code takes `Restore`'s field line, `That code doesn't check
  out.` (blessed).
- The change past its window, as the fault line above the commitment:
  `This change ran out before both sides landed. Your email stays as it
  is — start again from settings.`
- The new address taken meanwhile (`EMAIL_IN_USE`, which keeps
  answering until the window closes): `That address now belongs to
  another account. Your email stays as it is — if the address frees up
  before the change runs out, confirming again applies it.`
- The settings row while a side is owed: its value the address the
  account still has, its status `Change pending`
  (`SettingsEmailPending`).

**The new address's link, opened** (`ChangeEmailLinked`, `Verified`'s
idiom), first side: `New address confirmed` · `One side left: the code
we sent to sol@solferreira.art. Your email moves once it's typed in.` ·
`Enter the code`; last side: `Email changed` · `You sign in with
sol@ferreira.studio from now on, and resets go there too.` · `Back to
settings`. Past the window it takes `VerifyExpired`'s heading, `This
link doesn't work anymore` (blessed), with `The change it belonged to
ran out before both sides landed. Your email is still
sol@solferreira.art.` and `Back to settings`; with the address taken,
`That address is taken now` over the `EMAIL_IN_USE` line above. Signed
out (`ChangeEmailLinkedSignedOut`): `Sign in to finish the change` ·
`This link confirms sol@ferreira.studio as your new address. It counts
once you're signed in.` · `Sign in`.

## The key's lifecycle

The key-loss round's lines (2026-09-30): the ceremony's exits, the
backup made late or replaced, the key revealed, restored, or absent
with no backup to restore from.

**A browser that can't hold a key** (`KeyCeremonyUnsupported`) is told
so in the key-absent notice's voice, never a fault's: `This browser
can't hold a key` / `Open CoGra in a current Chrome, Firefox or Safari,
or in the Android app.` — and the app is a door, the login landing's own
link in its own words: `On Android? Download the app (APK)`.

**Declining the backup** says what it made, because the task card the
reader came from leaves the feed with it:
`Key made — no backup yet. You can make a code in settings.`

**The code screen** answers Android's Back with the way out rather than
swallowing it: `Type the code back to finish`. A copy that worked says
`Code copied` in the browser — the line the refused copy already
speaks in; Android's own clip confirmation answers there. A code made
or replaced from settings returns to settings with
`Your key is backed up with the new code.`

**The backup made late** (`SettingsBackupNone`): the Recovery code row
reads `Not made yet`, and the Key backup footnote stops promising a way
back — `Your key signs everything you publish and lives only in this
browser. Until you make a recovery code, it can't be brought back.` The
screen is `Make a recovery code`, with KeyDecline's consequence word for
word, the ceremony's `Create my recovery code`, and last: `The code is
shown once and never stored. Have somewhere to write it down before you
go on.`

**The key elsewhere, with no backup** (`KeyElsewhereNoBackup`): restore
cannot work, so the card does not offer it, and says how the key can
come instead — `This account has no backup, so the key can't be brought
here yet. Make a recovery code on the device that holds it, then restore
it here. Until then, anything you sign waits as pending.` Every
key-absent notice takes that sentence in place of its restore line for
this reader.

**The applicant's key elsewhere** (`ApplicantKeyElsewhere`): `Your
application's key was made on another device. Restore it here with your
recovery code, or make a new key — until you're approved, a new one
costs nothing.` — `Restore the key` · `Make a new key`.

**The landing card with the key elsewhere** (`ApplicantLanding`, the
`keyAt` chip) admits both doors: `Your key was made on another device —
open CoGra there, or restore the key to land here.` — `Restore the key`
under it (jakob 2026-10-02, **blessed**).

**A reply with the key elsewhere** keeps no draft, so its two notices
say what is left (the reply pack, 2026-09-30). At the door, before a
word is written (`ReplyKeyAbsent`): `A reply can't wait as pending —
restore the key before you write.` with `Not now` under it. At the
seal, when the key left mid-write (`ReplySealKeyAbsent`): `A reply
can't wait as pending — restore the key to sign this one.` with
`Discard the reply` under it. *Blessed, jakob 2026-10-01.*

**A pick kept pending** wears `Waiting for your key` under the post's
anchor, in `PendingMarker`'s quiet type — never `Still settling`, which
means signed and not yet ordered. Once the key is back and the review
waits unsigned, the same line reads `Waiting for your review`, spoken in
the anchor's name as `waiting for your review` (jakob 2026-10-02, kept
picks 1; *new 2026-10-02, blessed (jakob 2026-10-02)*).

**The kept picks' review** (`KeptPicksReview`, `KeptPicksSeal`; jakob's
rulings B1-B3, 2026-10-01). Every line here is *new 2026-10-01, blessed (jakob 2026-10-02)*:

- The review's title, `Kept picks`, and its one line: `These waited on
  this device for your key, and nothing is signed yet. Remove any you no
  longer mean — the rest sign together.` Each row's kind reads `Post` or
  `Person`, the staged citations' words; its × keeps `StagedReference`'s
  `Remove <name>`.
- The commit, `Sign them` (the ruling's own words).
- The last pick dropped: the snackbar `Nothing left to sign.` (a draft,
  per the ruling).
- The seal keeps the standard seal's words — `What you sign`, `Last step`,
  `3 things, signed together`, `They land together, or none does.` — and
  adds its own: each row's label `Opinion`, the X's name `Leave — your
  picks are kept`, and the commit `Sign the opinions`.
- Signed: the settled snackbar in its batch form, `Signed 3 things, still
  settling.` — the signed-opinion snackbar's own opening, without a
  `Current opinion`, since a batch holds more than one target.
- The settings row, last in `Key backup`: `3 kept picks waiting` (`1 kept
  pick waiting` in the singular). No status line.

The kept-picks rulings (jakob 2026-10-02) add these, each *new
2026-10-02, blessed (jakob 2026-10-02)*:

- A dropped row is spoken in the pickers' status idiom: `Removed — 2
  picks left.` (`Removed — 1 pick left.` in the singular).
- A row whose target was removed or redacted wears the target's removal
  mark in the name's place — `Removed by its author`, `Removed under the
  platform's rules`, `Deleted account` — and its × is named `Remove this
  pick: Post, Removed by its author`.
- A row whose pick would net its bundle to nothing says so under its
  kind in the family's landing words: `This takes you back to zero.` (a
  person or a post), `This leaves you with no opinion towards it.` (a
  topic).
- The write rule at this scale: the fact ends `Nothing was signed or
  spent — your picks are still kept.`, and the way out reads `Not now`.

The kept picks drawn (jakob 2026-10-02, the fix-fix round; *blessed
2026-10-02*) reuse those words and add none: the seal's acts card reads a
removed target by its removal mark where the name stood, `Removed by its
author`, and the anchor's `Waiting for your review` stands on the everyday
feed once the key is back (`PadPendingReview`).

**A restore that worked** says where the key is now, in the platform
noun: `Your key is on this browser now.` · `Your key is in this app now.`

**Your key, with the key elsewhere** (`YourKeyAbsent`) keeps `YourKey`'s
paragraph with one clause changed, so it does not contradict the notice
above it: `This key signs everything you publish, and it lives only on
the device it was made on.`

**The key behind its gate** (`YourKeyGate`, a browser whose seed is
sealed): `On this browser your key is sealed inside its backup. Enter
your recovery code to open it and see the key.` — the field `Current
recovery code`, the commitment `Show my key`, a refused code in
Restore's line and a code of the wrong length in `RestoreLength`'s, `A
recovery code is 26 characters.` (jakob 2026-10-05). Either copy on `YourKey` answers with the snackbar
`Copied`.

**Signing out without a backup** (`SignOutConfirm`, the don't-remember
switch on and no recovery code): `Sign out without a backup?` / `This
browser holds the only copy of your key. Signing out leaves your key,
your draft and any opinions you kept pending here, locked until you sign
in on this browser again. Erase them instead, and no one — including
CoGra — can bring them back.` — `Make a recovery code` ·
`Sign out, keep it locked` · `Erase it and sign out`. The body names
all three things the opt-in would clear — the key, the draft, the picks
kept pending (jakob's ruling). The app renders the platform noun as
`This app` and `in this app`.

**No screen lock** (Android, in front of every reveal or replace):
`This phone has no screen lock` / `Anyone who picks it up could see your
key or replace your recovery code. You can go on, or set a screen lock
first.` — `Go on anyway` · `Cancel`.

## The profile save

Blessed with the small-rulings batch. A profile edit is a signed act
that settles like any other, and the shell's snackbar is the only
feedback the surface draws:

- `Signed — your profile shows it now, still settling.` — what a saved
  profile answers with. It says both halves: the change is visible
  already, and the act is still finding its place in the order.
- The profile and picture seals keep no draft, so the write rule's
  notice there takes the pad's reading (jakob 2026-10-05): `Nothing was
  signed or spent.`, with `Not now` back to the seal — never `your draft
  is kept` or `Keep the draft, sign later`.

## The vouch-back ceremony

Blessed with the close-out round. `VouchedIn` is the one board that
marks a moment rather than reporting one, and its three strings are the
whole screen:

- `You're part of the sky now.` — the headline. *Sky* is the word the
  product already uses for this picture, and the board draws that
  picture behind the words; a headline that named the graph would be
  naming the mechanism at the one moment the reader is feeling
  something. It is the one place a metaphor leads, and it can afford
  to: the line under it carries the content.
- `Your opinion on @mira is signed, and the way is open both ways. The
  feed you see from here is your own.` — the subline, and the honest
  half. It claims three things that are all certainly true the instant
  the reader sees it, and nothing about weight, reach or standing that
  a later Sky would have to honour.
- `Go to your feed` — the single control. The opinion is signed and on
  the record, so there is no way back to offer and no second choice to
  make.

**The landed member's band** names the view and asks for nothing — no
`Vouch back` word rides it, because the first opinion on anyone ends the
borrowing (jakob 2026-10-02): `Browsing from @mira's view — your first
opinion starts your own.` — *new 2026-10-02, blessed (jakob 2026-10-02)*. The
vouch card's way out reads `Got it` (jakob 2026-10-02, **blessed**): it
puts the card away for good and says nothing — no snackbar, no reminder —
so its word promises no later. The way back to vouching stays on @mira's
profile, forever.

**The vouch card and its pad claim no order** — a member may opine on
others first while the card stands, so one wording is true in every
state (jakob 2026-10-02, **blessed**). The card's body, on `VouchBack`
and `VouchBackPad`: `Vouch back to open the way from your side — your
opinion toward @mira, and your feed grows from it.` (`VouchBack` adds
`Vouching opens the opinion control, set to a gentle default.`). The
pad's title and its "?" read `Your vouch back`, and its first coaching
line opens on the title: `Your vouch back. The pad is how you shape what
reaches you — for or against, and how much.` The band's line keeps
*first opinion*: the borrowed view does end on the first opinion,
whoever it's toward.

## Unsaving, and the actor with no name left

Blessed with the close-out round.

**Unsaving's snackbar.** `Removed from Saved.` with `Undo`, the second
snackbar in the product to carry an action. It names the LIST and not
the row: the thing that went is the one the reader just pressed, and
the fact they may want reversed is that it is no longer kept. The pair
is deliberately lopsided against saving's bare `Saved.` — saving costs
a reader nothing to repeat, and a mis-pressed unsave costs them finding
the thing again. The same line rides the empty list when the row that
went was the last one.

**The hide row with no name to say.** `Hide this account`, where the
actor is a deleted account and there is no handle to spell. It stands
beside `Hide @ada`, never instead of it, and the row never drops: the
act is about an ACTOR, the actor is still there, and its content still
ranks into the reader's feed. The system's voice for the same reason
`Deleted account` is — it is the product saying what the tap does when
it cannot say whose.

## A card's media description

**A card's media description names the kind of thing it has.** The
description is what a screen reader is given for a post card's body, so
a clip announced as a picture is the card telling a reader something
untrue — and it is the only place the difference is sayable, the two
looking alike until one plays:

- `1 clip · 0:24` — a video post. The duration belongs in the words:
  it is the one fact about a clip a reader decides on before playing
  it, and the eye reads it off the cover.
- `1 picture` · `4 pictures` — a picture post, the count alone.

## Tagging

Drawn on `TagPage`, `TagPageEmpty`, `TagPicker`, `TagPickerTyping` and
`TagPair`. The naming law above is part of the same ruling and is
written where it belongs.

**The page carries no preamble.** The list opens directly under the
title (jakob's review removed the explanatory line): the rows say what
they are, and a sentence restating the contract was noise where the
title and the claims already carry it.

**A row says which act put it there.** The claim's glyph, `Tagged`, and
then the pair, on a flag attached to every card's top edge — the word
names the act, the glyph and the numbers say what it claimed, and the
tag itself is not repeated because the page is titled by it.

**An unused tag is not a miss.** `Nothing carries this tag right now.
The name is still a place — anyone can use it.` No "not found",
because the tag was found; what is empty is the list. No "first"
either: the line states the present and promises no past (jakob
2026-09-15, `TagPageEmpty`). *Still a place*
is the fact the contract guarantees, said without saying Type, node or
vacuous anchoring.

**The picker refuses to imply a creation step.** `Any name works, used
or not — nobody owns a tag. It is yours the moment you sign.` This is
the round's most load-bearing line: it has to make a missing "Create
#foo" button feel like an absence of ceremony rather than a missing
feature. *Nobody owns a tag* is the commons said plainly; *the moment
you sign* puts the act where it really is.

**The field asks for a name, not a search.** Placeholder `Name a tag`.
A picker that said *Search tags* would promise that a name it cannot
show you is a name you cannot have.

**Canonicalization is previewed, never silent.** While `#SaltMaps` is
typed, the list's first row is always the typed name canonicalized —
`saltmaps`, with `Signs as #saltmaps` as its second line — and the
keyboard's action key stages it. Under the field sits the shape a name
may take: `Letters, digits, dot, dash and underscore. Capitals become
lowercase.` A reader is choosing a permanent public endpoint; one that
quietly becomes a different string is the surprise §9 exists to stop.
The preview is the row that picks, so the promise and the gesture are
one thing, and it is a row, never a `Create` button.

**The pair editor names its axes in the reader's words.** `How much it
is about this` with `Barely` / `Entirely`, and `How sure you are` with
`Guessing` / `Certain`. These are api-spec's own glosses — relevance is
how much the tag is the content's, confidence is how firmly the claim
is held — said without `p_d`, `p_i`, relevance or confidence, which §3
keeps off the screen. The second track starts at its top because that
is the contract's default, and the poles say why that is not
overconfidence: an author is *certain* of a declaration they are making
about their own post.

**And it says when it costs.** `Signed with the post, as its own
action.` The sheet stages; the seal signs. A slider that moved a number
with no word about it would read as free.

**The "?" · Tagging** (the picker's one dialog): `A tag is a name
anyone can use — nobody owns one, and using a name nobody has used
before takes no extra step. Tagging is its own signed action, and it
carries how much the post is about that tag. / Names are lowercased,
and a name can hold letters, digits, dot, dash and underscore. Tap a
tag you have added to set how it relates.`

## The exact-values setting

Drawn on `Settings` (and the two sheet boards that draw the page
beneath them). The mode itself draws nothing new — it decides whether
the numbers already on every board are painted — so its whole copy
surface is one row.

**The setting says what it shows, not how it works.** `Show exact
values` — the switch in Settings' Reading group. *Exact* is the word
that distinguishes the digits from the glyph beside them, which is the
only distinction the reader is being offered; *geek mode* is the name
the round was ruled under and never reaches the screen.

**Its status names what is behind the drawing.** `The number pairs
behind the faces.` Pairs, because that is the whole of what the setting
governs — a score and a rank keep their digits either way.

**The Reading group's footnote carries both rows' facts.** `Every feed
starts from what it shows, and a change made inside a feed lasts until
you change it back. Both choices stay on this device.` *Stays on this
device* is the theme group's own spelling for a client-local choice,
said once under the group rather than inside either row.

## The opinion pad and its surroundings

The lines the review round wrote (jakob's rulings, 2026-09-11 evening).
The naming law above is part of the same ruling and is written where it
belongs.

**The gesture, said in the settings group.** `Giving an opinion` is the
group, `A tap opens it; drift to where it feels right.` the pad's hint, and
`A tap opens this, everywhere. Press and hold instead, and a small
positive one is signed on the spot.` the footnote — the one place the
shortcut and the price are said together.

**The coach mark teaches the shortcut, not the control.**
`Press and hold to sign it outright` over `Nothing was signed just now.
A tap opens this pad. Press and hold the same button and a gentle 🙂
*(+0.10 / +0.10)* is signed without opening anything.` The blessed
first line stays: a reader who has just tapped and seen a pad still
needs to be told nothing was spent.

**The pad's four help lines.** `Drag the knob. Left
to right is against to for; bottom to top is how much more of it you
want reaching you.` / `Letting go changes nothing. Set signs it, Cancel
leaves without signing.` / `Your pick adds to what you've said before —
that's why the two faces can differ.` / `Walk it back takes everything
you've said to nothing. It has its own confirmation, and each thing
you've said is walked back by its own signature.` The alternates' set
differs in its first two lines only: `Two values, not one. …` /
`Nothing is signed until you press Sign it.` / the same fold line /
`Walk it back takes everything to nothing, and each thing you've said
is walked back by its own signature.`

**The fold is explained in faces.** *That's why the two faces can
differ* replaces a sentence about two different numbers: the
explanation has to hold for a reader who has never turned the digits
on, and the faces are what they see.

**The signed-opinion snackbar.** `Signed, still settling. Current
opinion 🙂 *(+0.55 / +0.20)*` — built from spans so its numbers ride
the reading mode, with the spoken twin naming the anchor's word and
both axes. A walk-back signature keeps its sentence:
`Signed 3 things, still settling. You've walked @ada back to nothing.`

**The walk-back.** Button `Walk it back`, dialog `Walk it all back?`,
cost `It signs 3 things, each paid separately.` (`It signs 1 thing,
paid on its own.` in the singular), and the cap aside trimmed to
`Your feed reads it capped at +1.00 / +0.85.` **These are the PERSON
family's words** — see *the topic disconnects* below.

**What one signature commits is counted in things.** The footer reads
`You're signing 2 things`, the total `2 things, signed together`
(`1 thing, signed` in the singular), the rows carry bare counts, and
the subline is `They land together, or none does.` everywhere.

**The wallet says reach, not paths.** `In escrow` · `Held` ·
`…paid when an advertiser's reach flows through you.` ·
`Posting, connecting, and giving opinions is how reach starts flowing
through you.` · `Every payout is traceable to the reach it paid for.` ·
`Earned · last 8 payouts` (`Earned · last payouts` as the chart's own
default) · `When it settles`.

**The straight fixes.** `What your feed shows` as the filter's first
section · `Your feed is showing nothing — everything is switched off.`
· `Your sky — every account a star, sized by your own paths to it.` ·
`These wait with your application and arrive with you.` ·
`What you post now arrives with you.`

**Carried over unchanged, and still unblessed** — drawn by the tag
round, named here so the review pass has them in one place: `Un-tag`,
the edit body's `Withdrawn: #coastroad`, and the acts card's
`Tags withdrawn` row label.

## The pads and the edit's withdrawals

Drawn on `TagPad`, `TagPadCompose`, `RefPair`, `RefPairEdit`,
`EditCompose`, `EditActs`, `CommentEdit`, `CommentEditActs`,
`EditComposeVideo`, `CommentEditVideo`, `ReplySealUploading` and
`ReplySealUploadFailed` (readme §13, *The pads and the edit's
withdrawals*, *The comment edit's withdrawals* and *The 134 and 135
residue*). Every line here is the lane's wording, **blessed (jakob 2026-10-02)**, unless marked otherwise — with the three carried-over strings above (`Un-tag`,
`Withdrawn:`, `Tags withdrawn`), which this round puts to work again.

**The non-drag route names its target.** `Set exact values for
#saltmaps` — the hidden-until-focused control on a tag or citation
sheet, the target's own name after `for`, the way `Choose your opinion
on …` names its target. The tracks it swaps in say the family's own
questions, already written: `How much it is about this` / `How sure
you are` for a tag, `How much it leans on this` / `For or against` for
a citation.

**A standing citation's readouts.** `Current` and `Resulting`, with the
pad's own `Your pick` between them — the stance pad's three, without
the word *opinion*, because a citation is not one. Spoken, they carry
the two axes and their values and never the anchor's word.

**The foot's line names what opened the sheet.** `TagPad` and
`RefPairEdit` are masters at both scales, so the noun is the opener's:
`Signed with the post, as its own action.` from the post edit, `Signed
with the comment, as its own action.` from the comment edit (*new,
blessed (jakob 2026-10-05)*).

**Removing a citation says its cost where the control is.** `Remove
citation` — the walk-away's slot, a text button. Over the foot, after
the signed line:

- `Removing it signs 1 thing, paid on its own.`
- `Removing it signs 3 things, each paid separately.` — the walk-back's
  own cost phrases, at the count `withdrawalCost` serves.

**A withdrawal reads back with its way back.** `Withdrawn: #coastroad`
and `Withdrawn: Tide tables and the third headland — @juno`, one line
per item, each ending in `Undo`, spoken `Undo withdrawing #coastroad`.

**The edit's acts, every kind.** The row labels: `Edit`, `Tags added`,
`Tags withdrawn`, `Tags revised`, `Citations added`, `Citations
revised`, `Citations withdrawn`, `Cover changed`. A row's count is the
records it signs, heard as `2 things` where a withdrawal takes two.

**The reply's gate, failed.** `One picture didn't upload. Signing waits
for it.` with `Retry` — the fact in error ink, the consequence in the
quiet voice. The running line stays `Uploading 1 of 2 — signing waits
for the pictures.`, and names the body's own content: on a clip it
reads `…signing waits for the video.` (jakob 2026-10-02, pads 3: "per
content of course"; *new, blessed (jakob 2026-10-02)*).

**The edit's gate is the seal's** (jakob 2026-10-05). An edit that took
new pictures waits on them in the seal's words: `Uploading 1 of 2 —
signing waits for the pictures.` over the foot, the fault reading `One
picture didn't upload. Signing waits for it.` with `Retry`, and the slow
line `Still signing — the network is slow right now.` A cover the edit
set is named by its own noun, `Uploading 0 of 1 — signing waits for the
cover.` (`EditComposeVideo`, `CommentEditVideo`; *new 2026-10-05,
blessed (jakob 2026-10-05)*). The pictures' noun counts: a gate waiting
on one picture reads `Uploading 0 of 1 — signing waits for the
picture.` (`CommentEdit`; *new 2026-10-05, flagged for blessing*), and
`the pictures` from two up; `the video` and `the cover` are one thing
already and never change.

**A standing citation whose target was removed** wears the kept picks'
face (jakob 2026-10-05): `Removed by its author` where the name stood,
on `EditCompose` and `CommentEdit`. Its controls name it by the mark,
never by the removed name: the × `Remove this citation: Post, Removed by
its author` and the row `Post, Removed by its author — set how it
relates` (spoken only; *new 2026-10-05, blessed (jakob 2026-10-05)*).

## Saved, History and hiding

Drawn on `ProfileOwnMenu`, `Saved`, `SavedEmpty`, `History`,
`HistoryEmpty`, `SettingsHidden`, the three content menus and the
settings page.

**The reader's word is save** (jakob's ruling). The surface it fills is
`Saved`, and the row in your own profile's ⋮ is that same word, so the
act and the place cannot drift apart. The pair of verbs is blessed and
lives under *Menu rows*.

**Hiding names its person.** `Hide @ada`, on the post menu and on the
profile menu, because the handle is what a reader recognises and what
they will look for again in settings. The pair on the other side is
`Hidden accounts` and `Unhide`.

**Hiding is confirm-free, and the snackbar is the whole ceremony.**
`@ada is hidden — their posts stay out of your feed.` with `Undo`
beside it. It says what changed and how far it reaches, which is what
stops a reader wondering whether they have done something to someone.
A deleted account has no handle to spell, so hiding one answers `This
account is hidden — its posts stay out of your feed.`, with the same
`Undo` (`ProfileDeletedMenu`; *blessed (jakob 2026-10-05)*).

**Saving is confirmed like every other completed act.** `Saved.` The
sheet closes on the tap, so without the snackbar nothing would answer
it — §3's rule, applied.

**The second list is `History`.** Posts you have read, newest reading
first. *View history* is the contract's word and stays there.

**Two empty states, and each says why the list is empty.**
`Nothing saved yet. A post, a comment or a person can be saved from its
own menu, and it waits here.` names the gesture, because no card shows
a saving affordance at rest and a reader who has never opened a ⋮ has
no other way to find it. `Nothing here yet. Posts you read show up here
on their own, newest first.` says the opposite thing — that this one
fills without being asked.

**The settings group is `People`,** its row `Hidden accounts` with a
bare count, and its footnote `Hiding someone clears your own feed of
them. Nothing changes for them, and their profile still opens if you go
looking.` The footnote carries the whole of what hiding means, which is
the group anatomy's own rule. With nobody hidden the row reads `None`.

**The sheet is titled by the row that opened it** — `Hidden accounts` —
and each row carries `Unhide` and the moment of the hiding in the ages
vocabulary (`Hidden 3d`, `Hidden 12.08.2026`) — the removal mark's own
precedent: the word, then the ladder or the date.

## Caps and their refusals

Drawn on `ComposeDetailsCaps`, `ComposeWordsCaps` and `TagPickerRefused`.
Two families: the count a capped field shows near its cap, and the
refusal it shows past it.

**The count is two words, and the second one is the reader's side.**
`6 left` while there is room, `7 over` past it — never `94/100`, which
is the field reporting on itself in the statistics register §3 refuses,
and never a bare number, which would leave the reader to guess whether
it counts what is written or what is left. *Left* is the word because
the count only ever appears when what is left is the thing worth
knowing.

**Characters is the reader's word for the unit,** as it already is in
`A password is at least 12 characters.` and `3–30 characters: a–z, 0–9,
_`. The caps are counted in Unicode scalar values; nothing on screen
says so, and nothing should.

**Every over-cap refusal is one construction,** the blessed password
line's own, turned to the other bound — a field's length rule said once,
whichever end of it the writer met:

- `A title is at most 100 characters.` — the composer's title.
- `A description is at most 500 characters.` — a post's description.
  **Drawn** on `ComposeDetailsCaps`.
- `A post's words are at most 5,000 characters.` — the words body.
  **Drawn** on `ComposeWordsCaps`. The plural is the field's: the body
  is words, not a word count.
- `A comment is at most 2,000 characters.` — the comment body, in the
  composer and the edit alike.
- `A picture's description is at most 1,000 characters.` — the describe
  sheet, and `A video's description…` on its other shape. The
  possessive is what keeps it apart from the post's description.
- `A reason is at most 140 characters.` — the sensitive sheet's `Why?`.
- `A display name is at most 50 characters.` · `A bio is at most 500
  characters.` · `A website address is at most 2,048 characters.` —
  the profile edit.

Thousands are grouped the way every other figure in the product groups
them (`MoneyFigure`: `12,500.00`), so the body's cap reads `5,000`.

**The tag name's refusal restates the rule it broke**, in the rule's own
words — the line under the picker's field says `Letters, digits, dot,
dash and underscore. Capitals become lowercase.` at rest, and in the
refused state:

- `A tag name is letters, digits, dot, dash and underscore.` — **drawn**
  on `TagPickerRefused`.
- `A tag name is at most 128 characters.` — the gate's other half, in
  the same construction as every cap above. Copy-only.

*Name*, not *tag*, because the string is what is wrong and the tag is
fine — there is no tag yet.

## Notifications

Drawn on `Notifications`, `NotificationsEmpty` and `FeedUnread`.

**A row is a sentence, and the handle is its subject.** `@ada commented
on your post`, not *Ada Okonkwo · commented* — the disc already carries
the face, so the words are free to be the whole fact, and a handle is
what a reader recognises and can go looking for. Nine kinds, nine
sentences, all present tense of the act that happened:

- `@ada commented on your post` — a comment on a post of yours.
- `@tobias replied to your comment` — a reply one level down. *Replied*,
  not *commented*, because the two land in different places and a reader
  who is told which will know where they are going.
- `@sol gave an opinion on you` — the profile opinion, in the
  chronicle's own verb (`Gave an opinion`). The reader's word is
  **opinion**; *followed* would name a gesture this product does not
  have, and *vouched* belongs to the vouch-in, not to this.
- `@mira mentioned you` — a citation whose target is you.
- `@ada cited your post` — a citation whose target is something you
  wrote. *Cited*, the product's verb for a Reference, and the second
  line says where: `in Sunday at the tide market`.
- `@rafa is ready for your approval` — an applicant staged through your
  invite who has finished both proofs. The person is the subject, not the
  application: *An application is ready* names the schema, and what the
  inviter is being asked about is a someone.
- `@juno landed through your invite` — *landed* is already the word the
  approval flow speaks (`Your registration is landing`), so the invite's
  other end keeps it.
- `@mira approved your application` — the approver's act, named as
  theirs. Not *You were approved*, which is the passive the register
  refuses and hides the person who did it.
- `@kel closed your application` — *closed* is the word the control
  itself carries, so the row and the button tell one story. Not
  *rejected*, which names a verdict the network never passed: one member
  declining is one member declining.

**The second line is what arrived, or where it is.** The comment's and
the reply's own words for the two that carry words; `in <title>` for the
mention and the citation, the saved comment row's `on <title>`
construction turned to the citing side. The other five have neither and
carry none — a line invented to even the rhythm would be chrome.

**The unread mark is a dot and says `New`.** On the row's trailing edge
under the age, and in the accessibility tree as the one word, because
the mark's whole content is that this has not been opened. Nothing says
*unread* on screen.

**The bell names itself, and names its dot.** `Notifications` at rest,
`Notifications — something new` when the dot is lit — the accessible
name changes with the drawing, because a marker a listener cannot hear
is not a marker. Never a number in either: the count belongs to no
sentence a reader needs.

**The empty state names the kinds.** `Nothing here yet. Comments,
replies, citations, mentions and opinions on you arrive here as they
happen, along with what becomes of your invites and your own
application.` The list has no gesture of its own — it fills from what
other people do — so naming what arrives is the only way to say the
channel is empty rather than broken. The kinds that reach a node are
named one by one and the four that reach the account are one clause: a
reader counting nine names has stopped reading a sentence. No action
button: nothing the reader can do from here fills it.

**The surface is `Notifications`,** in the page header and wherever it
is named. Not *Activity*, which describes a log, and not *Alerts*, which
describes an emergency.

## Deleting the account

Drawn on `Settings`, `DeleteAccount`, `DeleteAccountMail`,
`DeleteAccountConfirmed`, `FeedDeleting`, `SettingsDeleting`,
`DeleteAccountPending`, `DeleteAccountCanceled` and `ProfileDeleted`. This
flow's words carry the product's erasure ethic, so the register is held
tighter here than anywhere: honest, quiet, no drama, and nothing that
argues with a decision the reader has made.

**The settings row is two words and a footnote.** `Delete account` on a
navigating row, and under the group: `Nothing is deleted here. The next
screen says what goes and what stays, and the deletion is confirmed by a
link we email you.` The row is quiet by ruling; the footnote is what lets
it be, because the fact a reader needs before tapping is that the tap
deletes nothing. An applicant's deletion is confirmed in the app and
nothing is mailed, so their footnote stops at `Nothing is deleted here.
The next screen says what goes and what stays.` (`Settings`' reader chip;
**blessed**, jakob 2026-10-05).

**The request screen says what goes before what stays, and says both.**
Heading `Delete account`; then `This takes your name off CoGra. What you
signed stays on the graph, because it is other people's record as much
as yours — what goes is everything that says it was you.`

- `What goes` — `Your profile — display name, bio and picture.` ·
  `The link between you and this account. Nothing left here points back
  to you.` · `Your sessions, and what this account kept for you alone:
  saved items, hidden accounts, what you have read.`
- `What stays` — `Everything you signed, and everything others signed
  about you. Your posts still route and still credit their author; what
  is removed leaves a mark saying so.` *(The wallet bullet — "Your
  wallet and its address. They are held by your key, never by CoGra, so
  nothing here can touch them." — left V1.0 with the wallet, jakob
  2026-09-25: the page names what exists. It returns when the wallet
  does.)*

**The content sweep is the reader's own sentence, in the first person.**
`Also remove what I posted`, with `The words and pictures go out of your
posts and comments, each leaving its mark. Leave this off and
they stay as you wrote them.` under it. *Also* is what makes it an
addition to a decision already made rather than a second question.

**The commitment is `Send the confirmation link`** — what the press does,
and `Reset`'s `Send reset link` said for the same mechanism. Not `Delete
my account`, which would be a lie about a button that sends an email.
Under it: `Nothing is deleted until you open that link. After that it
runs in seven days, and you can cancel from any device until it does.`

**An applicant's case is immediate** (`DeleteAccount`'s reader chip,
jakob 2026-10-02). Nothing has landed, so nothing waits: the body reads
`Nothing has landed yet — deleting removes your application and your
account right away.` (**blessed**, jakob 2026-10-02), and the commitment
`Delete my account` (**blessed**, jakob 2026-10-05) deletes at
once — here the press does what the words say. What goes, what stays,
the content sweep and the link's note speak of landed records and the
mailed link, so the case draws none of them. The reader lands signed out
on the bare view, and one snackbar answers there: `Your account is
deleted.` (**blessed**, jakob 2026-10-05).

**No "are you sure".** Nothing in this flow asks twice, scolds, or lists
what the reader will miss. The friction is the emailed link, which is
also the check against a session that is not theirs; a typed handle or a
re-entered password on top would be ceremony, and ceremony here reads as
the product trying to talk them out of it.

**The mail state is the errand and the address.** `Check your mail` ·
`We sent a link to sol@solferreira.art. Opening it confirms the deletion
and starts the seven days.` · `Until you open it nothing is scheduled and
nothing has changed. Closing this screen changes nothing either — the
link is the whole of it.` · `Resend the link`. No expiry is claimed: the
reset link states its fifteen minutes because `auth.md` gives it fifteen
minutes, and `erasure.md` sets no window on this one.

**The band is one sentence and one word.** `Your account is deleted in 6
days.` with `Cancel`, and `Your account and everything you posted are
deleted in 6 days.` where the sweep was opted into. The band names what
is going, because a reader who chose the sweep is waiting on something
larger than one who did not.

**The link's landing states the deadline** (`DeleteAccountConfirmed`;
jakob 2026-10-01, audit K3.22; *new 2026-10-01, blessed (jakob 2026-10-02)*,
save the reused lines). The heading is the band's sentence on its first
day, `Your account is deleted in 7 days` — or `Your account and
everything you posted are deleted in 7 days` when the sweep is in — then
`That's 08.10.2026. Until then nothing changes, and you can cancel from
any device.` When the request left the sweep off, the page offers it
again in `DeleteAccount`'s own words (`Also remove what I posted` and
its line, blessed), committed with `Add it to the deletion`, whose
snackbar is `Added — what you posted goes too.` Signed out, one quiet
line says the link was enough — `You're not signed in here, and you
don't need to be — the link was the proof.` — and the way on reads `Sign
in` instead of `Go to the feed`.

**During the grace the settings row reads the deadline** —
`Deletion in 6 days`, the forward ladder — and the group's footnote
goes, since it describes a request not yet made (`SettingsDeleting`).
The row opens `DeleteAccountPending`: `Delete account` · `Your account
is deleted in 6 days, on 08.10.2026. Until then nothing has changed, and
canceling keeps everything as it is.` · `Cancel`, the band's word, which
ends in the canceled snackbar below.

**The cancel says what happened, and offers no way back.** `Canceled —
your account stays, and nothing was deleted.` Every other snackbar in the
product carries an Undo; this one cannot, because its undo would re-arm
an irreversible countdown from a control that disappears in four seconds.

**The third removal mark.** Beside `Removed by its author` and `Removed
under the platform's rules`: `Deleted by the person whose account it was`
— `Their name and profile are gone. What they signed stays on the graph
and still credits them.` Three marks now, still never interchangeable.
A deleted account must not read as a moderation verdict, and it must not
read as `This profile doesn't exist.` — someone was here, and the product
never pretends otherwise.

## The deleted actor's face

Drawn on `ProfileDeleted` and on every card and row a deleted actor
authored, plus the snackbar `FeedHidden` fires. The rest of the round's
words were ruled on canvas and have moved into the sections above:
`Unsave` sits under *Menu rows*, the settings ages under *The settings
page*, and the empty hidden row's `None` where the settings group is
written out.

**The name in a redacted actor's place.** `Deleted account` — two
words, in the system's own voice and in `text-secondary`, because it is
the product saying what happened and not a name anybody chose. It is the
same string wherever the actor appears: their own page's header, an
author chip on a post they wrote, a row in a list. The handle beside it
is dropped rather than replaced; a redacted handle is a uniqueness
device in the store, and printing anything in its place would invent a
handle a reader could try to reach.

**The moderation variant, which must never be the same string.**
`Removed by the network` where an actor's identity was taken by a
passed proposal rather than given up. The two readings have to stay
distinguishable for the reason the two removal marks do — collapsing
them lets a verdict hide behind a person's own decision, or the reverse
(`erasure.md` §7). Specced here, drawn nowhere yet: no board shows a
community-redacted actor.

**Hiding's snackbar, now that it has a board.** `@ada is hidden — their
posts stay out of your feed.` with `Undo`. The second clause is the one
that matters: what a reader wonders after hiding someone is whether
they have done something *to* that person, and the answer is that they
have changed their own feed and nothing else. `Undo` beside it: hiding
is a comfort a reader may have meant for one post rather than for a
person, and the way back costs nothing.

## The score drill-down and the opinions sheets

Every new line on the Feed score's four drill-down boards and on the two
opinions sheets. The register the round was ruled into is paths, people
and connections — never statistics — so the words are sparse by design:
each board says what the reader is looking at, and the honesty lands in
one sentence rather than a paragraph.

**The four titles.** `Why this reached you` · `One path` · `One step` ·
`What landed`. The first is the question the whole feature answers, put
from the reader's side and in their own terms; the three below it name
what the screen holds and nothing more, because the cover carried down
from level one already says what it is all about. Sentence case, no
colon, no subtitle.

**The score on the held thing** carries no word (jakob 2026-10-01): the
`graph` glyph and the signed figure, `+15.20`, hung on the thing's top-left;
`Feed score` is its spoken name. The sign appears only there — every card
keeps its plain figure, a negative keeping its `−` everywhere, a zero none.

**A path's spoken shape** ends kind-neutral: `You, then @ada, then what
reached you` — blessed (jakob 2026-10-01). The title's own words, since the
trace's last mark already says what kind of thing it reached. One person
on the path is named; a path through two or more takes the generic form,
`You, then several steps, then what reached you` — blessed (jakob
2026-10-01: "for longer paths we need generic wording"). A chain of handles read aloud would bury the reached
thing at its end, and the row's `Through @kel and @wren` already says who.
The back arrow on level one names the surface the score was tapped on
(readme §13, *The nav-noun sweep*) and draws `Back to feed`, for every kind.

**The rule under the cover**, on level one: `Every path here starts with
an opinion you gave.` This is the inbound-inert invariant
(`feed-ranking.md` §1) in the reader's vocabulary — nothing anyone points
at you moves anything toward you — and it is the one sentence that makes
the list below it mean what it means.

**A path's own words.** `Through @ada` · `Through @kel and @wren`, under
the trace that draws it. The trace says the shape; the words say who. The
handles rather than the names, because the row has one line for them and
a chain of display names would ellipsise before the last person in it.

**The quiet expand row**: `2 more paths`, with what they add beside it,
and `Show 2 more paths` as its accessible name. Never `See all`, never a
page number — the row unfolds the rest in place.

**A path's two facts**: `What it adds` and `Newest opinion on it`. Both
are questions a reader would actually ask out loud, which is what a
`FactRow` label is for.

**A step's three**: `What carries it` · `Behind it` · `Newest of them`,
and the way down is the word `Show them`. *Carries* is the round's one
piece of borrowed vocabulary and it is load-bearing: a step does not
*have* a value, it conveys the post along itself, and no plainer verb
says that.

**What a step is, in words**: `Your opinion of @ada` · `@ada published
it`, with `Her own opinion rides the post` under the second. A publish is
a step like any other, and what makes it one is the opinion the author
signed with it — which the composer's seal already told them.

**The fold, said once**: `You have given @ada two opinions. They add up
to one, and that one is what carries — the same adding up the pad shows
you as your current opinion.` It speaks faces and counts rather than
arithmetic, the geek round's rule for a sentence about pairs: it has to
hold for a reader who has never turned the digits on.

**The floor's two lines**: `The two records behind your opinion of @ada.`
and `These records are public. Anyone can run the same sum and land on
the same number.` The second is the sentence the whole drill-down exists
for, and it is a fact rather than a boast — the spec binds every
implementation to compute the sum exactly rather than sample it, which is
what makes it true.

**The aged-out line**: `The paths that carried it here have moved on.`
One line, and no offer of anything to do about it — nothing is owed and
nothing is broken. It is deliberately not an empty-list line: something
*was* here.

**The opinions list.** The post's door reads `8 opinions on this post`
(`1 opinion on this post` in the singular) with `Opinions on this post`
as its accessible name; the comment's menu row reads `Opinions on this`.
The sheets are titled `Opinions on this post` and `Opinions on this
comment`. *Opinion* throughout, never *stance* — the reader's word
(*Naming*, above) — and the count is bare beside it, the row's own words
having already said what was counted.

**The empty sheet**: `No opinions yet — yours would be the first.` The
`Nothing here yet — write the first post.` shape: calm, and naming the
one thing that would fill it. It never scolds and it carries no `error`
colour; a comment nobody has answered is not a fault.

## The feed cards

The comment, person and tag cards a reader meets beside the posts (readme
§13, *The feed cards, ruled*), blessed by jakob 2026-10-01.

**`Feed score`** — the figure's one name, on every ranked card of every
kind: "we will have up to 10 rankable objects and it should be the same for
all of them." It is spoken (the accessible name of the `graph_3` figure) and
read at the top of the trace.

**The tag's why-line**: `Reaches you through @ada and @tobias` — blessed.
Under the tag's name, the people the strongest paths run through, in the
drill-down's own `Through @ada` words; one person reads `Reaches you through
@ada`. Past two people the line names the first and counts the rest:
`Reaches you through @ada and 3 others` — blessed (jakob 2026-10-01). Where
the full line would not fit its one line, it compresses to `Through @ada`,
the strongest path's person — blessed; a handle so long that even that does
not fit ellipsizes, `ActorChip`'s truncation law ("…").

**The empty tag's line**: `Nothing carries this tag right now.` — blessed
(jakob 2026-10-01). Where the glimpse would stand when nothing carries the
tag, `TagPageEmpty`'s own first sentence.

**A comment's head row, over a removed post**: `Removed by its author` in
the title's place, the removal mark's own line in the system's voice, over
the author's handle. An untitled post is named there by its first words.

**The tag's glimpse line**: `@tobias · and 2 more` — blessed. Under the
newest thing's name, its author, then how many more stand behind it; with
nothing more, the author alone.

**The tag's own act**: `Tag a new post with it` — blessed, the compose
glyph's accessible name; the person menu's `Mention in a new post` sibling.

**The comment's reply glyph** is spoken `Reply to @tobias`, the seal's own
read-back of a reply to a comment.

## The coming-soon surfaces

Three places stand in for something drawn after the MVP: the screen the
band's chats icon opens (`ChatsComingSoon`, backlog item 68), the door
the bar's wallet slot opens (`WalletComingSoon`, the V1.0 scope cut),
and the hero card on Explore (backlog item 16). **All name the promise
the same way** — the thing, an em dash, `coming soon`, then one sentence
of what will be there:

- `Chats — coming soon. Your conversations will be here.`
- `Wallet — coming soon. Your earnings will be here.` *(Ruled by jakob
  2026-09-25.)*
- `The Sky — coming soon` · `Your sky — every account a star, sized by
  your own paths to it.`

One construction, because a product that says `coming soon` in one place
and something else in another has two answers to one question, and a
reader who meets both learns nothing from the difference. The promise
leads and the sentence under it says what the reader gets — the two
questions every empty surface answers, in the same order.

**`Coming soon` is the whole of what is promised.** No date, no release,
no "next": both sit on the would-like list and the order can change, so
the words say that something is intended and nothing about when it
lands.

The Sky card carries the promise in its heading, where its name already
was; the two doors carry it on the coming-soon card — the promise as the
headline, the sentence as its one line (`ComingSoonCard`, the
drawn-anatomy ruling, jakob 2026-09-25). No coming-soon surface offers
an action — nothing a reader can do fills any of them yet.


## Topics

Every line the topic round drew: the tag page's stance row, *Your
topics*, the feed filter's one-topic narrowing, *Cited by*, and the
acts footer's zero. Ruled by jakob 2026-09-14.

**The word "follow" never reaches the screen, on any surface.** The ban
above (*Naming*, the notifications section: "*followed* would name a
gesture this product does not have") extends to topics and is now
unconditional. There is no follow in this product — taking a position
on a topic is an **Affinity**, priced, signed and severable like every
other stance, and a word borrowed from a product where it is free would
promise exactly the thing this one refuses. *Docs and code keep the
word*; boards and this file do not.

**The list is `Your topics`** — the page title, Explore's door, and the
button that reaches it from the feed filter (`All your topics`). Second
person, because the set is the reader's own acts; no count in the title,
because the door beside it already carries one (`5 held`). *Held* is the
word for having a position on a topic, and it is the predicate said
plainly: a topic is held while the netted pair is not nothing.

**The empty list**: `No topics yet — say how you feel about one from
its page.` The `Nothing here yet — write the first post.` shape: calm,
and naming the one thing that would fill it — including where the
gesture lives, because a reader with no topics has not met the tag
page's row yet. *How you feel* is the pad's own register (`How much
you like it`); the stand-wording is banned from the screen (jakob
2026-09-24, amending this line at blessing).

**The Affinity pad's six words.** The pad a topic's stance row opens
fills the same two signed slots as an opinion's with different
quantities: association and attraction (`layer1-interface.md` §9.5).
Like a tag's pair editor it names them in the reader's words — and it
names what each axis ASKS as well as where it ends, because the ends
alone leave a slider labelled with the opinion's question. Association
asks **`How much you like it`** and runs `Dislike` to `Like`;
attraction asks **`How close you want to be`** and runs `Far away` to
`Close to me`. That is the pair a reader actually decides about a
topic — how much they like it, and how much of it they want to see —
and the words are the plainest ones that carry it. They borrow neither
the opinion's `Less / More`, which names reach rather than closeness,
nor its `Against / For`, which names a verdict this record does not
carry. The field draws the four ends; the two questions ride the
sliders, the typed fields and every spoken readout, so the accessible
route asks what the drawn one asks. Ruled 2026-09-15; drawn on
`TagPageHeldPad`.

**The feed filter's section**: label `One topic`, hint `Topics you hold
and are for. A topic you hold against stays a record — it just never
narrows a feed.` The label says the cardinality, because it is the one
section here that does not combine. The hint answers the question the
section raises by existing — where is the topic I hold against — rather
than leaving a reader to decide their own record went missing.

**The trigger spells the tag itself**, hash and all, leading the
deviations: `Posts · #saltmaps`. It is an extra rather than the head for
two reasons that agree: the head spells kinds and a topic is not one,
and the head is the half the collapse cannot take away — a name the pill
cannot hold has to be able to leave it.

**`Cited by N`** — the inbound count line on a post's detail, and
`Cited by` as the sheet's title and the comment menu's row. *Cited* is
already the product's verb for a Reference (*"@ada cited your post"*),
and the line reads from the artifact's side: what points at this. The
count is bare beside it, the row's own words having said what was
counted. There is no *by whom* in the title: the list holds ARTIFACTS,
not people, which is exactly what separates it from `Opinions on this
post`.

**The inbound empty sheet**: `Nothing cites this yet — yours would be
the first.` `No opinions yet — yours would be the first.`'s twin, and
kept a twin on purpose: the two sheets are reached the same way, from
the same menu, and a reader who has met one should recognize the other.

**The acts footer's zero and its singular**, closing a wording the
master itself recorded as unruled:

- `Nothing to sign yet` — at zero, and the line stops being a button,
  because the sheet it would open is empty. *yet* is load-bearing:
  nothing is broken and nothing is owed.
- `You're signing 1 thing` — the singular, taken from `ActsCard`'s own
  blessed total (`1 thing, signed`) rather than decided fresh. The short
  form and the long form are one sentence at two lengths and may not
  disagree about the plural.

## Invites

Every line the invites round drew: the queue, the teaching empty state,
the create sheet, the fresh link, the approval pad and the close
dialog. Ruled by jakob 2026-09-15.

**The screen is `Invites`**, titled by the profile row that opens it,
and its arrow says `Back to your profile` like every other private
surface off that page.

**The standing entry point is a noun and the empty state's action is a
verb.** `New invite` on the populated list, `Create invite` on the
empty state and on the sheet's own commit — the product's own split,
the one the bottom bar (`New post`) and the empty feed (`write the
first post`) already keep. The button and the sheet it raises say one
word between them.

**The empty state carries the whole mechanic in three sentences**:
`No invites out yet. A link lets someone make an account. Your vouch —
the opinion you sign when you approve them — is what brings them in.`
The two halves are said APART because every other product conflates
them and a reader who does will be surprised by the second. *Vouch* is
the product's word and a reader's unfamiliar one, so it is explained
where it stands rather than left to be guessed. `brings them in` is
lifted from `VouchBack`, `ApplicantWaiting` and `VouchedIn` — the
boards already had the right words, and one phrase said on four
surfaces teaches faster than four near-synonyms would.

**The sections are `Applications` and `Live links`.** Not "Waiting on
you": only one of those rows is waiting on the reader and the other is
waiting on its own applicant, so a caption claiming both would make the
second row a lie. Who is waited on is the ROW's to say.

**An application's second line is its status, and it names the
reader's fact and not the mechanism** (jakob 2026-09-15). Which proof
is still missing — a key, a confirmed email — is the applicant's
errand, and the person deciding whether to vouch has no use for it:
what they need to know is whether they can act. So both not-ready
states read `Not fully registered yet`, and ready reads `Ready for
your approval`, the same words the notification uses, so the list and
the bell cannot describe one state two ways.

**A group of applications is labelled by its link and its count** —
`Many uses · 4 waiting`, `Single use · 1 waiting` — and the count says
WAITING because that is the number the batch acts on: one already
closed is not closed again. The batch control is `Close all`, named in
full for the accessibility tree as `Close all 4 applications from this
link`, and it is absent at one waiting. Its dialog puts the count in
the title — `Close all 4 applications from this link?` — and names no
handles; its buttons are the plural of the row's, `Close them` and
`Keep them`.

**The row's close says what happens, not how it feels.** Its name is
`Close @imke's application`, never "Reject" or "Decline": nothing is
deleted and the person keeps the account they made. The dialog behind
it opens `Close @imke's application?` and answers in two sentences (*The
reject extension's lines* below). The buttons are `Close it` and `Keep
it`, `Keep it` being the house word for *don't*, from `RemoveConfirm`
and `SeveranceConfirm`.

**A live link's label is what it is, and its caption is when it dies.**
`Single use · not used yet` and `Many uses`; the slot state rides the
single-use label only, because a multi-use link has no slot to be in a
state. `Revoke` is the card's one inline word. Copy is named for what
it copies — `Copy the link` — because the button carries no word on
screen and its accessible name is its only one.

**The create sheet's switch is worded as the RESTRICTION**: `Only one
person can use it`. That is what makes the label alone enough, and why
the row carries no status line under it. What OFF does is the group's
footnote: `With it off, anyone holding the link can apply until it
expires. Either way each person still needs your approval, one at a
time.` The second sentence is the one that matters — what scales is the
queue, never the vouching.

**Expiry is a DURATION and not a moment, so it does not take the
forward ladder.** The row reads `Expires after` · `7 days` and the
chooser's rows are `24 hours` · `7 days` · `30 days` — bare lengths,
because the reader is choosing how long, not naming a date. The ladder
governs the card's caption instead, where a real moment is being
reported: `Expires in 7 days · 22.09.2026`, `WalletCampaign`'s blessed
`Ends in 6 days · 08.09.2026` one surface over.

**The fresh link's sheet is `Your invite link`** and its primary is
`Share link`. The sheet serves the LINK and nothing else (jakob
2026-09-15): the id inside it is the capability and the door reads a
bare one too, but that is a tolerance at the door, not a second way to
invite somebody, and a sheet offering both made the reader pick between
two spellings of one thing at the moment they were trying to send it.
One snackbar, `Link copied`. **The word "token" appears nowhere** — the
record calls this a link capability and the API calls the field an id;
on screen it is a link.

**The approval pad's two lines state what `Set` does, every time.**
`Approving is vouching. Set signs your opinion on @rafa and brings them
in.` and `It is one signed, priced act — and it is theirs to answer:
their opinion back completes the pair.` They are not `VouchBackPad`'s
one-time coaching: approving is rare and priced, and §3's honesty rule
wants anything priced to say so before it is signed. The pad's "?" is
named `How vouching works`.

**The eighth notification reads `@rafa is ready for your approval`** —
a state rather than an act, and the one row in that list that is. What
happened is that a second proof landed, which is nothing a reader can
picture; what they need is the errand and the name, in that order. The
profile row's mark speaks as `Invites — someone is waiting`.

**Two snackbars the list owes, drawn nowhere and named in the graph**:
`Invite revoked` when a card leaves, and `@imke has to finish
registering before you can approve` when a not-ready row is pressed —
the locked row answering with a reason, `ProfileApplicant`'s own
manner, and in the row's own words rather than a second account of the
same state.

### The reject extension's lines — same round, same day

**The dialog says both effects.** `Close @imke's application?` then
`It leaves your list and @imke is told. Their account stays exactly as
it is — signed in, and free to keep reading.` and `This is your call
and nobody else's. Any member can still vouch them in, and @imke gets a
link to ask with.` The first sentence is the one a reader would
otherwise assume away: closing is not private, and a product that let
somebody press it thinking it was would be lying by omission. The
second is what stops the first from reading as expulsion.

**The rejected applicant's card**: title `@kel closed your
application`, body `That was @kel's call, and it is the only thing it
decides. Your account stays exactly as it is, you can keep reading, and
any member you know can vouch you in instead.` *closed* is the control's
own word, carried through from the button to the dialog to the
notification to this card — four surfaces, one verb, so the product
never tells two stories about one act.

**About says the same, before it happens** — the applicant topic
(*Getting in, and being let in*) closes its second paragraph on `If your
application is closed, your account stays — anyone can still vouch you
in.` (jakob 2026-10-02, **blessed**). An application has no timer, so
closing is the one ending the page names.

**The ask link is labelled by what to do with it**, not by what it is:
`Ask someone you know to vouch for you`, with `Send it to anyone who is
already in. It does not expire, and it works however many people you
send it to.` underneath. The caption is doing the work the invite
link's expiry caption does — saying what kind of link this is — and
both of its facts are the differences from an invite link, said as
reassurance rather than as spec. Its copy control is `Copy your ask
link`; the snackbar is `Link copied`, the same one the invite link's
copy gives, because it is the same act on the same kind of thing.

**The band's line changes and the band does not**: `Browsing from
@kel's view — your own starts when someone vouches you in.` The old
line promised an approval that is not coming; the new one keeps the
vantage honest and says what would end it.

**The member-side landing**: the page is titled `A vouch, asked for`,
the card reads `@noor is asking to be vouched in` over `They have an
account and can read; what they do not have yet is anyone standing for
them. Your opinion is what brings them in.` Nobody else is named and no
reason is given — an ask link carries a person, not a case file. `Not
now` leaves it standing, which costs the asker nothing, because the
link does not expire and is not used up.

**The ninth notification**: `@kel closed your application`. A plain
report in the same shape as `@mira approved your application`, and
deliberately not softened: the two rows sit in one list and a reader
comparing them should see one mechanism, not a cheerful one and an
apologetic one.

**A surface names the person whose approval is in play — the APPROVER —
and never the role "inviter"** (jakob 2026-09-15, closing the sweep:
"yeah sweep — the other version where you can choose your inviter is a
super corner case that will probabely never happen"). An applicant has
no inviter: `invitations.md` §2 fixes that word at the joiner's own
back-edge, so before the vouch-back there is only a member whose
approval is waited on. The rule is about the WORDS, not the people —
where one member issued the link and approves through it, which is the
ordinary case, the same handle rightly appears at both ends. What may
not happen is a line defining the wait, the rung or the act by a
relationship that does not exist yet: `All set — waiting on @mira`, not
"waiting on your inviter"; `Waiting on @mira`, not "Waiting on your
inviter"; `@mira approved your application` as the approver's act. The
primitive's freedom to reciprocate anyone stays in §2 and stays off the
screen — no surface offers a choice of inviter, because no reader is
asked to make one.

## Disconnecting from a topic

**A person is walked back; a topic is DISCONNECTED from** (jakob
2026-09-15, rejecting *walked back*, *let go* and *dropped* for the
topic in one breath: "nah thats all to complicated for users.. instead
of walk back we could just call it 'disconnect' or sth like this. and
then we can say 'no opinion towards #saltmaps' or sth similar.. we want
human wording not this nerdy stuff!"). That sentence is the direction,
not just the ruling: where a word can be the plain one everybody already
owns, it is.

`Walk it back` is a sentence about a person — you walk back something
you said to somebody — and a reader who said they like a topic made it
no promise. The two families therefore part at the way out, the same way
they already parted at the axis words, and **the split is by record
family, not by surface**: every person pad keeps `Walk it back` and
every topic pad says `Disconnect`, wherever either stands.

**The topic family's words**, drawn on `TagPageHeldPad` and its dialog:

- Control `Disconnect` — the pad's standing way out, and the confirming
  button in the dialog it opens.
- Dialog title `Disconnect from #saltmaps?`
- What it does: `You end up with no opinion towards #saltmaps. It stops
  reaching your feed, you stop earning from it, and nothing passes on
  through you.`
- The total: `Everything you've said about #saltmaps adds up to
  +1.40 / +0.95, and disconnecting clears all of it.`
- The landing, inside the pad: `This leaves you with no opinion towards
  it.`
- What a disconnected topic reads as, wherever it is read as a sentence:
  `No opinion towards #saltmaps.` — and as a bare label beside the
  shrug, `No opinion`.
- The help line: `Disconnect takes everything you've said about the
  topic to nothing. It has its own confirmation, and each thing you've
  said is cleared by its own signature.` (the alternates' shorter twin:
  `Disconnect takes everything to nothing, and each thing you've said is
  cleared by its own signature.`)

**`Severed` and `severance` are not words on any screen, and on a topic
surface not even nearly.** They name the mechanic in the docs and the
code; what a reader is told is what they are left with.

## The draft's discard

**The blocked roll's answer** (`ComposeDraftDiscard`, jakob 2026-09-15).
Under an unanswered draft the picture roll is dimmed and out of reach; a
tap on it used to reach nothing, and now it raises this:

- Title `Discard your draft?` — the question the tap actually asked.
  Reaching for the roll is reaching past the draft.
- `Picking pictures starts a new post, and this draft is what stands in
  the way. Discarding is the only thing that loses it.` The first
  sentence says why the tap did nothing; the second says what the two
  answers cost, which is the honesty rule's own requirement before a
  destructive word is pressed.
- `Discard it` (quiet) and `Keep the draft` (filled) — `DiscardConfirm`'s
  weighting, with both words carrying their object. The card behind the
  scrim has a bare `Discard` of its own, inert under the wash, and two
  buttons reading one word on one screen is the ambiguity a dialog is
  there to remove.
- The shield over the roll is named `Answer your draft before starting a
  new post` — what a screen reader meets where a sighted reader meets a
  dimmed grid.

**The comment edit's ask** (`DiscardConfirm`, jakob 2026-10-02). The
edit asks only when it changed since it opened, and its title says what
goes: `Discard the changes?`, over the shared dialog's `Nothing is
kept.`, `Discard` and `Keep writing`. *Blessed, jakob 2026-10-02.*

**The body fork's ask** (`ComposeBodyDiscard`, jakob 2026-10-02, the
fix-fix round's ruling 14). Switching halves with something in the body
asks first, and the title names the half that goes: `Discard the
words?` from the words stage's `Add pictures instead`, `Discard the
pictures?` from a pick stage's `Write words instead`, `Discard the
video?` from a clip's (jakob 2026-10-02, the residue round's Q4). The
body is `The rest of the draft stays.` — the reader loses only the half
they leave. `Discard` (quiet) and `Keep them` (filled) — `Keep it` over
the one clip — `DiscardConfirm`'s weighting; nothing behind the scrim
reads `Discard`, so the bare word cannot be misread. *Blessed, jakob
2026-10-02.*

## The already-published marker

**Reusing media never blocks** (jakob 2026-09-30). An author may publish
media that already stands in one of their own published posts, any
media kind; the composer's Details step marks it instead, with one soft
line under the media row in the honesty-marker ink `Edited` and `Still
settling` wear:

- `Already in your post from 12 September.` — the date is the matched
  post's publication date, always present, so the line never leans on
  that post having a title.
- The line is a door, in the tappable-marker form `Edited` wears
  (underline, quiet ink), and opens the post it names. Checking costs
  one tap, and nothing asks a question: no dialog, no confirm step, no
  gate.
- Where several published posts match, the line names and opens the
  **earliest** — the origin, and stable: a later repost never repoints
  it.
- Only the author's own published posts count. A match in drafts alone,
  or in someone else's post, draws nothing.
- **The date reads the way the chronicle's datelines do** (*Change
  histories*): day and month in the viewer's locale conventions on the
  clients, English on the boards — `12 September` — with the year
  appended only when the post's year differs from the current one:
  `12 September 2025`.

The lines stand in `designs/canonical/behavior/ComposeDetails.md`; the
board is owed (backlog item 110).

## Change histories

The words of would-like #2 (post-MVP tree, 2026-09-22). Two kinds of
history — a content chronicle and a stance timeline — and one law under
both: **editing only ever adds**.

**The door.** `Edit history` — the ⋮ row, and the page's own title. Not
`History`: your own profile's ⋮ already carries that word for the
private list of what you have read, and the wallet has a History section
of its own. The row and the `Edited` marker's tappable form appear only
once a second version exists; a door onto a list of one teaches a reader
that the feature does nothing.

**The chronicle.**

- `Current version · signed 12 September` and `Earlier version · signed
  3 September` — the dateline over each version. `signed`, never
  `posted` or `saved`: a version is a record somebody put their key to.
- The tombstone keeps `Removed by its author`, the mark a removed post
  already wears, and carries its own line in the content's place: `A
  version stood here from 3 September. Its words and pictures were
  removed; the record of the change stays.`
- The foot of every chronicle: `Every version is its own signed record.
  Editing adds a new one on top — nothing is rewritten, and removing one
  leaves a mark in its place.` It is the additive law in the reader's
  words, and it is why no surface in this round draws a diff.

**The author's register.**

- `Remove the whole post` leads the page, under `Removes every version
  at once. Removing a single version leaves the rest standing.` The lead
  exists because the head never falls through: an author removing
  version after version ends with a post that still stands, wearing a
  mark.
- `Remove this version` rides the dateline of every version that still
  has a payload, the current one included — a word, not a button, this
  being a rare path. A tombstoned version's slot says `Already removed`
  instead, in `text-secondary` and not pressable: a finished act's word
  where the act would stand, the way the picked sheet says `Described`.
- The comment's register leads with `Remove the whole comment` under the
  post's own footnote. The profile's leads with `Remove every version`
  under `Removes the contents of every profile version at once. Your
  account, your handle and everything you published stay — this only
  empties the profile's history.` — the one kind whose removal can be
  mistaken for leaving, so the line names what it does not touch.
- A removed profile version keeps the handle beside the reserved disc and
  carries `A version stood here from 20 August. Its name, words, picture
  and address were removed; the record of the change stays.` — the post's
  tombstone line, naming the profile's own four fields. A removed comment
  version carries the post's line unchanged.
- The confirm is `RemoveConfirm` at version scale. Title `Remove this
  version?`; body `Its words and pictures leave every reader's view, and
  a mark stays in their place. The other versions keep standing. If this
  is the current version, the post shows it as removed — an earlier
  version never takes its place.`; `Remove version` (quiet) and `Keep
  it` (filled). The last sentence is the one a reader cannot guess, so
  it is spelled before the act rather than explained after it.
- The nouns swap per kind, nothing else moves (jakob 2026-09-23). The
  comment version's body reads `…the comment shows it as removed…`; the
  profile version's opens `Its contents leave every reader's view` and
  closes `…the profile shows it as removed…`. The whole-comment confirm
  is the post's `RemoveConfirm` body with `…along with every earlier
  version's, and the comment's spot in its thread stays with it.` The
  profile's `Remove every version` confirm reads `The contents of every
  profile version leave every reader's view at once, and marks stay in
  their place. Your account, your handle and everything you published
  stay.`

**A historic version, opened.** `A historic version — changed 12
September.` on the banner's own panel, with `See the current version`
under it — the same two lines over a words version and a picture version. The marker's own
accessible name in its tappable form is `Edited — see the edit history`.

**The stance timeline.** A stance IS a history, so this surface only had
to be opened.

- `As it stands` labels the standing; the face and the `cg-exact` pair
  read it.
- The sum in plain words, because the fold clips: `Built from 27 picks
  over three years — more weight than the dial can show.` The exact raw
  sum rides a `cg-exact` tail — `+27.40 / +26.10 before the cap` — so
  the digits paint only in geek mode while the sentence stands in both.
- **The sum sentence's rules, for any count of picks and any span.**
  - Shape: `Built from {N} picks {period}[ — more weight than the dial
    can show].`
  - `{N}` is numerals. One pick is its own line, `One pick, {date}.`,
    with no sum clause and no tail — a single record IS the sum, and its
    pair is the one the standing above already reads.
  - `{period}` runs from the oldest pick to the newest and is spelled in
    words. Under a month the picks came quickly and it says `in`: `in
    {n} days` below two weeks (`in seven days`), `in {n} weeks` from two
    weeks (`in two weeks`). From a month on they were sustained and it
    says `over`: `over {n} months`, then `over {n} years` from a year
    (`over three years`). Whole units, rounded down. Every pick on one
    day: `today` — and `on {date}` when that day is not today.
  - The weight clause ` — more weight than the dial can show` appears
    ONLY when the raw sum passes the dial on either axis (|Σp| > 1).
    Within the dial the sentence ends at its period: `Built from 3 picks
    in two weeks.`
  - Geek register (`cg-exact`): `{pd} / {pi} before the cap` when the
    sum clipped, `{pd} / {pi} summed` when it did not. The spoken twin
    carries the same words and the same pair, axis by axis.
  - The drawn cases: 27 picks across three years, raw +27.40 / +26.10 —
    `over three years`, clause, `before the cap`; 4 picks from 5 to 12
    September, raw +2.40 / +1.50 — `in seven days`, clause, `before the
    cap`.
- **The timeline's "?"** — `How opinions build`, on both timeline
  sheets' title row, opening a plain dialog:
  An opinion is not one number — it is every pick ever signed from one
  side toward the other, added up. Each row here is one signed pick,
  exactly as it was made. / The dial only reaches so far, but the sum
  underneath keeps counting — so walking something back takes as many
  picks as building it did. And walking back is not deleting: a pick in
  the other direction is one more signed record, and the whole history
  stays readable, right here.
- A row is the face it was cast at and the date it was signed. A
  counter-record stands in the list at its own date wearing `Walked
  back`, the system's own word: severance is records, never an absence.
- The value readout that opens one carries `See how this opinion built`
  where a row splits, and the pad's label line becomes `Current opinion ·
  see how it built`. Authoring doors are faces and fields; a history
  door is a readout.

## The search-scope line

From backlog item 105's ruling (readme §13, the indirect kinds are
scope-served): with Comments — V1.0's indirect kind; Messages and
Offers rejoin it with their slices — selected and no
scope in the query, the results region carries one quiet line where
results would stand — the way, not an apology:

- `Found through people and tags — start with @handle or #tag.`
  **Drawn** on `ExploreUnscoped`, as the results region's empty state.

## Chats

The words of would-like #3 (post-MVP tree, 2026-09-23: the base boards
and the round's completion).

**The page.** `Chats` titles it; the faces are `Your chats` and `All
chats`, a two-cell row named `Which chats` for the ear. The floating
button is named `New chat` — a noun, `Invites`' split kept — and wears
no word.

**The "?" — `How chats work`**, a plain dialog:
Chats are public: anyone can read a chat and see who is in it and who
talks to whom. The lock beside the field encrypts the message you are
writing, so only the chat's members can read its words — everyone can
still see that it was sent. / Sending signs the message in your name,
like any post. Press and hold the send arrow to see exactly what you
sign. A sent message never changes — a correction is the next message.

**A row on your list.** The last message's words, prefixed in a group by
the sender's display name and a colon (`Mira Voss: Six it is.`), by
`You:` for the reader's own, and bare in a 1:1. An encrypted message the
reader holds the key for previews its words like any other; one they
cannot open previews as `An encrypted message` after the lock, named
`End-to-end encrypted` for the ear. A muted chat's mark is named `Muted`
for the ear. Ages speak the ladder (`35m`, `1d`).

**A chat's options** (long-press a row): the sheet is titled by the
chat's name and named `{chat} — chat options` for the ear; `Mute`
(`Unmute` on a muted chat) and `Chat details`. The message's sheet is
named `Message actions`.

**The explorer.** The switch is `Hide chats you're in`, on. The join
speaks the chat's policy: `Join` (open), `Ask to join` (on request); an
invite-only chat's slot says `Invite only`, and a chat the reader is in,
shown once the switch is off, says `Member`.

**The thread.**

- The header's door is named `{chat} — chat details`; the way back is
  `Back to your chats`, or `Back to all chats` from the explorer.
- A bubble's time is the clock (`08:40`, in the device's own 12/24-hour
  form), and a day divider names the day in the dateline's words (`22
  September`) — never `Today` or `Yesterday`. See *Ages* for the
  exception this is.
- The encrypted mark is named `End-to-end encrypted` for the ear;
  nothing is printed beside it.
- The notice for a message the reader holds no key for: `An encrypted
  message — you don't have the key to read it.`, with `Show the
  encrypted text` under it.

**A message's acts** (long-press a bubble), in order: `Save`, `Cite in a
new post`, `Give your opinion`, `Reply`, `Cited by`, `Opinions on this`,
`License terms` — the comment menu's words, with the two a bubble cannot
wear on its face added. No `Edit`, ever.

**Read from outside.** The foot is `Ask to join` or `Join` by the
chat's policy; an invite-only chat's foot says `Invite only — a member
can invite you.`

**Starting a chat.**

- The picker is titled `New chat`, its field `Search people`, its head
  row `New group chat`; the group picker is titled `New group chat`, its
  way back `Back to new chat`, its forward action `Next`. A staged
  person's × is `Remove {name}`, `StagedReference`'s own words.
- Someone you already share a 1:1 with: title `You already have a chat
  with {name}`, body `Carry on where you left off, or start a separate
  chat — you can have more than one with the same person.`, `Start a new
  chat` (quiet) and `Open that chat` (filled).

**The foot.**

- The field is labelled `Message`.
- The lock toggle is named `Encrypt end to end` and pressed or not; the
  fill says the state.
- The send arrow is named `Sign and send` — the seal's rule that the
  label names the act.
- The first send's quiet line: `Sending signs the message in your name.
  Press and hold the arrow to see what you sign.`
- The keyboard board's slab says `The device's own keyboard` — a board
  device, never product copy.

**What you sign, for one message** (press and hold the arrow): the
sheet is `What you sign` with the seal's `How signing works`; the acts
card reads `Message` · the words · `1 thing, signed`; the facts are
`Into` · `{chat}`, `Encrypted` · `No — anyone can read it` (`Yes — only
members can read it` when the lock is on), `License` · `Public domain —
your default`, `Your opinion` · the readout; the act is `Sign and send`.

**The founding.** `New group chat` titles it; its way back is `Back to
the people you picked`. `Choose a picture`; `Name` and `Description`,
each `Optional`; the picked people said back as `Inviting Ada Okonkwo
and Tobias Lindqvist.` The group `Who can join` holds three choice rows:
`Open` · `Anyone can join straight away.`, `On request` · `Anyone can
ask to join.`, `Invite only` · `Only people who are invited can join.` —
each line says what a joiner meets and never who decides, because
governance ships silently. `Invite only` starts chosen. The forward
action is `Next`.

**The founding's seal.** `What you sign`, `Last step`, the leave named
`Leave — nothing is started`; the chat shown back as `Low-tide walks` ·
`A new group chat — invite only.`; the acts card `Chat` · the name and
`Invitations` · the names, `3 things, signed together`, `They land
together, or none does.`; the fact `Who can join` · `Invite only`; the
line `A chat is public: its name, who is in it and who talks to whom
are there for anyone to read.`; the act `Sign and start the chat`.

### Chat details

Round B1's words (post-MVP tree, 2026-09-23).

**The details.** The page is titled `Chat details` — the row menu's word
and the header door's (`{chat} — chat details`); its way back is `Back to
the chat`. Under the name, the policy in one line, the founding seal's
sentence without `new`: `A group chat — invite only.`, `A group chat —
anyone can ask to join.`, `A group chat — anyone can join.` — each says
what a joiner meets, never who decides. The opinion anchor is named
`Give your opinion on {chat}`. The actions row's second act is `Edit
chat` for a member, `Ask to join` or `Join` for a reader outside.

- The doors: `Media in this chat` and `Edit history` — the
  change-histories round's door word, kept for a chat. Search is not a
  row: it is the thread header's glyph, named `Search in this chat`.
- `Open decisions` labels the section; empty, it says `Nothing is being
  decided.`
- `Members` labels the list; `Add people` heads it for a member. A
  row's trailing word is its role: `Admin`, `Moderator`, `Member`. The
  reader's own row reads `@sol · you`; a Collective's `@rowingclub · a
  collective`; an invitee who has not joined `Invited — hasn't joined
  yet`, with no role. For a member the role word is a door, underlined,
  and named `{Role} — change the role` for the ear (`Admin — change the
  role`); a reader outside hears the plain word.
- `Mute this chat`, a switch, with `No push for its messages. It keeps
  its place and its dot on your list.`
- `Leave this chat`, alone at the foot, quiet at rest.

**Editing the chat.** `Edit chat` titles it; its way back is `Back to
chat details`. `Change picture`; `Name` and `Description`, each
`Optional`; `Save`. The seal: `What you sign`, `Last step`, the leave
`Leave`, the "?" `How signing works`; the chat shown back as `Coast
walkers` · `Name, picture and description — one change to the chat.`;
the acts card in three rows — `Change` · `A new description`, `Chat` ·
`Coast walkers`, `Your opinion` · `For the change` (spoken `1 change`,
`1 link to the chat`, `1 opinion`) — totalled `3 things, signed
together` over `They land together, or none does.`, the founding seal's
own pair (jakob's fix pass: the proposal's anchor, its reference to the
chat and the proposer's own ballot, named in the reader's words and
never as proposal, ballot or tally); the line `The change is public, and the chat's earlier
versions stay readable in its edit history.`; the act `Sign the change`
— the profile seal's own words.

**The chat's edit history.** `Edit history` titles it, back `Back to
chat details`. Versions keep the chronicle's datelines (`Current version
· signed 18 September`) and show the policy line under the name. The
events between them are one plain sentence each, the actor first — `Sal
Torres left`, `Harbour Rowing Club joined`, `Mira Voss invited Harbour
Rowing Club`, and `You invited Ada Okonkwo` for the reader's own — with
the date in the dateline's words on the trailing edge, and a leave's
parting reason quoted on the line under it. Every version carries the
author's register's `Remove this version` on its dateline — for every
member, because a chat has no author — and a removed one keeps its row
with `Already removed` in the act's slot.

**Search in this chat.** The thread header's glyph opens it, named
`Search in this chat`. Titled the same, back `Back to the chat`, the field `Search messages`. The note under the field: `Only
messages sent without the lock are searched — an encrypted message's
words open on members' devices and nowhere else.` A result's first line
is the sender (`You` for the reader's own), its second the message, its
edge the ages ladder.

**Media in this chat.** Titled `Media in this chat`, back `Back to chat
details`; no other words — the tiles carry their authors' descriptions,
and the clip's disc keeps `Turn sound on`.

**Leaving.** The dialog: `Leave {chat}?`; `It leaves your chats. You can
still read it the way anyone can, but you can't write in it, and what
its members encrypt from now on stays closed to you.`; `Leaving is
signed, and it shows in the chat's history.`; the field `Why?` with
`Optional — shown in the chat's history` in its corner, the sensitive
sheet's own pairing; `Leave` (quiet) and `Stay` (filled). It promises
nothing about coming back, because whether a return needs a new
invitation turns on the chat's rules.

### Chat decisions

Round B2's words (post-MVP tree, 2026-09-23, with jakob's fix pass of
2026-09-24). The register: a decision is said as
what a person wants, then how many people agree so far. `Vote` is the
reader's own word for what they cast (jakob's, in the fix pass); proposal,
ballot, tally, quorum and weight stay off the screen.

**A decision waiting in the thread.**

- The sentence names the proposer and what they want, in full display
  names: `Mira Voss wants to remove Kel Moreau from the chat`; the
  reader's own reads `You want to change the chat's name, picture and
  description`; a role change `{name} wants to make {name} a moderator`; a
  removal `{name} wants to remove the version of 10 September`.
- The count is the people who agree: `2 of 5 so far`, `3 of 6 so far`. It
  never names a threshold and never promises how many it will take.
- The two words are `Disagree` and `Agree`, named `Disagree — {the
  sentence}` and `Agree — {the sentence}` for the ear. On a join request
  the act is `Approve` alone, named `Approve — Sal Torres asks to join`.
- The card's words are a door, named `{the sentence} — see the decision`.
- A card the reader has voted on shows a readout, not a button: `You
  agreed` or `You disagreed` where the two words stood, and the whole card
  is the door, named `{the sentence}, {count}, You agreed — see the
  decision`. The reader's own card always reads `You agreed`.
- Settled, a card becomes one line saying what is now true. Passed: `Tobias
  Lindqvist is now a moderator`, `Kel Moreau was removed`, `The chat is
  now called “Salt prints”`, `Sal Torres's request was approved`, and for
  the requester `Your request was approved`. Failed: `The chat kept its
  name`, `Kel Moreau stays in the chat` — what stayed, never "rejected" or
  "voted down".
- A join request: `Sal Torres asks to join`, the request's message quoted
  under it; the requester's own card `You asked to join`.

**The vote's small seal.** The sheet `What you sign` with `How signing
works`; one sentence — `You agree that Kel Moreau should be removed from
the chat.`, `You disagree that Kel Moreau should be removed from the
chat.`, `You approve Sal Torres joining the chat.`, or for a withdrawal
`You take back your vote on changing the chat's name, picture and
description.`; the line `Your vote is public, and it is yours to change or
take back later.`; the act `Sign and agree`, `Sign and disagree`, `Sign and
approve` or `Sign and withdraw`.

**A decision, opened.** Titled `Decision`, back `Back`. The sentence as
its heading, and under it `Proposed by you on 20 September · open` (`Proposed
by {name}` for someone else's; `passed on {date}` or `failed on {date}` once
settled). The sections `If it passes` and `The chat now`; the proposed
picture on its card is a door named `Open the proposed picture`. `Votes`, over `3
agreed · 1 disagreed · 2 haven't voted`; each row the voter, the date they
voted (`you · 20 September` for the reader's own), and `Agreed` or
`Disagreed`; under the list `Every vote is a public record. Each person's
newest vote is the one that counts.` Geek mode adds `· by role 3 for, 3
against — 6 of 14 cast (admin 5, moderator 3, member 1); either side past
half the cast settles it`, spoken in both modes as `By role — admin 5,
moderator 3, member 1 — 3 for and 3 against, 6 of 14 cast; either side past
half of the cast settles it`. `Your vote`, over `You agreed when you
proposed it, on 20 September.`, with `Disagree instead` and `Take back your
vote`. The change act names the other direction: `Disagree instead` over an
agreement, `Agree instead` over a disagreement.

**Open decisions, filled.** Each row is the card's sentence over its
count, with the two words under them at the row's edge — or, once the
reader has voted, `You agreed` at the count line's end inside the door. The
door is named `{sentence}, {count} — see the decision`, with `, You agreed`
before the dash on a voted row.

**Adding people.** Titled `Add people`, back `Back to chat details`, the
field `Search people`, the forward action `Next`; under the list `People
already in the chat, or already invited, aren't listed.` The seal: `What
you sign`, `Last step`, the leave `Leave — nobody is invited`; the chat
shown back as `Coast walkers` · `Inviting two people into the chat.`; the
acts card `Invitations` · the names, `2 things, signed together`, `They
land together, or none does.`; the line `An invitation is public and
vouches that they belong here. They join only if they accept.`; the act
`Sign and invite`.

**The foot of a chat you are not in yet.** Invited: `Mira Voss invited
you.` over `Join`. Asked: `Your request is sent — you can join once it's
approved.` Approved: `Join` alone, under the outcome line.

**Joining's seal.** The sheet `What you sign` with `How signing works`;
the acts card `Joining` · the chat · `1 thing, signed` (spoken `1 join`);
the route's fact row — `Invited by` · `Mira Voss`, `Your request` ·
`Approved`, or `Who can join` · `Anyone`; `Your opinion` · the readout;
the line `Joining is public — your name joins the member list. Encrypted
messages sent before you join stay closed to you.`; the act `Sign and
join`.

**A member's role.** The sheet is titled `{name}'s role`; the rows
`Admin`, `Moderator`, `Member`, the current one chosen; under them `The
chat decides roles together. If your say is enough, the change is made at
once; if not, it waits in the chat until enough members agree.`

**Removing a chat's version.** `Remove this version?`; `Its name, picture
and words leave every reader's view, and a mark stays in their place. The
other versions keep standing. If this is the current version, the chat
shows it as removed — an earlier version never takes its place.`; `The
chat decides this together. If your say is enough, it's removed at once;
if not, it waits in the chat until enough members agree.`; `Remove
version` (quiet) and `Keep it` (filled) — the post's confirm with the
nouns swapped and the chat's paragraph added.

**The fourth removal mark.** Next to the three already in use: `Removed
by the chat's decision` — `Its members decided to take it down. The
decision is public.` A chat has no author, so the author's mark would
name nobody, and the platform's would dress the members' choice as a
verdict. A removed chat version reads `A version stood here from 10
September. Its name, picture and words were removed; the record of the
change stays.`

### Chats across the product

Round B3's words (post-MVP tree).

**The reaction trace.** No printed word: the faces and the count of people
(`👀🍿🙂 3`). Named for the ear `Opinions on this — {n} people: {the faces'
words}; {the pairs}. See who` (`1 person` at one), the pairs spoken in both
modes; geek mode paints the pairs after the count, `+N more` past three.

**The reply.** The strip reads `Replying to {name}` over one line of the
message; its × is `Cancel the reply`. A landed quote is the sender's name
over one line, named `Replying to {name}: {line} — go to the message`; the
reader's own quoted message is `You`. A removed message's quote reads the
mark's first line, `Removed by its author`.

**The mic and the recording.**

- The mic is named `Record a voice message`; a
  tap starts the recording — no gesture has words, because none exists.
- Recording: the length is a live timer named `Recording, 0:14`; `Describe`
  at its line's end; `Delete the recording` (the `delete` glyph), the lock
  toggle's own `Encrypt end to end`, `Pause the recording`, and the arrow's
  `Sign and send`. The line: `Not encrypted — anyone can hear it. The lock
  beside delete encrypts it.`, or `Encrypted — only the chat's members can
  hear it.`
- Paused: the length reads `0:22 · Paused`, the timer named `Recording paused
  at 0:22`; the middle control is `Keep recording`, and it extends the same note.

**A message's opinions.** The pad is the ordinary pad, named `Opinion pad for
{sender}'s message`. The sheet is titled `Opinions on this message` (the
post's `Opinions on this post`, one noun over), its rows the opinions page's.

**The seals' opinion.** The row stays `Your opinion`; its value is the
pressable face, named by the control's own words (`Your opinion on {chat}: …`).
The message's own seal adds `Adjust`, the compose seal's word.

**A voice note.** The play control is named `Play — {the author's
description}`, or `Play — Voice message, 0:42` where there is none; the
scrub line `Position in the voice message`, its value spoken as
"0:00 of 0:42", the Seek row's shape. The
length prints tabular, `0:42`.

**Encrypted media, no key** — the text notice's family, the verb fitted to
the kind:

- `An encrypted picture — you don't have the key to see it.`
- `An encrypted clip — you don't have the key to play it.`
- `An encrypted voice message — you don't have the key to hear it.`

No `Show the encrypted …` for media.

**Pending and didn't land.** A settling bubble reads `Still settling ·
08:52`. The notice: `Your message didn't land`; `“{the words}” couldn't finish
settling. Nothing was spent.`; `Dismiss` (quiet) and `Try again` (filled) — the word people are used to
(jakob 2026-09-24). It returns the words to the field, and the next send
is the trying: nothing is re-signed on the tap.

**Removing your message.** The own menu adds `Remove` among the acts. The
dialog: `Remove this message?`; `Its words and anything it carries leave
every reader's view. A visible mark stays in their place — “Removed by its
author” — and replies to it keep pointing there.`; `This is immediate and
permanent.`; `Remove` (quiet) and `Keep it` (filled). The mark's second line
for a message: `Its place in the chat stays, and so do the replies to it.` The
platform's mark is unchanged: `Removed under the platform's rules` — `A passed
proposal removed it. The decision is public.`

**A post sent into a chat.** Every share glyph opens the sheet; its name for
the ear stays `Share {target}`. The sheet is `Send to a chat`; the field `Search
your chats`; the head row `Share outside CoGra`; the foot's field `Message`, cornered
`Optional`; the line `Sends one message into {chat}, pointing to this post.`,
and with the lock on it adds `The lock seals your words, never which
post you sent.` Signed, the snackbar says `Sent
to {chat}` with `Open`. In the bubble the post reads as its reference row, its
title over `{author} · a post`.

**Asking to join.** The sheet `What you sign` with `How signing works`; the
acts card `Asking to join` · the chat · `1 thing, signed` (spoken `1
request`); the field `Message`, cornered `Optional — the chat can read it`;
`Your opinion` · the readout; the line `Your request is public. Once it's
approved, joining is yours to do.`; the act `Sign and ask`. The reader's own
card quotes their message under `You asked to join`.

**Inviting, with a message.** On the invite seal, the field `Message`,
cornered `Optional — public, with each invitation`. The invitee's foot quotes
it under `{name} invited you.`

**The explorer's invited word.** `You're invited`.

**Search and Saved.** A chat result's second line is its policy line. A saved
message's row is the message's words, the sender's handle beside them, and
`in {chat}` under them.

**The notification rows.** `@mira invited you to {chat}` with the invitation's
message quoted as the second line; `@saltorres asks to join {chat}` with the
request's message; `{chat} approved your request to join`. Push says the same words.

**The feed cards.** On the real card, with the card's own words: no `Join`
and no `Open in the chat` on a card. The message card's author line is the
sender's chip then `· in {chat}`; its
body is the message as a bubble with its clock. The chat card's author line is
the chat's name with its kind mark, named `a chat` for the ear, over the
policy line (`A group chat — anyone can join.`); its body is the last message
as a row, the sender over the words.

**Push.** The page's board is titled `Push notifications · the kinds and their
defaults`. Three rows join `Announced right away`: `Invitations to chats`,
`Requests to join your chats`, `Your requests to join approved`. A `Chats`
group holds `New messages`, footnoted `A muted chat stays quiet here — mute
one from its details or by holding its row.` A message's push: the chat's name
as the title (the sender's in a 1:1) and the preview row's words as the body
— `Mira Voss: Six it is.` — or `An encrypted message` where the device holds no
key.
