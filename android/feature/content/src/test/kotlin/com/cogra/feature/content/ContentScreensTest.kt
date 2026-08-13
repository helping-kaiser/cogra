package com.cogra.feature.content

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
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
        onCompose: () -> Unit = {},
        onSignInOrJoin: () -> Unit = {},
        onLoadMore: () -> Unit = {},
        onRefresh: () -> Unit = {},
    ) {
        compose.setContent {
            FeedScreen(
                state = state,
                signedIn = signedIn,
                onRefresh = onRefresh,
                onLoadMore = onLoadMore,
                onOpenPost = onOpenPost,
                onCompose = onCompose,
                onSignInOrJoin = onSignInOrJoin,
                onBack = {},
            )
        }
    }

    @Test
    fun anEmptyFeedShowsTheEmptyCopyAndTheComposer() {
        var composing = false
        renderFeed(FeedUiState(loading = false), onCompose = { composing = true })
        compose.onNodeWithTag("feed_empty").assertExists()
        compose.onNodeWithTag("feed_compose").performClick()
        assertThat(composing).isTrue()
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
        compose.onNodeWithTag("feed_compose").assertDoesNotExist()
        compose.onNodeWithTag("feed_signin").performClick()
        assertThat(joining).isTrue()
    }

    @Test
    fun aResolvingPhaseShowsNeitherFeedAffordance() {
        renderFeed(FeedUiState(loading = false), signedIn = null)
        compose.onNodeWithTag("feed_compose").assertDoesNotExist()
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
        onSubmitComment: () -> Unit = {},
        onSignInOrJoin: () -> Unit = {},
        onRefresh: () -> Unit = {},
        onLoadMoreComments: () -> Unit = {},
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
                onEdit = onEdit,
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
}
