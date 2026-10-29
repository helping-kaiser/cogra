package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cogra.core.designsystem.CograSnackbarHost
import com.cogra.core.designsystem.CommentStanceTarget
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.PendingMarker
import com.cogra.core.designsystem.RowLine
import com.cogra.core.designsystem.dataNode
import com.cogra.core.designsystem.v2.atom.CograSheetHost
import com.cogra.core.designsystem.v2.atom.CograSheetSurface
import com.cogra.core.designsystem.v2.atom.LoadingState
import com.cogra.core.designsystem.v2.atom.MenuRow
import com.cogra.core.designsystem.v2.atom.SheetTitle
import com.cogra.core.designsystem.v2.media.ScrollStageHost
import com.cogra.core.designsystem.v2.media.ScrollStageRow
import com.cogra.core.designsystem.v2.media.SensitiveSource
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.domain.CommentView
import com.cogra.domain.LicenseChoice
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.content.isRevealed
import com.cogra.domain.removal.RemovalKind
import com.cogra.domain.removal.marked
import com.cogra.domain.saved.SavedWrites
import com.cogra.feature.content.R
import com.cogra.feature.saved.LocalSavedHost
import com.cogra.feature.saved.rememberSavedHost
import com.cogra.feature.saved.rememberSavedWrites
import kotlinx.coroutines.flow.first

/**
 * THE COMMENTS SHEET, WIRED TO ITS OWN THREAD — the one comments surface
 * (jakob 2026-09-15).
 *
 * The same sheet the detail raises, raised over the feed by a card's
 * comment count, and full-function on both: reply, the comment ⋮, edit.
 * It is not a navigation destination — a sheet is a layer over the
 * surface that raised it, and the route below never changes — so it
 * takes its post id as an argument and binds [CommentsViewModel] to it,
 * rather than being reached by navigating.
 *
 * @param restoreTo where the reader was when the sheet gave way to a
 *   composer, and [pendingParent] which comment the new reply hangs
 *   under: the two halves of the return, both of them read from where
 *   the surface below keeps its results.
 */
@Composable
fun CommentsSheetRoute(
    postId: String,
    /** The viewer's account id; gates the per-comment edit affordance. */
    viewerId: String?,
    /** Null while the auth phase resolves; the comment affordances wait. */
    signedIn: Boolean?,
    onDismiss: () -> Unit,
    /** The composer, pinned to what it answers (`ReplyEntry` 5 and 7). */
    onReply: (ReplyTargetRequest) -> Unit,
    /** `ReplyMedia` 6 — `CommentEdit`, on an own comment. */
    onEditComment: (commentId: String) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    /** The Reference affordance (D20): compose a post citing this node. */
    onReference: (String) -> Unit,
    onSignInOrJoin: () -> Unit,
    /**
     * Called as the sheet gives way to a composer, carrying the reader's
     * place — the surface below keeps it until they come back.
     */
    onDepart: (CommentsScroll) -> Unit = {},
    /** What came back with the reader — see [CommentsReturn]. */
    commentsReturn: CommentsReturn = CommentsReturn(),
    /** Marks the return consumed, so it cannot fire twice. */
    onReturnConsumed: () -> Unit = {},
    /**
     * THE SURFACE'S OWN RE-PULL, HANDED DOWN. The thread binds once per post
     * ([CommentsViewModel.start] returns early on a second raise of the same
     * one), which is what keeps a reader's unfolded branches across a trip to
     * the composer — but it also meant a reader who pulled the surface to
     * refresh raised the sheet on the page read before the pull. A bump here
     * is the surface saying its own read is stale, so the thread re-reads too.
     */
    refreshToken: Int = 0,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit = { _, _, _ -> },
    /** A comment to land on: the thread pages and unfolds until it stands, then scrolls to it. */
    landOn: String? = null,
    /** The guest gate a signed-out reader's Save opens; null when signed in. */
    onRequireAccount: (() -> Unit)? = null,
    /**
     * The landing came from a comment card's comment glyph (FeedKinds.md,
     * Saved.md): once the landed comment stands, the reply composer opens
     * aimed at it.
     */
    aimReply: Boolean = false,
    viewModel: CommentsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(postId) { viewModel.start(postId) }
    LaunchedEffect(postId, landOn) { landOn?.let(viewModel.landing::landOn) }
    LaunchedEffect(postId, landOn, aimReply) {
        val at = landOn ?: return@LaunchedEffect
        if (!aimReply) return@LaunchedEffect
        val landed = viewModel.state.first { it.standing(at) != null }.standing(at)
        onReply(ReplyTargetRequest(postId, landed))
    }
    // In an effect, not the composition body: a recomposition that never
    // commits would otherwise fire the refetch anyway. The landing is
    // not consumed here — the place is the other half of the same
    // return, and clearing it before the thread has been put back would
    // lose it.
    LaunchedEffect(commentsReturn.landed, commentsReturn.parentCommentId) {
        if (commentsReturn.landed) {
            viewModel.onCommentLanded(commentsReturn.parentCommentId)
        }
    }
    // Zero is the token nobody pulled with, so the first composition does not
    // read the thread a second time on top of `start`.
    LaunchedEffect(refreshToken) {
        if (refreshToken > 0) viewModel.refresh()
    }
    // The terms stand OUTSIDE the sheet's own window, as a sibling: a
    // modal sheet raised from inside another one would leave the thread
    // beneath it inert. Only a COMMENT's terms reach this mount — the
    // post's own are raised by the surface below — so it is always the
    // stacked case (`CommentLicense.jsx`, design/readme.md:2364).
    var licenseShown by remember { mutableStateOf<LicenseChoice?>(null) }
    CommentsSheet(
        state = state,
        viewerId = viewerId,
        signedIn = signedIn,
        restoreTo = commentsReturn.scroll,
        onRestored = onReturnConsumed,
        onDismiss = onDismiss,
        onDepart = onDepart,
        onLoadMoreComments = viewModel::loadMore,
        onAddComment = { onReply(ReplyTargetRequest(postId, null)) },
        onReplyTo = { comment -> onReply(ReplyTargetRequest(postId, comment)) },
        onEditComment = { comment -> onEditComment(comment.id) },
        onCommentSignedShown = viewModel::onCommentSignedShown,
        onLoadMoreReplies = viewModel::onLoadMoreReplies,
        onReveal = viewModel::onReveal,
        onOpenActor = onOpenActor,
        onOpenTopic = onOpenTopic,
        onReference = onReference,
        onLicense = { licenseShown = it },
        onSignInOrJoin = onSignInOrJoin,
        stanceControl = stanceControl,
        saved = rememberSavedWrites(),
        onRequireAccount = onRequireAccount,
        onLanded = viewModel.landing::done,
    )
    licenseShown?.let { license ->
        // `CommentLicense` registers under `postDetail`, over the thread.
        LicenseSheet(
            license = license,
            onDismiss = { licenseShown = null },
            stacked = true,
            node = POST_DETAIL / "licenseSheet",
        )
    }
}

