// INVITES (the `Invites` board family: Invites, InvitesEmpty, InviteNew,
// InviteCreated, InviteExpiry, ApprovePad, RejectConfirm, RejectAllConfirm;
// behavior/<board>.md; copy-voice *The invites round*). Six boards, one page:
// the create sheet, the expiry chooser, the fresh link, the approval pad and
// the two closing dialogs are all drawn over this same page. web's twin is
// `web/src/app/(app)/invites/invites-view.tsx`.
//
// APPLICATIONS LEAD, LIVE LINKS FOLLOW (Invites.md:7). The queue is the one
// read spanning both ends of the funnel (`approvalQueue`): rows taken up
// through the reader's ask-link door head the list, every other row stands
// grouped by the link it came through, by age and never by readiness
// (`layoutQueue`). Each row carries its own close; a group carries `Close
// all` past one waiting.
//
// APPROVING IS VOUCHING (ApprovePad.md:5): a ready row's tap blooms the
// ordinary opinion pad from an anchor that takes the close's slot, over the
// approval seam (`ApprovalPad`) — `vouchesIn`, so a (0, 0) Set raises the
// empty sign's vouch-in ask and `Set it anyway` IS the act. A not-ready row
// answers with a snackbar and never opens the pad (:39).
//
// NO BOTTOM BAR (Invites.md:3): a task flow takes the back arrow, which names
// the door it came through (:95-97).

package com.cogra.feature.invites

import android.content.ClipData
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.CollapsingTop
import com.cogra.core.designsystem.CollapsingTopBand
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.LocalOnRestoreKey
import com.cogra.core.designsystem.LocalSnackbarHostState
import com.cogra.core.designsystem.StancePoint
import com.cogra.core.designsystem.StanceSignedSnackbar
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.v2.atom.AddressAction
import com.cogra.core.designsystem.v2.atom.AddressCard
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.ContentRow
import com.cogra.core.designsystem.v2.atom.ContentRowDisc
import com.cogra.core.designsystem.v2.atom.ContentRowSecond
import com.cogra.core.designsystem.v2.atom.EmptyState
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.forwardCount
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.ForwardUnit
import com.cogra.domain.ageLadder
import com.cogra.domain.dateLine
import com.cogra.domain.forwardLadder
import com.cogra.domain.invites.ApplicationGroup
import com.cogra.domain.invites.ApplicationInfo
import com.cogra.domain.invites.InviteLinkInfo
import kotlinx.coroutines.launch
import java.time.Instant

internal val INVITES = DataNode("invites")

/** The door Invites was opened from, which the back arrow names (Invites.md:95-97). */
enum class InvitesDoor { PROFILE, NOTIFICATIONS, KEPT_PICKS }

/** A `from` route value as the door it names; anything else is the reader's own profile. */
fun invitesDoorOf(from: String?): InvitesDoor = when (from) {
    "notifications" -> InvitesDoor.NOTIFICATIONS
    "kept-picks" -> InvitesDoor.KEPT_PICKS
    else -> InvitesDoor.PROFILE
}

