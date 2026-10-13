// WHAT'S NEW — the release chronicle behind Settings' `What's new` row
// (WhatsNew.md, WhatsNewBehind.md; the release-registry packet §9). Whole
// releases, newest first, one card each, never a diff; each card ends in its
// release's public page, opened outside the app. While the version running
// here is behind the newest release, one quiet line stands atop the list
// ending in `Update now`, which opens CoGra's store listing — never GitHub.
//
// DRIFT (release-registry slice C): geometry and tokens are rough until the
// surface-conformance pass.

package com.cogra.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.LoadingState
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.QuietNote
import com.cogra.domain.release.Release
import com.cogra.domain.release.datelineText
import com.cogra.domain.release.datelineWord
import com.cogra.domain.release.releaseKey
import com.cogra.domain.release.versionStatus

private val Page = DataNode("whatsNew")

/**
 * The page wired to its read. [onUpdateNow] is the app's: the store listing,
 * which only the app module knows the id of. Each card's door opens its
 * release's page through the platform's URI handler, outside the app.
 */
@Composable
fun WhatsNewRoute(
    onBack: () -> Unit,
    onUpdateNow: () -> Unit,
    viewModel: WhatsNewViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val uriHandler = LocalUriHandler.current
    WhatsNewScreen(
        state = state,
        onBack = onBack,
        onUpdateNow = onUpdateNow,
        onOpenRelease = { url -> uriHandler.openUri(url) },
    )
}

@Composable
fun WhatsNewScreen(
    state: WhatsNewUiState,
    onBack: () -> Unit,
    onUpdateNow: () -> Unit,
    onOpenRelease: (String) -> Unit,
) {
    Scaffold(
        modifier = Modifier.dataNodeSurface().dataNode(Page),
        topBar = {
            PageHeader(
                title = stringResource(R.string.whats_new_title),
                onBack = onBack,
                backContentDescription = stringResource(R.string.whats_new_back),
                node = Page / "header",
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(bottom = 16.dp),
        ) {
            when (state) {
                WhatsNewUiState.Loading -> LoadingState(
                    testTag = "whats_new_loading",
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp),
                )
                WhatsNewUiState.Failed -> ErrorLine(
                    text = R.string.whats_new_transport,
                    testTag = "whats_new_error",
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp),
                )
                is WhatsNewUiState.Ready -> Chronicle(state.releases, state.running, onUpdateNow, onOpenRelease)
            }
        }
    }
}

@Composable
private fun Chronicle(
    releases: List<Release>,
    running: String,
    onUpdateNow: () -> Unit,
    onOpenRelease: (String) -> Unit,
) {
    val status = versionStatus(releases, running)
    status.newest?.let { newest -> NewerLine(newest.version, onUpdateNow) }
    releases.forEachIndexed { index, release ->
        ReleaseCard(release, datelineText(release, datelineWord(status, index)), onOpenRelease)
    }
    QuietNote(
        text = stringResource(R.string.whats_new_footnote),
        modifier = Modifier
            .padding(start = 24.dp, end = 24.dp, top = 16.dp)
            .dataNode(Page / "footnote"),
    )
}

/** `A newer version exists. — Update now`, one quiet line atop the list (WhatsNewBehind.md:3). */
@Composable
private fun NewerLine(newest: String, onUpdateNow: () -> Unit) {
    val line = Page / "newerLine"
    val spoken = stringResource(R.string.whats_new_update_description, newest)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 24.dp, end = 24.dp, top = 8.dp)
            .dataNode(line),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = stringResource(R.string.whats_new_newer_line) + " ",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = "— ",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.clearAndSetSemantics {},
        )
        InlineAction(
            text = stringResource(R.string.whats_new_update_now),
            onClick = onUpdateNow,
            modifier = Modifier.semantics { contentDescription = spoken },
            testTag = (line / "update").tag,
        )
    }
}

@Composable
private fun ReleaseCard(release: Release, dateline: String, onOpenRelease: (String) -> Unit) {
    val key = releaseKey(release.version)
    val card = (Page / "release").keyed(key)
    val spoken = stringResource(R.string.whats_new_door_description, release.version)
    Text(
        text = dateline,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .padding(start = 24.dp, end = 24.dp, top = 12.dp, bottom = 4.dp)
            .dataNode((Page / "dateline").keyed(key)),
    )
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .dataNode(card),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHighest),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            release.notes.forEach { note ->
                Text(text = note, style = MaterialTheme.typography.bodyMedium)
            }
            InlineAction(
                text = stringResource(R.string.whats_new_door),
                onClick = { onOpenRelease(release.patchNotesUrl) },
                modifier = Modifier.semantics { contentDescription = spoken },
                testTag = (card / "door").keyed(key).tag,
            )
        }
    }
}
