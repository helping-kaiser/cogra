package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.R
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * The read shell's top-left identity
 * (`design/components/navigation/CograBand.jsx`): the mark and the wordmark on
 * a 48dp band. **Every tab root wears it** — a tab root carries no back arrow,
 * so [PageHeader] is the inner surfaces' header and this is the roots'.
 *
 * It carries no screen title. A tab root's name is the bar slot the reader
 * tapped to get here; spending the band on repeating it is what the mark is
 * for instead.
 *
 * **The right side works** (ruled 2026-08-28): a full-width band spent on
 * identity alone is wasted space, so [trailing] puts the tab's one working
 * control — the feed's filter trigger, the profile's gear — on the band's
 * right edge.
 *
 * **Chats ride the band** (jakob 2026-09-01): messaging must be reachable
 * from any major screen, so every tab root's band carries the chats
 * affordance built in. It sits LEFT of the screen's own trailing control, so
 * the ruled corner occupants keep their edge. `onChats = null` opts a band
 * out where messaging cannot apply.
 *
 * [content] rides below the band inside the same block. A surface whose top
 * region collapses hosts the two pieces itself — [CograBandIdentity] in the
 * bar it already has, [CograBandChats] as that bar's action — rather than
 * nesting the whole block inside one gate: collapsing the band and the cards
 * below it in a single step re-clamps the list underneath, and the leftover
 * scroll that produces reads to the collapse gate as "back at the top".
 */
@Composable
fun CograBand(
    modifier: Modifier = Modifier,
    onChats: (() -> Unit)? = null,
    chatsContentDescription: String = stringResource(R.string.cogra_band_chats),
    trailing: @Composable (RowScope.() -> Unit)? = null,
    testTag: String? = null,
    content: @Composable ColumnScope.() -> Unit = {},
) {
    Column(modifier = modifier.then(if (testTag != null) Modifier.testTag(testTag) else Modifier)) {
        Row(
            modifier = Modifier
                .defaultMinSize(minHeight = Layout.TopBarHeight)
                .padding(horizontal = Space.x4),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            CograBandIdentity(Modifier.weight(1f), testTag)
            if (onChats != null) {
                CograBandChats(onChats, chatsContentDescription, testTag)
            }
            trailing?.invoke(this)
        }
        content()
    }
}

/** The mark and the wordmark — the band's whole left side. */
@Composable
fun CograBandIdentity(modifier: Modifier = Modifier, testTag: String? = null) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        CograMark(size = 24.dp)
        Text(
            text = WORDMARK,
            style = MaterialTheme.typography.titleLarge,
            // The one weight the wordmark takes that the type ramp's title
            // rung does not: the mark's own drawing (§6).
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.testTag(
                testTag?.let { "${it}_wordmark" } ?: "cogra_band_wordmark",
            ),
        )
    }
}

/** The chats affordance, left of whatever the screen puts in the corner. */
@Composable
fun CograBandChats(
    onChats: () -> Unit,
    contentDescription: String = stringResource(R.string.cogra_band_chats),
    testTag: String? = null,
) {
    IconButton(
        onClick = onChats,
        modifier = Modifier
            .size(Layout.TouchTargetMin)
            .testTag(testTag?.let { "${it}_chats" } ?: "cogra_band_chats"),
    ) {
        Icon(
            imageVector = Icons.Filled.Forum,
            contentDescription = contentDescription,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(22.dp),
        )
    }
}

/** Lower case, always: the wordmark is a drawing, not a sentence (§6). */
private const val WORDMARK = "cogra"

@ThemePreviews
@Composable
private fun CograBandVariants() {
    Cogra2PreviewTheme {
        PreviewColumn(canvasWidth = true) {
            CograBand(onChats = {})
            CograBand(
                onChats = {},
                trailing = { InlineAction("Newest", {}) },
            )
        }
    }
}
