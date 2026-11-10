// THE OPINIONS PAGE (`design/designs/canonical/ProfileStances.dc.html`;
// behavior/ProfileStances.md). Opened from any profile's figures: titled with
// the person's handle and `Opinions`, the two directions on two tabs named in
// words — `On them` · `By them`, `On you` · `By you` on the reader's own — and
// never one merged list. Each row is a person with the public opinion the row
// is about (`StanceRow`), read-only, strongest first; tapping one opens their
// profile, whose arrow reads `Back to the opinions`. A read drill-in: the back
// arrow names the profile it came from, and the shell's bar rides, lit for
// the root the page's stack began in. web's twin is
// `web/src/app/u/[handle]/opinions/opinions-view.tsx`.
//
// THE FIGURE COUNTS RECORDS; THE PAGE LISTS PEOPLE (open-questions Q35): a
// revised opinion is three records and one row, so a figure may read more than
// its list holds — each says what its words say.
//
// The board draws no loading or fault state: the page takes the house loading
// line and the profile's own transport line with its `Try again`.

package com.cogra.feature.profile

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CollapsingTopBand
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.v2.atom.EmptyState
import com.cogra.core.designsystem.v2.atom.LoadingState
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.StanceRow
import com.cogra.core.designsystem.v2.atom.TabBar
import com.cogra.core.designsystem.v2.atom.TabBarTab
import com.cogra.domain.stance.HeldOpinion
import com.cogra.domain.stance.OpinionDirection

/** The registered prefix (nodes.json `ProfileStances`). */
internal val PROFILE_STANCES = DataNode("profileStances")
private val LIST = PROFILE_STANCES / "list"

/** The `from` a row on the page opens a profile with (`Back to the opinions`). */
const val OPINIONS_ORIGIN = "opinions"

/**
 * The page wired to its ViewModel. [handle] is the person's, null on the
 * reader's own root. [onOpenPerson] is a row's door: the person's profile by
 * the handle their account still answers to — a deleted account's too, whose
 * handle the row never prints (ProfileStances.md:27, `ProfileDeleted`). An
 * address no account fronts opens nothing.
 */
