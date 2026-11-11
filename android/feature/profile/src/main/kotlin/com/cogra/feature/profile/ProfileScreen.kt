// THE PROFILE (Profile.md, ProfileOther.md, ProfileDeleted.md,
// ProfileApplicant.md; `_shared.jsx` `ProfileOwnBody`, `ProfileOtherBody`,
// `ProfileDeletedBody`): one screen for the reader's own root and for every
// other actor's drill-in. Its parts wear the `profile` prefix's registered
// paths, so the conformance harness pairs it with the eight boards by id.
//
// - The own root wears the band (`ProfileBand`): the mark and the wordmark,
//   then the gear, chats and the bell.
// - A drill-in wears the house page header, titled `@handle` and carrying the
//   way back alone — a deleted account's title stays empty.
// - The compact header, then the tab row, then the list the tab names: the
//   person's posts as the feed's post cards (ProfilePosts.md:3), their
//   comments as comment cards (ProfileComments.md:3), and on the right-most
//   tab, Everything, the chronicle of all their acts (Profile.md:23). The
//   cards are the feed's own, handed down by the shell ([ProfileCardsHost]).

package com.cogra.feature.profile

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.CollapsingTop
import com.cogra.core.designsystem.CollapsingTopBand
import com.cogra.core.designsystem.CollapsingTopBanner
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.EdgeSighting
import com.cogra.core.designsystem.NodeSnackbarVisuals
import com.cogra.core.designsystem.RootReselectEffect
import com.cogra.core.designsystem.RowLine
import com.cogra.core.designsystem.SeenCardsEffect
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.core.designsystem.v2.atom.BandBell
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograBandBell
import com.cogra.core.designsystem.v2.atom.CograBandChats
import com.cogra.core.designsystem.v2.atom.CograBandIcon
import com.cogra.core.designsystem.v2.atom.CograBandIdentity
import com.cogra.core.designsystem.v2.atom.CograRowButton
import com.cogra.core.designsystem.v2.atom.EmptyState
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.TabBar
import com.cogra.core.designsystem.v2.atom.chronicleTabs
import com.cogra.core.designsystem.v2.media.ScrollStageHost
import com.cogra.core.designsystem.v2.media.ScrollStageRow
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.StateTokens
import com.cogra.domain.PostView
import com.cogra.domain.ProfileComment
import com.cogra.domain.ProfileView
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.saved.SavedWrites
import com.cogra.domain.stance.StanceTarget
import com.cogra.feature.saved.LocalSavedHost
import com.cogra.feature.saved.SavedHost
import com.cogra.feature.saved.rememberHiddenSet
import com.cogra.feature.saved.rememberSavedHost
import com.cogra.feature.saved.rememberSavedWrites
import com.cogra.feature.stance.StanceControlRoute
import com.cogra.feature.stance.vouchBackVariant
import kotlinx.coroutines.launch
import java.time.Instant

private val PROFILE = DataNode("profile")