@Composable
fun InvitesRoute(
    from: String?,
    onBack: () -> Unit,
    /** Invites never stands for a reader who is not a member (ProfileApplicant.md:18). */
    onNotMember: () -> Unit,
    onRestoreKey: () -> Unit,
    /** What an ask link handed over on the way here, taken once. */
    arrival: InvitesNotice? = null,
    onArrivalConsumed: () -> Unit = {},
    /** The deletion band, while the account's confirmed deletion is in its grace (`FeedDeleting.md:3`). */
    deletionBand: @Composable () -> Unit = {},
    viewModel: InvitesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val padState by viewModel.padState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    LaunchedEffect(arrival) {
        if (arrival != null) {
            viewModel.onArrival(arrival)
            onArrivalConsumed()
        }
    }
    LaunchedEffect(state.notMember) { if (state.notMember) onNotMember() }
    val copy: (String) -> Unit = { url ->
        scope.launch {
            clipboard.setClipEntry(ClipEntry(ClipData.newPlainText(url, url)))
            viewModel.onLinkCopied()
        }
    }
    CompositionLocalProvider(LocalOnRestoreKey provides onRestoreKey) {
        InvitesScreen(
            state = state,
            padState = padState,
            door = invitesDoorOf(from),
            now = viewModel.now(),
            joinUrl = viewModel::joinUrl,
            approvalPad = viewModel::approvalPad,
            actions = InvitesActions(
                onBack = onBack,
                onPull = viewModel::onPull,
                onOpenSheet = viewModel::onOpenSheet,
                onOpenRow = viewModel::onOpenRow,
                onApprovalDismissed = viewModel::onApprovalDismissed,
                onCloseRow = viewModel::onCloseRow,
                onCloseAll = viewModel::onCloseAll,
                onConfirmClose = viewModel::onConfirmClose,
                onKeep = viewModel::onKeep,
                onCopy = copy,
                onRevoke = viewModel::onRevoke,
                onSnackShown = viewModel::onSnackShown,
                onFocusMoved = viewModel::onFocusMoved,
                sheet = SheetActions(
                    onClose = viewModel::onCloseSheet,
                    onSingleUseChange = viewModel::onSingleUseChange,
                    onOpenExpiry = viewModel::onOpenExpiry,
                    onCloseExpiry = viewModel::onCloseExpiry,
                    onPickExpiry = viewModel::onPickExpiry,
                    onCreate = viewModel::onCreate,
                    onCopy = copy,
                    onShare = { url -> context.shareLink(url) },
                ),
            ),
            deletionBand = deletionBand,
        )
    }
}

/** `ACTION_SEND` in the system chooser — the platform's own share sheet (InviteCreated.md:15). */
internal fun Context.shareLink(url: String) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, url)
    }
    startActivity(Intent.createChooser(send, null))
}

