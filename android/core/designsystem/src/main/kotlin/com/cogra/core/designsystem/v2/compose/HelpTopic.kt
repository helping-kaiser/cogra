package com.cogra.core.designsystem.v2.compose

/**
 * The `?` dialogs' texts, verbatim from
 * `design/guidelines/copy-voice.md` §"The `?` dialogs".
 *
 * Copy-voice states the browser wording and says **the app variant swaps
 * the platform noun**, which is the only edit made here ([Key]'s "in this
 * app"). Everything else is the guideline's own words, including its
 * dashes: the copy is the design, so it is transcribed rather than
 * rephrased.
 *
 * THE ITALIC TAILS ARE `cg-exact` SPANS (copy-voice, *The "?" dialogs*: "the
 * face is drawn in both reading modes, the digits only when the reader has
 * asked for them"). They are written here between [EXACT_OPEN] and
 * [EXACT_CLOSE], so the dialog paints them only in geek mode and its
 * screen-reader twin says them either way ([exactSpans]).
 *
 * At most two short paragraphs each, because that is the shape the
 * `HelpDialog` board draws.
 */
enum class HelpTopic(val title: String, val paragraphs: List<String>) {
    /** The seal, post and reply (copy-voice: payer-neutral by the v1.0.0 scope cut). */
    HowSigningWorks(
        title = "How signing works",
        paragraphs = listOf(
            "Each piece of a post — the post itself, every tag, every citation — " +
                "is signed on its own, in your name. They sign together: all of them " +
                "land, or none does.",
            "Each signing is paid for — the cost is real, so each one still counts.",
        ),
    ),

    /** The describe sheet. */
    DescribingPictures(
        title = "Describing pictures",
        paragraphs = listOf(
            "A description is read aloud by screen readers and shown when a picture " +
                "can't load — plain words about what's there. It travels with the " +
                "picture, public like the rest of the post. A video takes one " +
                "description for the whole clip; its cover takes none of its own.",
            "Nothing is described for you: a picture without a description is " +
                "skipped by screen readers, never guessed at.",
        ),
    ),

    /** The license sheet. */
    License(
        title = "The license",
        paragraphs = listOf(
            "Terms for anyone who reuses what you publish — credit, and a public " +
                "record of use. They are not a statement about how you made it.",
            "The license is set when the post is first signed and can never change, " +
                "not even by an edit. Your default lives in settings — Public domain " +
                "until you change it.",
        ),
    ),

    /**
     * The feed filter sheet's "?" — the feed's and Settings' What your feed
     * shows (copy-voice *The filter*: the feed's seen sentence follows the
     * seen tail; FeedSheet.md: "the feed filter's \"?\" says What you've
     * already seen waits below the Already seen line unless you ask for it back").
     */
    TheFeedFilter(
        title = "How the filter works",
        paragraphs = listOf(
            "What you let in, and in what order — the kinds combine freely, ranked or newest is one " +
                "choice, and what you've already seen waits below the Already seen line unless you ask " +
                "for it back. Nothing changes until you press Done, and nothing here is signed or shared.",
            "It lasts until you change it, on this device only. Reset brings back your defaults, to " +
                "change them go to settings.",
        ),
    ),

    /**
     * The sensitive self-mark sheet — the post's, the reply's, and both
     * edit surfaces'. One wording for both scales (ruling 42): a comment
     * has no description to name, and a post's description is words.
     */
    MarkingAsSensitive(
        title = "Marking as sensitive",
        paragraphs = listOf(
            "The mark veils the pictures and the words until a reader chooses " +
                "to look. The title stays readable, so choosing is informed.",
            "Your reason, if you give one, is shown on the veil. The mark is public " +
                "and travels with the post.",
        ),
    ),

    /**
     * Key absent — the seal, the stance pad and the settings screens. One
     * text for every key-absent surface (the key-loss round): nothing in it
     * assumes a write in progress.
     */
    Key(
        title = "Your key",
        paragraphs = listOf(
            "Signing needs your key, and it isn't in this app — nothing is signed " +
                "without it.",
            "A recovery code brings the key to any device. Until it's here, anything " +
                "waiting on it stays on this device.",
        ),
    ),

    /**
     * The write rule's notice on the post's seal — the stopper exception's
     * own "?" (copy-voice: blessed jakob 2026-10-01). The draft clause is
     * the seal's, the surface that keeps a draft.
     */
    WhySigningWaits(
        title = "Why signing waits",
        paragraphs = listOf(
            "There's a limit to how many signed actions can go through in a short " +
                "time — it keeps the network safe from flooding. You've hit it for now.",
            "Nothing was signed or spent, and your draft is kept. Try again in a " +
                "little while.",
        ),
    ),

    /**
     * The write rule's notice on an edit, the post's or a comment's — the
     * same dialog, its draft clause true of a surface that keeps no draft:
     * `…and your edit is still here.` (copy-voice; blessed, jakob 2026-10-05).
     */
    /** The write rule's notice on the kept picks' seal (WriteRuleFailed.md:37). */
    WhySigningWaitsKept(
        title = "Why signing waits",
        paragraphs = listOf(
            "There's a limit to how many signed actions can go through in a short " +
                "time — it keeps the network safe from flooding. You've hit it for now.",
            // WriteRuleFailed.md:37: the kept picks' seal's own clause.
            "Nothing was signed or spent, and your picks are still kept. Try again in a little while.",
        ),
    ),

