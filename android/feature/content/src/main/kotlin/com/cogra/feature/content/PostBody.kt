// The body a post or a comment renders — words, or a gallery — with
// the two states that replace it: the sensitive veil and the removal
// placeholder (D12, D15).

package com.cogra.feature.content

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.atom.bleedHorizontally
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.media.MediaGallery
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.core.designsystem.v2.media.RemovalReason
import com.cogra.core.designsystem.v2.media.RemovedPlaceholder
import com.cogra.core.designsystem.v2.media.SensitiveSource
import com.cogra.core.designsystem.v2.media.SensitiveVeil
import com.cogra.core.designsystem.v2.media.SensitiveVeilCompact
import com.cogra.core.designsystem.v2.token.MediaFrame
import com.cogra.core.designsystem.v2.token.MediaShape
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.CommentView
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.ModeratedField
import com.cogra.domain.ModerationState
import com.cogra.domain.PostView
import com.cogra.domain.Removal
import com.cogra.domain.RemovalAgent
import com.cogra.domain.ageLadder
import com.cogra.domain.content.SensitiveMark
import com.cogra.feature.content.R
import java.time.Instant

/**
 * Which surface the body is drawn on, and therefore how its pictures sit.
 *
 * A post's body **is** its pictures, so they run full-bleed to the card's
 * edges, square-cornered, at the author's own crop, and they lead the body
 * — the boards draw them between the title and the words.
 *
 * **A comment is words first and its pictures join them**
 * (`design/components/content/CommentCard.prompt.md`): they follow the
 * words, stay inset at the card's medium rung, round their corners, and cap
 * far lower. They are an attachment, not the body, so no full-bleed. The
 * bytes are never cropped on the way up (2026-08-31) — but every comment
 * gallery display-crops to the pager's fixed square frame, because nothing
 * in this product letterboxes (2026-09-03).
 */
internal enum class BodySurface { Post, Comment }

/**
 * The body region of a card or a detail: the gallery, the words, and
 * the description — **as one state**.
 *
 * D12 (jakob, 2026-08-28) rules the granularity: a sensitive post blurs
 * media, text and description together and the title stays outside, so
 * this composable is exactly the region the veil covers and callers
 * draw the title above it.
 *
 * Redaction is record-granular: every authored field goes at once, so a
 * removed body is the placeholder rather than a gallery with holes in
 * it.
 *
 * **The reveal is not this composable's to remember.** It is per node
 * and per session, shared across every surface the node appears on, and
 * dropped when the node's own sensitive state changes (jakob
 * 2026-08-31) — none of which a `remember` keyed to one card can do. It
 * is hoisted to `SensitiveReveals`, and arrives here already decided.
 *
 * @param collapsed the summary card's reading: the body clamps to
 *   [TEXT_BODY_CLAMP_LINES], the description to
 *   [DESCRIPTION_CLAMP_LINES], and an opener unfolds whatever that hid.
 *   False on the detail, which is the read surface and clamps nothing.
 * @param revealed whether this reader has already chosen to look.
 * @param onReveal fired when they choose to; null where the surface
 *   holds no reveal state, which leaves the veil closed.
 */
