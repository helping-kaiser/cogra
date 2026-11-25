// The topic screen (hashtag.md; roadmap "Slice 2.3"): a topic's name,
// the stance row, and the content currently tagged with it — the fold
// read from the Type's own side (`Hashtag.taggedContent`).
//
// THE TITLE CARRIES NO CONTROL AND THE ROW BELOW IT DOES (`TagPage`,
// the topic round 2026-09-14). A stance anchor on the bar's trailing
// edge read as a stance readout for the post the reader arrived from;
// a row of its own, under the title and above anything belonging to a
// post, cannot. THE GESTURE IS AN AFFINITY — the same ceremony every
// stance uses, wearing the family's own words (`StanceAxes.Affinity`)
// — so there is no toggle and no one-tap follow, and the word "follow"
// is not on the screen.
//
// THE ROW IS A SLOT, not a control this module builds. `feature:topics`
// depends on `core:domain` and never on a feature it would have to
// reach through — the shell owns what a signed-out tap does, so the
// shell passes the whole row in (android/CLAUDE.md, "Navigation is
// hoisted"). It is also why a guest reaches this page like anyone else:
// the page is public, the face wears the same no-standing affordance a
// reader with nothing said wears, and the tap raises the join prompt.
//
// EVERY ROW IS THE CLAIM AND THE THING'S OWN CARD (TagPage.md:15, :19):
// the feed's post card, or the comment card leading with the thread it
// answers, attached under the claim that put it here ([TaggedRow]). The
// cards are hosted by the shell for the same reason the row is — this
// module never depends on the feed's — so they arrive through
// [TopicCardsHost], with every door, menu, sheet and stage they carry on
// the feed, the profile and History.
//
// THE EMPTIED PAGE CARRIES THE ROW TOO (TagPageEmpty.md:9; jakob
// 2026-09-15 overruled item 81's "no face"): taking a position on a name
// needs no Tag records, so the row stands whatever the list holds.
//
// REGISTERED under `tagPage` (round 60): the header, the full name under it
// where the header cuts it (`name`, round 63), the row
// (`actionRow`, its `stance` and `share`), each row's `claim` keyed by the
// tagged thing's id, and the cards the shell hosts (`card`, `commentCard`).

package com.cogra.feature.topics

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
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.EdgeSighting
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.FittedName
import com.cogra.core.designsystem.NodeSnackbarVisuals
import com.cogra.core.designsystem.SeenCardsEffect
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.dataNodeSurface
import com.cogra.core.designsystem.v2.atom.ButtonKind
import com.cogra.core.designsystem.v2.atom.ButtonSize
import com.cogra.core.designsystem.v2.atom.CograButton
import com.cogra.core.designsystem.v2.atom.EmptyState
import com.cogra.core.designsystem.v2.atom.PageHeader
import com.cogra.core.designsystem.v2.atom.hitTarget
import com.cogra.core.designsystem.v2.media.ScrollStageHost
import com.cogra.core.designsystem.v2.media.ScrollStageRow
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.PostView
import com.cogra.domain.ProfileComment
import com.cogra.domain.TaggedContentView
import com.cogra.domain.TaggedNode
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.saved.SavedWrites
import com.cogra.feature.saved.LocalSavedHost
import com.cogra.feature.saved.rememberHiddenSet
import com.cogra.feature.saved.rememberSavedHost
import com.cogra.feature.saved.rememberSavedWrites
import kotlinx.coroutines.launch

/** The `from` a History tag card opens a topic with (`Back to History`). */
const val TOPIC_FROM_HISTORY = "history"

/** The `from` a search result opens a topic with (`Back to the search`, TagPage.md:35). */
const val TOPIC_FROM_SEARCH = "search"

/** The `from` a Your-topics row opens a topic with (`Back to Your tags`, TagPage.md:49). */
const val TOPIC_FROM_YOUR_TOPICS = "yourTopics"

/** The `from` a feed card's chip opens a topic with (`Back to feed`, TagPage.md:49). */
const val TOPIC_FROM_FEED = "feed"

/** The `from` a post's tags-and-references sheet opens a topic with (`Back to the post`, TagPage.md:49). */
const val TOPIC_FROM_POST = "post"

/** The `from` a card on another's profile opens a topic with (`Back to the profile`, TagPage.md:49). */
const val TOPIC_FROM_PROFILE = "profile"

