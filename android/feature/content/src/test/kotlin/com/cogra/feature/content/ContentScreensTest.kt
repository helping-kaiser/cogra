package com.cogra.feature.content

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.unit.dp
import com.cogra.domain.Landing
import com.cogra.domain.LandingState
import com.cogra.domain.LicenseChoice
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testContentTarget
import com.cogra.domain.testing.testMentionTarget
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testReferenceClaim
import com.cogra.domain.testing.testTopicClaim
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

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
        onOpenTopic: (String) -> Unit = {},
        onSignInOrJoin: () -> Unit = {},
        onLoadMore: () -> Unit = {},
        onRefresh: () -> Unit = {},
        keyBanner: @Composable () -> Unit = {},
        onStance: (String, String) -> Unit = { _, _ -> },
    ) {
        compose.setContent {
            FeedScreen(
                stanceControl = { target, tag -> onStance(target, tag) },
                state = state,
                signedIn = signedIn,
                onRefresh = onRefresh,
                onLoadMore = onLoadMore,
                onOpenPost = onOpenPost,
                onOpenActor = onOpenActor,
                onOpenTopic = onOpenTopic,
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

    // Pending content shows in full — nothing greyed out or held back —
    // beside a quiet marker saying its place in the order is not yet
    // fixed (design.md §9).
    @Test
    fun aPendingPostCarriesTheSettlingMarker() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(
                    testPost("p1", landing = Landing.Pending),
                    testPost("p2", landing = Landing.landed(4)),
                ),
            ),
        )
        // The card is one click target, so it merges its children's
        // semantics — the marker is read out as part of the card and is
        // only addressable on its own in the unmerged tree.
        compose.onNodeWithTag("feed_post_pending_p1", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("feed_post_p1").assertExists()
        compose.onNodeWithTag("feed_post_pending_p2", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun anUnnamedLandingStateIsNotPresentedAsPending() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(testPost("p1", landing = Landing(LandingState.UNKNOWN, null))),
            ),
        )
        compose.onNodeWithTag("feed_post_pending_p1", useUnmergedTree = true).assertDoesNotExist()
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

    // The key banner rides the shared collapsing top: away scrolling
    // down, back only after about a third of a screen of accumulated
    // upward scroll (the gate itself is pinned in the designsystem's
    // CollapsingTopTest; this covers the feed wiring it).
    @Test
    fun theKeyBannerRidesTheCollapsingTop() {
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
        fun dragUpBy(px: Float) = compose.onNodeWithTag("feed_list").performTouchInput {
            down(center)
            moveBy(Offset(0f, px))
            advanceEventTime(250)
            up()
        }
        compose.onNodeWithTag("key_banner").assertExists()
        compose.onNodeWithTag("feed_list").performTouchInput { swipeUp() }
        compose.onNodeWithTag("key_banner").assertDoesNotExist()
        // A short correction toward a post's top summons nothing.
        dragUpBy(30f)
        compose.onNodeWithTag("key_banner").assertDoesNotExist()
        // The accumulated run crosses the gate: the banner returns.
        dragUpBy(80f)
        dragUpBy(80f)
        dragUpBy(80f)
        compose.onNodeWithTag("key_banner").assertExists()
    }

    // Reaching the top reveals without the tally — and on the feed the
    // gate must sit inside the pull-to-refresh box, whose gesture
    // would otherwise swallow the at-the-top leftover that carries
    // the signal.
    @Test
    fun reachingTheFeedTopRevealsTheBanner() {
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
        // A short hop down from the top hides the banner…
        compose.onNodeWithTag("feed_list").performTouchInput {
            down(center)
            moveBy(Offset(0f, -60f))
            advanceEventTime(250)
            up()
        }
        compose.onNodeWithTag("key_banner").assertDoesNotExist()
        // …and coming back to the top brings it straight back, far
        // below the third-of-a-screen gate.
        compose.onNodeWithTag("feed_list").performTouchInput {
            down(center)
            moveBy(Offset(0f, 100f))
            advanceEventTime(250)
            up()
        }
        compose.onNodeWithTag("key_banner").assertExists()
    }

    // The feed twin of the detail screen's rule: an upward correction
    // from the middle of the listing scrolls, it does not re-read.
    @Test
    fun anUpwardDragAwayFromTheFeedTopScrollsInsteadOfRefreshing() {
        var refreshes = 0
        renderFeed(
            FeedUiState(loading = false, posts = (1..30).map { testPost("p$it") }),
            onRefresh = { refreshes++ },
        )
        repeat(3) {
            compose.onNodeWithTag("feed_list").performTouchInput { swipeUp() }
        }
        compose.onNodeWithTag("feed_list").performTouchInput {
            down(center)
            moveBy(Offset(0f, 200f))
            advanceEventTime(250)
            up()
        }
        assertThat(refreshes).isEqualTo(0)
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
    fun theGuestBannerCarriesTheSignInEntry() {
        var joining = false
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1"))),
            signedIn = false,
            onSignInOrJoin = { joining = true },
        )
        compose.onNodeWithTag("feed_guest_banner").assertExists()
        compose.onNodeWithTag("feed_signin").performClick()
        assertThat(joining).isTrue()
    }

    @Test
    fun aSignedInReaderSeesNoGuestBanner() {
        renderFeed(FeedUiState(loading = false, posts = listOf(testPost("p1"))))
        compose.onNodeWithTag("feed_guest_banner").assertDoesNotExist()
        compose.onNodeWithTag("feed_signin").assertDoesNotExist()
    }

    @Test
    fun aResolvingPhaseWithholdsTheSignInEntry() {
        renderFeed(FeedUiState(loading = false), signedIn = null)
        compose.onNodeWithTag("feed_signin").assertDoesNotExist()
    }

    // The guest notice rides the same collapsing top as the key banner:
    // away scrolling down, back with the returning bar.
    @Test
    fun theGuestBannerRidesTheCollapsingTop() {
        renderFeed(
            FeedUiState(loading = false, posts = (1..30).map { testPost("p$it") }),
            signedIn = false,
        )
        compose.onNodeWithTag("feed_guest_banner").assertExists()
        compose.onNodeWithTag("feed_list").performTouchInput { swipeUp() }
        compose.onNodeWithTag("feed_guest_banner").assertDoesNotExist()
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
        onLicenseChange: (LicenseChoice) -> Unit = {},
        onTagInputChange: (String) -> Unit = {},
        onAddTag: () -> Unit = {},
        onRemoveTag: (String) -> Unit = {},
        onTuneTag: (String) -> Unit = {},
        onDoneTuningTag: () -> Unit = {},
        onTagRelevanceChange: (String, Double) -> Unit = { _, _ -> },
        onTagConfidenceChange: (String, Double) -> Unit = { _, _ -> },
        onOpenFinder: () -> Unit = {},
        onCloseFinder: () -> Unit = {},
        onFinderQueryChange: (String) -> Unit = {},
        onPickReference: (ReferenceCandidateRow) -> Unit = {},
        onRemoveReference: (String) -> Unit = {},
        onTuneReference: (String) -> Unit = {},
        onDoneTuningReference: () -> Unit = {},
        onReferenceRelevanceChange: (String, Double) -> Unit = { _, _ -> },
        onReferenceSupportChange: (String, Double) -> Unit = { _, _ -> },
        onConfirmSubmit: (Boolean) -> Unit = {},
        onDismissConfirm: () -> Unit = {},
        keyBanner: @Composable () -> Unit = {},
    ) {
        compose.setContent {
            ComposePostScreen(
                state = state,
                onTitleChange = {},
                onDescriptionChange = {},
                onBodyChange = {},
                onLicenseChange = onLicenseChange,
                onTagInputChange = onTagInputChange,
                onAddTag = onAddTag,
                onRemoveTag = onRemoveTag,
                onTuneTag = onTuneTag,
                onDoneTuningTag = onDoneTuningTag,
                onTagRelevanceChange = onTagRelevanceChange,
                onTagConfidenceChange = onTagConfidenceChange,
                onOpenFinder = onOpenFinder,
                onCloseFinder = onCloseFinder,
                onFinderQueryChange = onFinderQueryChange,
                onPickReference = onPickReference,
                onRemoveReference = onRemoveReference,
                onTuneReference = onTuneReference,
                onDoneTuningReference = onDoneTuningReference,
                onReferenceRelevanceChange = onReferenceRelevanceChange,
                onReferenceSupportChange = onReferenceSupportChange,
                onSubmit = onSubmit,
                onConfirmSubmit = onConfirmSubmit,
                onDismissConfirm = onDismissConfirm,
                onBack = {},
                keyBanner = keyBanner,
            )
        }
    }

    // The composer hosts the key-banner slot on its collapsing top — a
    // keyless writer learns before drafting, not at submit.
    @Test
    fun theComposerHostsTheKeyBannerSlot() {
        renderComposer(
            ComposePostUiState(),
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
    }

    @Test
    fun createModeCarriesTheLicenseControls() {
        var license: LicenseChoice? = null
        renderComposer(ComposePostUiState(), onLicenseChange = { license = it })
        compose.onNodeWithTag("license_attribution_none").assertExists()
        compose.onNodeWithTag("license_provenance_always").performScrollTo().performClick()
        assertThat(license).isEqualTo(LicenseChoice(attribution = 0.0, provenance = 1.0))
    }

    // The composer offers the published readings and nothing between
    // them — a free numeric input would ask an author to price a degree
    // CoGra has no reading for (platform-guidelines.md §5).
    @Test
    fun theComposerOffersOnlyTheNamedTiers() {
        renderComposer(ComposePostUiState())
        listOf(
            "license_attribution_none",
            "license_attribution_commercial",
            "license_attribution_always",
            "license_provenance_none",
            "license_provenance_commercial",
            "license_provenance_always",
        ).forEach { compose.onNodeWithTag(it).assertExists() }
    }

    @Test
    fun editModeHidesTheImmutableLicense() {
        renderComposer(ComposePostUiState(editingId = "p1"))
        compose.onNodeWithTag("license_attribution_none").assertDoesNotExist()
    }

    @Test
    fun theErrorStatesRender() {
        renderComposer(
            ComposePostUiState(
                emptyBody = true,
                refusal = "the server said no",
                signingFailed = true,
            ),
        )
        compose.onNodeWithTag("compose_empty_body").assertExists()
        compose.onNodeWithTag("compose_refused").assertExists()
        compose.onNodeWithTag("compose_signing_failed").assertExists()
    }

    /** F2: a refusal reaches the reader in the server's own words. */
    @Test
    fun aRefusalIsShownVerbatim() {
        renderComposer(ComposePostUiState(refusal = "`x y` is not a legal topic name"))
        compose.onNodeWithTag("compose_refused")
            .assertTextContains("`x y` is not a legal topic name")
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
        onOpenTopic: (String) -> Unit = {},
        onSubmitComment: () -> Unit = {},
        onSignInOrJoin: () -> Unit = {},
        onRefresh: () -> Unit = {},
        onLoadMoreComments: () -> Unit = {},
        onLoadMoreReplies: (com.cogra.domain.CommentView) -> Unit = {},
        onStartEditComment: (com.cogra.domain.CommentView) -> Unit = {},
        onSubmitCommentEdit: () -> Unit = {},
        onStartReply: (String) -> Unit = {},
        onSubmitReply: () -> Unit = {},
        onToggleTagValues: (String) -> Unit = {},
        onTagInputChange: (TagTarget, String) -> Unit = { _, _ -> },
        onAddTag: (TagTarget) -> Unit = {},
        onRemoveTag: (TagTarget, String) -> Unit = { _, _ -> },
        onTuneTag: (TagTarget, String) -> Unit = { _, _ -> },
        onDoneTuningTag: (TagTarget) -> Unit = {},
        onTagRelevanceChange: (TagTarget, String, Double) -> Unit = { _, _, _ -> },
        onTagConfidenceChange: (TagTarget, String, Double) -> Unit = { _, _, _ -> },
        onConfirmSubmit: (Boolean) -> Unit = {},
        onDismissConfirm: () -> Unit = {},
        onStance: (String, String) -> Unit = { _, _ -> },
        onToggleReferenceValues: (String) -> Unit = {},
        onRemoveReference: (TagTarget, String) -> Unit = { _, _ -> },
        onOpenPost: (String) -> Unit = {},
        onReference: (String) -> Unit = {},
    ) {
        compose.setContent {
            PostDetailScreen(
                stanceControl = { target, tag -> onStance(target, tag) },
                state = state,
                viewerId = viewerId,
                signedIn = signedIn,
                onRefresh = onRefresh,
                onLoadMoreComments = onLoadMoreComments,
                onDraftChange = {},
                onLicenseChange = {},
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
                onToggleTagValues = onToggleTagValues,
                onTagInputChange = onTagInputChange,
                onAddTag = onAddTag,
                onRemoveTag = onRemoveTag,
                onTuneTag = onTuneTag,
                onDoneTuningTag = onDoneTuningTag,
                onTagRelevanceChange = onTagRelevanceChange,
                onTagConfidenceChange = onTagConfidenceChange,
                onToggleReferenceValues = onToggleReferenceValues,
                onOpenFinder = {},
                onCloseFinder = {},
                onFinderQueryChange = { _, _ -> },
                onPickReference = { _, _ -> },
                onRemoveReference = onRemoveReference,
                onTuneReference = { _, _ -> },
                onDoneTuningReference = {},
                onReferenceRelevanceChange = { _, _, _ -> },
                onReferenceSupportChange = { _, _, _ -> },
                onConfirmSubmit = onConfirmSubmit,
                onDismissConfirm = onDismissConfirm,
                onEdit = onEdit,
                onOpenActor = onOpenActor,
                onOpenTopic = onOpenTopic,
                onOpenPost = onOpenPost,
                onReference = onReference,
                onSignInOrJoin = onSignInOrJoin,
                onBack = {},
            )
        }
    }

    // Post cards, the post itself, and every comment carry the stance
    // control (design.md §6), each on its own target.
    @Test
    fun everyPostCardCarriesAStanceControlForItsOwnPost() {
        val stanced = mutableListOf<Pair<String, String>>()
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1"), testPost("p2"))),
            onStance = { target, tag -> stanced += target to tag },
        )
        assertThat(stanced).containsExactly(
            "p1" to "feed_post_p1",
            "p2" to "feed_post_p2",
        )
    }

    /**
     * A taller device than the default: the assertion needs every
     * comment composed, and a `LazyColumn` composes only its window.
     * The detail's header grew a reference row and a Reference action,
     * so the default viewport no longer reaches the second comment.
     */
    @Config(qualifiers = "+h1600dp")
    @Test
    fun theDetailCarriesAStanceControlForThePostAndForEveryComment() {
        val stanced = mutableListOf<String>()
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(testComment("c1"), testComment("c2")),
            ),
            onStance = { target, _ -> stanced += target },
        )
        assertThat(stanced).containsExactly("p1", "c1", "c2")
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

    // Pull-to-refresh belongs to the top of the thread: a reader
    // correcting upward from the middle of a long post is scrolling,
    // not asking for a re-read.
    @Test
    fun anUpwardDragAwayFromTheTopScrollsInsteadOfRefreshing() {
        var refreshes = 0
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = (1..30).map { testComment("c$it") },
            ),
            onRefresh = { refreshes++ },
        )
        // Down the thread, well past the header…
        repeat(3) {
            compose.onNodeWithTag("detail_list").performTouchInput { swipeUp() }
        }
        // …then a correction back up that the thread itself absorbs.
        compose.onNodeWithTag("detail_list").performTouchInput {
            down(center)
            moveBy(Offset(0f, 200f))
            advanceEventTime(250)
            up()
        }
        assertThat(refreshes).isEqualTo(0)
    }

    // Landing is per node: a landed post can carry a comment that is
    // still settling, and the marker follows the node it belongs to.
    @Test
    fun theSettlingMarkerFollowsTheNodeThatIsPending() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1", landing = Landing.landed(2)),
                comments = listOf(
                    testComment("c1", landing = Landing.Pending),
                    testComment("c2", landing = Landing.landed(2)),
                ),
            ),
        )
        compose.onNodeWithTag("detail_pending").assertDoesNotExist()
        compose.onNodeWithTag("comment_pending_c1").assertExists()
        compose.onNodeWithTag("detail_comment_c1").assertExists()
        compose.onNodeWithTag("comment_pending_c2").assertDoesNotExist()
    }

    @Test
    fun aPendingPostIsMarkedOnItsDetail() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1", landing = Landing.Pending),
                comments = emptyList(),
            ),
        )
        compose.onNodeWithTag("detail_pending").assertExists()
        compose.onNodeWithTag("detail_body").assertExists()
    }

    // Enforcement inside CoGra reduces to honest display
    // (platform-guidelines.md §5), so the qualifiers ride the post and
    // every comment on the read surface.
    @Test
    fun theLicenseTermsRideThePostAndEveryComment() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1", license = LicenseChoice(attribution = 1.0, provenance = 0.0)),
                comments = listOf(testComment("c1")),
            ),
        )
        compose.onNodeWithTag("detail_license_terms").assertExists()
        compose.onNodeWithTag("comment_license_terms_c1").assertExists()
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
    @Config(qualifiers = "+h1600dp")
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

    // -- Topics --

    @Test
    fun aPostCardRendersItsTopicChips() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(testPost("p1").copy(topics = listOf(testTopicClaim("rust")))),
            ),
        )
        compose.onNodeWithTag("feed_post_p1_topic_rust").assertExists()
    }

    // -- Topic value reveal (F8): the detail view only, on demand --

    /** A card is for reading; the reveal belongs where the reader chose the content. */
    @Test
    fun aFeedCardOffersNoValueReveal() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(testPost("p1").copy(topics = listOf(testTopicClaim("rust")))),
            ),
        )
        compose.onNodeWithTag("feed_post_p1_topics_reveal").assertDoesNotExist()
    }

    @Test
    fun theDetailViewOffersTheRevealOnThePostAndOnEveryComment() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1").copy(topics = listOf(testTopicClaim("rust"))),
                comments = listOf(comment("c1").copy(topics = listOf(testTopicClaim("kotlin")))),
            ),
        )
        compose.onNodeWithTag("detail_post_topics_reveal").assertExists()
        compose.onNodeWithTag("comment_c1_topics_reveal").assertExists()
    }

    /** Default is the plain name chip — nobody sees the numbers unasked. */
    @Test
    fun anUnrevealedChipShowsOnlyItsName() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1").copy(
                    topics = listOf(testTopicClaim("rust", relevance = 0.4, confidence = 0.9)),
                ),
            ),
        )
        compose.onNodeWithTag("detail_post_topic_rust").assertTextEquals("#rust")
    }

    @Test
    fun revealingTheRowShowsEachClaimCompactlyAndSigned() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1").copy(
                    topics = listOf(testTopicClaim("rust", relevance = 0.4, confidence = 0.9)),
                ),
                revealedTagRows = setOf("p1"),
            ),
        )
        compose.onNodeWithTag("detail_post_topic_rust").assertTextContains("+0.40 · 0.90")
    }

    /** Bipolar relevance keeps its sign; a withdrawal-ward claim reads negative. */
    @Test
    fun aNegativeRelevanceRevealsWithItsSign() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1").copy(
                    topics = listOf(testTopicClaim("rust", relevance = -0.5, confidence = 1.0)),
                ),
                revealedTagRows = setOf("p1"),
            ),
        )
        compose.onNodeWithTag("detail_post_topic_rust").assertTextContains("-0.50 · 1.00")
    }

    /**
     * The compact form is an abbreviation, so the revealed chip names
     * both parameters for assistive tech rather than leaving TalkBack to
     * read "+0.40 · 0.90" after a name.
     */
    @Test
    fun aRevealedChipNamesBothParametersForScreenReaders() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1").copy(
                    topics = listOf(testTopicClaim("rust", relevance = 0.4, confidence = 0.9)),
                ),
                revealedTagRows = setOf("p1"),
            ),
        )
        compose.onNodeWithTag("detail_post_topic_rust")
            .assertContentDescriptionEquals("#rust, relevance +0.40, confidence 0.90")
    }

    /** The chip stays the way to the topic screen, revealed or not (F8). */
    @Test
    fun aRevealedChipStillNavigatesToItsTopic() {
        var opened: String? = null
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1").copy(topics = listOf(testTopicClaim("rust"))),
                revealedTagRows = setOf("p1"),
            ),
            onOpenTopic = { opened = it },
        )
        compose.onNodeWithTag("detail_post_topic_rust").performClick()
        assertThat(opened).isEqualTo("rust")
    }

    @Test
    fun tappingTheRevealReportsTheRowItBelongsTo() {
        val toggled = mutableListOf<String>()
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1").copy(topics = listOf(testTopicClaim("rust"))),
                comments = listOf(comment("c1").copy(topics = listOf(testTopicClaim("kotlin")))),
            ),
            onToggleTagValues = { toggled += it },
        )
        compose.onNodeWithTag("detail_post_topics_reveal").performClick()
        compose.onNodeWithTag("comment_c1_topics_reveal").performClick()
        assertThat(toggled).containsExactly("p1", "c1").inOrder()
    }

    /** One row's answer says nothing about the next row's. */
    @Test
    fun revealingOneRowLeavesTheOtherRowsPlain() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1").copy(
                    topics = listOf(testTopicClaim("rust", relevance = 0.4, confidence = 0.9)),
                ),
                comments = listOf(
                    comment("c1").copy(
                        topics = listOf(testTopicClaim("kotlin", relevance = 0.4, confidence = 0.9)),
                    ),
                ),
                revealedTagRows = setOf("p1"),
            ),
        )
        compose.onNodeWithTag("detail_post_topic_rust").assertTextContains("+0.40 · 0.90")
        compose.onNodeWithTag("comment_c1_topic_kotlin").assertTextEquals("#kotlin")
    }

    // -- Comment compose gains tags (F9) and the editor gains them (F10) --

    @Test
    fun theCommentBoxCarriesATagEntry() {
        renderDetail(PostDetailUiState(loading = false, post = testPost("p1")))
        compose.onNodeWithTag("detail_comment_tag_input").assertExists()
        compose.onNodeWithTag("detail_comment_tag_add").assertExists()
    }

    @Test
    fun anAnonymousReaderGetsNoTagEntry() {
        renderDetail(
            PostDetailUiState(loading = false, post = testPost("p1")),
            signedIn = false,
        )
        compose.onNodeWithTag("detail_comment_tag_input").assertDoesNotExist()
    }

    @Test
    fun typingIntoTheCommentTagFieldNamesItsSection() {
        val typed = mutableListOf<Pair<TagTarget, String>>()
        renderDetail(
            PostDetailUiState(loading = false, post = testPost("p1")),
            onTagInputChange = { target, text -> typed += target to text },
        )
        compose.onNodeWithTag("detail_comment_tag_input").performTextInput("Rust")
        assertThat(typed).containsExactly(TagTarget.COMMENT to "Rust")
    }

    @Test
    fun theCommentBoxRendersItsStagedChips() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                commentTags = TagSectionState(tags = tagRows("rust")),
            ),
        )
        compose.onNodeWithTag("detail_comment_tag_rust").assertExists()
    }

    /** The indicator counts the minting write and each declared topic (F4). */
    @Test
    fun theCommentSubmitSaysWhatItWillSign() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                commentTags = TagSectionState(tags = tagRows("rust", "kotlin")),
            ),
        )
        compose.onNodeWithTag("detail_comment_signed_actions")
            .assertTextContains("3", substring = true)
    }

    @Test
    fun theReplyBoxCarriesItsOwnTagEntry() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1")),
                replyingToId = "c1",
            ),
        )
        compose.onNodeWithTag("comment_reply_tag_input").assertExists()
        compose.onNodeWithTag("comment_reply_signed_actions").assertExists()
    }

    @Test
    fun theInlineEditorCarriesTheCommentsTags() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1")),
                editingCommentId = "c1",
                editDraft = "text",
                editLoadedText = "text",
                editTags = TagSectionState(tags = tagRows("rust"), loaded = tagRows("rust")),
            ),
            viewerId = "author-1",
        )
        compose.onNodeWithTag("comment_edit_tag_rust").assertExists()
        compose.onNodeWithTag("comment_edit_tag_input").assertExists()
    }

    /** An edit that changed nothing has nothing to sign (F10). */
    @Test
    fun anUnchangedEditCannotBeSubmitted() {
        val loaded = tagRows("rust")
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1")),
                editingCommentId = "c1",
                editDraft = "text",
                editLoadedText = "text",
                editTags = TagSectionState(tags = loaded, loaded = loaded),
            ),
            viewerId = "author-1",
        )
        compose.onNodeWithTag("comment_edit_signed_actions").assertTextContains("0", substring = true)
        compose.onNodeWithTag("comment_edit_save").assertIsNotEnabled()
    }

    @Test
    fun aTagOnlyEditIsSubmittable() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1")),
                editingCommentId = "c1",
                editDraft = "text",
                editLoadedText = "text",
                editTags = TagSectionState(tags = tagRows("rust"), loaded = emptyList()),
            ),
            viewerId = "author-1",
        )
        compose.onNodeWithTag("comment_edit_signed_actions").assertTextContains("1", substring = true)
        compose.onNodeWithTag("comment_edit_save").assertIsEnabled()
    }

    @Test
    fun aMultiActionCommentSubmitAsksFirst() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                commentTags = TagSectionState(tags = tagRows("rust")),
                confirmPending = TagTarget.COMMENT,
            ),
        )
        compose.onNodeWithTag("detail_confirm").assertExists()
        compose.onNodeWithTag("detail_confirm_body").assertTextContains("2", substring = true)
    }

    @Test
    fun confirmingTheBatchReportsTheDontAskChoice() {
        var confirmed: Boolean? = null
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                commentTags = TagSectionState(tags = tagRows("rust")),
                confirmPending = TagTarget.COMMENT,
            ),
            onConfirmSubmit = { confirmed = it },
        )
        compose.onNodeWithTag("detail_confirm_dont_ask").performClick()
        compose.onNodeWithTag("detail_confirm_proceed").performClick()
        assertThat(confirmed).isTrue()
    }

    @Test
    fun theComposerPreviewsTheNormalizedName() {
        // Stateless by design (android/CLAUDE.md "Stateless screens"): the
        // preview reads straight off state.tagInput, so a state carrying
        // the raw text is enough to assert the normalization it renders.
        renderComposer(ComposePostUiState(tagSection = TagSectionState(input = "#Rust")))
        compose.onNodeWithTag("compose_tag_preview").assertTextContains("rust", substring = true)
    }

    @Test
    fun typingIntoTheTagFieldReportsTheRawText() {
        var input: String? = null
        renderComposer(ComposePostUiState(), onTagInputChange = { input = it })
        compose.onNodeWithTag("compose_tag_input").performTextInput("Rust")
        assertThat(input).isEqualTo("Rust")
    }

    @Test
    fun stagedTagsRenderAsRemovableChips() {
        renderComposer(ComposePostUiState(tagSection = TagSectionState(tags = tagRows("rust", "kotlin"))))
        compose.onNodeWithTag("compose_tag_rust").assertExists()
        compose.onNodeWithTag("compose_tag_kotlin").assertExists()
    }

    @Test
    fun aStagedChipOffersARemoveAffordance() {
        renderComposer(ComposePostUiState(tagSection = TagSectionState(tags = tagRows("rust"))))
        compose.onNodeWithTag("compose_tag_rust_remove")
            .assertExists()
            .assert(hasClickAction())
    }

    @Test
    fun reachingTheCapHidesTheEntryFieldAndShowsTheLimit() {
        renderComposer(
            ComposePostUiState(
                tagSection = TagSectionState(tags = tagRows(*(1..10).map { "tag$it" }.toTypedArray())),
            ),
        )
        compose.onNodeWithTag("compose_tag_input").assertDoesNotExist()
        compose.onNodeWithTag("compose_tags_cap").assertExists()
    }

    /** F3: tag editing moved ONTO the edit screen — it is no longer hidden there. */
    @Test
    fun theEditScreenCarriesTheTagsSection() {
        renderComposer(ComposePostUiState(editingId = "p1", tagSection = TagSectionState(tags = tagRows("rust"))))
        compose.onNodeWithTag("compose_tags").assertExists()
        compose.onNodeWithTag("compose_tag_rust").assertExists()
        compose.onNodeWithTag("compose_tag_input").assertExists()
    }

    /** F1: the Add action refuses a name L1's atom rule cannot carry. */
    @Test
    fun anIllegalNameDisablesAddAndSaysWhy() {
        renderComposer(ComposePostUiState(tagSection = TagSectionState(input = "two words")))
        compose.onNodeWithTag("compose_tag_add").assertIsNotEnabled()
        compose.onNodeWithTag("compose_tag_illegal").assertExists()
        compose.onNodeWithTag("compose_tag_preview").assertDoesNotExist()
    }

    @Test
    fun aNonAsciiNameIsRefusedAtInputTime() {
        renderComposer(ComposePostUiState(tagSection = TagSectionState(input = "café")))
        compose.onNodeWithTag("compose_tag_add").assertIsNotEnabled()
        compose.onNodeWithTag("compose_tag_illegal").assertExists()
    }

    @Test
    fun aLegalNameEnablesAdd() {
        renderComposer(ComposePostUiState(tagSection = TagSectionState(input = "#Rust")))
        compose.onNodeWithTag("compose_tag_add").assertIsEnabled()
        compose.onNodeWithTag("compose_tag_illegal").assertDoesNotExist()
    }

    /** F2: the server's own words, on the chip it named. */
    @Test
    fun aFieldRefusalLandsOnItsChip() {
        renderComposer(
            ComposePostUiState(
                tagSection = TagSectionState(
                    tags = listOf(
                        TagRow("rust"),
                        TagRow("kotlin", error = "`kotlin` is not a legal topic name: nope"),
                    ),
                ),
            ),
        )
        compose.onNodeWithTag("compose_tag_error_kotlin")
            .assertTextContains("`kotlin` is not a legal topic name: nope")
        compose.onNodeWithTag("compose_tag_error_rust").assertDoesNotExist()
        // Nothing was signed, so nothing claims signing failed.
        compose.onNodeWithTag("compose_signing_failed").assertDoesNotExist()
    }

    /** F6: tapping a chip opens its two parameters. */
    @Test
    fun tappingAChipReportsItForTuning() {
        var tuned: String? = null
        renderComposer(ComposePostUiState(tagSection = TagSectionState(tags = tagRows("rust"))), onTuneTag = { tuned = it })
        compose.onNodeWithTag("compose_tag_rust_open").performScrollTo().performClick()
        assertThat(tuned).isEqualTo("rust")
    }

    @Test
    fun theTunedChipShowsBothSliders() {
        renderComposer(
            ComposePostUiState(tagSection = TagSectionState(tags = tagRows("rust"), tuning = "rust")),
        )
        compose.onNodeWithTag("compose_tag_params").assertExists()
        compose.onNodeWithTag("compose_tag_params_relevance").assertExists()
        compose.onNodeWithTag("compose_tag_params_confidence").assertExists()
    }

    // -- Signed-action indicator and the multi-action confirm (F4) --

    @Test
    fun theIndicatorCountsTheMintingRecordAndEachTag() {
        renderComposer(ComposePostUiState(tagSection = TagSectionState(tags = tagRows("rust", "kotlin"))))
        compose.onNodeWithTag("compose_signed_actions").assertTextContains("3", substring = true)
    }

    @Test
    fun anUnchangedEditStagesNothingAndCannotBeSubmitted() {
        renderComposer(
            ComposePostUiState(
                editingId = "p1",
                body = "same",
                loadedBody = "same",
            ),
        )
        compose.onNodeWithTag("compose_signed_actions").assertTextContains("0", substring = true)
        compose.onNodeWithTag("compose_submit").assertIsNotEnabled()
    }

    @Test
    fun theConfirmNamesTheCountAndProceedCarriesTheCheckbox() {
        var confirmed: Boolean? = null
        renderComposer(
            ComposePostUiState(tagSection = TagSectionState(tags = tagRows("rust")), confirmPending = true),
            onConfirmSubmit = { confirmed = it },
        )
        compose.onNodeWithTag("compose_confirm").assertExists()
        compose.onNodeWithTag("compose_confirm_body").assertTextContains("2", substring = true)
        compose.onNodeWithTag("compose_confirm_dont_ask").performClick()
        compose.onNodeWithTag("compose_confirm_proceed").performClick()
        assertThat(confirmed).isTrue()
    }

    @Test
    fun theConfirmProceedsWithoutTheCheckboxByDefault() {
        var confirmed: Boolean? = null
        renderComposer(
            ComposePostUiState(tagSection = TagSectionState(tags = tagRows("rust")), confirmPending = true),
            onConfirmSubmit = { confirmed = it },
        )
        compose.onNodeWithTag("compose_confirm_proceed").performClick()
        assertThat(confirmed).isFalse()
    }

    @Test
    fun cancellingTheConfirmSignsNothing() {
        var dismissed = false
        var confirmed = false
        renderComposer(
            ComposePostUiState(tagSection = TagSectionState(tags = tagRows("rust")), confirmPending = true),
            onConfirmSubmit = { confirmed = true },
            onDismissConfirm = { dismissed = true },
        )
        compose.onNodeWithTag("compose_confirm_cancel").performClick()
        assertThat(dismissed).isTrue()
        assertThat(confirmed).isFalse()
    }

    private fun tagRows(vararg names: String) = names.map { TagRow(it) }

    // -- The reference row (D16) --

    private fun mentionClaim(handle: String = "ada") =
        testReferenceClaim(testMentionTarget(handle))

    @Test
    fun aPostCardRendersItsReferenceChips() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(testPost("p1").copy(references = listOf(mentionClaim()))),
            ),
        )
        compose.onNodeWithTag("feed_post_p1_reference_l1-user-ada").assertExists()
    }

    /** A card is for reading; the reveal belongs where the reader chose the content. */
    @Test
    fun aFeedCardOffersNoReferenceValueReveal() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(testPost("p1").copy(references = listOf(mentionClaim()))),
            ),
        )
        compose.onNodeWithTag("feed_post_p1_references_reveal").assertDoesNotExist()
    }

    @Test
    fun theDetailOffersTheReferenceRevealOnThePostAndOnEveryComment() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1").copy(references = listOf(mentionClaim())),
                comments = listOf(comment("c1").copy(references = listOf(mentionClaim("grace")))),
            ),
        )
        compose.onNodeWithTag("detail_post_references_reveal").assertExists()
        compose.onNodeWithTag("comment_c1_references_reveal").assertExists()
    }

    /** The two rows reveal apart — a citation's parameters are its own question. */
    @Test
    fun revealingReferenceValuesLeavesTheTopicRowAlone() {
        val revealed = mutableListOf<String>()
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1").copy(
                    topics = listOf(testTopicClaim("rust")),
                    references = listOf(mentionClaim()),
                ),
                comments = emptyList(),
            ),
            onToggleReferenceValues = { revealed += it },
        )
        compose.onNodeWithTag("detail_post_references_reveal").performClick()
        assertThat(revealed).containsExactly("p1")
    }

    @Test
    fun aRevealedReferenceRowShowsBothParametersSigned() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1").copy(
                    references = listOf(
                        testReferenceClaim(
                            testMentionTarget("ada"),
                            relevance = 0.4,
                            support = -0.2,
                        ),
                    ),
                ),
                comments = emptyList(),
                revealedReferenceRows = setOf("p1"),
            ),
        )
        compose.onNodeWithTag("detail_post_reference_l1-user-ada")
            .assertTextContains("+0.40 · -0.20")
    }

    @Test
    fun aMentionChipOpensTheProfileItNames() {
        val opened = mutableListOf<String>()
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1").copy(references = listOf(mentionClaim())),
                comments = emptyList(),
            ),
            onOpenActor = { opened += it },
        )
        compose.onNodeWithTag("detail_post_reference_l1-user-ada").performClick()
        assertThat(opened).containsExactly("ada")
    }

    @Test
    fun aQuotedPostChipOpensThatPostsDetail() {
        val opened = mutableListOf<String>()
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1").copy(
                    references = listOf(testReferenceClaim(testContentTarget("p9"))),
                ),
                comments = emptyList(),
            ),
            onOpenPost = { opened += it },
        )
        compose.onNodeWithTag("detail_post_reference_l1-p9").performClick()
        assertThat(opened).containsExactly("p9")
    }

    /**
     * A citation this build cannot type still stands as a substrate
     * fact, so its chip renders — readable, and not actionable.
     */
    @Test
    fun anUntypeableCitationRendersInertRatherThanVanishing() {
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1").copy(
                    references = listOf(testReferenceClaim(target = null)),
                ),
                comments = emptyList(),
            ),
        )
        compose.onNodeWithTag("detail_post_reference_l1-untypeable").assertExists()
        compose.onNodeWithTag("detail_post_reference_l1-untypeable").assertIsNotEnabled()
    }

    // -- The Reference affordance and the finder (D20) --

    @Test
    fun thePostDetailOffersTheReferenceAffordance() {
        val referenced = mutableListOf<String>()
        renderDetail(
            PostDetailUiState(loading = false, post = testPost("p1"), comments = emptyList()),
            onReference = { referenced += it },
        )
        compose.onNodeWithTag("detail_post_reference_action").performClick()
        assertThat(referenced).containsExactly("p1")
    }

    @Test
    fun aCommentOffersTheReferenceAffordanceToo() {
        val referenced = mutableListOf<String>()
        renderDetail(
            PostDetailUiState(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1")),
            ),
            signedIn = true,
            onReference = { referenced += it },
        )
        compose.onNodeWithTag("comment_reference_c1").performClick()
        assertThat(referenced).containsExactly("c1")
    }

    @Test
    fun theComposerOpensTheFinderFromItsAddAction() {
        var opened = false
        renderComposer(ComposePostUiState(), onOpenFinder = { opened = true })
        compose.onNodeWithTag("compose_reference_add").performScrollTo().performClick()
        assertThat(opened).isTrue()
    }

    @Test
    fun theFinderListsWhatResolvedAndPicksOnTap() {
        val picked = mutableListOf<String>()
        renderComposer(
            ComposePostUiState(
                referenceSection = ReferenceSectionState(
                    finder = ReferenceFinderState(
                        query = "@ada",
                        candidates = listOf(
                            ReferenceCandidateRow("u1", testMentionTarget("ada")),
                        ),
                    ),
                ),
            ),
            onPickReference = { picked += it.targetId },
        )
        compose.onNodeWithTag("compose_finder_candidate_u1").performClick()
        assertThat(picked).containsExactly("u1")
    }

    /** Resolving nothing is the normal case mid-typing, not an error. */
    @Test
    fun aFinderThatResolvedNothingSaysSoWithoutAnErrorLine() {
        renderComposer(
            ComposePostUiState(
                referenceSection = ReferenceSectionState(
                    finder = ReferenceFinderState(query = "ad", candidates = emptyList()),
                ),
            ),
        )
        compose.onNodeWithTag("compose_finder_empty").assertExists()
        compose.onNodeWithTag("compose_finder_failed").assertDoesNotExist()
    }

    @Test
    fun aFinderLookupThatFellOverShowsItsOwnLine() {
        renderComposer(
            ComposePostUiState(
                referenceSection = ReferenceSectionState(
                    finder = ReferenceFinderState(query = "ada", failed = true),
                ),
            ),
        )
        compose.onNodeWithTag("compose_finder_failed").assertExists()
        compose.onNodeWithTag("compose_finder_empty").assertDoesNotExist()
    }

    @Test
    fun theComposerRefusesTheEleventhReferenceInWords() {
        renderComposer(
            ComposePostUiState(
                referenceSection = ReferenceSectionState(
                    references = (1..10).map { ReferenceRow("u$it", testMentionTarget("a$it")) },
                ),
            ),
        )
        compose.onNodeWithTag("compose_references_cap").assertExists()
        compose.onNodeWithTag("compose_reference_add").assertDoesNotExist()
    }

    /** Verbatim, on the chip the server named. */
    @Test
    fun aRefusedReferenceChipCarriesTheServersWords() {
        renderComposer(
            ComposePostUiState(
                referenceSection = ReferenceSectionState(
                    references = listOf(
                        ReferenceRow(
                            "u1",
                            testMentionTarget("ada"),
                            error = "An artifact cannot cite itself.",
                        ),
                    ),
                ),
            ),
        )
        compose.onNodeWithTag("compose_reference_error_u1")
            .assertTextEquals("An artifact cannot cite itself.")
    }

    /**
     * The count a withdrawal costs, quoted in the confirm before
     * anything is staged: the claim served it, so the dialog can name
     * it the first time it opens (B4).
     */
    @Test
    fun theConfirmQuotesWhatAWithdrawalCosts() {
        val standing = ReferenceRow("u1", testMentionTarget("ada"), withdrawalCost = 3)
        renderComposer(
            ComposePostUiState(
                editingId = "p1",
                confirmPending = true,
                referenceSection = ReferenceSectionState(
                    references = emptyList(),
                    loaded = listOf(standing),
                ),
            ),
        )
        compose.onNodeWithTag("compose_confirm_withdrawal").assertExists()
    }

    @Test
    fun aConfirmWithNoWithdrawalQuotesNoWithdrawalCost() {
        renderComposer(
            ComposePostUiState(
                tagSection = TagSectionState(tags = tagRows("rust")),
                confirmPending = true,
            ),
        )
        compose.onNodeWithTag("compose_confirm_withdrawal").assertDoesNotExist()
    }
}