/**
 * What the sheet asks the surface below to open a composer on: the post
 * the thread belongs to, and the comment being answered — null for a
 * comment on the post itself.
 *
 * The sheet hands up the NODES rather than a built route because the
 * composer's target card is built from the thread's own words, and the
 * thread is what has them.
 */
data class ReplyTargetRequest(val postId: String, val comment: CommentView?)

/** [id]'s comment where the thread holds it — a top-level comment or an unfolded reply. */
internal fun CommentsUiState.standing(id: String): CommentView? =
    comments.firstOrNull { it.id == id } ?: replyThreads.values.firstNotNullOfOrNull { thread ->
        thread.items.firstOrNull { it.id == id }
    }

/**
 * THE THREAD IS A SHEET OVER WHAT RAISED IT (`_shared.jsx:1247-1257`): the
 * title, the comments, and the entry row pinned at its foot. The surface below
 * keeps its place — the sheet is a drawer over the screen, so nothing behind it
 * scrolls when it opens or drops.
 *
 * The sheet's own height is drawn rather than content-sized
 * (`BottomSheet.jsx:29-32`: "a pinned input row at its foot needs the surface
 * itself to own the height"), so the foot does not walk up and down the screen
 * as a page of comments lands.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommentsSheet(
    state: CommentsUiState,
    viewerId: String?,
    signedIn: Boolean?,
    onDismiss: () -> Unit,
    onLoadMoreComments: () -> Unit,
    /** `ReplyEntry` 7 — the full-focus composer, this post pinned. */
    onAddComment: () -> Unit,
    /** `ReplyEntry` 5 — the composer, pre-targeted at that comment. */
    onReplyTo: (CommentView) -> Unit,
    /** `ReplyMedia` 6 — `CommentEdit`, on an own comment. */
    onEditComment: (CommentView) -> Unit,
    onCommentSignedShown: () -> Unit,
    onLoadMoreReplies: (CommentView) -> Unit,
    /** A reader chose to look at one veiled body, as it stands. */
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onReference: (String) -> Unit,
    /** Raises the terms in the sheet the menu's License row opens. */
    onLicense: (LicenseChoice) -> Unit,
    onSignInOrJoin: () -> Unit,
    /** The reader's place, handed up as the sheet gives way to a composer. */
    onDepart: (CommentsScroll) -> Unit = {},
    /** …and handed back on the way in. */
    restoreTo: CommentsScroll? = null,
    onRestored: () -> Unit = {},
    /** The stance control the post and every comment carry (design.md §6). */
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit = { _, _, _ -> },
    /** The app's one Saved overlay, which the comments' menus save through; null stands their Save rows inert. */
    saved: SavedWrites? = null,
    /** The guest gate a signed-out reader's Save opens; null when signed in. */
    onRequireAccount: (() -> Unit)? = null,
    /** The list scrolled to a landing ([CommentsUiState.landingAt]). */
    onLanded: () -> Unit = {},
) {
    // The sheet's own host. A ModalBottomSheet is its own window, so a
    // host on the surface behind would render the confirmation for a
    // comment that landed in THIS thread behind the thread it landed in.
    val snackbar = remember { SnackbarHostState() }
    val savedHost = rememberSavedHost(saved, snackbar, null, onRequireAccount)
    val signedCopy = stringResource(R.string.content_post_saved)
    LaunchedEffect(state.commentSigned) {
        if (state.commentSigned) {
            snackbar.showSnackbar(signedCopy)
            onCommentSignedShown()
        }
    }
    val listState = rememberLazyListState()
    ThreadPlacement(state, listState, restoreTo, onRestored, onLanded)
    // WHICH OF THE READER'S OWN COMMENTS THE THINK-TWICE DIALOG IS UP FOR
    // (CommentMenuOwn.md:11): the menu closes and the dialog comes up over the
    // thread, which stays where the reader opened the menu.
    var removeFor by remember { mutableStateOf<CommentView?>(null) }
    val depart: (() -> Unit) -> Unit = { go ->
        onDepart(
            CommentsScroll(
                listState.firstVisibleItemIndex,
                listState.firstVisibleItemScrollOffset,
            ),
        )
        go()
    }
    // THE TALLEST CLASS, ASKED FOR BY NAME (`BottomSheet.jsx`'s `tallest`,
    // readme §13 "The sheets-and-video round" 2026-09-22): pinned AT the
    // ceiling rather than held under it, because a thread is the one
    // surface with a list to read and a field to write in at once, so the
    // surface owns the height and the list scrolls inside it. The height
    // rides the drawn surface INSIDE the sheet ([CograSheetSurface]'s
    // `tallest`), never `ModalBottomSheet`'s own modifier — a height fixed
    // there collapses Material's expanded anchor and pins the sheet to the
    // top of the window, the very top of the glass included.
    CograSheetHost(onDismissRequest = onDismiss) {
        // THE THREAD SHEET IS ONE NAMED SHEET (`postDetail.threadSheet`), over
        // the detail or over a list alike — as the detail's one menu sheet is.
        CograSheetSurface(
            tallest = true,
            testTag = THREAD_SHEET.tag,
            handleTestTag = (THREAD_SHEET / "dragHandle").tag,
        ) {
            SheetTitle(
                text = stringResource(R.string.content_comments_heading),
                modifier = Modifier
                    .padding(horizontal = Space.x6, vertical = Space.x1)
                    .dataNode(THREAD_SHEET / "title"),
            )
            // The foot is drawn last and the list carries the weight, so a
            // foot that grows takes its room from the thread above it and the
            // sheet stays exactly at its ceiling. The keyboard pads from
            // inside the same height ([CograSheetSurface]), for the same
            // reason.
            // THE COMMENTS' MENUS SAVE THROUGH THE ONE OVERLAY, their aftermath
            // on this sheet's own snackbar — the page's is beneath the sheet.
            CompositionLocalProvider(LocalSavedHost provides savedHost) {
                CommentsList(
                    state = state,
                    listState = listState,
                    viewerId = viewerId,
                    signedIn = signedIn,
                    modifier = Modifier.weight(1f),
                    onLoadMoreComments = onLoadMoreComments,
                    onReplyTo = { c -> depart { onReplyTo(c) } },
                    onEditComment = { c -> depart { onEditComment(c) } },
                    onLoadMoreReplies = onLoadMoreReplies,
                    onReveal = onReveal,
                    onOpenActor = onOpenActor,
                    onOpenTopic = onOpenTopic,
                    onReference = onReference,
                    onLicense = onLicense,
                    onRemoveComment = { comment -> removeFor = comment },
                    stanceControl = stanceControl,
                )
            }
            CommentsFoot(signedIn, { depart(onAddComment) }, onSignInOrJoin)
            CograSnackbarHost(snackbar)
        }
    }
    // OVER THE THREAD, the sheet beneath whole and inert (CommentRemoveConfirm.md:3):
    // the dialog is its own window, raised after the sheet's. Taken, only the
    // one comment gives way to its mark — the list is not re-read, so the
    // reader's place and every unfolded branch hold (CommentRemoved.md:19).
    removeFor?.let { comment -> CommentRemoveConfirm(comment, onClose = { removeFor = null }) }
}

