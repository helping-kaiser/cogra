package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The house page header — one pattern for every inner surface
 * (`design/components/navigation/PageHeader.jsx`): a back arrow, the page
 * title, and an optional trailing action. Tab roots carry no back arrow and
 * wear `CograBand` instead; this is what the surfaces *inside* a tab open
 * with.
 *
 * **The header owns its band**: 48dp tall, 12dp of its own side padding, and
 * a 48dp square back target. The master records why the target is square and
 * unshifted — a 24dp glyph grown to 44dp with negative margins was both under
 * the minimum and a bet on the caller providing 24dp of gutter, and inside a
 * frame with none the target bled outside the surface and was clipped. 12dp
 * of padding plus a centred glyph in a 48dp target puts the arrow exactly on
 * the 24dp screen gutter without depending on anyone.
 *
 * The title is `titleLarge` — every board's band title, and M3's own
 * top-app-bar spec (`design/readme.md` §13, 2026-09-09). It never wraps: a
 * two-line header steals the content's first row.
 *
 * The back glyph is `automirrored` so a right-to-left locale gets the arrow
 * pointing the way that locale reads.
 *
 * This is a plain `Row` rather than M3's `TopAppBar` because the band is
 * 48dp and the small top app bar's container is 64dp; the bar's other
 * behaviour — the scrolled tint — is refused by `surfaceTopAppBarColors`
 * everywhere it is used anyway.
 */
@Composable
fun PageHeader(
    title: String? = null,
    modifier: Modifier = Modifier,
    onBack: (() -> Unit)? = null,
    backContentDescription: String? = null,
    action: @Composable (() -> Unit)? = null,
    testTag: String? = null,
) {
    Row(
        modifier = modifier
            .defaultMinSize(minHeight = Layout.TopBarHeight)
            .padding(horizontal = Layout.TopBarPadding)
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        if (onBack != null) {
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .size(Layout.TouchTargetMin)
                    .testTag(testTag?.let { "${it}_back" } ?: "page_header_back"),
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    // An icon never carries meaning alone (design/readme.md
                    // §5): the label lives in the accessibility tree.
                    contentDescription = backContentDescription,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // One filling weight does both jobs the board's `space-between` does:
        // the title draws at the start of the space it is given, and the
        // trailing action is pushed flush right whatever the title's length.
        Text(
            text = title.orEmpty(),
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = Space.x1)
                .testTag(testTag?.let { "${it}_title" } ?: "page_header_title"),
        )

        action?.invoke()
    }
}

@ThemePreviews
@Composable
private fun PageHeaderVariants() {
    Cogra2PreviewTheme {
        PreviewColumn(canvasWidth = true) {
            PageHeader(title = "Join", onBack = {}, backContentDescription = "Back")
            PageHeader(title = "Sign in", onBack = {}, backContentDescription = "Back")
            PageHeader(
                title = "Your key",
                onBack = {},
                backContentDescription = "Back",
                action = { InlineAction("What this means", {}) },
            )
        }
    }
}