    WhySigningWaitsAtEdit(
        title = "Why signing waits",
        paragraphs = listOf(
            "There's a limit to how many signed actions can go through in a short " +
                "time — it keeps the network safe from flooding. You've hit it for now.",
            "Nothing was signed or spent, and your edit is still here. Try again in a " +
                "little while.",
        ),
    ),

    /**
     * The edit surfaces — the post's, and `CommentEdit`'s own help dot.
     *
     * Transcribed verbatim: copy-voice.md carries one Editing text and the
     * boards point both edit surfaces at it.
     */
    Editing(
        title = "Editing",
        paragraphs = listOf(
            "An edit signs a full new version on top; earlier versions stay public " +
                "under \"Edited\". An edit never bumps it as new.",
            "Tag and citation changes ride the same signing, each as its own signed " +
                "action. The license never changes.",
        ),
    ),

    /**
     * The backing pad — the one-axis pad on one's own post, the seal's and
     * a post edit's (`ComposePad`, `EditPad`). BACKING is the authoring
     * number; the opinion is the one the post's face takes — the two words
     * never trade places.
     */
    YourBackingOnYourPost(
        title = "Your backing on your post",
        paragraphs = listOf(
            "Publishing also signs your backing of your own post — for or " +
                "against, from a gentle 🙂 $EXACT_OPEN(+0.10)$EXACT_CLOSE by default. An edit adds to it, " +
                "starting at nothing, so an edit you don't adjust leaves it as it is.",
            "How much of it reaches you isn't part of publishing: once the post is " +
                "out, give it an opinion on its face, like anyone's. Nothing is signed " +
                "until Set. Swap the input in settings if you prefer sliders or numbers.",
        ),
    ),

    /**
     * The reply's two-axis pad — its own topic, not
     * [YourBackingOnYourPost]. An opinion, never "your opinion" (copy-voice,
     * *Naming*).
     */
    TowardWhatYouAnswer(
        title = "Toward what you answer",
        paragraphs = listOf(
            "Replying also signs an opinion on what you answer — for or against, " +
                "and how much of it reaches you. It starts at a gentle 🙂 " +
                "$EXACT_OPEN(+0.10 / +0.10)$EXACT_CLOSE and rides the same signature as your reply.",
            "Nothing is signed until Set. Swap the input in settings if you prefer " +
                "sliders or numbers.",
        ),
    ),

    /** The tag picker's one "?" (copy-voice *Tagging*: the picker's one dialog). */
    Tagging(
        title = "Tagging",
        paragraphs = listOf(
            "A tag is a name anyone can use — nobody owns one, and using a name nobody has used before " +
                "takes no extra step. Tagging is its own signed action, and it carries how much the post is " +
                "about that tag.",
            "Names are lowercased, and a name can hold letters, digits, dot, dash and underscore. Tap a " +
                "tag you have added to set how it relates.",
        ),
    ),

    /** The citation picker's one "?" (copy-voice *The "?" dialogs*, **Citing**; trimmed to v1.0.0's kinds). */
    Citing(
        title = "Citing",
        paragraphs = listOf(
            "A citation is its own signed action and carries an opinion of what you cite. You can cite " +
                "a post, a comment or a person.",
            "A comment can also be cited from itself — open its menu and choose \"Cite in a new post\".",
        ),
    ),

    /** Explore's results (copy-voice *Searching*, re-voiced for the unified sigil law 2026-10-16). */
    Searching(
        title = "How searching works",
        paragraphs = listOf(
            "Search reads names, handles and titles, never bodies. Start with @ to find people by their " +
                "handle — what they made follows them. Start with # to find tags and what carries them.",
            "Results put what's closest to you first — the numbers are your view, no one else's. Below " +
                "the line, what's still beyond your reach, newest first. Your searches stay on this device.",
        ),
    ),

    /** The search filter sheet (copy-voice *The filter*, search's seen sentence). */
    TheSearchFilter(
        title = "How the filter works",
        paragraphs = listOf(
            "What you let in, and in what order — the kinds combine freely, ranked or newest is one " +
                "choice, and what you've already seen stays out unless you ask for it back. Nothing " +
                "changes until you press Done, and nothing here is signed or shared.",
            "It lasts until you change it, on this device only. Reset brings back your defaults, to " +
                "change them go to settings.",
        ),
    ),
}

/** Opens a `cg-exact` span inside a [HelpTopic] paragraph. */
const val EXACT_OPEN = "⁣["

/** Closes a `cg-exact` span inside a [HelpTopic] paragraph. */
const val EXACT_CLOSE = "]⁣"

/**
 * A paragraph as painted and as spoken: the `cg-exact` spans kept (geek
 * mode) or dropped with the space before them (glyph-first), and the spoken
 * twin always carrying them — "a screen-reader twin says both either way".
 */
fun exactSpans(paragraph: String, showExact: Boolean): Pair<String, String> {
    val spoken = paragraph.replace(EXACT_OPEN, "").replace(EXACT_CLOSE, "")
    if (showExact) return spoken to spoken
    val painted = Regex(" ?${Regex.escape(EXACT_OPEN)}.*?${Regex.escape(EXACT_CLOSE)}").replace(paragraph, "")
    return painted to spoken
}