/** Every gesture the page raises. */
data class InvitesActions(
    val onBack: () -> Unit = {},
    val onPull: () -> Unit = {},
    val onOpenSheet: () -> Unit = {},
    val onOpenRow: (ApplicationInfo) -> Unit = {},
    val onApprovalDismissed: () -> Unit = {},
    val onCloseRow: (ApplicationInfo) -> Unit = {},
    val onCloseAll: (ApplicationGroup) -> Unit = {},
    val onConfirmClose: () -> Unit = {},
    val onKeep: () -> Unit = {},
    val onCopy: (String) -> Unit = {},
    val onRevoke: (InviteLinkInfo) -> Unit = {},
    val onSnackShown: () -> Unit = {},
    val onFocusMoved: () -> Unit = {},
    internal val sheet: SheetActions = SheetActions({}, {}, {}, {}, {}, {}, {}, {}),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvitesScreen(
    state: InvitesUiState,
    door: InvitesDoor,
    actions: InvitesActions,
    padState: ApprovalPadState? = null,
    now: Instant = Instant.now(),
    joinUrl: (InviteLinkInfo) -> String = { "https://cogra.social/join/${it.id}" },
    approvalPad: () -> ApprovalPad? = { null },
    deletionBand: @Composable () -> Unit = {},
) {
    val snackbar = remember { SnackbarHostState() }
    val top = rememberCollapsingTop()
    val list = rememberLazyListState()
    InvitesSnacks(state.snack, snackbar, actions.onSnackShown)
    CompositionLocalProvider(LocalSnackbarHostState provides snackbar) {
        Scaffold(
            modifier = Modifier.dataNodeSurface(),
            topBar = { InvitesTopBar(top, door, actions.onBack, deletionBand) },
            snackbarHost = { CograSnackbarHost(snackbar, testTag = "invites_snackbar") },
        ) { padding ->
            PullToRefreshBox(
                isRefreshing = state.refreshing,
                onRefresh = actions.onPull,
                modifier = Modifier.padding(padding).fillMaxSize(),
            ) {
                Box(Modifier.fillMaxSize().collapsingTop(top)) {
                    InvitesBody(state, padState, now, joinUrl, approvalPad, actions, list)
                }
            }
        }
    }
    state.sheet?.let { sheet -> InviteSheet(sheet, joinUrl, now, actions.sheet) }
    state.closing?.let { closing -> CloseDialog(closing, actions.onConfirmClose, actions.onKeep) }
}

/** The page's one-shots: the signed line in the stance control's own voice, every other line plain. */
@Composable
private fun InvitesSnacks(snack: InvitesSnack?, host: SnackbarHostState, onShown: () -> Unit) {
    val signed = (snack as? InvitesSnack.Signed)?.landing
    StanceSignedSnackbar(signed?.let { StancePoint(it.pDirected, it.pInterest) }, onShown)
    val words = when (snack) {
        null, is InvitesSnack.Signed -> null
        InvitesSnack.LinkCopied -> stringResource(R.string.invites_link_copied)
        InvitesSnack.Revoked -> stringResource(R.string.invites_revoked)
        is InvitesSnack.FinishRegistering -> stringResource(R.string.invites_finish_registering, snack.handle)
        is InvitesSnack.AlreadyWaiting -> stringResource(R.string.invites_already_waiting, snack.handle)
    }
    LaunchedEffect(snack) {
        if (words != null) {
            // Spent before the wait, so a recomposition cannot repeat it.
            onShown()
            host.showSnackbar(words)
        }
    }
}

@Composable
private fun InvitesTopBar(
    top: CollapsingTop,
    door: InvitesDoor,
    onBack: () -> Unit,
    deletionBand: @Composable () -> Unit,
) {
    CollapsingTopBand(top) {
        Column {
            deletionBand()
            PageHeader(
                title = stringResource(R.string.invites_title),
                onBack = onBack,
                backContentDescription = stringResource(
                    when (door) {
                        InvitesDoor.PROFILE -> R.string.invites_back_profile
                        InvitesDoor.NOTIFICATIONS -> R.string.invites_back_notifications
                        InvitesDoor.KEPT_PICKS -> R.string.invites_back_kept_picks
                    },
                ),
                node = INVITES / "header",
            )
        }
    }
}

@Composable
@Suppress("LongParameterList") // the body draws every board's state the page holds
private fun InvitesBody(
    state: InvitesUiState,
    padState: ApprovalPadState?,
    now: Instant,
    joinUrl: (InviteLinkInfo) -> String,
    approvalPad: () -> ApprovalPad?,
    actions: InvitesActions,
    list: LazyListState,
) {
    val createFocus = remember { FocusRequester() }
    val rowFocus = remember { mutableMapOf<String, FocusRequester>() }
    val layout = state.layout
    val links = state.links
    FocusFollowsRemoval(state, list, rowFocus, createFocus, actions.onFocusMoved)
    LazyColumn(
        state = list,
        contentPadding = PaddingValues(top = Space.x2, bottom = Space.x8),
        modifier = Modifier.fillMaxSize(),
    ) {
        when {
            state.read == null && !state.fault -> item(key = "loading") {
                Text(
                    stringResource(R.string.invites_loading),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = Space.x6).testTag("invites_loading"),
                )
            }
            state.empty -> item(key = "empty") { Empty(actions.onOpenSheet, createFocus) }
            state.read != null -> {
                item(key = "create") {
                    // New invite heads the column, filled, at its full width (:5).
                    CograButton(
                        text = stringResource(R.string.invites_new),
                        onClick = actions.onOpenSheet,
                        modifier = Modifier
                            .padding(horizontal = Space.x4)
                            .fillMaxWidth()
                            .focusRequester(createFocus),
                        testTag = (INVITES / "create").tag,
                    )
                }
                applications(state, padState, now, approvalPad, actions, rowFocus)
                liveLinks(links, state, now, joinUrl, actions, rowFocus)
            }
        }
        if (state.fault) {
            item(key = "fault") {
                ErrorLine(
                    R.string.invites_transport,
                    testTag = "invites_error",
                    modifier = Modifier.padding(horizontal = Space.x6, vertical = Space.x2),
                )
            }
        }
    }
}

