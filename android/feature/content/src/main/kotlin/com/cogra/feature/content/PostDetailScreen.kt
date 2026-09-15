package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.ActorChip
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.PendingMarker
import com.cogra.core.designsystem.collapsingTop
import com.cogra.core.designsystem.rememberCollapsingTop
import com.cogra.core.designsystem.surfaceTopAppBarColors
import com.cogra.core.designsystem.v2.atom.CograOverflowMenu
import com.cogra.core.designsystem.v2.atom.LoadingState
import com.cogra.core.designsystem.v2.media.MediaViewer
import com.cogra.core.designsystem.v2.media.PinnedClip
import com.cogra.core.designsystem.v2.token.Layout
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.CommentView
import com.cogra.domain.LicenseChoice
import com.cogra.domain.PostView
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.isRevealed
import com.cogra.domain.stance.StanceTarget
import com.cogra.feature.content.R
import com.cogra.feature.content.reply.ReplyTarget
import com.cogra.feature.content.reply.ReplyTargetKind
import com.cogra.feature.stance.StanceControlRoute

@Composable
fun PostDetailRoute(
    postId: String,
    /** The viewer's account id; gates the edit affordance to the creator. */
    viewerId: String?,
    /** Null while the auth phase resolves; the comment/join affordances wait. */
    signedIn: Boolean?,
    onEdit: (String) -> Unit,
    /**
     * The reply wizard, pinned to what it answers — the post for
     * `ReplyEntry` 7, the comment for `ReplyEntry` 5. The target is
     * built here rather than by the caller because this is where the
     * thread's own words are.
     */
    onReply: (ReplyTarget) -> Unit,
    /** `ReplyMedia` 6 — `CommentEdit`, on an own comment. */
    onEditComment: (commentId: String, parentTitle: String) -> Unit,
    onOpenActor: (String) -> Unit,
    /** A post cited from the tags-and-references sheet. */
    onOpenPost: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    /** The Reference affordance (D20): compose a post citing this node. */
    onReference: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    onBack: () -> Unit,
    refreshSignal: Boolean = false,
    onRefreshSignalConsumed: () -> Unit = {},
    /**
     * THE SHEET'S OWN RETURN, not the detail's (jakob 2026-09-15). The
     * thread is the same sheet the feed raises, so a comment coming back
     * signed is answered by the sheet on either surface and this screen
     * only passes the two values through: where the reader was, and
     * which comment the new reply hangs under.
     */
    commentsReturn: CommentsReturn = CommentsReturn(),
    onCommentsReturnConsumed: () -> Unit = {},
    /** The reader's place, on the way out to a composer. */
    onCommentsDepart: (CommentsScroll) -> Unit = {},
    viewModel: PostDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    LaunchedEffect(postId) { viewModel.start(postId) }
    // In an effect, not the composition body: a recomposition that never
    // commits would otherwise consume the signal and fire the refetch
    // anyway.
    LaunchedEffect(refreshSignal) {
        if (refreshSignal) {
            onRefreshSignalConsumed()
            viewModel.refresh()
        }
    }
    PostDetailScreen(
        state = state,
        viewerId = viewerId,
        onRefresh = viewModel::refresh,
        onReveal = viewModel::onReveal,
        onEdit = onEdit,
        onOpenActor = onOpenActor,
        onOpenPost = onOpenPost,
        onOpenTopic = onOpenTopic,
        onReference = onReference,
        onShare = { id -> context.sharePost(viewModel.shareUrl(id)) },
        onBack = onBack,
        stanceControl = { target, tag -> StanceControlRoute(target = StanceTarget.Node(target), testTagPrefix = tag) },
        commentsSheet = { onDismiss ->
            CommentsSheetRoute(
                postId = postId,
                viewerId = viewerId,
                signedIn = signedIn,
                onDismiss = onDismiss,
                onReply = { request ->
                    val target = request.comment?.asReplyTarget() ?: state.post?.asReplyTarget()
                    target?.let(onReply)
                },
                onEditComment = { commentId ->
                    onEditComment(commentId, state.post?.title?.value.orEmpty())
                },
                onOpenActor = onOpenActor,
                onOpenTopic = onOpenTopic,
                onReference = onReference,
                onSignInOrJoin = onSignInOrJoin,
                onDepart = onCommentsDepart,
                commentsReturn = commentsReturn,
                onReturnConsumed = onCommentsReturnConsumed,
                stanceControl = { target, tag ->
                    StanceControlRoute(target = StanceTarget.Node(target), testTagPrefix = tag)
                },
            )
        },
    )
}

