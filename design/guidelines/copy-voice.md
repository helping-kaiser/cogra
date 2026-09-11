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
| `It takes 3 signed actions, each paid for separately.` | `This may incur charges.` |
| `Inviting unlocks once your application is approved.` | `Feature locked` |

Sentence case everywhere. No title case, no all-caps, no exclamation
marks outside a genuine welcome (`Approved! Your registration is
landing`). Em dashes carry asides; `…` marks work in progress.

## Emoji

Used in exactly one place: the stance readout (twenty anchors, plus 🤷 for
a zero standing and 🫥 for a control at rest). These are system emoji
rendering a value, not decoration. **Never** in headings, buttons,
marketing copy, empty states, or documentation of features. The `→` in
`Just looking? Browse the feed →` is the only other glyph used as
punctuation.

## Honesty phrasings to reuse verbatim

- `Still settling` — content authored, not yet ordered.
- `Edited` — an edit, marked softly.
- `Nothing was signed just now.` — the coach mark's first line.
- `Signing needs your key, which isn't in this browser — the write waits
  as pending.`
- `Your standing toward this post drops to nothing. It stops reaching
  your feed, you stop earning from it, and nothing passes on through
  you.`
- `A signing key can only ever back one account, so this account needs
  its own.`
- `This is the only way to restore your key.`
- `Replying also signs where you stand on the post it answers.` — the
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

- **Signed actions** (the seal, post and reply): Each piece of a post —
  the post itself, every tag, every citation — is its own signed
  action, written in your name. They sign together: all of them land,
  or none does. / You don't pay for these — a shared community pool
  covers members' signings. The pool is real and finite, so each
  action still counts.
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
- **Where you stand on it** (the post's one-axis pad): Publishing also
  signs where you stand on your own post — for or against, from a
  gentle +0.10 by default. / Your own post always reaches you in full,
  so only for-or-against is yours to set. Nothing is signed until Set.
  Prefer sliders or exact numbers? Swap the input in settings.
- **Toward what you answer** (the reply's two-axis pad): Replying also
  signs where you stand on the post you answer — for or against, and
  how much of it reaches you. It starts at a gentle +0.10 / +0.10 and
  rides the same signature as your reply. / Nothing is signed until
  Set. Swap the input in settings if you prefer sliders or numbers.
- **Your first stance** (the vouch-back pad): Vouching back signs where
  you stand on the person who vouched you in — your first stance, and
  your feed grows from it. / The pad is how you shape what reaches you —
  for or against, and how much. Nothing is signed until Set.
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
`Where you stand on it`, `Toward what you answer`, `Your first stance`
— because one name across three surfaces says only that a dialog
exists. `How stances work` is the stance control's own help, where the
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

- `Your post is staged — it lands with you.`
- `Your stance is staged — it lands with you.`

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

The words the three overflow menus put in front of a reader, settled in
spelling — one `License terms` everywhere, never the British spelling:

- `License terms` — the one row, on a post's menu and a comment's
  alike. It opens the terms in a sheet over the surface the reader
  asked from.
- `Cite in a new post` — on a post's menu and a comment's alike.
- `Mention in a new post` — the same row on a person, and the same
  fact; only the far end of the reference differs.
- `Share this profile` — another's profile.
- `Share your profile` — your own, where it is the accessible name of
  the band's share glyph rather than a row, the menu having gone.

## The license block

**The readings the sheet gives a reuser.** The chooser's hints speak to
the author declaring the terms, so a read surface that reused them told
a reuser they were owed the credit they in fact owe. These address the
reuser instead. One per axis value:

- Credit — `Not required` · `Required for commercial use` ·
  `Required for every use`
- Public record of use — `Not logged` ·
  `Commercial uses logged publicly` · `Every use logged publicly`

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
  rather than the block it sits in. The count beside it reads
  `1 action`, because that is what it is.
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
`Taking a stance` · `Writing` · `Reading` · `Key backup` · `Sessions` ·
`Credentials`. The sign-out group carries no heading; it is the end of
the page, not a subject. `Writing` is the settled title — Android said
Writing, web said Signing, and the setting is about what a submit does,
not about the key.

**A row's second line is status, not description.** `Last created
12 August` · `Last used 2 days ago` · `This browser` · `Changed 3 weeks
ago`. A switch is the exception, because its label alone cannot say what
turning it on does.

**Theme**: `Light` · `Dark` · `Auto`, and under them
`Auto follows your device's own setting, and the choice stays on this
device.` It is the one place a bare "device" is right: what Auto follows
is the device's own light-or-dark setting, which is neither the browser's
nor the app's.

**Taking a stance** keeps the shipped readings and their hints —
`The pad` / `Press and hold, then drift to where you stand.`,
`Sliders` / `One slider per side of the stance.`, `Typed values` /
`Type both numbers exactly.` — and moves the shipped body line under the
group, where it is read once: `A tap always adds a small positive one.
This is what a longer press opens, everywhere.`

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
always uses the newest one. Your current code was made on 12 August.`,
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

**Its status names what is behind the drawing.** `The numbers behind
the faces and the glyphs.` The faces are the stance table's, the glyphs
the tag table's and the score's mark — one line covering every signal
number without listing five families.

**The Reading group's footnote carries both rows' facts.** `Every feed
starts from what it shows, and a change made inside a feed lasts until
you change it back. Both choices stay on this device.` *Stays on this
device* is the theme group's own spelling for a client-local choice,
said once under the group rather than inside either row.