/** The `from` a card on the reader's own profile opens a topic with (`Back to your profile`, TagPage.md:49). */
const val TOPIC_FROM_OWN_PROFILE = "ownProfile"

/** The `from` a Saved card opens a topic with (`Back to Saved`, TagPage.md:49). */
const val TOPIC_FROM_SAVED = "saved"

/** The `from` another tag's page opens a topic with: that tag, `#` and all (`Back to #fieldnotes`, TagPage.md:49). */
fun topicFromTopic(name: String): String = "#$name"

/** The tag page's registered root (`tagPage.*`: TagPage, TagPageHeldPad, the menu boards). */
private val TAG_PAGE = DataNode("tagPage")

/**
 * The topic's wide anchor, drawn by the shell: [node] is the registered
 * control (`tagPage.actionRow.stance`), its open pad `node / "pad"`.
 */
typealias TopicStanceSlot = @Composable (node: DataNode) -> Unit

/**
 * What the tag page draws its rows' cards with: the feed's own post and
 * comment cards, hosted by the shell. [covered] is true while a sheet the
 * cards raised stands over the page — the stage holds and nothing counts as
 * seen, as on the feed.
 */
class TopicCards(
    /** One tagged post as the feed's post card, wearing [node] keyed by its id. */
    val post: @Composable (post: PostView, node: DataNode) -> Unit,
    /** One tagged comment as the comment card leading with what it answers, wearing [node] keyed by its id. */
    val comment: @Composable (listed: ProfileComment, node: DataNode) -> Unit,
    val covered: Boolean = false,
)

/**
 * Hosts [TopicCards] over the page: the shell wraps the list in the feed's
 * card host, which keeps the sheets the cards raise over it, and tells their
 * aftermath — `Reported.` — through [notify] on the page's own snackbar.
 */
typealias TopicCardsHost = @Composable (notify: (String) -> Unit, content: @Composable (TopicCards) -> Unit) -> Unit

/**
 * What the tag page's cards' menus write through (TagPageMenu.md:7,
 * TagPageCommentMenu.md:7, TagPageCommentRemovedMenu.md:9): the app's Saved
 * overlay and hidden set, and the guest gate their Save and Hide raise for one
 * signed out. Nothing given stands the rows inert.
 */
class TopicMenuWrites(
    val saved: SavedWrites? = null,
    val hidden: HiddenSet? = null,
    val onGuest: (() -> Unit)? = null,
)

/** No host: the rows draw their claims alone — for previews and the screen's own tests. */
val NoTopicCards: TopicCardsHost = { _, content -> content(TopicCards({ _, _ -> }, { _, _ -> })) }

@Composable
fun TopicRoute(
    name: String,
    /** Where the page was opened from; it names the way back (TagPage.md:49). */
    from: String? = null,
    onBack: () -> Unit,
    stanceControl: TopicStanceSlot? = null,
    /** The deletion band, while the account's confirmed deletion is in its grace (`FeedDeleting.md:3`). */
    deletionBand: @Composable () -> Unit = {},
    /** The feed's cards, hosted over the page by the shell (TagPage.md:15). */
    cardsHost: TopicCardsHost = NoTopicCards,
    /** The guest gate the cards' Save and Hide raise; null when signed in. */
    onRequireAccount: (() -> Unit)? = null,
    viewModel: TopicViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    LaunchedEffect(name) { viewModel.start(name) }
    TopicScreen(
        name = name,
        state = state,
        onRefresh = viewModel::refresh,
        onBack = onBack,
        stanceControl = stanceControl,
        onCardsSeen = viewModel::onCardsSeen,
        onCardEdgesSeen = viewModel::onCardEdgesSeen,
        onSeenCheckpoint = viewModel::onSeenCheckpoint,
        deletionBand = deletionBand,
        backDescription = topicBack(from),
        onShare = { context.shareTopic(viewModel.shareUrl(name)) },
        cardsHost = cardsHost,
        menus = TopicMenuWrites(rememberSavedWrites(), rememberHiddenSet(), onRequireAccount),
    )
}

/** The platform's own share sheet for the tag's web address. */
private fun Context.shareTopic(url: String) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, url)
    }
    startActivity(Intent.createChooser(send, null))
}

