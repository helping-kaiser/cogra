// The intro's five illustrations, placed as the boards place them
// (`screens/Onboarding*.jsx`; the frame's stage is `_shared.jsx`'s
// `IntroStage`/`IntroLines`/`IntroFace`/`IntroCaption`/`IntroPostCard`).
//
// ONE COORDINATE SPACE PER STAGE. Every piece sits at the board's own
// coordinates on a stage the board's size, and one Canvas under them draws
// every line — absolute placement is what keeps a drawing of
// lines-between-things from drifting apart. The stage then scales to the
// column as one picture (the frame's "AT ANY WIDTH AND ANY TEXT SIZE").
//
// THE ILLUSTRATIONS ARE NOT GATED BY THE APP'S OWN ELEMENTS: where a real
// component appears it IS the real component (the pad is the stance pad,
// every face is the monogram avatar); a post card, a comment and a chat
// bubble are LIKENESSES built from the masters' roles, radii and anatomy,
// with nothing pressable on them. Nothing on a stage takes input.
//
// MagicNumber is suppressed for this file by name: the numbers ARE the
// boards' coordinates, copied verbatim so a diff against `screens/*.jsx`
// reads line for line; a constant per point would hide the drawing.
@file:Suppress("MagicNumber")

package com.cogra.feature.onboarding.intro

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.MonogramAvatar
import com.cogra.core.designsystem.STANCE_ANCHORS
import com.cogra.core.designsystem.StancePadField
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.media.CograAvatar
import com.cogra.domain.ActorRef
import com.cogra.feature.onboarding.R

/** The boards' stage width; every stage is drawn at it and scaled from it. */
private const val STAGE_WIDTH = 342

/** The stage's registered name (`_shared.jsx` intro block: `stage`). */
private val StageNode: DataNode = IntroNode / "stage"

// The canvas's fixture people, as the boards name them (`_shared.jsx` ADA,
// TOBIAS, SOL, MIRA). They are the drawing's content, never the reader's.
private const val ADA = "Ada Okonkwo"
private const val TOBIAS = "Tobias Lindqvist"
private const val SOL = "Sol Ferreira"
private const val MIRA = "Mira Voss"

/** The drawn stage for [card], at its board's size, scaled to the column. */
@Composable
internal fun IntroStage(card: IntroCard, inviter: ActorRef?) {
    val height = when (card) {
        IntroCard.Steps -> 336
        IntroCard.Shape -> 392
        IntroCard.Public -> 396
        IntroCard.Layers -> 306
        IntroCard.Vouch -> 470
    }
    ScaledStage(height) {
        when (card) {
            IntroCard.Steps -> StepsStage()
            IntroCard.Shape -> ShapeStage()
            IntroCard.Public -> PublicStage()
            IntroCard.Layers -> LayersStage()
            IntroCard.Vouch -> VouchStage(inviter)
        }
    }
}

/**
 * The board's stage, multiplied by the column's width over the board's 342 so
 * every piece keeps its place: the outer box takes the scaled height in the
 * layout, the inner one stays the board's size and is scaled as one picture.
 */
@Composable
private fun ScaledStage(height: Int, content: @Composable BoxScope.() -> Unit) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val scale = maxWidth.value / STAGE_WIDTH
        Box(Modifier.fillMaxWidth().height((height * scale).dp)) {
            Box(
                modifier = Modifier
                    .wrapContentSize(Alignment.TopStart, unbounded = true)
                    .size(STAGE_WIDTH.dp, height.dp)
                    .graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                        transformOrigin = TransformOrigin(0f, 0f)
                    }
                    .dataNode(StageNode),
                content = content,
            )
        }
    }
}

// ── the stage's pieces ───────────────────────────────────────────────────

/** The one canvas under a stage's pieces, carrying every line (`IntroLines`). */
@Composable
private fun BoxScope.Lines(draw: DrawScope.(ink: Color) -> Unit) {
    val ink = MaterialTheme.colorScheme.outline
    Canvas(Modifier.matchParentSize()) { draw(ink) }
}

/** A board coordinate, in this canvas's pixels. */
private fun DrawScope.at(x: Number, y: Number): Offset = Offset(x.toFloat().dp.toPx(), y.toFloat().dp.toPx())

private fun DrawScope.line(ink: Color, from: Offset, to: Offset) =
    drawLine(ink, from, to, strokeWidth = 2.dp.toPx())