/** The comment's think-twice dialog (CommentRemoveConfirm): the post's anatomy, the comment's nouns. */
@Composable
private fun CommentRemoveConfirm(comment: CommentView, onClose: () -> Unit) {
    RemoveConfirm(
        kind = RemovalKind.Comment,
        nodeId = comment.id,
        record = comment.genesisRecordId,
        onClose = onClose,
        testTag = "comment_remove_confirm",
        node = POST_DETAIL / "dialog",
        answerKeyed = true,
    )
}

/** Where the thread's list stands when it opens: the reader's old place, or a landing. */
@Composable
private fun ThreadPlacement(
    state: CommentsUiState,
    listState: LazyListState,
    restoreTo: CommentsScroll?,
    onRestored: () -> Unit,
    onLanded: () -> Unit,
) {
    // THE READER COMES BACK WHERE THEY LEFT (jakob 2026-09-15). The
    // restore waits for the refetched page: scrolling an empty list puts
    // the reader at the top and the arriving comments do not move them.
    // It consumes either way once the read is done, so a thread that
    // came back empty does not leave a place behind to jump to later.
    LaunchedEffect(restoreTo, state.loading, state.comments.isEmpty()) {
        val place = restoreTo ?: return@LaunchedEffect
        if (state.loading) return@LaunchedEffect
        if (state.comments.isNotEmpty()) listState.scrollToItem(place.index, place.offset)
        onRestored()
    }
    // LANDED ON A COMMENT (Saved.md "tap a comment's row"): the branch is
    // already unfolded down to it, so the thread scrolls to the top-level
    // comment it hangs under and the comment stands within that row.
    LaunchedEffect(state.landingAt) {
        val top = state.landingAt ?: return@LaunchedEffect
        val index = state.comments.indexOfFirst { it.id == top }
        if (index >= 0) listState.scrollToItem(index)
        onLanded()
    }
}