/**
 * FOCUS FOLLOWS A REMOVAL (Invites.md:61): the next row, else the previous,
 * else the empty state's create. And an ask link's arrival stands at its row
 * (VouchAsk.md:17).
 */
@Composable
private fun FocusFollowsRemoval(
    state: InvitesUiState,
    list: LazyListState,
    rowFocus: Map<String, FocusRequester>,
    createFocus: FocusRequester,
    onMoved: () -> Unit,
) {
    val rows = state.layout.rows
    LaunchedEffect(state.read, state.focusAfter, state.standAt) {
        if (state.read == null) return@LaunchedEffect
        val wanted = state.focusAfter
        val standAt = state.standAt
        if (wanted == null && standAt == null) return@LaunchedEffect
        withFrameNanos { }
        val target: String? = when {
            standAt != null -> rows.firstOrNull { it.handle == standAt }?.id
            wanted?.section == FocusAfter.Section.APPLICATION && rows.isNotEmpty() ->
                rows[wanted.index.coerceAtMost(rows.lastIndex)].id
            wanted?.section == FocusAfter.Section.LINK && state.links.isNotEmpty() ->
                LINK_FOCUS_PREFIX + state.links[wanted.index.coerceAtMost(state.links.lastIndex)].id
            else -> null
        }
        val visible = target != null && list.layoutInfo.visibleItemsInfo.any { it.key == target }
        if (target != null && !visible) {
            // Off screen: bring it into view first, then focus it.
            val position = itemPosition(state, target)
            if (position >= 0) list.animateScrollToItem(position)
            withFrameNanos { }
        }
        runCatching {
            if (target == null) createFocus.requestFocus() else rowFocus[target]?.requestFocus()
        }
        onMoved()
    }
}

private const val LINK_FOCUS_PREFIX = "link:"

/** Where [key] stands in the lazy list — the same order [InvitesBody] emits. */
private fun itemPosition(state: InvitesUiState, key: String): Int {
    val keys = buildList {
        add("create")
        val layout = state.layout
        if (!layout.isEmpty) add("applicationsLabel")
        layout.head.forEach { add(it.id) }
        layout.groups.forEach { group ->
            add("group:${group.linkId}")
            group.rows.forEach { add(it.id) }
        }
        if (state.links.isNotEmpty()) add("linksLabel")
        state.links.forEach { add(LINK_FOCUS_PREFIX + it.id) }
    }
    return keys.indexOf(key)
}

@Composable
private fun Empty(onCreate: () -> Unit, focus: FocusRequester) {
    // INVITESEMPTY (InvitesEmpty.md): the calm line, and the page's one
    // committing control under it at the column's full width — no error
    // colour, no bar. Unregistered: it wears `invites.empty` until design
    // registers the board.
    EmptyState(
        testTag = "invites.empty",
        title = stringResource(R.string.invites_empty),
        registered = true,
        modifier = Modifier.padding(horizontal = Space.x6, vertical = Space.x2),
        action = {
            CograButton(
                text = stringResource(R.string.invites_create),
                onClick = onCreate,
                modifier = Modifier.fillMaxWidth().focusRequester(focus),
                testTag = "invites.empty.create",
            )
        },
    )
}

