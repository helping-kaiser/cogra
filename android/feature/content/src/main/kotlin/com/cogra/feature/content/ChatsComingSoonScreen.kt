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
fun ChatsComingSoonRoute(onBack: () -> Unit) {
    ChatsComingSoonScreen(onBack = onBack)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatsComingSoonScreen(onBack: () -> Unit) {
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
                            contentDescription = stringResource(R.string.content_back),
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