/**
 * The thread's rows, and the three things it says when it has none:
 * reading, unreachable, or empty.
 *
 * The sheet says all three ITSELF, unlike the version that projected the
 * detail's state: it is raised over the feed too, where there is no
 * screen underneath holding a thread to degrade in its place.
 */
@Composable
private fun CommentsList(
    state: CommentsUiState,
    listState: LazyListState,
    viewerId: String?,
    signedIn: Boolean?,
    onLoadMoreComments: () -> Unit,
    onReplyTo: (CommentView) -> Unit,
    onEditComment: (CommentView) -> Unit,
    onLoadMoreReplies: (CommentView) -> Unit,
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onReference: (String) -> Unit,
    onLicense: (LicenseChoice) -> Unit,
    /** An own comment's Remove row: the think-twice dialog over the thread. */
    onRemoveComment: (CommentView) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
    modifier: Modifier = Modifier,
) {
    // ONE STAGE FOR THE THREAD (the stage law, design/readme.md "The
    // feed-video rulings"): every clip in it, replies included, competes
    // for one — the playing clip keeps it while past 70%, and the topmost
    // qualifying clip takes it the moment it drops. The sheet is a scroll
    // surface of its own, so it does not share the stage of the list below —
    // it suspends it: the surface that raised the sheet stops its own clip
    // while the sheet stands (jakob 2026-09-24). Settling at the thread's own
    // hard top hands its stage to the topmost qualifying clip (jakob
    // 2026-09-30): else a top clip that once lost focus never plays again.
    ScrollStageHost(listState, hardTopReelects = true) {
        LazyColumn(
            state = listState,
            modifier = modifier.testTag("comments_list"),
            contentPadding = PaddingValues(horizontal = Space.x4, vertical = Space.x2),
            verticalArrangement = Arrangement.spacedBy(Space.x3),
        ) {
            if (state.comments.isEmpty()) {
                item {
                    when {
                        state.loading -> LoadingState(testTag = "comments_loading")
                        state.transportFault != null -> ErrorLine(
                            R.string.content_error_transport,
                            "comments_transport_error",
                        )
                        else -> Text(
                            stringResource(R.string.content_comments_empty),
                            modifier = Modifier.testTag("detail_no_comments"),
                        )
                    }
                }
            }
            items(state.comments, key = { it.id }) { comment ->
                // The row's key again, so the stage can ask the list whether
                // this thread — replies and all — is still placed.
                ScrollStageRow(comment.id) {
                    CommentThread(
                        comment = comment,
                        depth = 0,
                        state = state,
                        viewerId = viewerId,
                        signedIn = signedIn,
                        onLoadMoreReplies = onLoadMoreReplies,
                        onReplyTo = onReplyTo,
                        onEditComment = onEditComment,
                        onReveal = onReveal,
                        onOpenActor = onOpenActor,
                        onOpenTopic = onOpenTopic,
                        onReference = onReference,
                        onLicense = onLicense,
                        onRemoveComment = onRemoveComment,
                        stanceControl = stanceControl,
                    )
                }
            }
            if (state.hasMore) {
                item { MoreComments(state, onLoadMoreComments) }
            }
        }
    }
}