@Suppress("LongParameterList")
private fun LazyListScope.applications(
    state: InvitesUiState,
    padState: ApprovalPadState?,
    now: Instant,
    approvalPad: () -> ApprovalPad?,
    actions: InvitesActions,
    rowFocus: MutableMap<String, FocusRequester>,
) {
    val layout = state.layout
    if (layout.isEmpty) return
    item(key = "applicationsLabel") {
        SectionLabel(stringResource(R.string.invites_applications), INVITES / "applicationsLabel")
    }
    val row: @Composable (ApplicationInfo) -> Unit = { application ->
        val focus = remember(application.id) { FocusRequester() }
        rowFocus[application.id] = focus
        ApplicationRow(
            application = application,
            now = now,
            approving = state.approvingId == application.id,
            padState = padState,
            approvalPad = approvalPad,
            actions = actions,
            modifier = Modifier.focusRequester(focus),
        )
    }
    // A staging through the reader's ask link heads the list on its own (:71).
    layout.head.forEach { application ->
        item(key = application.id) {
            Box(Modifier.padding(start = Space.x4, end = Space.x4, bottom = Space.x2)) { row(application) }
        }
    }
    layout.groups.forEach { group ->
        item(key = "group:${group.linkId}") { GroupHeader(group, actions.onCloseAll) }
        group.rows.forEach { application ->
            item(key = application.id) {
                Box(Modifier.padding(start = Space.x4, end = Space.x4, top = Space.x2)) { row(application) }
            }
        }
    }
}

/** A quiet section caption (`SectionLabel.jsx`): label-small, secondary ink, `12 24 4`. */
@Composable
private fun SectionLabel(text: String, node: DataNode) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .padding(start = Space.x6, end = Space.x6, top = Space.x3, bottom = Space.x1)
            .dataNode(node),
    )
}

/**
 * A link's group (the board's `ApplicationGroup`): its label and waiting
 * count, `Close all` past one waiting, then its rows by age.
 */
@Composable
private fun GroupHeader(group: ApplicationGroup, onCloseAll: (ApplicationGroup) -> Unit) {
    val node = (INVITES / "group").keyed(group.linkId)
    val closeAllName = stringResource(R.string.invites_close_all_label, group.rows.size)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Space.x4)
            .padding(start = Space.x1, end = Space.x1, top = Space.x1)
            .dataNode(node),
    ) {
        Text(
            text = stringResource(
                if (group.singleUse) R.string.invites_group_single else R.string.invites_group_many,
                group.rows.size,
            ),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.dataNode(INVITES / "group" / "label"),
        )
        if (group.closesAll) {
            CograButton(
                text = stringResource(R.string.invites_close_all),
                onClick = { onCloseAll(group) },
                kind = ButtonKind.Text,
                size = ButtonSize.Compact,
                // Named in full for the accessibility tree (RejectAllConfirm.md:9).
                modifier = Modifier.semantics { contentDescription = closeAllName },
                testTag = (INVITES / "group" / "close").tag,
            )
        }
    }
}

/**
 * One application (the board's `ContentRow` in its chronicle variant): the
 * monogram from the handle, the handle alone, the reader's fact, the age, and
 * the row's own close — or, while its pad is up, the stance anchor the pad
 * bloomed from in the close's slot (ApprovePad.md:15).
 */
@Composable
@Suppress("LongParameterList")
private fun ApplicationRow(
    application: ApplicationInfo,
    now: Instant,
    approving: Boolean,
    padState: ApprovalPadState?,
    approvalPad: () -> ApprovalPad?,
    actions: InvitesActions,
    modifier: Modifier = Modifier,
) {
    val handle = "@${application.handle}"
    val node = (INVITES / "application").keyed(application.handle)
    val pad = approvalPad()
    ContentRow(
        title = handle,
        disc = ContentRowDisc.Monogram(application.handle),
        testTag = "invites_application_${application.id}",
        second = {
            ContentRowSecond(
                stringResource(if (application.approvable) R.string.invites_ready else R.string.invites_not_registered),
            )
        },
        trailing = ageLadder(application.createdAt, now),
        onOpen = { actions.onOpenRow(application) },
        node = node,
        modifier = modifier,
        action = {
            if (approving && pad != null && padState != null) {
                ApprovalControl(
                    pad = pad,
                    state = padState,
                    handle = handle,
                    testTagPrefix = "invites_approve_${application.id}",
                    node = INVITES / "application" / "stance",
                    onDismiss = actions.onApprovalDismissed,
                )
            } else {
                CloseGlyph(handle) { actions.onCloseRow(application) }
            }
        },
    )
}

