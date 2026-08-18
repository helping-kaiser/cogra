package com.cogra.feature.content

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipe
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.unit.dp
import com.cogra.domain.OversightChoice
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testPost
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ContentScreensTest {

    @get:Rule
    val compose = createComposeRule()

    // -- Feed --

    private fun renderFeed(
        state: FeedUiState,
        signedIn: Boolean? = true,
        onOpenPost: (String) -> Unit = {},
        onOpenActor: (String) -> Unit = {},
        onSignInOrJoin: () -> Unit = {},
        onLoadMore: () -> Unit = {},
        onRefresh: () -> Unit = {},
        keyBanner: @Composable () -> Unit = {},
    ) {
        compose.setContent {
            FeedScreen(
                state = state,
                signedIn = signedIn,
                onRefresh = onRefresh,
                onLoadMore = onLoadMore,
                onOpenPost = onOpenPost,
                onOpenActor = onOpenActor,
                onSignInOrJoin = onSignInOrJoin,
                keyBanner = keyBanner,
            )
        }
    }

    @Test
    fun anEmptyFeedShowsTheEmptyCopy() {
        renderFeed(FeedUiState(loading = false))
        compose.onNodeWithTag("feed_empty").assertExists()
    }

    @Test
    fun postsRenderAndOpen() {
        var opened: String? = null
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1"), testPost("p2"))),
            onOpenPost = { opened = it },
        )
        compose.onNodeWithTag("feed_post_p1").performClick()
        assertThat(opened).isEqualTo("p1")
        compose.onNodeWithTag("feed_empty").assertDoesNotExist()
    }

    // The regression this pins: the bar's enterAlways connection
    // consumes every delta while the bar moves, so the banner's
    // observer must sit outside it — a small upward scroll (less than
    // the bar's own height) has to bring the banner back even though
    // the bar swallows the whole delta re-entering.
    @Test
    fun theKeyBannerFollowsTheReaderBackOnASmallUpwardScroll() {
        renderFeed(
            FeedUiState(loading = false, posts = (1..30).map { testPost("p$it") }),
            keyBanner = {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .testTag("key_banner"),
                )
            },
        )
        compose.onNodeWithTag("key_banner").assertExists()
        compose.onNodeWithTag("feed_list").performTouchInput { swipeUp() }
        compose.onNodeWithTag("key_banner").assertDoesNotExist()
        // A short drag, held before release: per-frame deltas clear the
        // observer's 4px threshold, the total stays under the bar's own
        // height (the regression's blind spot), and the hold kills the
        // fling velocity.
        compose.onNodeWithTag("feed_list").performTouchInput {
            down(center)
            moveBy(Offset(0f, 20f))
            moveBy(Offset(0f, 10f))
            advanceEventTime(250)
            up()
        }
        compose.onNodeWithTag("key_banner").assertExists()
    }

    @Test
    fun theNextPageLoadsOnDemand() {
        var more = false
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1")), hasNextPage = true),
            onLoadMore = { more = true },
        )
        compose.onNodeWithTag("feed_load_more").performScrollTo().performClick()
        assertThat(more).isTrue()
    }

    @Test
    fun theComposeAffordanceSwapsForTheSignInEntryForAGuest() {
        var joining = false
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1"))),
            signedIn = false,
            onSignInOrJoin = { joining = true },
        )
        compose.onNodeWithTag("feed_signin").performClick()
        assertThat(joining).isTrue()
    }

    @Test
    fun aResolvingPhaseWithholdsTheSignInEntry() {
        renderFeed(FeedUiState(loading = false), signedIn = null)
        compose.onNodeWithTag("feed_signin").assertDoesNotExist()
    }

    @Test
    fun aTransportFaultOffersRetry() {
        var retried = false
        renderFeed(
            FeedUiState(loading = false, transportFault = TransportFault.REFRESH),
            onRefresh = { retried = true },
        )
        compose.onNodeWithTag("feed_transport_error").assertExists()
        compose.onNodeWithTag("feed_retry").performClick()
        assertThat(retried).isTrue()
    }

    @Test
    fun aTransportFaultKeepsTheLoadedPostsReadable() {
        var retried = false
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(testPost("p1")),
                transportFault = TransportFault.REFRESH,
            ),
            onRefresh = { retried = true },
        )
        compose.onNodeWithTag("feed_post_p1").assertExists()
        compose.onNodeWithTag("feed_transport_error").assertDoesNotExist()
        compose.onNodeWithTag("feed_transport_banner").assertExists()
        compose.onNodeWithTag("feed_retry").performClick()
        assertThat(retried).isTrue()
    }

    @Test
    fun aFailedPageFetchSurfacesAtTheLoadMoreSlot() {
        var more = false
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(testPost("p1")),
                hasNextPage = true,
                transportFault = TransportFault.APPEND,
            ),
            onLoadMore = { more = true },
        )
        compose.onNodeWithTag("feed_post_p1").assertExists()
        compose.onNodeWithTag("feed_transport_banner").assertDoesNotExist()
        compose.onNodeWithTag("feed_load_more").assertDoesNotExist()
        compose.onNodeWithTag("feed_load_more_error").performScrollTo().assertExists()
        compose.onNodeWithTag("feed_load_more_retry").performClick()
        assertThat(more).isTrue()
    }

    // -- Composer --

    private fun renderComposer(
        state: ComposePostUiState,
        onSubmit: () -> Unit = {},
        onOversightChange: (OversightChoice) -> Unit = {},
    ) {
        compose.setContent {
            ComposePostScreen(
                state = state,
                onTitleChange = {},
                onDescriptionChange = {},
                onBodyChange = {},
                onAttributionChange = {},
                onOversightChange = onOversightChange,
                onSubmit = onSubmit,
                onBack = {},
            )
        }
    }

    @Test
    fun createModeCarriesTheLicenseControls() {
        var oversight: OversightChoice? = null
        renderComposer(ComposePostUiState(), onOversightChange = { oversight = it })
        compose.onNodeWithTag("license_attribution").assertExists()
        compose.onNodeWithTag("license_oversight_full").performScrollTo().performClick()
        assertThat(oversight).isEqualTo(OversightChoice.FULL)
    }

    @Test
    fun editModeHidesTheImmutableLicense() {
        renderComposer(ComposePostUiState(editingId = "p1"))
        compose.onNodeWithTag("license_attribution").assertDoesNotExist()
    }

    @Test
    fun theErrorStatesRender() {
        renderComposer(ComposePostUiState(emptyBody = true, refused = true, signingFailed = true))
        compose.onNodeWithTag("compose_empty_body").assertExists()
        compose.onNodeWithTag("compose_refused").assertExists()
        compose.onNodeWithTag("compose_signing_failed").assertExists()
    }

    @Test
    fun submittingDisablesTheButton() {
        renderComposer(ComposePostUiState(submitting = true))
        compose.onNodeWithTag("compose_submit").assertIsNotEnabled()
    }

    // -- Post detail --

    private fun renderDetail(
        state: PostDetailUiState,
        viewerId: String? = null,
        signedIn: Boolean? = true,
        onEdit: (String) -> Unit = {},
        onOpenActor: (String) -> Unit = {},
        onSubmitComment: () -> Unit = {},
        onSignInOrJoin: () -> Unit = {},
        onRefresh: () -> Unit = {},
        onLoadMoreComments: () -> Unit = {},
        onLoadMoreReplies: (com.cogra.domain.CommentView) -> Unit = {},
        onStartEditComment: (com.cogra.domain.CommentView) -> Unit = {},
        onSubmitCommentEdit: () -> Unit = {},
        onStartReply: (String) -> Unit = {},
        onSubmitReply: () -> Unit = {},
    ) {
        compose.setContent {
            PostDetailScreen(
                state = state,
                viewerId = viewerId,
                signedIn = signedIn,
                onRefresh = onRefresh,
                onLoadMoreComments = onLoadMoreComments,
                onDraftChange = {},
                onAttributionChange = {},
                onOversightChange = {},
                onSubmitComment = onSubmitComment,
                onCommentSignedShown = {},
                onLoadMoreReplies = onLoadMoreReplies,
                onStartEditComment = onStartEditComment,
                onEditDraftChange = {},
                onCancelEditComment = {},
                onSubmitCommentEdit = onSubmitCommentEdit,
                onStartReply = onStartReply,
                onReplyDraftChange = {},
                onCancelReply = {},
                onSubmitReply = onSubmitReply,
                onEdit = onEdit,
                onOpenActor = onOpenActor,
                onSignInOrJoin = onSignInOrJoin,
                onBack = {},
            )
        }
    }

    @Test
    fun thePostAndItsThreadRender() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(testComment("c1")),
            ),
        )
        compose.onNodeWithTag("detail_body").assertExists()
        compose.onNodeWithTag("detail_comment_c1").assertExists()
        compose.onNodeWithTag("detail_no_comments").assertDoesNotExist()
    }

    @Test
    fun theEditAffordanceHidesForNonCreators() {
        renderDetail(
            PostDetailUiState(loading = false, post = testPost("p1")),
            viewerId = "someone-else",
        )
        compose.onNodeWithTag("detail_edit").assertDoesNotExist()
    }

    @Test
    fun theEditAffordanceOpensForTheCreator() {
        var editing: String? = null
        renderDetail(
            PostDetailUiState(loading = false, post = testPost("p1")),
            viewerId = "author-1",
            onEdit = { editing = it },
        )
        compose.onNodeWithTag("detail_edit").performClick()
        assertThat(editing).isEqualTo("p1")
    }

    @Test
    fun anEmptyDraftDisablesTheCommentButton() {
        renderDetail(PostDetailUiState(loading = false, post = testPost("p1"), draft = ""))
        compose.onNodeWithTag("detail_comment_submit").performScrollTo().assertIsNotEnabled()
    }

    @Test
    fun aDraftEnablesAndSubmits() {
        var submitted = false
        renderDetail(
            PostDetailUiState(loading = false, post = testPost("p1"), draft = "hello"),
            onSubmitComment = { submitted = true },
        )
        compose.onNodeWithTag("detail_comment_submit").performScrollTo().performClick()
        assertThat(submitted).isTrue()
    }

    @Test
    fun theCommentComposerSwapsForTheSignInEntryForAGuest() {
        var joining = false
        renderDetail(
            PostDetailUiState(loading = false, post = testPost("p1")),
            signedIn = false,
            onSignInOrJoin = { joining = true },
        )
        compose.onNodeWithTag("detail_comment_input").assertDoesNotExist()
        compose.onNodeWithTag("detail_comment_submit").assertDoesNotExist()
        compose.onNodeWithTag("detail_comment_signin").performScrollTo().performClick()
        assertThat(joining).isTrue()
    }

    @Test
    fun aResolvingPhaseShowsNeitherCommentAffordance() {
        renderDetail(
            PostDetailUiState(loading = false, post = testPost("p1")),
            signedIn = null,
        )
        compose.onNodeWithTag("detail_comment_input").assertDoesNotExist()
        compose.onNodeWithTag("detail_comment_signin").assertDoesNotExist()
    }

    @Test
    fun anUnknownPostRendersNotFound() {
        renderDetail(PostDetailUiState(loading = false, notFound = true))
        compose.onNodeWithTag("detail_not_found").assertExists()
    }

    @Test
    fun aRefreshFaultKeepsTheThreadReadable() {
        var retried = false
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(testComment("c1")),
                transportFault = TransportFault.REFRESH,
            ),
            onRefresh = { retried = true },
        )
        compose.onNodeWithTag("detail_body").assertExists()
        compose.onNodeWithTag("detail_comment_c1").assertExists()
        compose.onNodeWithTag("detail_transport_error").assertDoesNotExist()
        compose.onNodeWithTag("detail_transport_banner").assertExists()
        compose.onNodeWithTag("detail_retry").performClick()
        assertThat(retried).isTrue()
    }

    @Test
    fun aFailedCommentsPageSurfacesAtItsLoadMoreSlot() {
        var more = false
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(testComment("c1")),
                commentsHaveMore = true,
                transportFault = TransportFault.APPEND,
            ),
            onLoadMoreComments = { more = true },
        )
        compose.onNodeWithTag("detail_comment_c1").assertExists()
        compose.onNodeWithTag("detail_transport_banner").assertDoesNotExist()
        compose.onNodeWithTag("detail_more_comments").assertDoesNotExist()
        // A read fault never lights the composer's error line.
        compose.onNodeWithTag("detail_comment_transport").assertDoesNotExist()
        compose.onNodeWithTag("detail_more_comments_error").performScrollTo().assertExists()
        compose.onNodeWithTag("detail_more_comments_retry").performClick()
        assertThat(more).isTrue()
    }

    @Test
    fun aSubmitTransportFaultRendersInTheComposer() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                submitTransportFailed = true,
            ),
        )
        compose.onNodeWithTag("detail_comment_transport").performScrollTo().assertExists()
        compose.onNodeWithTag("detail_transport_banner").assertDoesNotExist()
        compose.onNodeWithTag("detail_more_comments_error").assertDoesNotExist()
    }

    // -- The comment thread (slice 2.1: edit affordance, nesting) --

    private fun comment(
        id: String,
        authorId: String = "author-1",
        edited: Boolean = false,
        replies: com.cogra.domain.Page<com.cogra.domain.CommentView>? = null,
    ) = testComment(id).let { base ->
        base.copy(
            author = base.author?.copy(id = authorId),
            updatedAt = if (edited) base.updatedAt.plusSeconds(60) else base.createdAt,
            createdAt = base.createdAt,
            replies = replies,
        )
    }

    @Test
    fun theViewersOwnCommentOffersEditOthersDoNot() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("mine", authorId = "viewer"), comment("theirs")),
            ),
            viewerId = "viewer",
        )
        compose.onNodeWithTag("comment_edit_mine").assertExists()
        compose.onNodeWithTag("comment_edit_theirs").assertDoesNotExist()
    }

    @Test
    fun anEditedCommentCarriesTheSoftMarker() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1", edited = true), comment("c2")),
            ),
        )
        compose.onNodeWithTag("comment_edited_c1").assertExists()
        compose.onNodeWithTag("comment_edited_c2").assertDoesNotExist()
    }

    @Test
    fun theEditAffordanceOpensTheInlineEditor() {
        var editing: com.cogra.domain.CommentView? = null
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("mine", authorId = "viewer")),
            ),
            viewerId = "viewer",
            onStartEditComment = { editing = it },
        )
        compose.onNodeWithTag("comment_edit_mine").performScrollTo().performClick()
        assertThat(editing?.id).isEqualTo("mine")
    }

    @Test
    fun theInlineEditorRendersWithSaveAndCancel() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("mine", authorId = "viewer")),
                editingCommentId = "mine",
                editDraft = "better words",
            ),
            viewerId = "viewer",
        )
        compose.onNodeWithTag("comment_edit_input").assertExists()
        compose.onNodeWithTag("comment_edit_save").assertExists()
        compose.onNodeWithTag("comment_edit_cancel").assertExists()
    }

    @Test
    fun prefetchedRepliesNestAndOfferMore() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(
                    comment(
                        "c1",
                        replies = com.cogra.domain.Page(
                            listOf(comment("r1")),
                            endCursor = "rc",
                            hasNextPage = true,
                        ),
                    ),
                ),
            ),
        )
        compose.onNodeWithTag("detail_comment_r1").assertExists()
        compose.onNodeWithTag("replies_more_c1").assertExists()
    }

    @Test
    fun theReplyAffordanceIsSignedInOnly() {
        val state = PostDetailUiState(
            loading = false,
            post = testPost("p1"),
            comments = listOf(comment("c1")),
        )
        renderDetail(state, signedIn = false)
        compose.onNodeWithTag("comment_reply_c1").assertDoesNotExist()
    }

    @Test
    fun theReplyComposerRendersUnderItsComment() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1")),
                replyingToId = "c1",
            ),
        )
        compose.onNodeWithTag("comment_reply_input").assertExists()
        compose.onNodeWithTag("comment_reply_submit").assertExists()
    }

    @Test
    fun authorChipsRenderOnPostAndComments() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1")),
            ),
        )
        compose.onNodeWithTag("detail_author").assertExists()
        compose.onNodeWithTag("comment_author_c1").assertExists()
    }
}
