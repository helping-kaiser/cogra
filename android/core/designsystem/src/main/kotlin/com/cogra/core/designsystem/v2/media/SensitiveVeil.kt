package com.cogra.core.designsystem.v2.media

import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.R
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews
import com.cogra.core.designsystem.v2.token.Veil

/**
 * The sensitive veil, over **the post's whole body as one state**.
 *
 * D12 (jakob, 2026-08-28) rules the granularity: media, text and description
 * blur together as a unit and the title stays outside, so a screen wraps its
 * body region in this and leaves the title above it. That reverses the older
 * per-attachment rule in design/readme.md §9/§12, which lane E rewrites.
 *
 * **The content stays mounted and keeps its exact space** (design/readme.md
 * §9), so revealing moves nothing on screen — which is also why text is
 * blurred in place rather than replaced.
 *
 * **No `error` colouring and no warning glyph** — a neutral wash of the
 * theme's own `scrim` and a plain `visibility` chip. Sensitive is not a
 * failure.
 *
 * Two things are deliberate and worth not "fixing":
 *
 * 1. **Below API 31 the body is covered opaquely instead of blurred.**
 *    `Modifier.blur` is a documented no-op before Android 12, and this app's
 *    `minSdk` is 26 — so a blur-only veil would silently publish exactly the
 *    content the reader asked not to see on a quarter of the supported range.
 *    Less pretty, never leaky.
 * 2. **The veiled body is removed from the accessibility tree.** Blurring
 *    pixels does nothing for a screen reader, so the veil replaces the
 *    subtree's semantics with its own description and its reveal action.
 *
 * The veil never grows what it covers — that is what makes revealing move
 * nothing — so its chrome is bounded by the body's own size. It is sized for
 * a post's body region, which always carries media or several lines of text;
 * wrapping a single line would clip the chrome rather than expand it.
 *
 * **A clip under the veil is out of its stage's rotation** (jakob 2026-09-24,
 * backlog item 103, `design/readme.md` "The feed-video rulings": "the
 * sensitive veil covers its clip the same way" a sheet covers a surface). The
 * veil says so to everything it covers through [LocalStageVeil], and the
 * content keeps ONE slot in the composition whether veiled or not — which is
 * what "stays mounted" means — so a clip is the same clip on both sides of
 * the reveal: the stage sees its veil lift and re-elects, as after a sheet's
 * dismissal ([StageElection]).
 *
 * @param reason the author's optional stated reason, shown on the veil when
 *   they self-marked the post (design/readme.md §13).
 */
@Composable
fun SensitiveVeil(
    veiled: Boolean,
    onReveal: () -> Unit,
    modifier: Modifier = Modifier,
    reason: String? = null,
    revealLabel: String = "Show",
    veilText: String = "Marked sensitive",
    testTag: String? = null,
    content: @Composable () -> Unit,
) {
    val canBlur = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    val description = buildString {
        append(veilText)
        if (reason != null) append(". ").append(reason)
    }

    Box(
        modifier = modifier
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
    ) {
        Box(
            modifier = if (veiled) {
                Modifier
                    .then(if (canBlur) Modifier.blur(Veil.BlurRadius) else Modifier)
                    // Pixels are hidden; the tree must be too.
                    .clearAndSetSemantics { contentDescription = description }
            } else {
                Modifier
            },
        ) {
            CompositionLocalProvider(LocalStageVeil provides rememberStageVeil(veiled), content = content)
        }

        if (veiled) {
            VeilFace(
                canBlur = canBlur,
                veilText = veilText,
                reason = reason,
                revealLabel = revealLabel,
                onReveal = onReveal,
                testTag = testTag,
            )
        }
    }
}

/** The wash and its chrome over a veiled body: the glyph, the words, the reason and the reveal. */
@Composable
private fun BoxScope.VeilFace(
    canBlur: Boolean,
    veilText: String,
    reason: String?,
    revealLabel: String,
    onReveal: () -> Unit,
    testTag: String?,
) {
    Box(
        modifier = Modifier
            .matchParentSize()
            .background(
                MaterialTheme.colorScheme.scrim.copy(
                    alpha = if (canBlur) Veil.ScrimAlpha else Veil.OpaqueFallbackAlpha,
                ),
            )
            // THE WASH IS THE ONLY DOOR THROUGH THE VEIL
            // (design/components/honesty/SensitiveVeil.jsx: the reveal is a
            // full-tile button, and its handler's own comment reads "The
            // veil is a decision, not a route: it must not also open the
            // post it sits in"). Without pointer input of its own, the wash
            // is invisible to Compose's hit test and a tap on it falls
            // through to the still-composed body underneath — this is that
            // pointer input, tapping anywhere on the wash reveals. Raw
            // pointerInput rather than clickable: it must not add a second
            // accessible control next to the reveal button below, and
            // `awaitFirstDown(requireUnconsumed = true)` — detectTapGestures'
            // default — already skips a down the button itself consumed, so
            // the button's own click still fires once, not twice.
            .pointerInput(onReveal) { detectTapGestures(onTap = { onReveal() }) },
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Space.x2),
            modifier = Modifier.padding(Space.x4),
        ) {
            Icon(
                imageVector = Icons.Filled.Visibility,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.inverseOnSurface,
            )
            Text(
                text = veilText,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.inverseOnSurface,
            )
            if (reason != null) {
                Text(
                    text = reason,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.inverseOnSurface,
                )
            }
            CograButton(
                text = revealLabel,
                onClick = onReveal,
                kind = ButtonKind.Outlined,
                size = ButtonSize.Compact,
                testTag = testTag?.let { "${it}_reveal" } ?: "veil_reveal",
            )
        }
    }
}