@Composable
fun ProfileStancesRoute(
    handle: String?,
    onBack: () -> Unit,
    onOpenPerson: (handle: String) -> Unit,
    viewModel: ProfileStancesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(handle) { viewModel.start(handle) }
    ProfileStancesScreen(
        state = state,
        onBack = onBack,
        onDirection = viewModel::onDirection,
        onRefresh = viewModel::refresh,
        onOpenPerson = onOpenPerson,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileStancesScreen(
    state: ProfileStancesUiState,
    onBack: () -> Unit,
    onDirection: (OpinionDirection) -> Unit,
    onRefresh: () -> Unit,
    onOpenPerson: (handle: String) -> Unit,
) {
    val top = rememberCollapsingTop()
    Scaffold(
        modifier = Modifier.dataNodeSurface(),
        topBar = {
            // THE TAB ROW STANDS DIRECTLY UNDER THE BAR, and both collapse with
            // the page and return on the way up (ProfileStances.md:59).
            CollapsingTopBand(top) {
                Column {
                    PageHeader(
                        title = state.profile?.let { title(state) },
                        onBack = onBack,
                        backContentDescription = stringResource(
                            if (state.own) R.string.stances_back_own else R.string.stances_back_other,
                        ),
                        node = PROFILE_STANCES / "header",
                    )
                    DirectionTabs(state, onDirection)
                }
            }
        },
    ) { padding ->
        // THE PULL-DOWN AT THE TOP REFRESHES, the platform's own indicator
        // showing (ProfileStances.md:61).
        PullToRefreshBox(
            isRefreshing = state.refreshing && !state.loading,
            onRefresh = onRefresh,
            modifier = Modifier.padding(padding).fillMaxSize(),
        ) {
            Box(Modifier.fillMaxSize().collapsingTop(top)) {
                Body(state, onRefresh, onOpenPerson)
            }
        }
    }
}

/** `@ada · Opinions`; a deleted account's handle went with the rest, so it is titled `Opinions` alone. */
@Composable
private fun title(state: ProfileStancesUiState): String {
    val profile = state.profile ?: return ""
    return if (state.whose == StancesWhose.DELETED) {
        stringResource(R.string.stances_title_deleted)
    } else {
        stringResource(R.string.stances_title, profile.handle)
    }
}

/**
 * The tab row (ProfileStances.md:7-11): `On them` · `By them` on another's and
 * a deleted account's page, `On you` · `By you` on the reader's own, the choice
 * named `Which direction`. The board draws the row once per tab, keyed by it.
 */
@Composable
private fun DirectionTabs(state: ProfileStancesUiState, onDirection: (OpinionDirection) -> Unit) {
    val own = state.whose == StancesWhose.OWN
    val tabs = listOf(
        TabBarTab(ON, stringResource(if (own) R.string.stances_tab_on_you else R.string.stances_tab_on_them)),
        TabBarTab(BY, stringResource(if (own) R.string.stances_tab_by_you else R.string.stances_tab_by_them)),
    )
    val value = if (state.direction == OpinionDirection.ON) ON else BY
    TabBar(
        tabs = tabs,
        value = value,
        onSelect = { id -> onDirection(if (id == BY) OpinionDirection.BY else OpinionDirection.ON) },
        label = stringResource(R.string.stances_tabs_label),
        node = (PROFILE_STANCES / "tabRow").keyed(value),
    )
}

@Composable
private fun Body(state: ProfileStancesUiState, onRetry: () -> Unit, onOpenPerson: (String) -> Unit) {
    val rows = state.rows
    when {
        state.notFound -> Text(
            stringResource(R.string.profile_not_found),
            modifier = Modifier.padding(16.dp).testTag("stances_not_found"),
        )
        rows == null && state.failed -> Fault(onRetry)
        rows == null -> LoadingState(testTag = "stances_loading", modifier = Modifier.padding(16.dp))
        rows.isEmpty() -> Empty(state)
        else -> Rows(rows, onOpenPerson)
    }
}

@Composable
private fun Rows(rows: List<HeldOpinion>, onOpenPerson: (String) -> Unit) {
    LazyColumn(
        // `padding-top: 4px` (the board's list).
        contentPadding = PaddingValues(top = 4.dp),
        modifier = Modifier.fillMaxSize().dataNode(LIST),
    ) {
        items(rows, key = { it.holderId }) { opinion ->
            val holder = opinion.holder
            StanceRow(
                // An address no account fronts still holds its opinion and
                // keeps its row, named by its address.
                name = holder.displayName?.takeIf { it.isNotBlank() } ?: holder.handle ?: opinion.holderId,
                handle = holder.handle,
                avatarUrl = holder.avatarUrl,
                point = StancePoint(opinion.pair.pDirected, opinion.pair.pInterest),
                redacted = holder.redacted,
                severed = opinion.severed,
                onOpen = holder.handle?.let { handle -> { onOpenPerson(handle) } },
                node = rowNode(opinion),
            )
        }
    }
}

/**
 * A row's node: a person is `list.row` keyed by the handle the row names; a
 * DELETED ACCOUNT is `list.redactedRow` keyed by the account's id, having no
 * handle to key by (nodes.json, round 27). An address no account fronts keeps
 * a `row`, keyed by that address.
 */
internal fun rowNode(opinion: HeldOpinion): DataNode {
    val holder = opinion.holder
    val deletedId = holder.actorId?.takeIf { holder.redacted }
    return if (deletedId != null) {
        (LIST / "redactedRow").keyed(deletedId)
    } else {
        (LIST / "row").keyed(holder.handle ?: opinion.holderId)
    }
}

/**
 * THE EMPTY TAB SAYS THE FIGURE'S NOUN AT ZERO, calm and in no error colour
 * (ProfileStances.md:33-45): another's `On them` keeps the opinions sheet's
 * invitation; a deleted account, which will give none again, says so in the
 * past.
 */
@Composable
private fun Empty(state: ProfileStancesUiState) {
    val on = state.direction == OpinionDirection.ON
    val line = when (state.whose) {
        StancesWhose.OWN -> stringResource(if (on) R.string.stances_empty_on_you else R.string.stances_empty_by_you)
        StancesWhose.DELETED -> stringResource(
            if (on) R.string.stances_empty_on_deleted else R.string.stances_empty_by_deleted,
        )
        StancesWhose.OTHER -> if (on) {
            stringResource(R.string.stances_empty_on_them)
        } else {
            stringResource(R.string.stances_empty_by_them, state.profile?.handle.orEmpty())
        }
    }
    // `padding: 8px 24px` around the empty state's own `8 0`.
    Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp)) {
        EmptyState(testTag = "stances_empty", title = line, node = PROFILE_STANCES / "empty")
    }
}

/** The page could not be read and nothing stands in its place: the transport line and `Try again`. */
@Composable
private fun Fault(onRetry: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(16.dp)) {
        Text(
            stringResource(R.string.error_transport),
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.weight(1f).testTag("stances_transport_error"),
        )
        TextButton(onClick = onRetry, modifier = Modifier.testTag("stances_retry")) {
            Text(stringResource(R.string.profile_retry))
        }
    }
}

private const val ON = "on"
private const val BY = "by"