/**
 * A failed comments page surfaces where the failed fetch was asked for — the
 * load-more slot, inside the thread (android.md "Degrade, never crash").
 */
@Composable
private fun MoreComments(state: CommentsUiState, onLoadMoreComments: () -> Unit) {
    when {
        state.loadingMore -> CircularProgressIndicator(modifier = Modifier.padding(8.dp))
        state.transportFault == TransportFault.APPEND -> Column {
            ErrorLine(R.string.content_thread_stale, "detail_more_comments_error")
            TextButton(
                onClick = onLoadMoreComments,
                modifier = Modifier.testTag("detail_more_comments_retry"),
            ) {
                Text(stringResource(R.string.content_retry))
            }
        }
        else -> TextButton(
            onClick = onLoadMoreComments,
            modifier = Modifier.testTag("detail_more_comments"),
        ) {
            Text(stringResource(R.string.content_feed_load_more))
        }
    }
}

/**
 * `ReplyEntry` 7: the sheet's foot is the way *into* the composer, not the
 * composer itself. The full-focus wizard is where a comment is written, so
 * this row only opens it.
 *
 * The write affordance swaps, never merely disables: a member gets the
 * composer's door, an anonymous reader gets the join entry (android.md
 * "Screens"); while the phase resolves, neither.
 */
@Composable
private fun CommentsFoot(
    signedIn: Boolean?,
    onAddComment: () -> Unit,
    onSignInOrJoin: () -> Unit,
) {
    if (signedIn == null) return
    HorizontalDivider()
    if (signedIn) {
        // It looks like the field the board draws and behaves like the button
        // it is: a real text field would take focus and raise a keyboard for
        // words that are typed on the next screen.
        Surface(
            onClick = onAddComment,
            shape = MaterialTheme.shapes.extraLarge,
            color = MaterialTheme.colorScheme.surfaceContainerHighest,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Space.x4, vertical = Space.x3)
                .testTag("detail_add_comment"),
        ) {
            Text(
                text = stringResource(R.string.content_comment_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            )
        }
    } else {
        TextButton(
            onClick = onSignInOrJoin,
            modifier = Modifier
                .padding(horizontal = Space.x2)
                .testTag("detail_comment_signin"),
        ) {
            Text(stringResource(R.string.content_comment_signin))
        }
    }
}

/**
 * THE COMMENT'S ROWS (`_shared.jsx` `COMMENT_MENU` / `OWN_COMMENT_MENU`) —
 * Save · Cite in a new post · [Remove, on the reader's own] · Cited by ·
 * Opinions on this · License terms.
 *
 * REMOVE IS THE LAST OF THE ACTS on the reader's own comment
 * (CommentMenuOwn.md:3): after Save and Cite, before the two readings, the
 * license closing the menu — `OWN_POST_MENU`'s place for the row. No Edit row:
 * a comment's Edit is a button on its own card.
 *
 * NO HIDE ROW, AND THE ABSENCE IS RULED (jakob 2026-09-12): hiding is an
 * act on an ACTOR, and the route to it is the commenter's own profile,
 * one tap away through their chip. A thread of many voices is not where
 * that decision belongs.
 *
 * `Cited by` and `Opinions on this` STAND WHATEVER THE COUNT IS, which is
 * the difference between a menu row and a count line: a row that came and
 * went with a number would make the menu a different menu every time. Their
 * sheets are not built on this client yet, so the rows stand inert (the
 * introduced-but-inert law, jakob 2026-09-14).
 *
 * @param onRemove the Remove row's door; null on someone else's comment, which
 *   carries no such row.
 * @param sheet the registered sheet the rows name themselves under — the
 *   thread's `postDetail.menuSheet` (CommentMenu, CommentMenuOwn); null keeps
 *   the per-comment tags a surface off the thread binds to.
 */