/** A cubic edge, `M a C b, c, d` in the board's path. */
private fun DrawScope.curve(ink: Color, vararg points: Pair<Number, Number>) {
    val (a, b, c, d) = points.map { at(it.first, it.second) }
    val path = Path().apply {
        moveTo(a.x, a.y)
        cubicTo(b.x, b.y, c.x, c.y, d.x, d.y)
    }
    drawPath(path, ink, style = Stroke(width = 2.dp.toPx()))
}

/** An arrowhead, the board's `polygon` of three points. */
private fun DrawScope.head(ink: Color, vararg points: Pair<Number, Number>) {
    val corners = points.map { at(it.first, it.second) }
    val path = Path().apply {
        moveTo(corners[0].x, corners[0].y)
        corners.drop(1).forEach { lineTo(it.x, it.y) }
        close()
    }
    drawPath(path, ink)
}

/** A face on the stage, centred on (x, y) — the real avatar, placed (`IntroFace`). */
@Composable
private fun Face(
    x: Int,
    y: Int,
    name: String,
    size: Int = 44,
    @DrawableRes photo: Int? = null,
    url: String? = null,
    node: DataNode? = null,
) {
    val placed = Modifier.offset((x - size / 2f).dp, (y - size / 2f).dp)
    when {
        photo != null -> FixturePhoto(photo, placed.size(size.dp).clip(CircleShape).dataNode(node))
        else -> CograAvatar(name = name, size = size.dp, modifier = placed, url = url, testTag = node?.tag)
    }
}

/** A drawn picture — the canvas's own photograph, decorative to a screen reader. */
@Composable
private fun FixturePhoto(@DrawableRes photo: Int, modifier: Modifier) {
    Image(
        painter = painterResource(photo),
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = modifier,
    )
}

/**
 * A node's caption — the word under a face, `label-small` and quiet; a handle
 * longer than the caption's width is cut at its end with "…" (`IntroCaption`).
 */
@Composable
private fun Caption(text: String, x: Int, y: Int, width: Int = 88, node: DataNode? = null) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.offset((x - width / 2f).dp, y.dp).width(width.dp).dataNode(node),
    )
}

