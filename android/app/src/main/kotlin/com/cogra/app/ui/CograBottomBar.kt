// The shell's bottom bar (design.md §6): five slots left to right —
// feed, search, create post, wallet, profile — all five in V1.0, the
// wallet's opening its coming-soon door (BottomNav.jsx). The center slot is an action, not a
// destination — a deliberate, documented deviation from M3's
// destinations-only navigation-bar guidance — and wears
// primaryContainer, the one loud surface per screen (design.md §2.4).
// The short navigation bar (64dp) is the compact M3 default — the
// classic 80dp NavigationBar reads oversized next to the bars popular
// apps carry (design.md §6).

package com.cogra.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DynamicFeed
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PersonOutline
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Wallet
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationItemColors
import androidx.compose.material3.ShortNavigationBar
import androidx.compose.material3.ShortNavigationBarItem
import androidx.compose.material3.ShortNavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cogra.app.R
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.dataNodeSurface

@Composable
fun CograBottomBar(
    feedSelected: Boolean,
    profileSelected: Boolean,
    onFeed: () -> Unit,
    onCompose: () -> Unit,
    onProfile: () -> Unit,
    modifier: Modifier = Modifier,
    slots: List<NavSlot> = NavSlot.entries,
    onSearch: () -> Unit = {},
    onWallet: () -> Unit = {},
    searchSelected: Boolean = false,
    walletSelected: Boolean = false,
    /**
     * The bar's data-node under a registered screen (`feed.bottomBar`): the
     * bar and its slots then wear the registered paths in place of their
     * shell tags, and expose them to the conformance harness.
     */
    node: DataNode? = null,
) {
    // The hairline the master draws on top of the bar
    // (`BottomNav.jsx:72`, `design.md` §4): M3's navigation bars carry no
    // divider of their own, and the web client draws it, so without this the
    // two platforms disagree about where the page ends.
    val hairline = MaterialTheme.colorScheme.outlineVariant
    ShortNavigationBar(
        modifier = modifier
            .drawBehind {
                drawLine(
                    color = hairline,
                    start = Offset(0f, 0f),
                    end = Offset(size.width, 0f),
                    strokeWidth = 1.dp.toPx(),
                )
            }
            .then(if (node != null) Modifier.dataNodeSurface() else Modifier)
            .testTag(node?.tag ?: "bottom_bar"),
    ) {
        slots.forEach { slot ->
            when (slot) {
                NavSlot.Feed -> DestinationSlot(
                    slot = slot,
                    selected = feedSelected,
                    onClick = onFeed,
                    glyph = Icons.Filled.DynamicFeed,
                    testTag = node?.div("feedSlot")?.tag ?: "bar_feed",
                )
                NavSlot.Search -> DestinationSlot(
                    slot = slot,
                    selected = searchSelected,
                    onClick = onSearch,
                    glyph = Icons.Filled.Search,
                    testTag = node?.div("searchSlot")?.tag ?: "bar_explore",
                )
                NavSlot.Compose -> ComposeSlot(onCompose, node?.div("composeSlot")?.tag ?: "bar_compose")
                NavSlot.Wallet -> DestinationSlot(
                    slot = slot,
                    selected = walletSelected,
                    onClick = onWallet,
                    glyph = Icons.Filled.Wallet,
                    testTag = node?.div("walletSlot")?.tag ?: "bar_wallet",
                )
                NavSlot.Profile -> DestinationSlot(
                    slot = slot,
                    selected = profileSelected,
                    onClick = onProfile,
                    glyph = Icons.Filled.PersonOutline,
                    selectedGlyph = Icons.Filled.Person,
                    testTag = node?.div("profileSlot")?.tag ?: "bar_profile",
                )
            }
        }
    }
}

/**
 * A destination slot. Selection shows in COLOUR — `onSurfaceVariant` to
 * `onSurface` — and, on the profile's slot alone, in the filled cut; never
 * an indicator pill (`BottomNav.jsx`, `Icon.jsx`: every other glyph keeps
 * the one filled cut whatever its state). The colour is never alone,
 * because `ShortNavigationBarItem` announces the selection too.
 */
@Composable
private fun DestinationSlot(
    slot: NavSlot,
    selected: Boolean,
    onClick: () -> Unit,
    glyph: ImageVector,
    testTag: String,
    selectedGlyph: ImageVector = glyph,
) {
    ShortNavigationBarItem(
        selected = selected,
        onClick = onClick,
        icon = { Icon(if (selected) selectedGlyph else glyph, contentDescription = null) },
        label = { Text(stringResource(slot.label)) },
        modifier = Modifier.testTag(testTag),
        colors = barItemColors(),
    )
}

/**
 * The slots' colours by the master (`BottomNav.jsx`: `tone(selected)`):
 * M3's defaults would tint a selected slot `secondary` over a
 * `secondaryContainer` indicator pill, and the bar draws neither.
 */
@Composable
internal fun barItemColors(): NavigationItemColors = ShortNavigationBarItemDefaults.colors(
    selectedIconColor = MaterialTheme.colorScheme.onSurface,
    selectedTextColor = MaterialTheme.colorScheme.onSurface,
    selectedIndicatorColor = Color.Transparent,
    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
)

/** The centre slot: the compose ACTION, wearing the one loud surface. */
@Composable
private fun ComposeSlot(onCompose: () -> Unit, testTag: String) {
    ShortNavigationBarItem(
        selected = false,
        onClick = onCompose,
        icon = {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
            ) {
                Icon(
                    Icons.Filled.Add,
                    contentDescription = stringResource(R.string.bar_compose),
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        },
        // The compose action is icon-only: the badge is its label.
        label = null,
        modifier = Modifier.testTag(testTag),
    )
}