/**
 * THE SHEET'S TWO-VALUE RETURN (jakob 2026-09-15).
 *
 * A composer is a destination and the thread is not, so signing one
 * comes back to a sheet that has to be drawn again from nothing. "A
 * reply landed" cannot draw it: the reader has to find themselves where
 * they were, looking at what they just wrote — which sits one level
 * down, behind a count that was collapsed when they left.
 *
 * So the return carries both: [scroll] puts the thread back where it
 * stood, and [parentCommentId] names the branch that unfolds so the new
 * reply is on screen wearing its pending marker. Null [parentCommentId]
 * alongside a landing is a comment on the post itself, already at the
 * top level.
 *
 * [landed] is the third fact and not one of the two: it says whether
 * anything was signed at all. The place comes back from a composer the
 * reader ABANDONED too — leaving one should not cost them their place —
 * and only a landing earns the refetch and the confirmation.
 */
data class CommentsReturn(
    val scroll: CommentsScroll? = null,
    val landed: Boolean = false,
    val parentCommentId: String? = null,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostDetailScreen(
    state: PostDetailUiState,
    viewerId: String?,
    onRefresh: () -> Unit,
    /** A reader chose to look at one veiled body, as it stands. */
    onReveal: (String, SensitiveMark) -> Unit,
    onEdit: (String) -> Unit,
    onOpenActor: (String) -> Unit,
    /** A post cited from the tags-and-references sheet. */
    onOpenPost: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onReference: (String) -> Unit,
    /** Hands this post to the platform's own share sheet. */
    onShare: (String) -> Unit,
    onBack: () -> Unit,
    /** The stance control the post and every comment carry (design.md §6). */
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit = { _, _ -> },
    /**
     * THE THREAD, WHICH THIS SCREEN NO LONGER OWNS. The sheet is the one
     * comments surface and holds its own state, so the detail supplies
     * only the affordance that raises it and the slot it stands in —
     * exactly what the feed supplies.
     */
    commentsSheet: @Composable (onDismiss: () -> Unit) -> Unit = {},
) {
    val snackbar = remember { SnackbarHostState() }
    // THE LICENSE IS NEVER A STATE OF THE CARD (`ReaderPostMenu.jsx:27-29`):
    // one sheet for the screen, raised by the menu row that asked for it.
    // This screen's only such row is the post's own, in the top bar; a
    // comment's is the thread's, and rides the thread.
    var licenseShown by remember { mutableStateOf<LicenseChoice?>(null) }
    var removeOpen by remember { mutableStateOf(false) }
    // SAVED, not merely remembered: the composer and the comment editor are
    // their own destinations, so the thread is left and re-entered rather than
    // covered — and every way out of them comes back to it (`ReplyCompose` and
    // `CommentEdit` both cancel and advance to the thread).
    var commentsOpen by rememberSaveable { mutableStateOf(false) }
    val collapsingTop = rememberCollapsingTop()
    Scaffold(
        snackbarHost = { CograSnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                // The 48dp band every board draws (`spacing.css`
                // `--top-bar-height`, `PageHeader.jsx`); M3's small bar
                // defaults to 64dp, which is a rung the design does not
                // have. `expandedHeight` is the documented way to set it,
                // and the collapse arithmetic follows it.
                expandedHeight = Layout.TopBarHeight,
                colors = surfaceTopAppBarColors(),
                scrollBehavior = collapsingTop.scrollBehavior,
                // No title in the band: the post's title is the card's
                // heading, above its media (`_shared.jsx:287-289` — the
                // detail header takes no title prop).
                title = {},
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("detail_back")) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.content_back),
                        )
                    }
                },
                actions = {
                    DetailMenu(
                        post = state.post,
                        viewerId = viewerId,
                        onEdit = onEdit,
                        onCite = onReference,
                        onRemove = { removeOpen = true },
                        // Over the page — never stacked.
                        onLicense = { license -> licenseShown = license },
                    )
                },
            )
        },
    ) { padding ->
        PullToRefreshBox(
            // The read in flight, not the empty screen: a post opened
            // from the feed is already drawn while its read runs, and
            // an indicator over content the reader can see says the
            // screen is still arriving when it has arrived (HT-10).
            isRefreshing = state.refreshing,
            onRefresh = onRefresh,
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            // The collapsing top wires up inside the pull-to-refresh
            // box, not on the Scaffold: post-scroll flows innermost
            // first, and the refresh gesture consumes the unconsumed
            // at-the-top leftover — the gate's signal that the reader is
            // back at the top — before an outer gate would ever see it.
            // Outside, the bar stays hidden at the top of the thread
            // while a pull is already gathering, which reads as a
            // refresh fired mid-scroll (the feed's twin wiring).
            Box(
                Modifier
                    .fillMaxSize()
                    .collapsingTop(collapsingTop),
            ) {
                when {
                    state.notFound -> ErrorLine(
                        R.string.content_error_not_found,
                        "detail_not_found",
                        modifier = Modifier.padding(24.dp),
                    )
                    state.transportFault != null && state.post == null -> Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        ErrorLine(R.string.content_error_transport, "detail_transport_error")
                        TextButton(
                            onClick = onRefresh,
                            modifier = Modifier.testTag("detail_retry"),
                        ) {
                            Text(stringResource(R.string.content_retry))
                        }
                    }
                    // Nothing held and nothing arrived: the reader opened
                    // a post this device has never read. The surface says
                    // what it is doing in a line of text — the boards
                    // give a loading state no spinner
                    // (design/components/states/EmptyState.prompt.md).
                    state.loading && state.post == null -> LoadingState(
                        testTag = "detail_loading",
                        modifier = Modifier.padding(24.dp),
                    )
                    state.post != null -> Column(modifier = Modifier.fillMaxSize()) {
                        // A transport fault never blanks content already
                        // on screen, and it surfaces where the failed
                        // fetch was requested: a failed refresh on this
                        // banner, a failed comments page at the load-more
                        // slot in the thread (android.md "Degrade, never
                        // crash").
                        if (state.transportFault == TransportFault.REFRESH) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 24.dp, vertical = 8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                ErrorLine(
                                    R.string.content_error_transport,
                                    "detail_transport_banner",
                                )
                                TextButton(
                                    onClick = onRefresh,
                                    modifier = Modifier.testTag("detail_retry"),
                                ) {
                                    Text(stringResource(R.string.content_retry))
                                }
                            }
                        }
                        PostDetailBody(
                            state = state,
                            post = state.post,
                            onReveal = onReveal,
                            onOpenActor = onOpenActor,
                            onOpenPost = onOpenPost,
                            onOpenTopic = onOpenTopic,
                            onOpenComments = { commentsOpen = true },
                            onShare = onShare,
                            stanceControl = stanceControl,
                        )
                    }
                }
            }
        }
    }

    if (commentsOpen) {
        commentsSheet { commentsOpen = false }
    }
    // ONLY THE POST'S OWN TERMS REACH THIS MOUNT, so it is never stacked
    // (design/readme.md:2364). A comment's terms are raised from inside the
    // thread and stand over it — that mount moved into the sheet, which is
    // now the one thing that knows it is a sheet over a sheet.
    licenseShown?.let { license ->
        LicenseSheet(license = license, onDismiss = { licenseShown = null })
    }
    // THE DIALOG SHIPS, THE REMOVAL DOES NOT (jakob 2026-09-14): erasure is
    // slice 8's, whole — "we need to do erasure right so it should be one
    // task" — so Remove closes the dialog and changes nothing.
    if (removeOpen) {
        RemoveConfirm(
            onDismiss = { removeOpen = false },
            onRemove = { removeOpen = false },
        )
    }
}