@Composable
fun ProfileRoute(
    handle: String?,
    /** The bar's Profile slot re-tapped over this root, counted (Profile.md:61-63); 0 on a drill-in. */
    reselectSignal: Int = 0,
    handleChangedResult: Boolean,
    onHandleChangedResultConsumed: () -> Unit,
    profileSavedResult: Boolean,
    onProfileSavedResultConsumed: () -> Unit,
    onEdit: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenInvites: () -> Unit,
    onOpenPost: (String) -> Unit,
    onBack: (() -> Unit)?,
    keyBanner: @Composable () -> Unit = {},
    /** The deletion band, while the account's confirmed deletion is in its grace (`FeedDeleting.md:3`). */
    deletionBand: @Composable () -> Unit = {},
    banners: @Composable () -> Unit = {},
    /**
     * A signing on the member who vouched the reader in was taken — by Set
     * or by the hold — so the ceremony opens (ProfileOther.md:37). Gets the
     * profile it was signed on.
     */
    onVouchedBack: (ProfileView) -> Unit = {},
    /** The own menu's Saved row opens the Saved list. */
    onOpenSaved: () -> Unit = {},
    /** The own menu's History row opens History (ProfileOwnMenu.md). */
    onOpenHistory: () -> Unit = {},
    /** The guest gate a signed-out reader's rows open; null when signed in. */
    onRequireAccount: (() -> Unit)? = null,
    /** Where the reader came from, which the back arrow names (ProfileOther.md:73). */
    from: String? = null,
    /** The bell, on the own profile ROOT only (Profile.md:3, :41); null elsewhere. */
    bell: BandBell? = null,
    /** The band's chats (Profile.md:39), on the own root. */
    onChats: (() -> Unit)? = null,
    /** `Message` on another's profile: the chats coming-soon (ProfileOther.md:51). */
    onMessage: () -> Unit = {},
    /** The figures' one door: the opinions page on this profile (Profile.md:49). */
    onOpenOpinions: () -> Unit = {},
    /** The feed's own cards, which the Posts and Comments tabs draw; the shell hosts them. */
    cardsHost: ProfileCardsHost = NoProfileCards,
    /** The ⋮'s `Mention in a new post`: the wizard with this person staged (ProfileMenu.md:17). */
    onMention: (profileId: String) -> Unit = {},
    viewModel: ProfileViewModel = hiltViewModel(),
    shareModel: ProfileShareViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    LaunchedEffect(handle) { viewModel.start(handle) }
    // Settings confirmed the handle change; the edit screen confirmed
    // the save — either way this screen re-reads.
    LaunchedEffect(handleChangedResult) {
        if (handleChangedResult) {
            onHandleChangedResultConsumed()
            viewModel.refresh()
        }
    }
    // The re-read is separated from the confirmation on purpose. The
    // screen consumes the result only once its snackbar has run its
    // course (the house one-shot shape), and hanging the refetch off
    // that consume made the profile sit on the picture it had just
    // replaced for the whole four seconds — and drop the refetch
    // entirely whenever the snackbar was cancelled early. One read is
    // enough: a signed edit is served from its signature on, pending
    // until it lands (substrate.md §6).
    LaunchedEffect(profileSavedResult) {
        if (profileSavedResult) viewModel.refresh()
    }
    ProfileScreen(
        state = state,
        reselectSignal = reselectSignal,
        profileSavedResult = profileSavedResult,
        onProfileSavedResultConsumed = onProfileSavedResultConsumed,
        onTabChange = viewModel::onTabChange,
        onLoadMore = viewModel::onLoadMore,
        onRetryPage = viewModel::onRetryPage,
        onRetry = viewModel::refresh,
        onEdit = onEdit,
        onOpenSettings = onOpenSettings,
        onOpenInvites = onOpenInvites,
        onOpenPost = onOpenPost,
        onBack = onBack,
        keyBanner = keyBanner,
        deletionBand = deletionBand,
        banners = banners,
        stanceControl = { target, label, node ->
            ProfileStance(state, target, label, node, onVouchedBack, onRequireAccount)
        },
        saved = rememberSavedWrites(),
        hidden = rememberHiddenSet(),
        onRequireAccount = onRequireAccount,
        onOpenSaved = onOpenSaved,
        onOpenHistory = onOpenHistory,
        onShareProfile = { profileHandle -> context.shareProfile(shareModel.urlFor(profileHandle)) },
        backDescription = backLabel(from),
        bell = bell,
        onChats = onChats,
        onMessage = onMessage,
        onOpenOpinions = onOpenOpinions,
        cardsHost = cardsHost,
        seen = ProfileSeen(viewModel::onCardsSeen, viewModel::onCardEdgesSeen, viewModel::onSeenCheckpoint),
        onMention = onMention,
    )
}

/**
 * WHAT THE CARD TABS DRAW THEIR CARDS WITH — the feed's own post card and
 * comment card, live (ProfilePosts.md:3, ProfileComments.md:3) — and whether
 * a sheet the cards raised covers the list.
 */
class ProfileCards(
    /** One post card, wearing [node] (`profile.posts.card`) keyed by the post's id. */
    val post: @Composable (post: PostView, node: DataNode) -> Unit,
    /**
     * One comment card, wearing [node] (`profile.comments.commentCard`) keyed
     * by its id, its replies line [repliesNode] (`profile.comments.viewReplies`).
     * [lockedReply] answers an applicant's Reply (ProfileComments.md:29); null
     * opens the thread.
     */
    val comment: @Composable (
        listed: ProfileComment,
        node: DataNode,
        repliesNode: DataNode,
        lockedReply: (() -> Unit)?,
    ) -> Unit,
    val covered: Boolean = false,
)

/**
 * THE SHELL HOSTS THE CARDS: it wraps the list, keeps the sheets the cards
 * raise over it, and tells their aftermath through [notify], on the page's
 * own snackbar.
 */
typealias ProfileCardsHost = @Composable (notify: (String) -> Unit, content: @Composable (ProfileCards) -> Unit) -> Unit

