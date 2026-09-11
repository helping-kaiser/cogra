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

## The vocabulary that stays off the screen

Words describing how the thing is built rather than what the reader is
doing: **graph, node, edge, vertex, tensor, weight, parameter,
decentralized, protocol, token, crypto**. The repo's own internal
vocabulary is equally out: *valence*, *connection*, `p_d`, `p_i`.

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
a date. The removal mark's `when` speaks this vocabulary like any
other timestamp — it is the redaction's own moment, not the content's
age.

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
| `Inviting unlocks once your application is approved.` | `Feature locked` |

Sentence case everywhere. No title case, no all-caps, no exclamation
marks outside a genuine welcome (`Approved! Your registration is
landing`). Em dashes carry asides; `…` marks work in progress.

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

- `Still settling` — content authored, not yet ordered.
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
- `Replying also signs your opinion on the post it answers.` — the
  reply seal's note, under the ruled block on both its states.

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

**"Standing" leaves the screen entirely.** `Current opinion` and
`Resulting opinion` say what it said, in the word a reader owns.

The law stops at the code's own names, exactly as the tag/topic law
does. `StanceControl`, `StancePad`, `StanceReadout`, `StanceRow`,
`StanceValue`, `STANCE_ANCHORS`, the `stance` prop, the stance record
and its `api-spec` shape, the flow-graph's `stance face` labels and the
`ProfileStances` board name all stay: they name the record, no one
using the product reads them, and churning them would cost every
cross-reference to the contract for nothing.

## Platform nouns

The key lives on a device, and the device is named as the reader sees
it: **"this browser"** on web, **"this app"** on Android — never a bare
"device" where the concrete noun exists, and each noun carries its own
preposition. One line, two renderings:
`Your key isn't on this browser` · `Your key isn't in this app`.

## The "?" dialogs

Compose keeps captions to one short line; the full explanation lives
behind a small "?" (at most one per screen) opening a plain dialog:
title, at most two short paragraphs, Close. The texts, verbatim
(browser wording shown; the app variant swaps the platform noun):

- **How signing works** (the seal, post and reply): Each piece of a
  post — the post itself, every tag, every citation — is signed on
  its own, in your name. They sign together: all of them land, or
  none does. / You don't pay for these — a shared community pool
  covers members' signings. The pool is real and finite, so each one
  still counts.
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
  *(The video sentence is an extension of blessed copy — 2026-09-02,
  flagged for review; the rest of the dialog is unchanged.)*
  The sheet and the describe row both carry the reason permanently,
  under the title and under the row: **`Read aloud to people who
  can't see it.`** — the "?" is for the reader who wants the rest,
  not for the one who needs to know why the field is there.
- **Your key** (key absent at the seal and at the stance pad): Signing needs your key, and
  it isn't on this browser. Nothing is signed or sent without it — the
  draft stays on this device. / Restore the key with your recovery
  code to finish. Restoring here is the only way to complete this
  write.
