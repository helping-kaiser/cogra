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
  the post itself, every topic, every citation — is its own signed
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
  description until a reader chooses to look. The title stays
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
  the post as new. / Topic and citation changes ride the same signing,
  each as its own signed action. The license never changes.
- **Citing**: A citation is its own signed action and carries where
  you stand on what you cite. You can cite anything on CoGra — start
  with @handle or #topic to reach comments, messages, and offers. /
  Comments and chat messages can also be cited from themselves —
  open one and choose "Cite in a new post".
- **Searching** (the Explore tab's results): Search reads names and
  titles, never bodies. Start with @handle to search one person's
  work — including their comments and offers, found through what
  they point at. Start with #topic to search inside a topic. /
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

## Accessible names

The words the stream, the video transport and the viewer put in front
of a reader. These controls are glyphs, so what is written here is what
a screen reader says, and it is the only wording they have.

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

## Awaiting blessing — the audit-states round

Drawn on the boards the 2026-09-09 rulings added, and up for review in
the same pass. Once blessed each line moves to the section it belongs
to above. The reply pad's help topic is absent from this list on
purpose: **Toward what you answer** was already blessed, and the round
drew a board for it rather than writing a second version of it.

**The chronicle's failed next page** (`ProfileMoreFailed`). The
chronicle scrolls like the feed, so the only drawn state is the one
where a page does not arrive. jakob's own words for it:

- `Couldn't load more` — the fact, `text-secondary` at body-medium,
  not `--error`: rows are already on screen, so the page that didn't
  come means stale, not gone.
- `Retry` — the way out, an `InlineAction` at the end of that line.

**A profile that isn't there, and one that wouldn't load** (`ProfileNotFound`,
`ProfileUnreachable`). Two states, and the difference between them is
the whole design — an answer that was no, and no answer at all:

- `This profile doesn't exist.` — the terminal state. Both apps already
  ship this exact sentence; adopting it costs nothing and settles the
  wording where it already agrees. It carries no way on, because
  nothing about trying again makes a profile exist.
- `Can't reach the server — this profile can't load right now.` — the
  fault. It is §3's own feed variant (`Can't reach the server — new
  posts can't load right now.`) with the noun this surface is about.
  The long house line ends in "and try again", which beside a Retry
  says try again twice — the same reason the reply's failed upload is
  drawn short.

**Setting the new password** (`ResetNew`). The stage behind the reset
link, which no board drew. `At least 12 characters.` is Join's hint
verbatim and `This restores your sign-in only…` is Reset's quiet note
verbatim — neither needs blessing again:

- `Set a new password` — the heading.
- `Setting a new password signs out every device. You sign in again
  with the new one.` — the consequence, said where the act happens.
  Reset's request screen already carries the first fact; this is the
  screen that acts on it.
- `New password` — the field's label.
- `Set the new password` — the commitment.

**Nothing that reads as an invite** (`InviteEntryError`):

- `That doesn't look like an invite link.` — the field's own supporting
  line. It takes the shape the register already uses for a local format
  failure (`That doesn't look like an email address.`) and names the
  link, because the field asks for a link. Web's invented line adds "or
  its code", describing a field this design does not draw; Android's
  says "doesn't contain an invite code", describing a paste this design
  does not ask for. Belongs under **Field errors**, drawn, once blessed.

**The verification link, in the app** (`VerifiedApp`, `VerifyExpired`).
`Email verified` and `Resend the link` are taken verbatim from the
browser landing and the applicant feed's card:

- `Your application moved a step. The rest of it is waiting for you on
  the feed.` — the app's landing. The browser's second sentence ("You
  can go back to the app — it already knows") is addressed to a reader
  who is not in the app, so it cannot stand here.
- `Go to the feed` — the way on, naming its destination the way `Back
  to CoGra` names the browser's.
- `This link doesn't work anymore` — the dead link's heading, in
  `JoinInvalid`'s idiom (`This invite can't be used anymore`).
- `It may have expired or already been used. Send yourself a fresh one
  — your application is untouched, and the new link picks it back up.`
  — the two possibilities, the way forward, and the reassurance
  `JoinInvalid` also carries, because a reader who reads "expired"
  without it assumes the application expired too.