/** An author line — face, handle, age — as `PostCard` and `CommentCard` carry it. */
@Composable
private fun AuthorLine(name: String, handle: String, age: String, @DrawableRes photo: Int? = null) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (photo != null) {
            FixturePhoto(photo, Modifier.size(24.dp).clip(CircleShape))
        } else {
            MonogramAvatar(name = name, size = 24.dp)
        }
        Text(
            text = "@$handle",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
        Text(age, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** The card's own fill, corner and hairline (`surface-card`, `radius-medium`, `border-hairline`). */
@Composable
private fun Modifier.cardLikeness(): Modifier {
    val shape = MaterialTheme.shapes.medium
    return this
        .clip(shape)
        .background(MaterialTheme.colorScheme.surfaceContainerHighest)
        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
}

// ── 1 of 5: the feed is your own steps ───────────────────────────────────

@Composable
private fun BoxScope.StepsStage() {
    Lines { ink ->
        line(ink, at(87, 44), at(143, 44))
        head(ink, 143 to 39, 153 to 44, 143 to 49)
        line(ink, at(197, 44), at(253, 44))
        head(ink, 253 to 39, 263 to 44, 253 to 49)
        curve(ink, 281 to 66, 281 to 104, 171 to 92, 171 to 118)
        head(ink, 166 to 118, 176 to 118, 171 to 128)
    }
    Face(61, 44, SOL)
    Face(171, 44, ADA, photo = R.drawable.intro_comment_camera)
    Face(281, 44, TOBIAS)
    Caption(stringResource(R.string.intro_caption_you), 61, 72)
    Caption("@ada", 171, 72)
    Caption("@tobias", 281, 72)
    // The post as a likeness: `PostCard`'s author line, title and picture.
    Column(Modifier.offset(y = 130.dp).width(STAGE_WIDTH.dp).cardLikeness()) {
        Box(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
            AuthorLine(TOBIAS, "tobias", stringResource(R.string.intro_steps_post_age))
        }
        Text(
            text = stringResource(R.string.intro_steps_post_title),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(start = 12.dp, end = 12.dp, bottom = 10.dp),
        )
        FixturePhoto(R.drawable.intro_post_photo, Modifier.fillMaxWidth().height(130.dp))
    }
}

// ── 2 of 5: your opinions have a shape ───────────────────────────────────

/** The edges' anchors, in the fan's order — `STANCE_ANCHORS`' own faces, never spelled here. */
private val INTRO_EDGES = listOf("😍" to 40, "👀" to 127, "😌" to 215, "😕" to 302)

@Composable
private fun BoxScope.ShapeStage() {
    // The pad is the pad, at the knob the first edge carries; it takes no
    // input — the cover over it answers every touch, and a screen reader
    // reads it as the drawing it is.
    Box(Modifier.offset(x = 31.dp).width(280.dp).clearAndSetSemantics { }) {
        StancePadField(
            pick = StancePoint(0.9, 0.25),
            onPick = {},
            testTag = "onboarding_pad",
        )
        Box(
            Modifier
                .matchParentSize()
                .testTag("onboarding_pad_cover")
                .pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent() } },
        )
    }
    Lines { ink ->
        INTRO_EDGES.forEach { (_, x) -> line(ink, at(171, 268), at(x, 337)) }
    }
    Face(171, 250, SOL, size = 36)
    Caption(stringResource(R.string.intro_caption_you), 171, 212)
    INTRO_EDGES.forEach { (emoji, x) -> EdgeFace(emoji, x) }
    Face(40, 352, ADA, size = 30, photo = R.drawable.intro_comment_camera)
    FixturePhoto(
        R.drawable.intro_post_photo,
        Modifier.offset(112.dp, 337.dp).size(30.dp).clip(MaterialTheme.shapes.small),
    )
    Box(
        Modifier
            .offset(200.dp, 337.dp)
            .size(30.dp)
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
            .clearAndSetSemantics { },
        contentAlignment = Alignment.Center,
    ) {
        Text("#", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    Face(302, 352, TOBIAS, size = 30)
    Caption("@ada", 40, 370, width = 80)
    Caption(stringResource(R.string.intro_caption_a_post), 127, 370, width = 80)
    Caption("#coastroad", 215, 370, width = 80)
    Caption("@tobias", 302, 370, width = 80)
}

/**
 * The glyph on its OWN edge's midpoint, masking the line it belongs to — the
 * sentiment is the edge — and spoken by its anchor's own words.
 */
@Composable
private fun EdgeFace(emoji: String, x: Int) {
    val anchor = STANCE_ANCHORS.first { it.emoji == emoji }
    val words = stringResource(anchor.label)
    Box(
        Modifier
            .offset(((171 + x) / 2f - 16).dp, 287.dp)
            .size(32.dp)
            .background(MaterialTheme.colorScheme.surface, CircleShape)
            .clearAndSetSemantics { contentDescription = words },
        contentAlignment = Alignment.Center,
    ) {
        Text(anchor.emoji, fontSize = 20.sp, lineHeight = 20.sp)
    }
}

// ── 3 of 5: everything here is public ────────────────────────────────────

@Composable
private fun BoxScope.PublicStage() {
    val quoted = stringResource(R.string.intro_public_bubble_3)
    // THE STAGE FLOWS; NOTHING IS PINNED: one column — panel, arrow spacer,
    // comment — and the bubbles one column with one 12dp gap.
    Column(Modifier.width(STAGE_WIDTH.dp)) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(MaterialTheme.shapes.large)
                .background(MaterialTheme.colorScheme.surfaceContainer)
                .padding(12.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                FixturePhoto(R.drawable.intro_comment_camera, Modifier.size(24.dp).clip(CircleShape))
                MonogramAvatar(name = TOBIAS, size = 24.dp)
                Text(
                    stringResource(R.string.intro_public_pair),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Bubble(
                    stringResource(R.string.intro_public_bubble_1),
                    maxWidth = 226,
                    theirs = true,
                    fill = MaterialTheme.colorScheme.surfaceContainerHighest,
                )
                Bubble(
                    stringResource(R.string.intro_public_bubble_2),
                    maxWidth = 236,
                    theirs = false,
                    fill = MaterialTheme.colorScheme.surfaceContainerHigh,
                )
                Bubble(
                    quoted,
                    maxWidth = 250,
                    theirs = true,
                    fill = MaterialTheme.colorScheme.primaryContainer,
                    ink = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        }
        // The arrow lives in a fixed-height spacer between the panel and the
        // comment, so its aim survives any rewrap of the bubbles above.
        Box(Modifier.fillMaxWidth().height(46.dp)) {
            Lines { ink ->
                curve(ink, 200 to 46, 200 to 30, 120 to 28, 120 to 12)
                head(ink, 115 to 12, 125 to 12, 120 to 2)
            }
        }
        Column(Modifier.fillMaxWidth().cardLikeness().padding(horizontal = 12.dp, vertical = 10.dp)) {
            AuthorLine(SOL, "sol", stringResource(R.string.intro_public_comment_age))
            Row(Modifier.padding(top = 8.dp).height(IntrinsicSize.Min)) {
                Box(Modifier.width(2.dp).fillMaxHeight().background(MaterialTheme.colorScheme.outline))
                Text(
                    quoted,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 12.dp),
                )
            }
            Text(
                stringResource(R.string.intro_public_comment),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

/** A chat bubble — an illustration, since chats are not built; [theirs] leans left. */
@Composable
private fun Bubble(text: String, maxWidth: Int, theirs: Boolean, fill: Color, ink: Color? = null) {
    val shape = if (theirs) {
        RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 4.dp)
    } else {
        RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomEnd = 4.dp, bottomStart = 16.dp)
    }
    Box(Modifier.fillMaxWidth(), contentAlignment = if (theirs) Alignment.CenterStart else Alignment.CenterEnd) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodySmall,
            color = ink ?: MaterialTheme.colorScheme.onSurface,
            textAlign = if (theirs) TextAlign.Start else TextAlign.End,
            modifier = Modifier
                .widthIn(max = maxWidth.dp)
                .clip(shape)
                .background(fill)
                .padding(horizontal = 12.dp, vertical = 8.dp),
        )
    }
}

// ── 4 of 5: nothing is lost ──────────────────────────────────────────────

@Composable
private fun BoxScope.LayersStage() {
    val small = MaterialTheme.shapes.small
    FixturePhoto(R.drawable.intro_gallery_honey, Modifier.offset(44.dp, 0.dp).size(100.dp, 76.dp).clip(small))
    FixturePhoto(R.drawable.intro_gallery_grapes, Modifier.offset(198.dp, 0.dp).size(100.dp, 76.dp).clip(small))
    Lines { ink ->
        curve(ink, 94 to 84, 94 to 102, 140 to 96, 140 to 104)
        head(ink, 135 to 104, 145 to 104, 140 to 114)
        curve(ink, 248 to 84, 248 to 102, 202 to 96, 202 to 104)
        head(ink, 197 to 104, 207 to 104, 202 to 114)
    }
    // The stack behind the card is the history: two plates above its edge.
    Plate(x = 28, y = 120, width = 286, fill = MaterialTheme.colorScheme.surfaceContainer)
    Plate(x = 14, y = 130, width = 314, fill = MaterialTheme.colorScheme.surfaceContainerHigh)
    Column(Modifier.offset(y = 140.dp).width(STAGE_WIDTH.dp).cardLikeness()) {
        Box(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
            AuthorLine(MIRA, "mira", stringResource(R.string.intro_layers_post_age), photo = R.drawable.intro_inviter)
        }
        Text(
            text = stringResource(R.string.intro_layers_post_title),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(start = 12.dp, end = 12.dp, bottom = 10.dp),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            listOf(R.drawable.intro_gallery_market, R.drawable.intro_gallery_honey, R.drawable.intro_gallery_grapes)
                .forEach { FixturePhoto(it, Modifier.weight(1f).height(88.dp)) }
        }
    }
}

@Composable
private fun Plate(x: Int, y: Int, width: Int, fill: Color) {
    val shape = MaterialTheme.shapes.medium
    Box(
        Modifier
            .offset(x.dp, y.dp)
            .size(width.dp, 40.dp)
            .clip(shape)
            .background(fill)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape),
    )
}

// ── 5 of 5: someone brings you in ────────────────────────────────────────

/** The graph above the inviter, hand-placed as the board places it. */
private val MEMBERS: Map<String, Pair<Int, Int>> = mapOf(
    "l1" to (132 to 246),
    "l2" to (206 to 232),
    "m1" to (72 to 186),
    "m2" to (152 to 168),
    "m3" to (234 to 176),
    "m4" to (296 to 146),
    "u1" to (36 to 108),
    "u2" to (112 to 76),
    "u3" to (192 to 98),
    "u4" to (258 to 58),
    "t1" to (148 to 20),
    "t2" to (306 to 30),
)

/** Ten edges branch upward and six cross between branches. */
private val MESH = listOf(
    "l1" to "l2", "l1" to "m1", "l1" to "m2", "l2" to "m3", "l2" to "m4", "m1" to "u1", "m1" to "u2",
    "m2" to "u2", "m2" to "u3", "m2" to "m3", "m3" to "u3", "m3" to "u4", "m4" to "u4", "u2" to "t1",
    "u3" to "t1", "u4" to "t2",
)

/** An edge that leaves the card: where it starts, where it dies, and whether a far dot stands there. */
private data class Loose(val from: String, val toX: Int, val toY: Int, val far: Boolean = false)

private val LOOSE = listOf(
    Loose("u1", -28, 78, far = true),
    Loose("u1", -20, 160),
    Loose("m1", -24, 234),
    Loose("l1", 40, 298),
    Loose("t1", 126, -36, far = true),
    Loose("u2", 84, -28),
    Loose("u4", 280, -34),
    Loose("t2", 350, -14, far = true),
    Loose("m4", 372, 108, far = true),
    Loose("m4", 364, 186),
    Loose("l2", 304, 274),
)

/** The two edges that make the inviter the gate. */
private val GATE = listOf("l1", "l2")
private const val INVITER_X = 171
private const val INVITER_Y = 324

@Composable
private fun BoxScope.VouchStage(inviter: ActorRef?) {
    val dot = MaterialTheme.colorScheme.secondaryContainer
    val stage = StageNode
    Lines { ink ->
        fun member(id: String): Offset = MEMBERS.getValue(id).let { at(it.first, it.second) }
        // The edges that leave, under everything else: each fades along its
        // own direction to nothing (the board's per-edge gradient).
        LOOSE.forEach { edge ->
            val start = member(edge.from)
            val end = at(edge.toX, edge.toY)
            val fade = Brush.linearGradient(
                0f to ink,
                0.5f to ink.copy(alpha = 0.45f),
                1f to ink.copy(alpha = 0f),
                start = start,
                end = end,
            )
            drawLine(fade, start, end, strokeWidth = 2.dp.toPx())
        }
        LOOSE.filter { it.far }.forEach { drawCircle(dot.copy(alpha = 0.4f), 7.dp.toPx(), at(it.toX, it.toY)) }
        MESH.forEach { (from, to) -> line(ink, member(from), member(to)) }
        if (inviter != null) {
            GATE.forEach { line(ink, at(INVITER_X, INVITER_Y), member(it)) }
            // Hers to you: the one edge that is not solid yet.
            val dash = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 5.dp.toPx()))
            drawLine(ink, at(171, 360), at(171, 398), strokeWidth = 2.dp.toPx(), pathEffect = dash)
            head(ink, 165 to 398, 177 to 398, 171 to 406)
        }
    }
    MEMBERS.values.forEach { (x, y) ->
        Box(Modifier.offset((x - 10).dp, (y - 10).dp).size(20.dp).background(dot, CircleShape))
    }
    // The inviter's face is the ACTUAL link-issuer's avatar, their monogram
    // where they have no photo (OnboardingVouch.md:7). With no inviter on
    // the account there is no face to draw (as built).
    if (inviter != null) {
        Face(
            INVITER_X,
            INVITER_Y,
            name = inviter.displayName ?: inviter.handle,
            size = 64,
            url = inviter.avatar?.url,
            node = stage / "inviter",
        )
        Caption("@${inviter.handle}", 252, 316, node = stage / "inviterCaption")
    }
    Box(
        Modifier
            .offset(143.dp, 406.dp)
            .size(56.dp)
            .dataNode(stage / "youRing"),
    ) {
        Lines { ink ->
            val dash = PathEffect.dashPathEffect(floatArrayOf(3.dp.toPx(), 3.dp.toPx()))
            drawCircle(
                ink,
                radius = size.minDimension / 2 - 0.5.dp.toPx(),
                style = Stroke(width = 1.dp.toPx(), pathEffect = dash),
            )
        }
    }
    Box(
        Modifier
            .offset(159.dp, 422.dp)
            .size(24.dp)
            .background(MaterialTheme.colorScheme.primary, CircleShape)
            .dataNode(stage / "you"),
    )
    Caption(stringResource(R.string.intro_caption_you), 252, 426, node = stage / "youCaption")
}