/** No host: the card tabs list nothing — for previews and the screen's own tests. */
val NoProfileCards: ProfileCardsHost = { _, content -> content(ProfileCards({ _, _ -> }, { _, _, _, _ -> })) }

/** What the list reports to History as the reader sees it (History.md:11, :13). */
class ProfileSeen(
    val onCardsSeen: (List<String>) -> Unit = {},
    val onCardEdgesSeen: (List<EdgeSighting>) -> Unit = {},
    val onCheckpoint: () -> Unit = {},
)

/** The `from` a Saved row's person is opened with. */
const val SAVED_ORIGIN = "saved"

/** The `from` a History card's person is opened with (`Back to History`). */
const val HISTORY_ORIGIN = "history"

/** The `from` a notification's person or post is opened with (`Back to Notifications`). */
const val NOTIFICATIONS_ORIGIN = "notifications"

/** The `from` an author chip on a feed card opens a profile with (`Back to feed`). */
const val FEED_ORIGIN = "feed"

/** The `from` a post's author chip, opinions or references open a profile with (`Back to the post`). */
const val POST_ORIGIN = "post"

/** The `from` the comments sheet opens a profile with (`Back to the comments`). */
const val COMMENTS_ORIGIN = "comments"

/** The `from` a search result opens a profile with (`Back to the search`, ProfileOther.md:73). */
const val SEARCH_ORIGIN = "search"

/** The `from` a tag's page opens a profile with (`Back to #coastroad`). */
fun topicOrigin(name: String): String = "#$name"

/**
 * THE WAY BACK NAMES WHERE IT GOES (ProfileOther.md:71-75; copy-voice.md's
 * origin nouns): each origin the shell passes, and `Back to feed` for an entry
 * with no history behind it — the feed is a profile's home root.
 */
@Composable
internal fun backLabel(from: String?): String = when {
    from == SAVED_ORIGIN -> stringResource(R.string.profile_back_saved)
    from == HISTORY_ORIGIN -> stringResource(R.string.profile_back_history)
    from == NOTIFICATIONS_ORIGIN -> stringResource(R.string.profile_back_notifications)
    from == POST_ORIGIN -> stringResource(R.string.profile_back_post)
    from == COMMENTS_ORIGIN -> stringResource(R.string.profile_back_comments)
    from == SEARCH_ORIGIN -> stringResource(R.string.profile_back_search)
    from == OPINIONS_ORIGIN -> stringResource(R.string.profile_back_opinions)
    from != null && from.startsWith("#") -> stringResource(R.string.profile_back_topic, from.removePrefix("#"))
    else -> stringResource(R.string.profile_back_feed)
}

