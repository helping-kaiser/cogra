// The shell's bottom bar (design.md §6): five slots left to right —
// feed, search, create post, wallet, profile — each arriving with the
// slice that builds its surface; this slice ships feed, the compose
// action, and profile. The center slot is an action, not a
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
import androidx.compose.material.icons.outlined.DynamicFeed
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ShortNavigationBar
import androidx.compose.material3.ShortNavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.cogra.app.R

@Composable
fun CograBottomBar(
    feedSelected: Boolean,
    profileSelected: Boolean,
    onFeed: () -> Unit,
    onCompose: () -> Unit,
    onProfile: () -> Unit,
) {
    ShortNavigationBar(modifier = Modifier.testTag("bottom_bar")) {
        ShortNavigationBarItem(
            selected = feedSelected,
            onClick = onFeed,
            icon = {
                Icon(
                    if (feedSelected) Icons.Filled.DynamicFeed else Icons.Outlined.DynamicFeed,
                    contentDescription = null,
                )
            },
            label = { Text(stringResource(R.string.bar_feed)) },
            modifier = Modifier.testTag("bar_feed"),
        )
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
            modifier = Modifier.testTag("bar_compose"),
        )
        ShortNavigationBarItem(
            selected = profileSelected,
            onClick = onProfile,
            icon = {
                Icon(
                    if (profileSelected) Icons.Filled.Person else Icons.Outlined.Person,
                    contentDescription = null,
                )
            },
            label = { Text(stringResource(R.string.bar_profile)) },
            modifier = Modifier.testTag("bar_profile"),
        )
    }
}