@Composable
internal fun PostBody(
    content: ModeratedField,
    description: ModeratedField?,
    attachments: List<MediaAssetView>,
    attachmentsStatus: FieldStatus,
    moderation: ModerationState,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
    /**
     * The node's own mark (`Post.removal` / `Comment.removal`). Given one, the
     * body is the mark whatever the fields say — a surface patches it in the
     * moment a removal is taken — and the mark reads its agent and its moment.
     */
    removal: Removal? = null,
    collapsed: Boolean = false,
    /**
     * The card padding a post's gallery cancels so it runs to the
     * card's edges (`PostCard.jsx:263`, `margin: 0 calc(-1 *
     * var(--card-padding))`). Zero where there is none to escape.
     */
    bleed: Dp = 0.dp,
    /**
     * What the gallery's tap does, handed the page the reader is on.
     *
     * The feed opens the POST and ignores the page; the detail opens the
     * FULLSCREEN VIEWER on that very frame (graph.json, `PostDetail` via 4 —
     * "detail media → the frame, whole and full-screen"; `ViewerPicture.jsx:2-3`
     * — "the card's tap opens the post, the post's tap opens the frame").
     */
    onOpenMedia: ((page: Int) -> Unit)? = null,
    /**
     * The surface is already showing this body's media above the card, so the
     * body draws none — the video detail, where "THE CLIP STANDS ABOVE THE
     * CARD, not inside it" (`screens/PostDetailVideo.jsx:7-10`).
     *
     * It moves the GALLERY only: whether the record bears media still decides
     * everything else, words xor media above all, because the clip is the body
     * wherever it is drawn.
     */
    mediaAbove: Boolean = false,
    surface: BodySurface = BodySurface.Post,
    revealed: Boolean = false,
    onReveal: () -> Unit = {},
    /**
     * Whose mark the veil carries. The statuses above are the veil
     * itself — the OR of the author's own mark and a moderator's verdict
     * — so the caller reads the author's half to tell the two apart.
     */
    sensitiveSource: SensitiveSource = SensitiveSource.Author,
    /** The author's public reason, shown on the veil after the source. */
    sensitiveReason: String? = null,
    /**
     * The card's data-node on a registered screen (`feed.card`): the words,
     * the description, the opener and the gallery then wear its `body`,
     * `description`, `opener` and `media` parts in place of the
     * [testTagPrefix] tags. The veil and the removal placeholder are not
     * drawn on a registered board, so they keep theirs.
     */
    node: DataNode? = null,
    /**
     * Where [collapsed] folds the words: a post's text body at its drawn
     * ceiling, a comment card's at two lines under `More`
     * (FeedCommentShapes.md, the caption's precedent).
     */
    wordsClampLines: Int = TEXT_BODY_CLAMP_LINES,
) {
    if (removal != null || isRemoved(content, attachments, attachmentsStatus)) {
        RemovedBody(removal, moderation, surface, testTagPrefix, modifier)
        return
    }

    // WORDS XOR MEDIA (D16): the picture IS the body, so a media post
    // draws no `content` even when the record carries one. The words
    // beside a picture are the description, and the card draws them
    // under it. Handed both — an impossible post — the documented media
    // reading wins: the manifest is the body, and half a card is better
    // than an invented one. A comment is words PLUS pictures, so the
    // exclusion is a post's alone.
    val mediaIsTheBody = surface == BodySurface.Post && attachments.isNotEmpty()
    val words = content.value?.takeIf { it.isNotEmpty() && !mediaIsTheBody }
    val reading = CaptionReading(
        collapsed = collapsed,
        wordsClampLines = wordsClampLines,
        // `PostCard.jsx:265`: a media post's caption is clamped to two lines
        // and ALWAYS carries the opener.
        alwaysOpenable = mediaIsTheBody && !description?.value.isNullOrEmpty(),
        // The detail reads its words at `body-large` (`PostCard.jsx:235`).
        detailWords = surface == BodySurface.Post && !collapsed,
    )

    val body: @Composable () -> Unit = {
        Column(
            modifier = Modifier.fillMaxWidth(),
            // A POST'S BODY STANDS IN THE CARD'S OWN RHYTHM (`Card.jsx`
            // `--card-gap`, 12dp): the gallery, the words and the opener are
            // the card's children on the board. A comment keeps its own.
            verticalArrangement = Arrangement.spacedBy(if (surface == BodySurface.Post) Space.x3 else 8.dp),
        ) {
            // A post leads with its pictures; a comment leads with its
            // words and its pictures join them.
            if (surface == BodySurface.Comment) Caption(words, description?.value, testTagPrefix, node, reading)
            if (attachments.isNotEmpty() && !mediaAbove) {
                Gallery(attachments, surface, onOpenMedia, bleed, "${testTagPrefix}_gallery", node?.div("media"))
            }
            if (surface == BodySurface.Post) Caption(words, description?.value, testTagPrefix, node, reading)
        }
    }

    val veiled = !revealed && isSensitive(content, description, attachmentsStatus)
    // THE TWO FACES OF ONE VEIL. A post's body carries media or several
    // lines, so it blurs in place and keeps its exact space. A comment
    // is two lines and an inset attachment: covering it in place would
    // wash the words and wash the pictures separately, so the whole body
    // is replaced by one block at the card's own scale
    // (design/components/honesty/SensitiveVeil.jsx).
    if (surface == BodySurface.Comment) {
        SensitiveVeilCompact(
            veiled = veiled,
            onReveal = onReveal,
            modifier = modifier.fillMaxWidth(),
            source = sensitiveSource,
            reason = sensitiveReason,
            testTag = "${testTagPrefix}_veil",
            content = body,
        )
    } else {
        SensitiveVeil(
            veiled = veiled,
            onReveal = onReveal,
            modifier = modifier.fillMaxWidth(),
            testTag = "${testTagPrefix}_veil",
            content = body,
        )
    }
}