@Composable
fun ProfileScreen(
    state: ProfileUiState,
    /** The bar's Profile slot re-tapped over this root, counted ([RootReselectEffect]). */
    reselectSignal: Int = 0,
    profileSavedResult: Boolean,
    onProfileSavedResultConsumed: () -> Unit,
    onTabChange: (ProfileTab) -> Unit,
    onLoadMore: () -> Unit,
    /** The tail's Retry: the page that did not arrive (ProfileMoreFailed.md). */
    onRetryPage: () -> Unit = onLoadMore,
    onRetry: () -> Unit,
    onEdit: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenInvites: () -> Unit,
    onOpenPost: (String) -> Unit,
    onBack: (() -> Unit)?,
    keyBanner: @Composable () -> Unit = {},
    deletionBand: @Composable () -> Unit = {},
    banners: @Composable () -> Unit = {},
    /**
     * The opinion on the person, worn wide (ProfileOther.md:11): its target,
     * the target's name in the reader's words (`@ada`, `this account`) and
     * the registered `profile.identity.actionRow.stance`.
     */
    stanceControl: @Composable (target: String, targetLabel: String, node: DataNode) -> Unit = { _, _, _ -> },
    /** The app's one Saved overlay, which the ⋮'s Save row saves through; null stands it inert. */
    saved: SavedWrites? = null,
    /** The guest gate a signed-out reader's rows open; null when signed in. */
    onRequireAccount: (() -> Unit)? = null,
    /** The own menu's Saved row. */
    onOpenSaved: () -> Unit = {},
    /** The own menu's History row. */
    onOpenHistory: () -> Unit = {},
    /** Hands this profile to the platform's own share sheet. */
    onShareProfile: (String) -> Unit = {},
    /** The back arrow's spoken name, by where the reader came from; null reads `Back to feed`. */
    backDescription: String? = null,
    /** The reader's hidden set, which the ⋮'s Hide row hides through; null stands it inert. */
    hidden: HiddenSet? = null,
    /** The bell, right-most on the own profile root's band. */
    bell: BandBell? = null,
    /** The band's chats, between the gear and the bell. */
    onChats: (() -> Unit)? = null,
    /** `Message` on another's profile. */
    onMessage: () -> Unit = {},
    /** The figures' one door: the opinions page on this profile (Profile.md:49, ProfileOther.md:57). */
    onOpenOpinions: () -> Unit = {},
    /** The feed's own cards, which the Posts and Comments tabs draw. */
    cardsHost: ProfileCardsHost = NoProfileCards,
    /** What the cards report to History as they are seen. */
    seen: ProfileSeen = ProfileSeen(),
    /** The ⋮'s `Mention in a new post`: the wizard with this person staged (ProfileMenu.md:17). */
    onMention: (profileId: String) -> Unit = {},
    now: Instant = Instant.now(),
) {
    val snackbarHostState = remember { SnackbarHostState() }
    // THE ⋮'S AFTERMATH READS ON THE PAGE'S OWN SNACKBAR (`profile.snackbar`):
    // `Saved.`, `Removed from Saved.` and a hide's words, each with `Undo`.
    val savedHost = rememberSavedHost(saved, snackbarHostState, PROFILE / "snackbar", onRequireAccount, hidden)
    ProfileSavedConfirm(profileSavedResult, snackbarHostState, onProfileSavedResultConsumed)
    // The list is the screen's, not the body's: the bar's re-tap scrolls it
    // whatever the body is showing when the tap lands.
    val list = rememberLazyListState()
    RootReselectEffect(signal = reselectSignal, list = list)
    val collapsingTop = rememberCollapsingTop()
    Scaffold(
        modifier = Modifier.dataNodeSurface(),
        snackbarHost = { CograSnackbarHost(snackbarHostState) },
        topBar = {
            Column {
                if (onBack == null) {
                    ProfileBand(collapsingTop, onOpenSettings, onChats, bell)
                } else {
                    ProfileHeaderBar(state.profile, collapsingTop, onBack, backDescription)
                }
                // Directly under the header, collapsing with it (FeedDeleting.md:5).
                CollapsingTopBand(collapsingTop) { deletionBand() }
                CollapsingTopBanner(collapsingTop) { keyBanner() }
            }
        },
    ) { padding ->
        // The pull-to-refresh box wires up inside the Scaffold's content
        // slot (design/readme.md, "The pull-down lives on every full-screen
        // scrolling root"), and the collapsing top's gate inside IT: the
        // refresh gesture would otherwise swallow the at-the-top leftover
        // that tells the gate the reader is back at the top (the feed's
        // wiring).
        PullToRefreshBox(
            isRefreshing = state.refreshing,
            onRefresh = onRetry,
            modifier = Modifier.padding(padding).fillMaxSize(),
        ) {
            Box(Modifier.fillMaxSize().collapsingTop(collapsingTop)) {
                ProfileBody(
                    state = state,
                    list = list,
                    savedHost = savedHost,
                    snackbarHostState = snackbarHostState,
                    actions = ProfileActions(
                        onTabChange = onTabChange,
                        onLoadMore = onLoadMore,
                        onRetryPage = onRetryPage,
                        onRetry = onRetry,
                        onEdit = onEdit,
                        onOpenInvites = onOpenInvites,
                        onOpenPost = onOpenPost,
                        onOpenSaved = onOpenSaved,
                        onOpenHistory = onOpenHistory,
                        onShareProfile = onShareProfile,
                        onRequireAccount = onRequireAccount,
                        onMessage = onMessage,
                        onOpenOpinions = onOpenOpinions,
                        seen = seen,
                        onMention = onMention,
                    ),
                    banners = banners,
                    drillIn = onBack != null,
                    stanceControl = stanceControl,
                    cardsHost = cardsHost,
                    now = now,
                )
            }
        }
    }
}

/** What the page's controls do, carried as one value so the body's signature stays readable. */
internal class ProfileActions(
    val onTabChange: (ProfileTab) -> Unit,
    val onLoadMore: () -> Unit,
    val onRetryPage: () -> Unit,
    val onRetry: () -> Unit,
    val onEdit: () -> Unit,
    val onOpenInvites: () -> Unit,
    val onOpenPost: (String) -> Unit,
    val onOpenSaved: () -> Unit,
    val onOpenHistory: () -> Unit,
    val onShareProfile: (String) -> Unit,
    val onRequireAccount: (() -> Unit)?,
    val onMessage: () -> Unit,
    val onOpenOpinions: () -> Unit,
    val seen: ProfileSeen,
    val onMention: (profileId: String) -> Unit = {},
)