@Composable
internal fun commentMenuRows(
    comment: CommentView,
    onCite: () -> Unit,
    onLicense: () -> Unit,
    onRemove: (() -> Unit)? = null,
    sheet: DataNode? = null,
): List<MenuRow> = buildList {
    fun tag(row: String, legacy: String): String = sheet?.div(row)?.tag ?: "comment_menu_${legacy}_${comment.id}"
    // SAVE IS THE ONE BEHAVIOUR EVERY MENU SHARES (`saveMenuRow`); the comment
    // menus gain the `Saved.` snackbar too (design digest item 54).
    val save = stringResource(R.string.content_menu_save)
    add(
        LocalSavedHost.current?.menuRow(comment.id, comment.viewerBookmarkedAt, tag("save", "save"))
            ?: MenuRow(save, tag("save", "save")) {},
    )
    add(MenuRow(stringResource(R.string.content_menu_cite), tag("cite", "cite"), onCite))
    if (onRemove != null) {
        add(MenuRow(stringResource(R.string.content_menu_remove), tag("remove", "remove"), onRemove))
    }
    add(MenuRow(stringResource(R.string.content_menu_cited_by), tag("citedBy", "cited_by")) {})
    add(MenuRow(stringResource(R.string.content_menu_opinions), tag("opinions", "opinions")) {})
    add(MenuRow(stringResource(R.string.content_menu_license), tag("license", "license"), onLicense))
}

/**
 * The thread is **two levels deep on screen**: a comment, and its
 * replies indented once (design/readme.md §13, 2026-08-28, and the
 * canonical `CommentCard`, which sets exactly this).
 *
 * Anything deeper flattens into that one reply level and opens with the
 * @handle it answers — the mention is the structure, so the column never
 * narrows to a word. design.md §6 still says three levels; it predates
 * the ruling (design/backlog.md item 26 tracks that lag).
 */
private const val MAX_INDENT_DEPTH = 1

/**
 * One comment with its replies (design.md §6 "Comment"): author chip,
 * body, the soft "Edited" marker (design.md §9), the creator's edit
 * affordance, the reply affordance, and the branch behind its count.
 */
@Composable
private fun CommentThread(
    comment: CommentView,
    depth: Int,
    modifier: Modifier = Modifier,
    state: CommentsUiState,
    viewerId: String?,
    signedIn: Boolean?,
    onLoadMoreReplies: (CommentView) -> Unit,
    onReplyTo: (CommentView) -> Unit,
    onEditComment: (CommentView) -> Unit,
    /** A reader chose to look at one veiled body, as it stands. */
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onReference: (String) -> Unit,
    /** Raises the terms in the sheet the menu's License row opens. */
    onLicense: (LicenseChoice) -> Unit,
    onRemoveComment: (CommentView) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
) {
    val indent = (minOf(depth, MAX_INDENT_DEPTH) * 12).dp
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(start = indent),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        CommentCard(
            // ONLY THE ONE NODE GIVES WAY (CommentRemoveConfirm.md:11): a
            // comment removed since the thread was read wears its mark in its
            // own place, and its branch below is untouched.
            comment = comment.marked(rememberRemovedMarks()),
            state = state,
            viewerId = viewerId,
            signedIn = signedIn,
            onReplyTo = onReplyTo,
            onEditComment = onEditComment,
            onReveal = onReveal,
            onOpenActor = onOpenActor,
            onOpenTopic = onOpenTopic,
            onReference = onReference,
            onLicense = onLicense,
            onRemoveComment = onRemoveComment,
            stanceControl = stanceControl,
        )
        CommentBranch(
            comment = comment,
            depth = depth,
            state = state,
            viewerId = viewerId,
            signedIn = signedIn,
            onLoadMoreReplies = onLoadMoreReplies,
            onReplyTo = onReplyTo,
            onEditComment = onEditComment,
            onReveal = onReveal,
            onOpenActor = onOpenActor,
            onOpenTopic = onOpenTopic,
            onReference = onReference,
            onLicense = onLicense,
            onRemoveComment = onRemoveComment,
            stanceControl = stanceControl,
        )
    }
}

/**
 * The card itself (`CommentCard.jsx`) — the author's line, what they
 * wrote, and the one affordance row under it.
 */