/**
 * A post's title and its body, in the order and the rhythm the board draws
 * them (`PostCard.jsx:294-299, 338`): a media post's title stands above its
 * media as one of the card's own children, the card's 12dp clear of it; a
 * words post's title opens its text block, the block's 4dp seam above the
 * words. Either way the title stays outside the veil (D12).
 */
@Composable
internal fun TitledBody(post: PostView, title: @Composable () -> Unit, body: @Composable () -> Unit) {
    if (post.isMediaPost) {
        title()
        body()
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(Space.x1)) {
            title()
            body()
        }
    }
}

/**
 * The body's words and the caption under them, with the opener that
 * unfolds whatever the clamp hid.
 *
 * BODY FIRST, DESCRIPTION UNDER IT, on both kinds of post — so the two
 * shapes read as one card re-proportioned rather than two layouts.
 */
@Composable
private fun Caption(
    words: String?,
    description: String?,
    testTagPrefix: String,
    node: DataNode?,
    reading: CaptionReading,
) {
    val collapsed = reading.collapsed
    val type = MaterialTheme.typography
    val wordsStyle = if (reading.detailWords) type.bodyLarge else type.bodyMedium
    // What the clamp hid, remembered from the reading that hid it: once
    // the opener has unfolded the text nothing overflows any more, so a
    // live measurement would take the opener away with the fold.
    var folded by remember(testTagPrefix) { mutableStateOf(false) }
    var open by remember(testTagPrefix) { mutableStateOf(false) }
    val clamping = collapsed && !open
    val shownDescription = description?.takeIf { it.isNotEmpty() }

    // BODY FIRST, DESCRIPTION UNDER IT: two fields, one visible join — the
    // text block's `--space-1` seam (`PostCard.jsx:252-253, 295`).
    if (words != null || shownDescription != null) {
        Column(verticalArrangement = Arrangement.spacedBy(Space.x1)) {
            words?.let {
                ClampedText(
                    text = it,
                    color = MaterialTheme.colorScheme.onSurface,
                    style = wordsStyle,
                    maxLines = if (clamping) reading.wordsClampLines else Int.MAX_VALUE,
                    onOverflow = { folded = true },
                    testTag = node.partTag("body", "${testTagPrefix}_words"),
                )
            }
            shownDescription?.let {
                ClampedText(
                    text = it,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = if (clamping) DESCRIPTION_CLAMP_LINES else Int.MAX_VALUE,
                    onOverflow = { folded = true },
                    testTag = node.partTag("description", "${testTagPrefix}_description"),
                )
            }
        }
    }
    // Only where there is something folded away — and always under a media
    // post's caption. A text control, not a link: it opens the text in place
    // and never navigates. Drawn on its `4px 0` padding, it answers at 48dp
    // (`PostCard.jsx:269-291`, `cg-hit`).
    if (collapsed && (folded || reading.alwaysOpenable)) {
        Opener(open, onToggle = { open = !open }, testTag = node.partTag("opener", "${testTagPrefix}_opener"))
    }
}

/** The opener's drawn height: `label-medium`'s 16dp line on its `4px 0` padding. */
private val OPENER_HEIGHT = 24.dp

/**
 * THE DESCRIPTION IS TWO LINES in the feed, on both kinds of post. It is
 * the caption, not the body: enough to say what the thing is, never
 * enough to become the reading.
 */
internal const val DESCRIPTION_CLAMP_LINES = 2

/**
 * THE TEXT BODY'S CEILING — a text post stands about as tall as a media
 * post, never taller, so a feed of both keeps one rhythm. Derived from
 * the tokens rather than chosen: on the 390×844 board, 844 less the 44px
 * safe area, the 64px bottom bar and the 360px worst-case chrome leaves
 * 376px, and `body-medium`'s line height is 20px — floor(376 / 20) = 18.
 */