- **Your opinion on your post** (the post's one-axis pad): Publishing
  also signs your opinion on your own post — for or against, from a
  gentle 🙂 *(+0.10)* by default. / Your own post always reaches you in
  full, so only for-or-against is yours to set. Nothing is signed until
  Set. Prefer sliders or exact numbers? Swap the input in settings.
- **Toward what you answer** (the reply's two-axis pad): Replying also
  signs your opinion on the post you answer — for or against, and
  how much of it reaches you. It starts at a gentle 🙂 *(+0.10 / +0.10)*
  and rides the same signature as your reply. / Nothing is signed until
  Set. Swap the input in settings if you prefer sliders or numbers.
- **Your first opinion** (the vouch-back pad): Vouching back signs where
  you stand on the person who vouched you in — your first opinion, and
  your feed grows from it. / The pad is how you shape what reaches you —
  for or against, and how much. Nothing is signed until Set.

  *The italicised tails are the `cg-exact` spans: the face is drawn in
  both reading modes, the digits only when the reader has asked for
  them (readme §13), and a screen-reader twin says both either way.*
- **Editing**: An edit replaces the whole post; earlier versions stay
  public under "Edited" unless you remove them. An edit never bumps
  the post as new. / Tag and citation changes ride the same signing,
  each as its own signed action. The license never changes.
- **Citing**: A citation is its own signed action and carries where
  you stand on what you cite. You can cite anything on CoGra — start
  with @handle or #tag to reach comments, messages, and offers. /
  Comments and chat messages can also be cited from themselves —
  open one and choose "Cite in a new post".
- **Searching** (the Explore tab's results): Search reads names and
  titles, never bodies. Start with @handle to search one person's
  work — including their comments and offers, found through what
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
  name — the picture changes the moment yours lands. / The community
  pool covers the signing, like your posts. The record that you
  changed it stays, like every signed action.
- **The filter** (the feed's and search's filter sheets): What you
  let in, and in what order — the kinds combine freely, ranked or
  newest is one choice, and what you've already seen stays out
  unless you ask for it back. Every change applies as you tap;
  nothing here is signed or shared. / It lasts until you change it,
  on this device only. Your default lives in settings.

**A "?" is named by the dialog it opens.** Its accessible name is that
dialog's own subject, so a listener hears which explanation the tap
brings: `Your key`, `License`, `Sensitive`, `How the filter works`,
`What is CGT?`. The three stance pads take theirs the same way —
`Your opinion on your post`, `Toward what you answer`, `Your first opinion`
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

**Screens say MB; the caps are MiB.** The limit enforced is the binary
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

## Staging a video

**A video is the whole body** — the quiet line where the add control
used to be, once a clip is staged:

- `A video is the whole post. Its cover comes next.`
- `A video is the whole comment. Give it a cover below.`

**A clip that didn't upload** — a fault, not a refusal, so it keeps
Retry (`UploadErrorLine` with both ways out):

- `That video didn't upload.`

  The transport voice would write it *That didn't upload. Try again.*;
  the line is drawn short because Retry stands beside it and the pair
  would say "try again" twice.

**The cover's own words** — the crop a gallery picture goes through,
and the way back to it from an edit:

- `The cover takes the video's shape.`
- `Change the cover`

## Editing a media post

The edit surface shows the gallery the post already has where the words
field would stand, and one line says why the field is not there:

- `A post's body is words or media, never both.`

It states the body's rule, never a lock on this post: an edit carries
the post's complete new content state, so it may flip the kind outright
— every picture replaced by words, or the words by a gallery.

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

- `Back to the feed` — the stream's way out. Not "Close": the reader is
  going back to the feed the stream narrowed, not shutting a layer.
- `Close` — the viewer's X, which IS shutting a layer.
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

## The staged-act snackbar

An applicant's second tap of a kind already staged answers here instead
of opening the real surface again; one line per kind, same shape:

- `Your post waits with your application — it arrives with you.`
- `Your opinion waits with your application — it arrives with you.`

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
- `That code doesn't check out.` — Restore's recovery-code field.
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
  — your application is untouched, and the new link picks it back up.`
  — the two possibilities, the way forward, and the reassurance a
  reader who reads "expired" without it would miss.

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

**Key backup**: `Recovery code` and `Your key` are rows, not verbs. The
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

**Sign out** carries the login form's own line verbatim —
`Don't remember this account on this device` — with what it decides
underneath: `Your key and your draft are cleared from this browser when
you sign out.`

**A new recovery code** (`SettingsBackup`): the heading, then
`A new code re-encrypts your key and replaces the old backup — recovery
always uses the newest one. Your current code was made on 12.08.2026.`,
the field `Current recovery code`, the commitment `Create a new recovery
code`, and last: `The new code is shown once and never stored. Have
somewhere to write it down before you go on — the old code stops working
as soon as the new one exists.`

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
meets it first. The sections, hints and `Reset` are the feed's own. Its
foot reads the choice back in the trigger's own word — `Posts`, nothing
more, because the title has already asked the question and the note
above has already said what the answer binds — and commits it with
`Done`, the word both of the page's sheets use.

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

## The profile save

Blessed with the small-rulings batch. A profile edit is a signed act
that settles like any other, and the shell's snackbar is the only
feedback the surface draws:

- `Signed — your profile shows it now, still settling.` — what a saved
  profile answers with. It says both halves: the change is visible
  already, and the act is still finding its place in the order.

## Awaiting blessing — the parked-rulings round

Drawn, and up for review in the same pass. Kept apart from the blessed
lines above until then.

**A card's media description names the kind of thing it has.** The
description is what a screen reader is given for a post card's body, so
a clip announced as a picture is the card telling a reader something
untrue — and it is the only place the difference is sayable, the two
looking alike until one plays:

- `1 clip · 0:24` — a video post. The duration belongs in the words:
  it is the one fact about a clip a reader decides on before playing
  it, and the eye reads it off the cover.
- `1 picture` · `4 pictures` — a picture post, the count alone.

## Awaiting blessing — the tag round

Drawn on `TagPage`, `TagPageEmpty`, `TagPicker`, `TagPickerTyping` and
`TagPair`, and up for review in the same pass. The naming law above is
part of the same ruling and is written where it belongs; these are the
new lines.

**The page carries no preamble.** The list opens directly under the
title (jakob's review removed the explanatory line): the rows say what
they are, and a sentence restating the contract was noise where the
title and the claims already carry it.

**A row says which act put it there.** The claim's glyph, `Tagged`, and
then the pair, on a flag attached to every card's top edge — the word
names the act, the glyph and the numbers say what it claimed, and the
tag itself is not repeated because the page is titled by it.

**An unused tag is not a miss.** `Nothing carries this tag yet. The name
is still a place — anyone can be the first to use it.` No "not found",
because the tag was found; what is empty is the list. *Still a place*
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

**Canonicalization is previewed, never silent.** `Signs as #saltmaps`
under the field while `#SaltMaps` is typed, and under that the shape a
name may take: `Letters, digits, dot, dash and underscore. Capitals
become lowercase.` A reader is choosing a permanent public endpoint;
one that quietly becomes a different string is the surprise §9 exists
to stop.

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

## Awaiting blessing — the geek-mode round

Drawn on `Settings` (and the two sheet boards that draw the page
beneath them), and up for review in the same pass. The mode itself
draws nothing new — it decides whether the numbers already on every
board are painted — so the round's whole copy surface is one row.

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

## Awaiting blessing — the geek round's review

The lines the review round wrote (jakob's rulings, 2026-09-11 evening).
The naming law above is part of the same ruling and is written where it
belongs; these are the new strings.

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
`Your feed reads it capped at +1.00 / +0.85.`

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
`Invites open when you're in.` · `What you post now arrives with you.`

**Carried over unchanged, and still unblessed** — drawn by the tag
round, named here so the review pass has them in one place: `Un-tag`,
the edit body's `Withdrawn: #coastroad`, and the acts card's
`Tags withdrawn` row label.

## Awaiting blessing — the private-viewer-state round

Drawn on `ProfileOwnMenu`, `Saved`, `SavedEmpty`, `History`,
`HistoryEmpty`, `SettingsHidden`, the three content menus and the
settings page, and up for review in the same pass.

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

## Awaiting blessing — the caps-affordance round

Drawn on `ComposeDetailsCaps`, `ComposeWordsCaps` and `TagPickerRefused`,
and up for review in the same pass. Two families: the count a capped
field shows near its cap, and the refusal it shows past it.

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

## Awaiting blessing — the notifications round

Drawn on `Notifications`, `NotificationsEmpty` and `FeedUnread`, and up
for review in the same pass.

**A row is a sentence, and the handle is its subject.** `@ada commented
on your post`, not *Ada Okonkwo · commented* — the disc already carries
the face, so the words are free to be the whole fact, and a handle is
what a reader recognises and can go looking for. Seven kinds, seven
sentences, all present tense of the act that happened:

- `@ada commented on your post` — a comment on a post of yours.
- `@tobias replied to your comment` — a reply one level down. *Replied*,
  not *commented*, because the two land in different places and a reader
  who is told which will know where they are going.
- `@sol gave an opinion on you` — the profile opinion, in the
  chronicle's own verb (`Gave an opinion`). The reader's word is
  **opinion**; *followed* would name a gesture this product does not
  have, and *vouched* is the inviter's word, not this one's.
- `@mira mentioned you` — a citation whose target is you.
- `@ada cited your post` — a citation whose target is something you
  wrote. *Cited*, the product's verb for a Reference, and the second
  line says where: `in Sunday at the tide market`.
- `@juno landed through your invite` — *landed* is already the word the
  approval flow speaks (`Your registration is landing`), so the invite's
  other end keeps it.
- `@mira approved your application` — the inviter's act, named as
  theirs. Not *You were approved*, which is the passive the register
  refuses and hides the person who did it.

**The second line is what arrived, or where it is.** The comment's and
the reply's own words for the two that carry words; `in <title>` for the
mention and the citation, the saved comment row's `on <title>`
construction turned to the citing side. The other three have neither and
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
happen.` The list has no gesture of its own — it fills from what other
people do — so naming what arrives is the only way to say the channel is
empty rather than broken. No action button: nothing the reader can do
from here fills it.

**The surface is `Notifications`,** in the page header and wherever it
is named. Not *Activity*, which describes a log, and not *Alerts*, which
describes an emergency.

## Awaiting blessing — the account-deletion round

Drawn on `Settings`, `DeleteAccount`, `DeleteAccountMail`,
`FeedDeleting`, `DeleteAccountCanceled` and `ProfileDeleted`. This
flow's words carry the product's erasure ethic, so the register is held
tighter here than anywhere: honest, quiet, no drama, and nothing that
argues with a decision the reader has made.

**THE ONE WORD NOT YET RULED — how a FUTURE moment is said.** The ages
ladder above is a vocabulary for how long ago something happened; the
deletion band counts FORWARD, and no ruling covers that (backlog 54.1).
Three candidates:

1. `Deleted in 6d` — the ladder read forward, one vocabulary for every
   duration on screen. Cheapest to hold, and the one place the ladder's
   compression can genuinely mislead: `6d` means *ago* everywhere else
   in the product, so a reader scanning a band could read the account as
   already gone.
2. `Deleted in 6 days` — spelled out. **Recommended, and what is
   drawn.** The ladder's compression buys room in lists where many ages
   compete for it; this is one sentence in a band with room to spare, so
   the compression buys nothing and costs the ambiguity above. Running
   down: `in 1 day`, then `in 5 hours` on the last day.
3. `Deleted on 17.09.2026` — the ladder's own past-30-days branch, a
   fixed date. Exact and needs no arithmetic, but a date does not shrink,
   and a window whose whole point is that it is closing should read as
   closing.

**The settings row is two words and a footnote.** `Delete account` on a
navigating row, and under the group: `Nothing is deleted here. The next
screen says what goes and what stays, and the deletion is confirmed by a
link we email you.` The row is quiet by ruling; the footnote is what lets
it be, because the fact a reader needs before tapping is that the tap
deletes nothing.

**The request screen says what goes before what stays, and says both.**
Heading `Delete account`; then `This takes your name off CoGra. What you
signed stays on the graph, because it is other people's record as much
as yours — what goes is everything that says it was you.`

- `What goes` — `Your profile — display name, bio, picture and cover.` ·
  `The link between you and this account. Nothing left here points back
  to you.` · `Your sessions, and what this account kept for you alone:
  saved items, hidden accounts, what you have read.`
- `What stays` — `Everything you signed, and everything others signed
  about you. Your posts still route and still credit their author; what
  is removed leaves a mark saying so.` · `Your wallet and its address.
  They are held by your key, never by CoGra, so nothing here can touch
  them.`

**The content sweep is the reader's own sentence, in the first person.**
`Also remove what I posted`, with `The words and pictures go out of your
posts, comments and messages, each leaving its mark. Leave this off and
they stay as you wrote them.` under it. *Also* is what makes it an
addition to a decision already made rather than a second question.

**The commitment is `Send the confirmation link`** — what the press does,
and `Reset`'s `Send reset link` said for the same mechanism. Not `Delete
my account`, which would be a lie about a button that sends an email.
Under it: `Nothing is deleted until you open that link. After that it
runs in seven days, and you can cancel from any device until it does.`

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

## Awaiting blessing — the review round

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

## Awaiting blessing — the score-and-opinions round

Every new line on the Post score's four drill-down boards and on the two
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

## Awaiting blessing — the follow-up bundle

Two strings, drawn on `SavedUndo` and owed by the redacted-actor law.

**Unsaving's snackbar.** `Removed from Saved.` with `Undo`, the second
snackbar in the product to carry an action. It names the LIST and not
the row: the thing that went is the one the reader just pressed, and
the fact they may want reversed is that it is no longer kept. The pair
is deliberately lopsided against saving's bare `Saved.` — saving costs
a reader nothing to repeat, and a mis-pressed unsave costs them finding
the thing again.

**The hide row with no name to say.** `Hide this account`, where the
author is a deleted account and there is no handle to spell. It stands
beside `Hide @ada`, never instead of it, and the row never drops: the
act is about an ACTOR, the actor is still there, and its content still
ranks into the reader's feed. The system's voice for the same reason
`Deleted account` is — it is the product saying what the tap does when
it cannot say whose.