@Composable
private fun CommentCard(
    comment: CommentView,
    state: CommentsUiState,
    viewerId: String?,
    signedIn: Boolean?,
    onReplyTo: (CommentView) -> Unit,
    onEditComment: (CommentView) -> Unit,
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onReference: (String) -> Unit,
    onLicense: (LicenseChoice) -> Unit,
    onRemoveComment: (CommentView) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
) {
    // Keyed by the comment's id, as a feed card by its post's: the board keys
    // its samples by handle, which one person's two comments would share.
    val card = (THREAD_SHEET / "commentCard").keyed(comment.id)
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .dataNode(card),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            // The picture the boards draw on a comment card (Q49),
            // and the age beside it. Null is the monogram — the
            // designed fallback for an author who has set none, not
            // a gap waiting for a photo.
            ContentCardHeader(
                author = comment.author,
                at = comment.createdAt,
                onOpenActor = onOpenActor,
                testTagPrefix = "comment_${comment.id}",
                // A REMOVED COMMENT HAS NO MENU LEFT (CommentRemoved.md:9; the
                // post's `Removed` rule): nothing on it is left to save, cite
                // or read the terms of, so its ⋮ goes with the payload.
                menu = if (comment.removed) {
                    emptyList()
                } else {
                    commentMenuRows(
                        comment = comment,
                        onCite = { onReference(comment.id) },
                        onLicense = { onLicense(comment.license) },
                        onRemove = if (isOwn(comment, viewerId)) {
                            { onRemoveComment(comment) }
                        } else {
                            null
                        },
                        // CommentMenu and CommentMenuOwn register the thread's
                        // menu under the detail's prefix, whichever surface
                        // raised the thread (`postDetail.menuSheet.*`).
                        sheet = POST_DETAIL / "menuSheet",
                    )
                },
                menuSheetNode = POST_DETAIL / "menuSheet",
                menuContentDescription = stringResource(R.string.content_menu_comment),
                // IT IS DRAWN STACKED ON PURPOSE (`CommentMenu.jsx:18-23`):
                // the thread already lives in a sheet, so this menu is a
                // sheet on a sheet (design/readme.md:2364).
                stacked = true,
                node = card,
            )
            CommentCardBody(
                comment = comment,
                state = state,
                node = card,
                onReveal = onReveal,
                onOpenTopic = onOpenTopic,
            )
            CommentAffordances(
                comment = comment,
                node = card / "actionRow",
                viewerId = viewerId,
                signedIn = signedIn,
                onReplyTo = onReplyTo,
                onEditComment = onEditComment,
                stanceControl = stanceControl,
            )
            // THE ROW LINE under the face (RowSigning.md): a save or unsave
            // of this comment that did not go through.
            LocalSavedHost.current?.comfortLine(comment.id)?.let { RowLine(it, "comment_${comment.id}_row_line") }
        }
    }
}

/**
 * What the author wrote, and the quiet marks the card carries under it.
 */
@Composable
private fun CommentCardBody(
    comment: CommentView,
    state: CommentsUiState,
    node: DataNode,
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenTopic: (String) -> Unit,
) {
    // A comment is text **plus** optional media (D16),
    // so its body is never the exclusive-or a post's
    // is — but it veils and redacts as one region all
    // the same.
    PostBody(
        content = comment.content,
        description = null,
        attachments = comment.attachments,
        attachmentsStatus = comment.attachmentsStatus,
        moderation = comment.moderation,
        removal = comment.removal,
        testTagPrefix = "comment_${comment.id}",
        surface = BodySurface.Comment,
        node = node,
        revealed = state.reveals.isRevealed(comment.id, comment.sensitiveMark()),
        onReveal = { onReveal(comment.id, comment.sensitiveMark()) },
        // The statuses are the veil — the OR of the author's
        // own mark and a moderator's verdict — so the
        // author's half is what names the source.
        sensitiveSource = if (comment.sensitiveSelfMark) {
            SensitiveSource.Author
        } else {
            SensitiveSource.Platform
        },
        sensitiveReason = comment.sensitiveReason,
    )
    // The soft marker, friendly not forensic (design.md §9).
    if (comment.updatedAt.isAfter(comment.createdAt)) {
        Text(
            text = stringResource(R.string.content_comment_edited),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.testTag("comment_edited_${comment.id}"),
        )
    }
    if (comment.landing.isPending) {
        PendingMarker(testTag = "comment_pending_${comment.id}")
    }
    // The same one line a post wears (`CommentCard.jsx`).
    TopicsLine(
        topics = comment.topics,
        references = comment.references,
        onOpenTopic = onOpenTopic,
        testTagPrefix = "comment_${comment.id}",
    )
}

