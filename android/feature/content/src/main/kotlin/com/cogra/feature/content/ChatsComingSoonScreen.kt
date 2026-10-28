package com.cogra.feature.content

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.core.designsystem.v2.atom.EmptyState
import com.cogra.core.designsystem.v2.token.Layout

/**
 * Chats — coming soon (backlog item 68, ruled 2026-09-14: chats moved down
 * the release order, but the band law did not move with it, so the chats
 * affordance stays on every root and this is what it opens).
 *
 * The board (`design/designs/canonical/screens/ChatsComingSoon.jsx`): a
 * page header reading "Chats", the empty-state idiom carrying the blessed
 * line (`design/guidelines/copy-voice.md` "The coming-soon surfaces"), and
 * no action — nothing fills this one, not yet anything at all. A door that
 * says what is behind it is not a dead end; the alternative is a tap that
 * does nothing, which reads as a broken build.
 */
@Composable
fun ChatsComingSoonRoute(from: String, onBack: () -> Unit) {
    ChatsComingSoonScreen(from = from, onBack = onBack)
}

/** The `from` the band's chats icon on the feed opens the page with (`Back to feed`). */
const val CHATS_FROM_FEED = "feed"

/** ...on the reader's own profile (`Back to your profile`). */
const val CHATS_FROM_OWN_PROFILE = "profile"

/** ...and a profile's Message (`Back to the profile`). */
const val CHATS_FROM_MESSAGE = "message"

/** ...on Explore's band (`Back to Explore`). */
const val CHATS_FROM_EXPLORE = "explore"

/** ...on the Wallet tab's band (`Back to Wallet`). */
const val CHATS_FROM_WALLET = "wallet"

/**
 * THE ARROW NAMES WHERE IT GOES (ChatsComingSoon.md:15-17): the root the band's
 * chats icon was tapped on, or the profile whose Message opened the page.
 */
@Composable
private fun chatsBackLabel(from: String): String = stringResource(
    when (from) {
        CHATS_FROM_OWN_PROFILE -> R.string.content_chats_back_own_profile
        CHATS_FROM_MESSAGE -> R.string.content_chats_back_profile
        CHATS_FROM_EXPLORE -> R.string.content_chats_back_explore
        CHATS_FROM_WALLET -> R.string.content_chats_back_wallet
        else -> R.string.content_chats_back_feed
    },
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatsComingSoonScreen(onBack: () -> Unit, from: String = CHATS_FROM_FEED) {
    val collapsingTop = rememberCollapsingTop()
    Scaffold(
        modifier = Modifier.collapsingTop(collapsingTop),
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.content_chats_title),
                        modifier = Modifier.semantics { heading() },
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("chats_back")) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = chatsBackLabel(from),
                        )
                    }
                },
                expandedHeight = Layout.TopBarHeight,
                colors = surfaceTopAppBarColors(),
                scrollBehavior = collapsingTop.scrollBehavior,
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
        ) {
            EmptyState(
                testTag = "chats_empty",
                title = stringResource(R.string.content_chats_coming_soon),
            )
        }
    }
}