/**
 * Whose mark a veil carries.
 *
 * The author's own warning and the platform's verdict are two
 * independent states that read back as **the same veil**, so the face
 * has to say which one a reader met — a reason alone cannot, since a
 * verdict may carry one too and an author may leave theirs empty. That
 * is why the source line is unconditional: an unnamed source would read
 * as the other one (design/components/honesty/SensitiveVeil.jsx).
 */
enum class SensitiveSource { Author, Platform }

/**
 * THE COMMENT-SCALE VEIL: the whole body **replaced** by one block.
 *
 * A comment is words first and its pictures join them, so its body is
 * short and its pictures are an inset attachment — covering that in
 * place would put a wash the height of two lines over one thing and a
 * second wash over the other. Words and pictures go under one block
 * instead, at the scale of the card it sits in.
 *
 * What stays outside it is the comment's answer to a post's title
 * staying readable: the author, the timestamp, the topics, and the
 * stance a reader can still take — so choosing to look is informed.
 *
 * The wash is the veil's own, but **the type is the theme's** rather
 * than the media face's fixed white: that white is legible because the
 * wash lies over a picture, and here it lies over the card.
 *
 * The whole block is the reveal — one target, not a button inside a
 * panel — and the label and the source line are announced as one thing.
 *
 * **A replaced clip is off its stage outright** — nothing of the body is
 * composed under the block — and the reveal brings it onto the stage already
 * lifted ([LocalStageVeil]), so the stage re-elects exactly as for the
 * post's veil (jakob 2026-09-24, backlog item 103).
 */
@Composable
fun SensitiveVeilCompact(
    veiled: Boolean,
    onReveal: () -> Unit,
    modifier: Modifier = Modifier,
    source: SensitiveSource = SensitiveSource.Author,
    reason: String? = null,
    testTag: String? = null,
    content: @Composable () -> Unit,
) {
    val stageVeil = rememberStageVeil(veiled)
    if (!veiled) {
        Box(modifier.then(if (testTag != null) Modifier.testTag(testTag) else Modifier)) {
            CompositionLocalProvider(LocalStageVeil provides stageVeil, content = content)
        }
        return
    }

    val label = stringResource(R.string.sensitive_veil_label)
    val sourceLine = sensitiveSourceLine(source, reason)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.scrim.copy(alpha = Veil.ScrimAlpha))
            .clickable(
                role = Role.Button,
                onClickLabel = label,
                onClick = onReveal,
            )
            // One target: the label and the source line are read as one.
            .semantics(mergeDescendants = true) {
                contentDescription = "$label. $sourceLine"
            }
            .padding(Space.x3)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        verticalArrangement = Arrangement.spacedBy(Space.x1),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            Icon(
                imageVector = Icons.Filled.Visibility,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.size(COMPACT_GLYPH),
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
        Text(
            text = sourceLine,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}

/**
 * The source, and the reason after it where the author gave one — the
 * board's one line, built one way so the faces cannot word it
 * differently.
 */
@Composable
fun sensitiveSourceLine(source: SensitiveSource, reason: String?): String {
    val named = stringResource(
        when (source) {
            SensitiveSource.Author -> R.string.sensitive_source_author
            SensitiveSource.Platform -> R.string.sensitive_source_platform
        },
    )
    val given = reason?.takeIf { it.isNotBlank() } ?: return named
    return stringResource(R.string.sensitive_source_with_reason, named, given)
}

/** `Icon name="visibility" size={18}` on the compact face. */
private val COMPACT_GLYPH = 18.dp

/** A post body — media plus its description — for the veil's previews. */
@Composable
private fun VeilBodySample() {
    Column(verticalArrangement = Arrangement.spacedBy(Space.x2)) {
        MediaGallery(listOf(MediaItem(null, 1.91f, "A wide frame")))
        Text(
            "Rubbings from three weekends at low tide.",
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@ThemePreviews
@Composable
private fun SensitiveVeilStates() {
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            SensitiveVeil(veiled = true, onReveal = {}) { VeilBodySample() }
            SensitiveVeil(
                veiled = true,
                onReveal = {},
                reason = "Shows an injury",
            ) { VeilBodySample() }
            SensitiveVeil(veiled = false, onReveal = {}) { VeilBodySample() }
            Box(Modifier.fillMaxSize())
        }
    }
}