/**
 * ON A DETAIL SURFACE THE MENU LIVES UP HERE and the card's own dot yields
 * (`_shared.jsx:337-341`): two dots would be two menus for one post.
 *
 * A REMOVED POST HAS NO MENU LEFT — back is the whole header
 * (`Removed.jsx:5-6`). There is nothing of it to edit, cite or license, and
 * the skeleton that holds the thread's place is not a thing a reader keeps.
 *
 * It lives in the top bar, over the plain page — never over the comments
 * thread — so it stays unstacked, unlike the comment's own menu.
 */
@Composable
private fun DetailMenu(
    post: PostView?,
    viewerId: String?,
    onEdit: (String) -> Unit,
    onCite: (String) -> Unit,
    onRemove: () -> Unit,
    onLicense: (LicenseChoice) -> Unit,
) {
    if (post == null) return
    if (isRemoved(post.content, post.attachments, post.attachmentsStatus)) return
    CograOverflowMenu(
        items = postMenuRows(
            own = viewerId != null && post.author?.id == viewerId,
            handle = post.author?.handle,
            license = post.license,
            onEdit = { onEdit(post.id) },
            onCite = { onCite(post.id) },
            onRemove = onRemove,
            onLicense = { onLicense(post.license) },
            testTagPrefix = "detail_menu",
        ),
        contentDescription = stringResource(R.string.content_menu_post),
        testTag = "detail_menu",
    )
}