/** The back arrow's origin noun (TagPage.md:49); null is the plain `Back`. */
@Composable
internal fun topicBack(from: String?): String? = when {
    from == TOPIC_FROM_HISTORY -> stringResource(R.string.topics_back_history)
    from == TOPIC_FROM_SEARCH -> stringResource(R.string.topics_back_search)
    from == TOPIC_FROM_YOUR_TOPICS -> stringResource(R.string.topics_back_your_topics)
    from == TOPIC_FROM_FEED -> stringResource(R.string.topics_back_feed)
    from == TOPIC_FROM_POST -> stringResource(R.string.topics_back_post)
    from == TOPIC_FROM_PROFILE -> stringResource(R.string.topics_back_profile)
    from == TOPIC_FROM_OWN_PROFILE -> stringResource(R.string.topics_back_own_profile)
    from == TOPIC_FROM_SAVED -> stringResource(R.string.topics_back_saved)
    from != null && from.startsWith("#") -> stringResource(R.string.topics_back_topic, from.removePrefix("#"))
    else -> null
}

@Composable
fun TopicScreen(
    name: String,
    state: TopicUiState,
    onRefresh: () -> Unit,
    onBack: () -> Unit,
    /**
     * The page's one action, drawn by the shell, wearing the node it is
     * handed (`tagPage.actionRow.stance`, its pad `.pad`). Null while the auth
     * state is still unknown — the signed-in and signed-out readings
     * differ, and guessing puts the wrong action on the tap for a frame.
     */
    stanceControl: TopicStanceSlot? = null,
    /** Content cards that stood fully in the viewport (`SeenCardsEffect`). */
    onCardsSeen: (List<String>) -> Unit = {},
    /** Tall cards with an edge on screen this frame (History.md:13). */
    onCardEdgesSeen: (List<EdgeSighting>) -> Unit = {},
    /** The reading paused: the scroll rested, or the reader left. */
    onSeenCheckpoint: () -> Unit = {},
    deletionBand: @Composable () -> Unit = {},
    /** The back arrow's spoken name when it names an origin; null is the plain `Back`. */
    backDescription: String? = null,
    /** The stance row's share: the tag's own address, handed to the platform's sheet. */
    onShare: () -> Unit = {},
    cardsHost: TopicCardsHost = NoTopicCards,
    /** What the cards' menus save and hide through, their words on this page's snackbar. */
    menus: TopicMenuWrites = TopicMenuWrites(),
) {
    val listState = rememberLazyListState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val notify: (String) -> Unit = { text ->
        scope.launch { snackbarHostState.showSnackbar(NodeSnackbarVisuals(text, TAG_PAGE / "snackbar")) }
    }
    // THE MENUS' AFTERMATH READS ON THE PAGE'S OWN SNACKBAR (`tagPage.snackbar`,
    // TagPageMenu.md:7, TagPageCommentMenu.md:7): `Saved.`, a hide's words, each
    // with `Undo` — the menus under it save and hide through this host.
    val snackbar = TAG_PAGE / "snackbar"
    val savedHost = rememberSavedHost(menus.saved, snackbarHostState, snackbar, menus.onGuest, menus.hidden)
    // "TOO LONG" IS THE TITLE'S OWN MEASURED CUT (TagPage.md:5, :7, :15),
    // never a count of characters: the header says on every layout whether
    // its one line cut the name, so a turned phone that fits it drops the
    // heading and a narrower one prints it again.
    var titleCut by remember(name) { mutableStateOf(false) }
    Scaffold(
        // A registered surface: its tags reach UiAutomator as resource ids.
        modifier = Modifier.dataNodeSurface(),
        topBar = { TagPageHeader(name, onBack, backDescription, deletionBand) { titleCut = it } },
        snackbarHost = { CograSnackbarHost(snackbarHostState) },
    ) { padding ->
        Box(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            when {
                state.loading -> CircularProgressIndicator(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .testTag("topic_loading"),
                )
                state.notFound || state.transportFailed -> UnreadPage(state.notFound, onRefresh)
                else -> Column(modifier = Modifier.fillMaxSize()) {
                    // Under the title, above anything belonging to a
                    // post — outside the list, so it does not scroll
                    // away from the page it acts on. The emptied page
                    // carries it too, holding nothing (TagPageEmpty.md:9).
                    // The whole name, where the title cut it, stands
                    // above the row (`TagPageBody`'s order); only the
                    // read page prints it.
                    if (titleCut) TagFullName(name)
                    StanceRow(name, stanceControl, onShare)
                    CompositionLocalProvider(LocalSavedHost provides savedHost) {
                        cardsHost(notify) { cards ->
                            val seen = TopicSeen(onCardsSeen, onCardEdgesSeen, onSeenCheckpoint)
                            TaggedList(state = state, listState = listState, cards = cards, seen = seen)
                        }
                    }
                }
            }
        }
    }
}