internal const val TEXT_BODY_CLAMP_LINES = 18

/**
 * A paragraph that reports whether the clamp hid anything.
 *
 * Measured rather than estimated from a character count: the board's
 * estimate exists because a static render cannot measure a paragraph,
 * and the rule it serves is "only where there is something folded away".
 */
@Composable
private fun ClampedText(
    text: String,
    color: Color,
    style: TextStyle,
    maxLines: Int,
    onOverflow: () -> Unit,
    testTag: String,
) {
    Text(
        text = text,
        style = style,
        color = color,
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
        onTextLayout = { if (it.hasVisualOverflow) onOverflow() },
        modifier = Modifier.testTag(testTag),
    )
}

/**
 * The gallery at the rung its surface gives it.
 *
 * Every comment gallery — one item or many, a clip included — rides the
 * same pager in the comment scale's fixed square frame and display-crops
 * to fill it: nothing in this product letterboxes
 * (`design/components/content/CommentCard.prompt.md`).
 */
@Composable
private fun Gallery(
    attachments: List<MediaAssetView>,
    surface: BodySurface,
    onOpenMedia: ((page: Int) -> Unit)?,
    bleed: Dp,
    testTag: String,
    node: DataNode?,
) {
    val items = attachments.map { it.toItem() }
    when (surface) {
        // FULL-BLEED, on the card and on the detail alike (design
        // backlog item 35, ruled 2026-09-08). The media cancels the
        // card's own padding so it runs to the card's edges and drops
        // its side radii — it meets the card's straight sides, never its
        // corners, so nothing needs clipping. It is the largest thing in
        // the card by a wide margin, which is the point.
        BodySurface.Post -> MediaGallery(
            items = items,
            onOpen = onOpenMedia,
            modifier = if (bleed > 0.dp) Modifier.bleedHorizontally(bleed) else Modifier,
            testTag = testTag,
            node = node,
        )

        BodySurface.Comment -> MediaGallery(
            items = items,
            onOpen = onOpenMedia,
            frameRatio = MediaShape.Square.ratio,
            fit = ContentScale.Crop,
            maxHeight = MediaFrame.CommentMaxHeight,
            shape = MaterialTheme.shapes.medium,
            testTag = testTag,
            node = node,
        )
    }
}

/**
 * The design-system view of one attachment.
 *
 * A clip hands over two URLs: the component draws the poster and plays
 * the video, and it is the *cover's* URL that becomes `url` because
 * that is the still the frame shows before a first frame exists.
 *
 * **A cover redacted on its own leaves the video playing.** The cover
 * answers with its own status, so a removed poster means the frame
 * reserves its space and waits for the first frame rather than drawing
 * bytes that are gone — the video itself was not removed, and pretending
 * otherwise would erase something nobody erased.
 */
internal fun MediaAssetView.toItem(): MediaItem {
    if (!isVideo) {
        return MediaItem(url = url, aspectRatio = aspectRatio, altText = altText)
    }
    val poster = cover?.takeIf { !it.status.hidden() }
    return MediaItem(
        url = poster?.url,
        aspectRatio = aspectRatio,
        altText = altText,
        videoUrl = url,
        durationMs = durationMs,
    )
}

/**
 * The mark where a removed body was (`RedactedContent`): its reason read off
 * the node's own mark, its `when` the removal's own moment in the one age
 * ladder (backlog item 45), never the content's age.
 */
@Composable
private fun RemovedBody(
    removal: Removal?,
    moderation: ModerationState,
    surface: BodySurface,
    testTagPrefix: String,
    modifier: Modifier,
) {
    val reason = removalReason(removal, moderation)
    // A comment's mark swaps the noun in the author's second line
    // (CommentRemoved.md:5); a verdict's line is the verdict's.
    val commentNote = surface == BodySurface.Comment && reason == RemovalReason.Author
    RemovedPlaceholder(
        reason = reason,
        modifier = modifier,
        timestamp = removal?.let { ageLadder(it.at, Instant.now()) },
        note = if (commentNote) stringResource(R.string.content_removed_comment_note) else null,
        testTag = "${testTagPrefix}_removed",
    )
}