@Composable
private fun PostDetailBody(
    state: PostDetailUiState,
    post: PostView,
    /** A reader chose to look at one veiled body, as it stands. */
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    /** A post cited from the tags-and-references sheet. */
    onOpenPost: (String) -> Unit,
    /** `ReplyEntry`: the affordance row's count raises the thread. */
    onOpenComments: () -> Unit,
    /** Hands this post to the platform's own share sheet. */
    onShare: (String) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit,
) {
    // A removed post keeps its skeleton and loses everything the payload
    // carried: the license, the topics and the citations rode it away.
    val removed = isRemoved(post.content, post.attachments, post.attachmentsStatus)
    // A VIDEO POST'S DETAIL IS ITS OWN BOARD (`screens/PostDetailVideo.jsx`):
    // the clip leaves the card body, pins above the column still playing, and
    // wears the full transport. A post of pictures is untouched — its gallery
    // is still the card's body. A removed record has no clip to pin.
    val pinned = if (removed) {
        null
    } else {
        post.attachments.firstOrNull { it.isVideo }?.toItem()
    }
    // THE FULLSCREEN VIEWER, over one of this post's attachments (DV-01/H-25).
    // Null is closed; the number is which attachment it opened on. It is held
    // here rather than in the card because "it never changes the underlying
    // route" (`MediaViewer.jsx:26`) — a layer over this screen, so this screen
    // owns whether it is up.
    var viewerAt by rememberSaveable { mutableStateOf<Int?>(null) }
    val attachments = remember(post.attachments) { post.attachments.map { it.toItem() } }

    Column(modifier = Modifier.fillMaxSize()) {
        if (pinned != null) {
            // OUTSIDE the list, which is what "pinned" means: the body rises
            // beneath a clip that stays put.
            PinnedClip(
                item = pinned,
                // The clip's two routes into the viewer — the bar's fullscreen
                // toggle and the clip's own tap (graph.json, `PostDetailVideo`
                // via 19 and via 3). A post carries one clip, so the viewer
                // opens on it.
                onOpenViewer = { viewerAt = 0 },
            )
        }
        // The post is a card here too, edge to edge with its 8dp seam — on the
        // boards the post wears the card and the thread stands in its own sheet
        // over it, not as a second half of this page.
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .testTag("detail_list"),
            contentPadding = PaddingValues(top = Space.x2, bottom = Space.x4),
            verticalArrangement = Arrangement.spacedBy(Space.x2),
        ) {
            item {
                DetailCard(
                    state = state,
                    post = post,
                    removed = removed,
                    mediaPinned = pinned != null,
                    // THE POST'S TAP OPENS THE FRAME (graph.json, `PostDetail`
                    // via 4), on the page the reader was looking at.
                    onOpenMedia = { page -> viewerAt = page },
                    onReveal = onReveal,
                    onOpenActor = onOpenActor,
                    onOpenTopic = onOpenTopic,
                    onOpenPost = onOpenPost,
                    onOpenComments = onOpenComments,
                    onShare = onShare,
                    stanceControl = stanceControl,
                )
            }
        }
    }

    // Over everything, answering to nothing behind it.
    viewerAt?.let { at ->
        MediaViewer(
            items = attachments,
            index = at,
            onClose = { viewerAt = null },
        )
    }
}

/** The post itself, as the card it wears on every surface. */
@Composable
private fun DetailCard(
    state: PostDetailUiState,
    post: PostView,
    removed: Boolean,
    /** The gallery's tap, handed the page under the reader's thumb. */
    onOpenMedia: (Int) -> Unit,
    /** The clip is pinned above this card, so the body draws no gallery. */
    mediaPinned: Boolean,
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onOpenPost: (String) -> Unit,
    onOpenComments: () -> Unit,
    onShare: (String) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth().testTag("detail_card")) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Space.x4),
            verticalArrangement = Arrangement.spacedBy(Space.x1),
        ) {
            // PEOPLE FIRST: the author leads, above the content and never
            // below it as a byline — including on a media post. On the video
            // detail the clip is above the CARD, so the chip leads the card
            // rather than the screen.
            ContentCardHeader(
                author = post.author,
                at = post.createdAt,
                onOpenActor = onOpenActor,
                testTagPrefix = "detail",
            )
            // The title titles the thing, so it stands above the media rather
            // than in the bar: below the picture it would read as a caption,
            // and the caption as a second one. The detail is the read surface,
            // so it never clamps.
            post.title.value?.takeIf { it.isNotEmpty() }?.let { title ->
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.testTag("detail_title"),
                )
            }
            // Media, words and description are one region because the veil
            // covers them as one state (D12); the title stays outside it.
            PostBody(
                content = post.content,
                description = post.description,
                attachments = post.attachments,
                attachmentsStatus = post.attachmentsStatus,
                moderation = post.moderation,
                testTagPrefix = "detail",
                modifier = Modifier.testTag("detail_body"),
                bleed = Space.x4,
                mediaPinned = mediaPinned,
                onOpenMedia = onOpenMedia,
                // The same set the feed reads: a reader who already chose to
                // look at this post is not asked again on the way in.
                revealed = state.reveals.isRevealed(post.id, post.sensitiveMark()),
                onReveal = { onReveal(post.id, post.sensitiveMark()) },
            )
            DetailCardFoot(
                post = post,
                removed = removed,
                onOpenTopic = onOpenTopic,
                onOpenActor = onOpenActor,
                onOpenPost = onOpenPost,
                onOpenComments = onOpenComments,
                onShare = onShare,
                stanceControl = stanceControl,
            )
        }
    }
}