/**
 * THE HOUSE HEADER (`PageHeader`, TagPage.md:3, :7) as `tagPage.header`: the
 * arrow naming its origin and the tag, # and all — and no control; the
 * deletion band directly under it (FeedDeleting.md:5).
 */
@Composable
private fun TagPageHeader(
    name: String,
    onBack: () -> Unit,
    backDescription: String?,
    deletionBand: @Composable () -> Unit,
    onTitleCut: (Boolean) -> Unit,
) {
    Column {
        PageHeader(
            title = "#$name",
            onBack = onBack,
            backContentDescription = backDescription ?: stringResource(R.string.topics_back),
            node = TAG_PAGE / "header",
            onTitleCut = onTitleCut,
        )
        deletionBand()
    }
}

/**
 * THE TAG'S FULL NAME (`TagFullName`, TagPage.md:7-17) as `tagPage.name`: the
 * whole name, # and all, in the title role, wrapping at its hyphens and
 * breaking inside a run that has none — the one place a tag's name wraps,
 * never cut. IT SHRINKS TO FIT (round 66): the profile head's two-line rule
 * with a 12 floor ([FittedName]). Print only: the header's title already
 * speaks the whole name, so the heading is hidden from assistive technology.
 */
@Composable
private fun TagFullName(name: String) {
    FittedName(
        text = "#$name",
        style = MaterialTheme.typography.titleLarge,
        color = MaterialTheme.colorScheme.onSurface,
        floor = TAG_NAME_FLOOR,
        modifier = Modifier
            .fillMaxWidth()
            .dataNode(TAG_PAGE / "name")
            // `padding: 4px 16px 0` (`TagFullName`).
            .padding(start = Space.x4, end = Space.x4, top = Space.x1),
        textModifier = Modifier.semantics { hideFromAccessibility() },
    )
}

/** The heading's smallest size (jakob 2026-11-23: never below 12). */
private const val TAG_NAME_FLOOR = 12

/**
 * The page's place where nothing could be listed, the header standing above it:
 * the answer no for a name that cannot be a tag (TagPage.md:69-71) — the
 * not-found family's `EmptyState`, never the failure voice or its colour, and
 * nothing on it retries — or no answer at all (:65), the house line over an
 * outlined Retry leading the column, `ProfileUnreachable`'s shape.
 */
@Composable
private fun UnreadPage(notFound: Boolean, onRetry: () -> Unit) {
    if (notFound) {
        EmptyState(
            testTag = "topic_not_found",
            title = stringResource(R.string.topics_not_found),
            modifier = Modifier.padding(horizontal = Space.x6, vertical = Space.x2),
        )
    } else {
        Column(
            modifier = Modifier.padding(horizontal = Space.x6, vertical = Space.x4),
            verticalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            ErrorLine(R.string.topics_error_transport, "topic_transport_error")
            CograButton(
                text = stringResource(R.string.topics_retry),
                onClick = onRetry,
                kind = ButtonKind.Outlined,
                size = ButtonSize.Compact,
                testTag = "topic_retry",
            )
        }
    }
}

/**
 * The topic's stance row (`TopicStanceRow`, registered as `tagPage.actionRow`):
 * the wide anchor the shell passes in, wearing `actionRow.stance`, and the tag's
 * share, `actionRow.share` — round 48's names.
 */
@Composable
private fun StanceRow(name: String, stanceControl: TopicStanceSlot?, onShare: () -> Unit) {
    val row = TAG_PAGE / "actionRow"
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .dataNode(row)
            .padding(start = Space.x4, end = Space.x4, top = Space.x1, bottom = Space.x2),
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f)) {
            if (stanceControl != null) {
                Box(Modifier.fillMaxWidth()) { stanceControl(row / "stance") }
            }
        }
        // DRAWN COMPACT, TAPPED AT 48 (`TagPage`'s row, `ShareButton.jsx`): the
        // 18 glyph on 6 above and below and 8 at the sides, its 48 target an
        // invisible margin, so the row's right edge is the drawn pill's.
        val description = stringResource(R.string.topics_share, name)
        Box(
            modifier = Modifier
                .dataNode(row / "share")
                .hitTarget(
                    interactive = Modifier
                        .clip(CircleShape)
                        .clickable(role = Role.Button, onClick = onShare)
                        .semantics(mergeDescendants = true) { contentDescription = description },
                    drawnWidth = SHARE_GLYPH + Space.x2 * 2,
                    drawnHeight = SHARE_GLYPH + SHARE_INSET * 2,
                )
                .padding(horizontal = Space.x2, vertical = SHARE_INSET),
        ) {
            Icon(
                Icons.Filled.Share,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(SHARE_GLYPH),
            )
        }
    }
}