/**
 * ONE AFFORDANCE ROW, AS ON PostCard, SPREAD ACROSS THE CARD
 * (`CommentCard.jsx`: `width: "100%"`, `justifyContent: "space-between"`,
 * `flexWrap: "wrap"`, `columnGap: --space-2`, `rowGap: --space-1`). A fixed
 * gap huddled the controls at the leading edge; wrapping is what keeps every
 * one of them on its 48dp target when a comment grows one more.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CommentAffordances(
    comment: CommentView,
    /** The card's registered `actionRow`: its stance, reply and edit wear its parts. */
    node: DataNode,
    viewerId: String?,
    signedIn: Boolean?,
    onReplyTo: (CommentView) -> Unit,
    onEditComment: (CommentView) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth().dataNode(node),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalArrangement = Arrangement.spacedBy(Space.x1),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        // A comment carries the control too (design.md §6), naming its
        // target `this comment` (`CommentCard.jsx`).
        CommentStanceTarget { stanceControl(comment.id, "comment_${comment.id}", node / "stance") }
        if (signedIn == true) {
            // `ReplyEntry` 5 — the composer, pre-targeted.
            TextButton(
                onClick = { onReplyTo(comment) },
                modifier = Modifier.dataNode(node / "reply"),
            ) {
                Text(stringResource(R.string.content_comment_reply))
            }
        }
        // `ReplyMedia` 6 — an own comment wears Edit, and it
        // opens `CommentEdit`. A REMOVED ONE LOSES IT WITH ITS PAYLOAD
        // (CommentRemoved.md:9; `_shared.jsx` `onEdit={removed ? undefined …}`):
        // there is nothing left on it to edit. Reply and the face stay.
        if (isOwn(comment, viewerId) && !comment.removed) {
            TextButton(
                onClick = { onEditComment(comment) },
                modifier = Modifier.dataNode(node / "edit"),
            ) {
                Text(stringResource(R.string.content_edit))
            }
        }
    }
}

/** Whether the reader wrote [comment] — what gives it Edit and the own menu's Remove. */
private fun isOwn(comment: CommentView, viewerId: String?): Boolean =
    viewerId != null && comment.author?.id == viewerId

/**
 * The branch under a card: the replies a reader has opened, and the one line
 * that stands in for them until they ask.
 *
 * Replies are counted, not carried (Q49): nothing is on screen until a reader
 * opens the branch, and `replyCount` is what the collapsed line reads.
 */
@Composable
private fun CommentBranch(
    comment: CommentView,
    depth: Int,
    state: CommentsUiState,
    viewerId: String?,
    signedIn: Boolean?,
    onLoadMoreReplies: (CommentView) -> Unit,
    onReplyTo: (CommentView) -> Unit,
    onEditComment: (CommentView) -> Unit,
    onReveal: (String, SensitiveMark) -> Unit,
    onOpenActor: (String) -> Unit,
    onOpenTopic: (String) -> Unit,
    onReference: (String) -> Unit,
    onLicense: (LicenseChoice) -> Unit,
    onRemoveComment: (CommentView) -> Unit,
    stanceControl: @Composable (target: String, testTagPrefix: String, node: DataNode?) -> Unit,
) {
    val thread = state.replyThreads[comment.id]
    val replies = thread?.items.orEmpty()
    val hasMore = thread?.hasMore ?: false
    replies.forEach { reply ->
        CommentThread(
            comment = reply,
            depth = depth + 1,
            state = state,
            viewerId = viewerId,
            signedIn = signedIn,
            onLoadMoreReplies = onLoadMoreReplies,
            onReplyTo = onReplyTo,
            onEditComment = onEditComment,
            onReveal = onReveal,
            onOpenActor = onOpenActor,
            onOpenTopic = onOpenTopic,
            onReference = onReference,
            onLicense = onLicense,
            onRemoveComment = onRemoveComment,
            stanceControl = stanceControl,
        )
    }
    when {
        thread?.loading == true -> CircularProgressIndicator(
            modifier = Modifier.padding(start = 12.dp).testTag("replies_loading_${comment.id}"),
        )
        thread?.failed == true -> TextButton(
            onClick = { onLoadMoreReplies(comment) },
            modifier = Modifier.testTag("replies_retry_${comment.id}"),
        ) {
            Text(stringResource(R.string.content_retry))
        }
        // The collapsed branch, as `CommentCard` draws it: the count
        // stands in for the replies until a reader asks for them.
        replies.isEmpty() && comment.replyCount > 0 -> TextButton(
            onClick = { onLoadMoreReplies(comment) },
            modifier = Modifier.testTag("replies_more_${comment.id}"),
        ) {
            Text(
                pluralStringResource(
                    R.plurals.content_comment_view_replies,
                    comment.replyCount,
                    comment.replyCount,
                ),
            )
        }
        hasMore -> TextButton(
            onClick = { onLoadMoreReplies(comment) },
            modifier = Modifier.testTag("replies_more_${comment.id}"),
        ) {
            Text(stringResource(R.string.content_comment_more_replies))
        }
    }
}

/** The thread's one sheet (`postDetail.threadSheet`), whichever surface raised it. */
internal val THREAD_SHEET = POST_DETAIL / "threadSheet"