/**
 * THE OWN ROOT'S BAND (`ProfileBand`, Profile.md:3): the mark and the
 * wordmark, then the gear, chats and the bell — the band carries no ⋮. It
 * leaves with the scroll and returns on the way up (Profile.md:19).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProfileBand(
    collapsingTop: CollapsingTop,
    onOpenSettings: () -> Unit,
    onChats: (() -> Unit)?,
    bell: BandBell?,
) {
    val band = PROFILE / "band"
    TopAppBar(
        title = { CograBandIdentity(node = band) },
        modifier = Modifier.dataNode(band),
        actions = {
            CograBandIcon(
                icon = Icons.Filled.Settings,
                description = stringResource(R.string.profile_open_settings),
                onClick = onOpenSettings,
                testTag = (band / "gear").tag,
            )
            onChats?.let { CograBandChats(it, node = band) }
            bell?.let { CograBandBell(it, node = band) }
            // The band's own 16dp end (`CograBand.jsx` `0 var(--space-4)`):
            // the bar's actions row already insets 4dp.
            Spacer(Modifier.width(Space.x3))
        },
        expandedHeight = Layout.TopBarHeight,
        colors = surfaceTopAppBarColors(),
        scrollBehavior = collapsingTop.scrollBehavior,
    )
}

@Composable
private fun ProfileBody(
    state: ProfileUiState,
    list: LazyListState,
    savedHost: SavedHost?,
    snackbarHostState: SnackbarHostState,
    actions: ProfileActions,
    banners: @Composable () -> Unit,
    drillIn: Boolean,
    stanceControl: @Composable (String, String, DataNode) -> Unit,
    cardsHost: ProfileCardsHost,
    now: Instant,
) {
    when {
        state.loading -> Box(Modifier.fillMaxSize()) {
            CircularProgressIndicator(
                modifier = Modifier.padding(24.dp).testTag("profile_loading"),
            )
        }
        state.notFound -> Column(Modifier.fillMaxSize().padding(24.dp)) {
            Text(
                text = stringResource(R.string.profile_not_found),
                modifier = Modifier.testTag("profile_not_found"),
            )
        }
        state.transportFailed && state.profile == null ->
            Column(Modifier.fillMaxSize().padding(24.dp)) {
                Text(
                    text = stringResource(R.string.error_transport),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("profile_transport_error"),
                )
                TextButton(onClick = actions.onRetry, modifier = Modifier.testTag("profile_retry")) {
                    Text(stringResource(R.string.profile_retry))
                }
            }
        else -> state.profile?.let { profile ->
            // THE CARDS' AFTERMATH READS ON THE PAGE'S OWN SNACKBAR, and their
            // menus save and hide through the page's one overlay — as the
            // profile's own ⋮ does.
            val scope = rememberCoroutineScope()
            val notify: (String) -> Unit = { text ->
                scope.launch { snackbarHostState.showSnackbar(NodeSnackbarVisuals(text, PROFILE / "snackbar")) }
            }
            CompositionLocalProvider(LocalSavedHost provides savedHost) {
                cardsHost(notify) { cards ->
                    ProfileList(
                        state,
                        list,
                        profile,
                        savedHost,
                        snackbarHostState,
                        actions,
                        banners,
                        drillIn,
                        stanceControl,
                        cards,
                        now,
                    )
                }
            }
        }
    }
}

@Composable
private fun ProfileList(
    state: ProfileUiState,
    list: LazyListState,
    profile: ProfileView,
    savedHost: SavedHost?,
    snackbarHostState: SnackbarHostState,
    actions: ProfileActions,
    banners: @Composable () -> Unit,
    drillIn: Boolean,
    stanceControl: @Composable (String, String, DataNode) -> Unit,
    cards: ProfileCards,
    now: Instant,
) {
    LoadNextAtTheTail(
        list = list,
        rows = state.listed,
        ready = state.hasMore && !state.pageFailed && !state.rowsLoading,
        onLoadMore = actions.onLoadMore,
    )
    // SEEN, AT THE LIST: a post or comment card fully in the viewport joins
    // the reader's History, as itself (History.md:11); the header and the
    // chronicle's acts are never reported.
    val cardIds = remember(state.posts, state.comments) {
        state.posts.associate { postKey(it.id) to it.id } +
            state.comments.associate { commentKey(it.comment.id) to it.comment.id }
    }
    SeenCardsEffect(
        listState = list,
        nodeIdOf = { key -> (key as? String)?.let(cardIds::get) },
        onSeen = actions.seen.onCardsSeen,
        onEdgesSeen = actions.seen.onCardEdgesSeen,
        onCheckpoint = actions.seen.onCheckpoint,
        suspended = cards.covered,
    )
    // THE FEED'S ONE STAGE (ProfilePosts.md:7-11): at most one clip plays in
    // the list, and it re-elects at the list's hard top.
    ScrollStageHost(list, suspended = cards.covered, hardTopReelects = true) {
        ProfileColumn(
            state,
            list,
            profile,
            savedHost,
            snackbarHostState,
            actions,
            banners,
            drillIn,
            stanceControl,
            cards,
            now,
        )
    }
}

@Composable
private fun ProfileColumn(
    state: ProfileUiState,
    list: LazyListState,
    profile: ProfileView,
    savedHost: SavedHost?,
    snackbarHostState: SnackbarHostState,
    actions: ProfileActions,
    banners: @Composable () -> Unit,
    drillIn: Boolean,
    stanceControl: @Composable (String, String, DataNode) -> Unit,
    cards: ProfileCards,
    now: Instant,
) {
    val identity = PROFILE / "identity"
    // ONE SCROLL, ONE NAME: the tab's view is the list the header rides at
    // the top of (a lazy list has no box around a run of its items), so the
    // view's node — `profile.posts`, `profile.comments` or
    // `profile.chronicle` — names the scrolling list, its cards inside it.
    val view = viewNode(state.tab)
    val scope = rememberCoroutineScope()
    val replyLocked = stringResource(R.string.profile_reply_locked)
    val lockedReply: (() -> Unit)? = if (state.applicant) {
        { scope.launch { snackbarHostState.showSnackbar(NodeSnackbarVisuals(replyLocked, PROFILE / "snackbar")) } }
    } else {
        null
    }
    LazyColumn(state = list, modifier = Modifier.fillMaxSize().dataNode(view)) {
        // The status banners (the own root only), seamed only when they draw.
        item(key = "banners") {
            Box(Modifier.padding(horizontal = Space.x4)) { banners() }
        }
        item(key = "header") {
            ProfileHeader(
                profile = profile,
                showHandle = !drillIn,
                node = identity,
                actions = {
                    if (state.own) {
                        OwnActions(state, profile, savedHost, snackbarHostState, actions, identity)
                    } else {
                        OtherActions(state, profile, savedHost, snackbarHostState, actions, identity, stanceControl)
                    }
                },
                under = { savedHost?.comfortLine(profile.id)?.let { RowLine(it, "profile_row_line") } },
                figures = state.figures,
                own = state.own,
                onFigures = actions.onOpenOpinions,
            )
        }
        item(key = "tabs") { ProfileTabRow(state.tab, actions.onTabChange) }
        // Every view's list stands 8dp under the tab row, its cards 8dp
        // apart (`ChronicleList`; the ProfilePosts and ProfileComments
        // boards' `8px 0 0`), the gap carried under each card.
        item(key = "list-top") {
            Spacer(Modifier.fillMaxWidth().height(LIST_TOP))
        }
        if (state.listed == 0 && !state.rowsLoading && !state.pageFailed) {
            item(key = "empty") { TabEmpty(state.tab, state.applicant && state.own, view) }
        }
        when (state.tab) {
            ProfileTab.POSTS -> items(state.posts, key = { postKey(it.id) }) { post ->
                ScrollStageRow(postKey(post.id)) {
                    Box(Modifier.padding(bottom = LIST_GAP)) { cards.post(post, view / "card") }
                }
            }
            ProfileTab.COMMENTS -> items(state.comments, key = { commentKey(it.comment.id) }) { listed ->
                ScrollStageRow(commentKey(listed.comment.id)) {
                    Box(Modifier.padding(bottom = LIST_GAP)) {
                        cards.comment(listed, view / "commentCard", view / "viewReplies", lockedReply)
                    }
                }
            }
            ProfileTab.EVERYTHING -> itemsIndexed(state.rows, key = { _, row -> row.id }) { index, row ->
                Box(Modifier.padding(bottom = LIST_GAP)) {
                    ChronicleAct(row, index + 1, state.own, now, view / "act", actions.onOpenPost)
                }
            }
        }
        item(key = "tail") {
            ChronicleTail(
                paging = state.rowsLoading,
                failed = state.pageFailed,
                onRetry = actions.onRetryPage,
            )
        }
    }
}

/** The view the tab names, registered under the page's prefix (round 27, seam 252). */
private fun viewNode(tab: ProfileTab): DataNode = when (tab) {
    ProfileTab.POSTS -> PROFILE / "posts"
    ProfileTab.COMMENTS -> PROFILE / "comments"
    ProfileTab.EVERYTHING -> PROFILE / "chronicle"
}

