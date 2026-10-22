package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.R
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews
import com.cogra.core.designsystem.v2.token.TypeTokens

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
 * affordance built in. `onChats = null` opts a band out where messaging
 * cannot apply.
 *
 * **The bell keeps the corner** (CograBand.jsx; FeedUnread.md): the cluster
 * reads the screen's own control, then chats, then the bell (Profile.md:3;
 * ChatsComingSoon.md:3). A guest has no list, so a guest's band passes no
 * [bell].
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
    bell: BandBell? = null,
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
            trailing?.invoke(this)
            if (onChats != null) {
                CograBandChats(onChats, chatsContentDescription, testTag)
            }
            bell?.let { CograBandBell(it, testTag) }
        }
        content()
    }
}

/** The bell's state as a root passes it: lit only on a fresh root load (FeedUnread.md). */
data class BandBell(val lit: Boolean, val onOpen: () -> Unit)

/**
 * The bell (`BandIcon` with `dot`): right-most on every signed-in root band,
 * a dot and never a count — `--primary` at 8dp, ringed in the surface — and
 * it is the button's name that says the dot is lit
 * (FeedUnread.md:11, :13, :15).
 *
 * @param node the band's data-node on a registered screen; the control wears
 *   its `bell` part and the dot `bell.dot`.
 */
@Composable
fun CograBandBell(bell: BandBell, testTag: String? = null, node: DataNode? = null) {
    val name = stringResource(if (bell.lit) R.string.cogra_band_bell_lit else R.string.cogra_band_bell)
    val tag = node?.div("bell")?.tag ?: testTag?.let { "${it}_bell" } ?: "cogra_band_bell"
    BandIconButton(onClick = bell.onOpen, testTag = tag, description = name) {
        Box {
            Icon(
                imageVector = Icons.Filled.Notifications,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(22.dp),
            )
            if (bell.lit) {
                Box(
                    Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = 2.dp, y = (-1).dp)
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surface)
                        .padding(2.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary)
                        .testTag(node?.div("bell")?.div("dot")?.tag ?: "${tag}_dot"),
                )
            }
        }
    }
}

/**
 * The mark and the wordmark — the band's whole left side.
 *
 * @param node the band's data-node on a registered screen (`feed.band`):
 *   the mark and the wordmark then wear its `mark` and `wordmark` parts.
 */
@Composable
fun CograBandIdentity(modifier: Modifier = Modifier, testTag: String? = null, node: DataNode? = null) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
    ) {
        CograMark(modifier = Modifier.dataNode(node?.div("mark")), size = 24.dp)
        Text(
            text = WORDMARK,
            style = MaterialTheme.typography.titleLarge,
            // The one weight the wordmark takes that the type ramp's title
            // rung does not: the mark's own drawing (§6).
            fontWeight = TypeTokens.WordmarkWeight,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.testTag(
                node?.div("wordmark")?.tag ?: testTag?.let { "${it}_wordmark" } ?: "cogra_band_wordmark",
            ),
        )
    }
}

/**
 * The chats affordance, left of whatever the screen puts in the corner.
 *
 * @param node the band's data-node on a registered screen; the control wears
 *   its `chats` part.
 */
@Composable
fun CograBandChats(
    onChats: () -> Unit,
    contentDescription: String = stringResource(R.string.cogra_band_chats),
    testTag: String? = null,
    node: DataNode? = null,
) {
    BandIconButton(
        onClick = onChats,
        testTag = node?.div("chats")?.tag ?: testTag?.let { "${it}_chats" } ?: "cogra_band_chats",
        description = contentDescription,
    ) {
        Icon(
            imageVector = Icons.Filled.Forum,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(22.dp),
        )
    }
}

/**
 * A screen's own control on the band's working edge (`BandIcon`) — the
 * profile's gear (`ProfileBand`): 40dp of ink, answering at 48.
 */
@Composable
fun CograBandIcon(icon: ImageVector, description: String, onClick: () -> Unit, testTag: String) {
    BandIconButton(onClick = onClick, testTag = testTag, description = description) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(22.dp),
        )
    }
}

/**
 * THE BAND'S ONE ICON-CONTROL SHAPE (`CograBand.jsx` `BandIcon`): 40dp of ink,
 * no background, and the full 48dp target around it ([hitTarget]) — 48dp of
 * DRAWN box is what crowded the band, so only the box shrank, never the
 * target. Its name rides the target.
 */
@Composable
private fun BandIconButton(
    onClick: () -> Unit,
    testTag: String,
    description: String,
    content: @Composable () -> Unit,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .testTag(testTag)
            .hitTarget(
                interactive = Modifier
                    .clip(CircleShape)
                    .clickable(role = Role.Button, onClick = onClick)
                    .semantics { contentDescription = description },
                drawnWidth = BAND_ICON,
                drawnHeight = BAND_ICON,
            )
            .size(BAND_ICON),
    ) {
        content()
    }
}

/** `BandIcon`'s drawn box. */
private val BAND_ICON = 40.dp

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
                bell = BandBell(lit = true, onOpen = {}),
            )
        }
    }
}