/**
 * Which of the two removals a reader is looking at.
 *
 * The docs require the two to stay distinguishable, since collapsing
 * them lets a verdict hide behind an author's decision. The node's own
 * mark is the data (`removal.by`, api-spec.md `RemovalAgent`): MODERATION is
 * the platform's verdict, and AUTHOR and ACCOUNT both read as the author's
 * ("AUTHOR and ACCOUNT both read `Removed by its author`") — no other branch
 * is taken on `by`, and an agent this build cannot name is never a verdict.
 * Where a node carries no mark, its `ILLEGAL` verdict is the only reading
 * left, and every other state leaves the author's own removal.
 */
internal fun removalReason(removal: Removal?, moderation: ModerationState): RemovalReason = when {
    removal != null -> if (removal.by == RemovalAgent.MODERATION) RemovalReason.Platform else RemovalReason.Author
    moderation == ModerationState.ILLEGAL -> RemovalReason.Platform
    else -> RemovalReason.Author
}

/** Whether the post's whole payload is gone: its own mark, or every field it answers. */
internal val PostView.removed: Boolean
    get() = removal != null || isRemoved(content, attachments, attachmentsStatus)

/** Whether the comment's whole payload is gone, as [PostView.removed]. */
internal val CommentView.removed: Boolean
    get() = removal != null || isRemoved(content, attachments, attachmentsStatus)

/**
 * Whether the whole body is gone.
 *
 * A words post is removed when its `content` is REDACTED; a media post
 * when its gallery is. UNKNOWN counts as removed on both: a state this
 * build cannot name is never rendered as if it were fine.
 */
internal fun isRemoved(
    content: ModeratedField,
    attachments: List<MediaAssetView>,
    attachmentsStatus: FieldStatus,
): Boolean {
    val galleryGone = attachments.isNotEmpty() &&
        (attachmentsStatus.hidden() || attachments.all { it.status.hidden() })
    val wordsGone = attachments.isEmpty() && content.status.hidden()
    return galleryGone || wordsGone
}

/**
 * The node's sensitive state, as a reveal is remembered against.
 *
 * The same three statuses [isSensitive] reads, kept together so a reveal
 * can be compared to the state it was made under rather than merely to
 * a node id.
 */
internal fun sensitiveMark(
    content: ModeratedField,
    description: ModeratedField?,
    attachmentsStatus: FieldStatus,
): SensitiveMark = SensitiveMark(
    content = content.status,
    description = description?.status,
    attachments = attachmentsStatus,
)

internal fun PostView.sensitiveMark(): SensitiveMark =
    sensitiveMark(content, description, attachmentsStatus)

internal fun CommentView.sensitiveMark(): SensitiveMark =
    sensitiveMark(content, description = null, attachmentsStatus = attachmentsStatus)

/** Whether the body is marked sensitive — one state for the whole of it. */
internal fun isSensitive(
    content: ModeratedField,
    description: ModeratedField?,
    attachmentsStatus: FieldStatus,
): Boolean = attachmentsStatus == FieldStatus.SENSITIVE ||
    content.status == FieldStatus.SENSITIVE ||
    description?.status == FieldStatus.SENSITIVE

private fun FieldStatus.hidden(): Boolean =
    this == FieldStatus.REDACTED || this == FieldStatus.UNKNOWN

/** [part]'s registered tag on a registered card, else the [fallback] the unregistered surfaces bind to. */
private fun DataNode?.partTag(part: String, fallback: String): String = this?.div(part)?.tag ?: fallback

/**
 * How a caption reads where it stands: [collapsed] on a summary card, folding
 * its words at [wordsClampLines]; [alwaysOpenable] under a media post's
 * caption; [detailWords] at the detail's `body-large`.
 */
private data class CaptionReading(
    val collapsed: Boolean,
    val wordsClampLines: Int,
    val alwaysOpenable: Boolean,
    val detailWords: Boolean,
)

/** `More` / `Less`: drawn on its `4px 0` padding, answering at 48dp (`PostCard.jsx:269-291`, `cg-hit`). */
@Composable
private fun Opener(open: Boolean, onToggle: () -> Unit, testTag: String) {
    Text(
        text = stringResource(if (open) R.string.content_less else R.string.content_more),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .testTag(testTag)
            .hitTarget(
                interactive = Modifier.clickable(role = Role.Button, onClick = onToggle),
                drawnHeight = OPENER_HEIGHT,
            )
            .padding(vertical = Space.x1),
    )
}