/** A post card's list key, apart from a comment's and an act's. */
private fun postKey(id: String) = "post:$id"

/** A comment card's list key. */
private fun commentKey(id: String) = "comment:$id"

/**
 * A tab with nothing in it, at `EmptyState`: `Nothing here yet.`, the line
 * alone (Profile.md:27; ProfilePosts.md:5; ProfileComments.md:9) — a member
 * knows why their own is empty, and another's needs no reason. The
 * applicant's own chronicle says what fills it and when
 * (ProfileApplicant.md:22), because that is new.
 */
@Composable
private fun TabEmpty(tab: ProfileTab, applicantsOwn: Boolean, view: DataNode) {
    val applicant = applicantsOwn && tab == ProfileTab.EVERYTHING
    EmptyState(
        testTag = (view / "empty").tag,
        title = stringResource(
            if (applicant) R.string.profile_chronicle_empty_applicant else R.string.profile_chronicle_empty,
        ),
        modifier = Modifier.padding(horizontal = Space.x4),
        registered = true,
    )
}

/**
 * Your own row: `Edit profile` and `Invites` sharing what the ⋮ leaves
 * (`ProfileHeader.jsx` `own`). An applicant's Invites wears the locked look —
 * visibly inactive, still tappable — and its tap says what unlocks it
 * (ProfileApplicant.md:16-18).
 */
