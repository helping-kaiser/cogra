package com.cogra.core.designsystem.v2.media

import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
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
    if (!veiled) {
        Box(modifier.then(if (testTag != null) Modifier.testTag(testTag) else Modifier)) {
            content()
        }
        return
    }

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
            modifier = Modifier
                .then(if (canBlur) Modifier.blur(Veil.BlurRadius) else Modifier)
                // Pixels are hidden; the tree must be too.
                .clearAndSetSemantics { contentDescription = description },
        ) {
            content()
        }

        Box(
            modifier = Modifier
                .matchParentSize()
                .background(
                    MaterialTheme.colorScheme.scrim.copy(
                        alpha = if (canBlur) Veil.ScrimAlpha else Veil.OpaqueFallbackAlpha,
                    ),
                ),
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
}

@ThemePreviews
@Composable
private fun SensitiveVeilStates() {
    val body = @Composable {
        Column(verticalArrangement = Arrangement.spacedBy(Space.x2)) {
            MediaGallery(listOf(MediaItem(null, 1.91f, "A wide frame")))
            Text(
                "Rubbings from three weekends at low tide.",
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
    Cogra2PreviewTheme {
        PreviewMediaColumn {
            SensitiveVeil(veiled = true, onReveal = {}) { body() }
            SensitiveVeil(
                veiled = true,
                onReveal = {},
                reason = "Shows an injury",
            ) { body() }
            SensitiveVeil(veiled = false, onReveal = {}) { body() }
            Box(Modifier.fillMaxSize())
        }
    }
}