/** The row's own close: the glyph alone, spoken with the handle it closes (Invites.md:23). */
@Composable
private fun CloseGlyph(handle: String, onClose: () -> Unit) {
    val name = stringResource(R.string.invites_close_application, handle)
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .dataNode(INVITES / "application" / "close")
            .hitTarget(
                interactive = Modifier
                    .clip(CircleShape)
                    .clickable(role = Role.Button, onClick = onClose)
                    .semantics { contentDescription = name },
                drawnWidth = CLOSE_SIZE,
                drawnHeight = CLOSE_SIZE,
            )
            .size(CLOSE_SIZE),
    ) {
        Icon(
            Icons.Filled.Close,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(20.dp),
        )
    }
}

private val CLOSE_SIZE = 40.dp

private fun LazyListScope.liveLinks(
    links: List<InviteLinkInfo>,
    state: InvitesUiState,
    now: Instant,
    joinUrl: (InviteLinkInfo) -> String,
    actions: InvitesActions,
    focus: MutableMap<String, FocusRequester>,
) {
    if (links.isEmpty()) return
    item(key = "linksLabel") { SectionLabel(stringResource(R.string.invites_live_links), INVITES / "linksLabel") }
    links.forEachIndexed { index, link ->
        item(key = LINK_FOCUS_PREFIX + link.id) {
            val url = joinUrl(link)
            val requester = remember(link.id) { FocusRequester() }
            focus[LINK_FOCUS_PREFIX + link.id] = requester
            AddressCard(
                address = url,
                label = linkLabel(link),
                copyLabel = stringResource(R.string.invites_copy_link),
                onCopy = { actions.onCopy(url) },
                // Inert from the press, `Revoking…` past 200ms, never dimmed
                // and never a spinner (:49-51).
                action = AddressAction(
                    label = stringResource(R.string.invites_revoke),
                    onClick = { actions.onRevoke(link) },
                    inFlight = state.revoking == link.id,
                    busyLabel = stringResource(R.string.invites_revoking),
                ),
                caption = linkCaption(link, now),
                node = (INVITES / "link").keyed(link.id),
                modifier = Modifier
                    .padding(start = Space.x4, end = Space.x4, top = if (index == 0) 0.dp else Space.x2)
                    .focusRequester(requester),
            )
        }
    }
    if (state.revokeFailed) {
        item(key = "revokeFailed") {
            ErrorLine(
                R.string.invites_transport,
                testTag = "invites_revoke_failed",
                modifier = Modifier.padding(horizontal = Space.x6, vertical = Space.x2),
            )
        }
    }
}

/**
 * What it is, nothing else: the slot state rides the single-use label only,
 * and a single-use link on the page is one whose slot is open, simply by
 * being there (copy-voice; design digest item 4: used stays used).
 */
@Composable
internal fun linkLabel(link: InviteLinkInfo): String =
    stringResource(if (link.singleUse) R.string.invites_link_single else R.string.invites_link_many)

/** `Expires in 7 days · 22.09.2026` — the forward ladder and the house date. */
@Composable
internal fun linkCaption(link: InviteLinkInfo, now: Instant): String {
    val count = forwardLadder(link.expiresAt, now)
    return stringResource(
        R.string.invites_link_expires,
        forwardCount(count.count, inHours = count.unit == ForwardUnit.HOURS),
        dateLine(link.expiresAt),
    )
}