@Composable
private fun RowScope.OwnActions(
    state: ProfileUiState,
    profile: ProfileView,
    savedHost: SavedHost?,
    snackbarHostState: SnackbarHostState,
    actions: ProfileActions,
    identity: DataNode,
) {
    val scope = rememberCoroutineScope()
    val lockedMessage = stringResource(R.string.profile_invites_locked)
    val row = identity / "actionRow"
    CograRowButton(
        text = stringResource(R.string.profile_edit),
        onClick = actions.onEdit,
        size = ButtonSize.Compact,
        testTag = (row / "edit").tag,
        modifier = Modifier.weight(1f),
    )
    CograRowButton(
        text = stringResource(R.string.profile_invites),
        onClick = {
            if (state.applicant) {
                scope.launch {
                    snackbarHostState.showSnackbar(NodeSnackbarVisuals(lockedMessage, PROFILE / "snackbar"))
                }
            } else {
                actions.onOpenInvites()
            }
        },
        size = ButtonSize.Compact,
        alpha = if (state.applicant) StateTokens.DISABLED else 1f,
        testTag = (row / "invites").tag,
        modifier = Modifier.weight(1f),
    )
    ProfileMenu(
        kind = ProfileMenuKind.OWN,
        profile = profile,
        saved = savedHost,
        onOpenSaved = actions.onOpenSaved,
        onOpenHistory = actions.onOpenHistory,
        onShare = { actions.onShareProfile(profile.handle) },
        onRequireAccount = null,
    )
}

/**
 * Another's row: the opinion on them worn wide, taking what the row leaves;
 * `Message` sized by its word; the ⋮ closing it (ProfileOther.md:11). A
 * deleted account's row has no Message — a message targets a person, and the
 * person is gone (ProfileDeleted.md:19) — and its anchor names `this account`.
 */
