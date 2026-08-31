# Copy and voice

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
a zero standing and 😐 for a control at rest). These are system emoji
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
  public like the rest of the post. / Nothing is described for you:
  a picture without a description is skipped by screen readers,
  never guessed at.
- **Your key** (key absent at the seal): Signing needs your key, and
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
  amount can be traced to what paid it.
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

Two removal marks, never interchangeable: `Removed by its author` —
"The words and pictures are gone. The post's place in the thread, and
every response, remain." — and `Removed under the platform's rules` —
"A passed proposal removed it. The decision is public."