/**
 * What closes the detail's card: the markers, the one topics line, and the
 * row of acts.
 *
 * The row is the same one the card wears (`PostCard.jsx`) — stance, comment,
 * share — and it is the skeleton a removal leaves standing, because no record
 * leaves the graph and no removal is silent.
 */
@Composable
private fun DetailCardFoot(
    post: PostView,
    removed: Boolean,
    onOpenTopic: (String) -> Unit,
    /** The sheet the topics line opens: a mention lands on the profile. */
    onOpenActor: (String) -> Unit,
    /** …and a cited post or comment on the post carrying it. */
    onOpenPost: (String) -> Unit,
    /** `ReplyEntry`: the affordance row's count raises the thread. */
    onOpenComments: () -> Unit,
    onShare: (String) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String) -> Unit,
) {
    if (post.landing.isPending) {
        PendingMarker(testTag = "detail_pending")
    }
    // The license, the topics and the citations rode the payload away.
    if (!removed) {
        // THE WHOLE LINE IS THE OPENER on a detail surface (`TopicsLine.jsx`),
        // and what it opens is the sheet the counts have always pointed at.
        var refsOpen by rememberSaveable { mutableStateOf(false) }
        TopicsLine(
            topics = post.topics,
            references = post.references,
            onOpenTopic = onOpenTopic,
            testTagPrefix = "detail_post",
            onOpen = { refsOpen = true },
        )
        if (refsOpen) {
            RefsSheet(
                topics = post.topics,
                references = post.references,
                onDismiss = { refsOpen = false },
                onOpenTopic = onOpenTopic,
                onOpenActor = onOpenActor,
                onOpenPost = onOpenPost,
                testTagPrefix = "detail_post",
            )
        }
    }
    PostAffordanceRow(
        commentCount = post.commentCount,
        onOpenComments = onOpenComments,
        onShare = { onShare(post.id) },
        testTagPrefix = "detail_post",
    ) {
        stanceControl(post.id, "detail_post")
    }
}

/**
 * The post, as the composer's target card reads it (`ReplyEntry` 7).
 *
 * A post leads with its title; the line under it is the body, clipped,
 * because the card gives it one line either way.
 */
internal fun PostView.asReplyTarget(): ReplyTarget = ReplyTarget(
    id = id,
    kind = ReplyTargetKind.Post,
    title = title.value.orEmpty(),
    snippet = content.value.orEmpty().clipForCard(),
    authorHandle = author?.handle.orEmpty(),
    avatarUrl = author?.avatar?.url,
)

/**
 * The comment, as the composer's target card reads it (`ReplyEntry` 5).
 *
 * A comment has no title, so its own opening words become one — the
 * card's two lines are then the answer's subject and its context, the
 * way a post's title and body are.
 */
internal fun CommentView.asReplyTarget(): ReplyTarget = ReplyTarget(
    id = id,
    kind = ReplyTargetKind.Comment,
    title = content.value.orEmpty().clipForCard(TARGET_TITLE_CHARS),
    snippet = content.value.orEmpty().clipForCard(),
    authorHandle = author?.handle.orEmpty(),
    avatarUrl = author?.avatar?.url,
)

/**
 * The card draws one line, and a route carries what it is given — so
 * the words are clipped where they are read rather than where they are
 * drawn.
 */
private fun String.clipForCard(limit: Int = TARGET_SNIPPET_CHARS): String =
    if (length <= limit) this else take(limit).trimEnd() + "…"

private const val TARGET_TITLE_CHARS = 48
private const val TARGET_SNIPPET_CHARS = 120