@Composable
private fun RowScope.OtherActions(
    state: ProfileUiState,
    profile: ProfileView,
    savedHost: SavedHost?,
    snackbarHostState: SnackbarHostState,
    actions: ProfileActions,
    identity: DataNode,
    stanceControl: @Composable (String, String, DataNode) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val postLocked = stringResource(R.string.profile_mention_locked)
    // MENTION OPENS THE WIZARD WITH THE PERSON STAGED (ProfileMenu.md:17); an
    // applicant is told instead, and the wizard never opens (ProfileMenu.md:19).
    val mention: () -> Unit = {
        if (state.applicant) {
            scope.launch { snackbarHostState.showSnackbar(NodeSnackbarVisuals(postLocked, PROFILE / "snackbar")) }
        } else {
            actions.onMention(profile.id)
        }
    }
    val row = identity / "actionRow"
    val label = if (profile.deleted) stringResource(R.string.profile_target_account) else "@${profile.handle}"
    Box(Modifier.weight(1f)) { stanceControl(profile.id, label, row / "stance") }
    if (!profile.deleted) {
        CograRowButton(
            text = stringResource(R.string.profile_message),
            onClick = { actions.onRequireAccount?.invoke() ?: actions.onMessage() },
            testTag = (row / "message").tag,
        )
    }
    ProfileMenu(
        kind = if (profile.deleted) ProfileMenuKind.DELETED else ProfileMenuKind.OTHER,
        profile = profile,
        saved = savedHost,
        onOpenSaved = actions.onOpenSaved,
        onOpenHistory = actions.onOpenHistory,
        onShare = { actions.onShareProfile(profile.handle) },
        onRequireAccount = actions.onRequireAccount,
        onMention = mention,
    )
}

/** A view's own 8dp ground above its first card (`ChronicleList` `padding: 8 16 0`; ProfilePosts' `8px 0 0`). */
private val LIST_TOP = 8.dp

/** Between two cards (`ChronicleList` `gap: 8`; ProfilePosts' and ProfileComments' `gap: 8`). */
private val LIST_GAP = 8.dp

/**
 * THE HEADER BAR CARRIES ONLY THE WAY BACK (ProfileOther.md:3), and it leaves
 * with the scroll and returns on the way up. No handle anywhere on a deleted
 * account's page, the bar's title included (ProfileDeleted.md:9).
 */
@Composable
private fun ProfileHeaderBar(
    profile: ProfileView?,
    collapsingTop: CollapsingTop,
    onBack: () -> Unit,
    backDescription: String?,
) {
    CollapsingTopBand(collapsingTop) {
        PageHeader(
            title = profile?.takeUnless { it.deleted }?.let { "@${it.handle}" },
            onBack = onBack,
            backContentDescription = backDescription ?: stringResource(R.string.profile_back_feed),
            node = PROFILE / "header",
        )
    }
}

/** The live opinion on the person: wide, named, on its registered node, the shell's guest gate passed through. */
@Composable
private fun ProfileStance(
    state: ProfileUiState,
    target: String,
    label: String,
    node: DataNode,
    onVouchedBack: (ProfileView) -> Unit,
    onRequireAccount: (() -> Unit)?,
) {
    val profile = state.profile
    // THE VOUCH-BACK STAYS OPEN FROM HERE (VouchBack.md:51): the tap opens
    // the vouch-back pad, Cancel closes back onto this profile
    // (VouchBackPad.md:47), and a taken signing opens the ceremony instead
    // of the control's own confirmation.
    val vouchBack = state.vouchesBack && profile != null
    StanceControlRoute(
        target = StanceTarget.Node(target),
        testTagPrefix = "profile",
        targetLabel = label,
        wide = true,
        node = node,
        variant = if (vouchBack) vouchBackVariant() else null,
        onTaken = if (vouchBack && profile != null) ({ onVouchedBack(profile) }) else null,
        onRequireAccount = onRequireAccount,
    )
}

/** The tab row: Posts, Comments and Everything, by glyph (Profile.md:21). */
@Composable
private fun ProfileTabRow(tab: ProfileTab, onTabChange: (ProfileTab) -> Unit) {
    TabBar(
        tabs = chronicleTabs(
            posts = stringResource(R.string.profile_filter_posts),
            comments = stringResource(R.string.profile_filter_comments),
            everything = stringResource(R.string.profile_filter_everything),
        ),
        value = tab.id,
        onSelect = { id -> onTabChange(ProfileTab.entries.first { it.id == id }) },
        label = stringResource(R.string.profile_tabs),
        node = PROFILE / "tabRow",
    )
}

/**
 * A saved edit's confirmation on the page's own snackbar. Consumed only after
 * the snackbar is done: clearing first would flip the LaunchedEffect key and
 * cancel the showing coroutine, so the confirmation was torn down in the
 * frame it was posted and the reader saw nothing. The refetch does not ride
 * this effect — the route fires it the moment the result arrives.
 */
@Composable
private fun ProfileSavedConfirm(result: Boolean, host: SnackbarHostState, onConsumed: () -> Unit) {
    val savedMessage = stringResource(R.string.profile_saved)
    LaunchedEffect(result) {
        if (result) {
            host.showSnackbar(NodeSnackbarVisuals(savedMessage, PROFILE / "snackbar"))
            onConsumed()
        }
    }
}