/** The share's glyph is 18, drawn on 6 above and below (`TagPage`'s row). */
private val SHARE_GLYPH = 18.dp
private val SHARE_INSET = 6.dp

/** What the list reports to History as the reader sees it (History.md). */
private class TopicSeen(
    val onCardsSeen: (List<String>) -> Unit,
    val onCardEdgesSeen: (List<EdgeSighting>) -> Unit,
    val onCheckpoint: () -> Unit,
)

/**
 * The rows, newest claim first as the read hands them (TagPage.md:11): each
 * the claim and the thing's own card under it, on the feed's one stage — at
 * most one clip plays, re-electing at the list's hard top (:27, :33-35).
 */
@Composable
private fun TaggedList(state: TopicUiState, listState: LazyListState, cards: TopicCards, seen: TopicSeen) {
    val rows = remember(state.content) { state.content.filter { it.node != null } }
    // SEEN, AT THE LIST: a post or comment card fully in the viewport joins
    // the reader's History, as itself (History.md). The page's own title is
    // a page rendering, not a card, and is never reported (H1 leaves pages
    // out); neither is a kind this build does not render.
    val cardIds = remember(rows) { rows.associate { it.listKey() to it.id } }
    SeenCardsEffect(
        listState = listState,
        nodeIdOf = { key -> cardIds[key] },
        onSeen = seen.onCardsSeen,
        onEdgesSeen = seen.onCardEdgesSeen,
        onCheckpoint = seen.onCheckpoint,
        suspended = cards.covered,
    )
    ScrollStageHost(listState, suspended = cards.covered, hardTopReelects = true) {
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .testTag("topic_list"),
            // THE CLAIM IS FLUSH WITH THE LIST'S LEFT EDGE (`TaggedRow`): the
            // rows run edge to edge, 8 apart, as the feed's cards do.
            contentPadding = PaddingValues(top = Space.x1, bottom = Space.x4),
            verticalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            if (!state.contentLoading && state.content.isEmpty()) {
                // THE EMPTIED PAGE (TagPageEmpty.md:3-7): the calm `EmptyState`,
                // 24 at the sides and 4 under the row — no action, no error colour.
                // `tagPage.empty` is the empty state's own box (EmptyState.jsx); the
                // board's `4px 24px 0` wrapper around it is the page's, unregistered
                // (TagPageEmpty.jsx) — the 4 is the list's own top padding.
                item {
                    Box(Modifier.padding(horizontal = Space.x6)) {
                        EmptyState(
                            testTag = (TAG_PAGE / "empty").tag,
                            title = stringResource(R.string.topics_content_empty),
                            node = TAG_PAGE / "empty",
                        )
                    }
                }
            }
            items(rows, key = { it.listKey() }) { entry ->
                ScrollStageRow(entry.listKey()) { TaggedCard(entry, cards) }
            }
            if (state.contentLoading) {
                item {
                    CircularProgressIndicator(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp)
                            .testTag("topic_content_loading"),
                    )
                }
            }
        }
    }
}

/** One row: the claim, and under it the post card or the comment card leading with its thread. */
@Composable
private fun TaggedCard(entry: TaggedContentView, cards: TopicCards) {
    when (val node = entry.node) {
        is TaggedNode.Post -> TaggedRow(entry, TAG_PAGE / "claim") { cards.post(node.post, TAG_PAGE / "card") }
        is TaggedNode.Comment -> TaggedRow(entry, TAG_PAGE / "claim") {
            cards.comment(node.listed, TAG_PAGE / "commentCard")
        }
        null -> Unit
    }
}

/** The row's list key, kind and id together; the seen map reads it back. */
private fun TaggedContentView.listKey(): String = "$kind:$id"
