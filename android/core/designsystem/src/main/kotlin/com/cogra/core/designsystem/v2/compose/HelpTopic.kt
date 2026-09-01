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
 * At most two short paragraphs each, because that is the shape the
 * `HelpDialog` board draws.
 */
enum class HelpTopic(val title: String, val paragraphs: List<String>) {
    /** The seal, post and reply. */
    SignedActions(
        title = "Signed actions",
        paragraphs = listOf(
            "Each piece of a post — the post itself, every topic, every citation — " +
                "is its own signed action, written in your name. They sign together: " +
                "all of them land, or none does.",
            "You don't pay for these — a shared community pool covers members' " +
                "signings. The pool is real and finite, so each action still counts.",
        ),
    ),

    /** The describe sheet. */
    DescribingPictures(
        title = "Describing pictures",
        paragraphs = listOf(
            "A description is read aloud by screen readers and shown when a picture " +
                "can't load — plain words about what's there. It travels with the " +
                "picture, public like the rest of the post.",
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

    /** The sensitive self-mark sheet. */
    MarkingAsSensitive(
        title = "Marking as sensitive",
        paragraphs = listOf(
            "The mark veils the pictures and the description until a reader chooses " +
                "to look. The title stays readable, so choosing is informed.",
            "Your reason, if you give one, is shown on the veil. The mark is public " +
                "and travels with the post.",
        ),
    ),

    /**
     * Key absent at the seal. On that screen the one `?` belongs to this
     * notice rather than the header: the key story outranks the seal story
     * there (design/readme.md §13).
     */
    Key(
        title = "Your key",
        paragraphs = listOf(
            "Signing needs your key, and it isn't in this app. Nothing is signed " +
                "or sent without it — the draft stays on this device.",
            "Restore the key with your recovery code to finish. Restoring here is " +
                "the only way to complete this write.",
        ),
    ),

    /**
     * The edit surfaces — the post's, and `CommentEdit`'s own help dot.
     *
     * Transcribed verbatim, "post" included: copy-voice.md carries one
     * Editing text and the boards point both edit surfaces at it, so
     * swapping the noun here would be the rephrasing this file exists
     * not to do.
     */
    Editing(
        title = "Editing",
        paragraphs = listOf(
            "An edit replaces the whole post; earlier versions stay public under " +
                "\"Edited\" unless you remove them. An edit never bumps the post as new.",
            "Topic and citation changes ride the same signing, each as its own " +
                "signed action. The license never changes.",
        ),
    ),

    /** The post's one-axis pad. */
    WhereYouStand(
        title = "Where you stand on it",
        paragraphs = listOf(
            "Publishing also signs where you stand on your own post — for or " +
                "against, from a gentle +0.10 by default.",
            "Your own post always reaches you in full, so only for-or-against is " +
                "yours to set. Nothing is signed until Set. Prefer sliders or exact " +
                "numbers? Swap the input in settings.",
        ),
    ),
}
