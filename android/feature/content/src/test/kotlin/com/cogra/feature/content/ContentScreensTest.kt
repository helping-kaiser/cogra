package com.cogra.feature.content

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.unit.dp
import com.cogra.domain.FieldStatus
import com.cogra.domain.Landing
import com.cogra.domain.LandingState
import com.cogra.domain.LicenseChoice
import com.cogra.domain.PostView
import com.cogra.domain.content.SensitiveMark
import com.cogra.domain.MediaAssetView
import com.cogra.core.designsystem.v2.media.PINNED_CLIP_TAG
import com.cogra.domain.ModeratedField
import com.cogra.domain.testing.testComment
import com.cogra.domain.testing.testContentTarget
import com.cogra.domain.testing.testMentionTarget
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testReferenceClaim
import com.cogra.domain.testing.testTopicClaim
import com.cogra.feature.content.reply.ReplyTargetKind
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
class ContentScreensTest {

    @get:Rule
    val compose = createComposeRule()

    // -- Feed --

    private fun renderFeed(
        state: FeedUiState,
        onOpenPost: (String) -> Unit = {},
        onOpenActor: (String) -> Unit = {},
        onOpenTopic: (String) -> Unit = {},
        onLoadMore: () -> Unit = {},
        onRefresh: () -> Unit = {},
        keyBanner: @Composable () -> Unit = {},
        borrowedViewBand: @Composable () -> Unit = {},
        onChats: (() -> Unit)? = null,
        onShare: (String) -> Unit = {},
        onStance: (String, String) -> Unit = { _, _ -> },
        viewerId: String? = null,
        onEditPost: (String) -> Unit = {},
        onCitePost: (String) -> Unit = {},
        thread: CommentsUiState = CommentsUiState(loading = false),
        onThreadRaised: (String) -> Unit = {},
    ) {
        compose.setContent {
            FeedScreen(
                onShare = onShare,
                stanceControl = { target, tag -> onStance(target, tag) },
                state = state,
                onRefresh = onRefresh,
                onLoadMore = onLoadMore,
                onOpenPost = onOpenPost,
                onOpenActor = onOpenActor,
                onOpenTopic = onOpenTopic,
                onChats = onChats,
                keyBanner = keyBanner,
                borrowedViewBand = borrowedViewBand,
                viewerId = viewerId,
                onEditPost = onEditPost,
                onCitePost = onCitePost,
                // The same stateless sheet the detail mounts: the feed
                // supplies the slot, and the thread state stands in for
                // the holder the route would bind.
                commentsSheet = { postId, onDismiss ->
                    onThreadRaised(postId)
                    CommentsSheet(
                        state = thread,
                        viewerId = viewerId,
                        signedIn = true,
                        onDismiss = onDismiss,
                        onLoadMoreComments = {},
                        onAddComment = {},
                        onReplyTo = {},
                        onEditComment = {},
                        onCommentSignedShown = {},
                        onLoadMoreReplies = {},
                        onReveal = { _, _ -> },
                        onOpenActor = onOpenActor,
                        onOpenTopic = onOpenTopic,
                        onReference = onCitePost,
                        onLicense = {},
                        onSignInOrJoin = {},
                    )
                },
            )
        }
    }

    @Test
    fun theFeedWearsTheBandRatherThanAPageTitle() {
        renderFeed(FeedUiState(loading = false))

        // A tab root's name is the bar slot the reader tapped to get here,
        // so the band carries the mark and the wordmark and no screen
        // title (FE-09).
        compose.onNodeWithTag("feed_band_wordmark").assertTextEquals("cogra")
        compose.onNodeWithText("Feed").assertDoesNotExist()
    }

    @Test
    fun theBandCarriesChatsWhereMessagingLeadsSomewhere() {
        var chats = 0
        renderFeed(FeedUiState(loading = false), onChats = { chats++ })

        compose.onNodeWithTag("feed_band_chats").performClick()

        assertThat(chats).isEqualTo(1)
    }

    @Test
    fun theBandDrawsNoChatsControlWhereItWouldOpenNothing() {
        // The signed-in reader's chat surface is an undrawn gap on the
        // canvas, and a control that opens nothing teaches the reader the
        // band lies.
        renderFeed(FeedUiState(loading = false), onChats = null)

        compose.onNodeWithTag("feed_band_chats").assertDoesNotExist()
    }

    @Test
    fun theBorrowedViewBandRidesTheTopRegionForTheReaderWhoHasOne() {
        renderFeed(
            FeedUiState(loading = false),
            borrowedViewBand = {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(24.dp)
                        .testTag("borrowed_band"),
                )
            },
        )

        compose.onNodeWithTag("borrowed_band").assertExists()
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

    // THE NEXT PAGE ARRIVES BECAUSE THE READER KEPT GOING (design readme
    // §13, the same rule web's `infinite-list.ts` cites): no button, no
    // page numbers — the watch sits `FEED_TAIL_DISTANCE` posts short of
    // the end, so scrolling that post into view is the reader "approaching
    // the tail".
    @Test
    fun theNextPageLoadsAutomaticallyAsTheReaderApproachesTheTail() {
        var calls = 0
        val posts = (1..10).map { testPost("p$it") }
        renderFeed(
            FeedUiState(loading = false, posts = posts, hasNextPage = true),
            onLoadMore = { calls++ },
        )
        // Ten posts, five short of the end: the watched post is the sixth.
        // `performScrollToNode` — not `performScrollTo` — because the tail
        // post is not yet composed off-screen in a `LazyColumn`.
        compose.onNodeWithTag("feed_list").performScrollToNode(hasTestTag("feed_post_p6"))
        compose.waitForIdle()
        assertThat(calls).isEqualTo(1)

        // Staying put once the tail is on screen does not ask again — the
        // watch rises once per approach (`distinctUntilChanged`), the same
        // guard `IntersectionObserver` gives web. (A later re-approach, after
        // scrolling away and back, is allowed to ask again on both
        // platforms; what stops a duplicate FETCH there is `loadingMore` /
        // `hasNextPage` in the ViewModel, covered by
        // `FeedViewModelTest.loadMoreWithoutANextPageIsANoOp`.)
        compose.waitForIdle()
        assertThat(calls).isEqualTo(1)
    }

    @Test
    fun theFeedDrawsNoLoadMoreControlAtRest() {
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1")), hasNextPage = true),
        )
        compose.onNodeWithTag("feed_load_more").assertDoesNotExist()
    }

    // The band rides the same collapsing top as the key banner: away
    // scrolling down, back with the returning bar. Whose view it names
    // and which reading it wears belong to the band's own test — the
    // feed knows only that the slot rides this region.
    @Test
    fun theBorrowedViewBandRidesTheCollapsingTop() {
        renderFeed(
            FeedUiState(loading = false, posts = (1..30).map { testPost("p$it") }),
            borrowedViewBand = {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(24.dp)
                        .testTag("borrowed_band"),
                )
            },
        )
        compose.onNodeWithTag("borrowed_band").assertExists()
        compose.onNodeWithTag("feed_list").performTouchInput { swipeUp() }
        compose.onNodeWithTag("borrowed_band").assertDoesNotExist()
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

    // -- The feed card's ⋮ (`PostCard.jsx:262`) --

    /** The rows are `READER_POST_MENU` (`_shared.jsx:376`), on a card. */
    @Test
    fun aFeedCardCarriesTheReaderMenuForSomeoneElsesPost() {
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1"))),
            viewerId = "someone-else",
        )
        compose.onNodeWithTag("feed_p1_menu").performClick()
        compose.onNodeWithTag("feed_p1_menu_save").assertExists()
        compose.onNodeWithTag("feed_p1_menu_cite").assertExists()
        compose.onNodeWithTag("feed_p1_menu_hide").assertExists()
        compose.onNodeWithTag("feed_p1_menu_license").assertExists()
        compose.onNodeWithTag("feed_p1_menu_edit").assertDoesNotExist()
        compose.onNodeWithTag("feed_p1_menu_remove").assertDoesNotExist()
    }

    /**
     * The rows are `OWN_POST_MENU` (`_shared.jsx:421-428`), on a card. Cite
     * takes the reader menu's own position, second, so the thumb finds one
     * row in one place on every menu that has it.
     */
    @Test
    fun aFeedCardCarriesTheOwnPostMenuWhereTheViewerIsTheAuthor() {
        var editing: String? = null
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1"))),
            viewerId = "author-1",
            onEditPost = { editing = it },
        )
        compose.onNodeWithTag("feed_p1_menu").performClick()
        compose.onNodeWithTag("feed_p1_menu_save").assertExists()
        compose.onNodeWithTag("feed_p1_menu_cite").assertExists()
        compose.onNodeWithTag("feed_p1_menu_sensitive").assertExists()
        compose.onNodeWithTag("feed_p1_menu_remove").assertExists()
        compose.onNodeWithTag("feed_p1_menu_license").assertExists()
        compose.onNodeWithTag("feed_p1_menu_hide").assertDoesNotExist()

        val save = compose.onNodeWithTag("feed_p1_menu_save").getUnclippedBoundsInRoot().top
        val cite = compose.onNodeWithTag("feed_p1_menu_cite").getUnclippedBoundsInRoot().top
        val edit = compose.onNodeWithTag("feed_p1_menu_edit").getUnclippedBoundsInRoot().top
        val sensitive = compose.onNodeWithTag("feed_p1_menu_sensitive").getUnclippedBoundsInRoot().top
        val remove = compose.onNodeWithTag("feed_p1_menu_remove").getUnclippedBoundsInRoot().top
        val license = compose.onNodeWithTag("feed_p1_menu_license").getUnclippedBoundsInRoot().top
        assertThat(save.value).isLessThan(cite.value)
        assertThat(cite.value).isLessThan(edit.value)
        assertThat(edit.value).isLessThan(sensitive.value)
        assertThat(sensitive.value).isLessThan(remove.value)
        assertThat(remove.value).isLessThan(license.value)

        compose.onNodeWithTag("feed_p1_menu_edit").performClick()
        assertThat(editing).isEqualTo("p1")
    }

    /**
     * A SIGNED-OUT READER IS NOBODY'S AUTHOR. With no viewer there is no own
     * post, so the card falls to the reader's rows rather than guessing.
     */
    @Test
    fun aSignedOutReaderGetsTheReaderRowsOnEveryCard() {
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1"))),
            viewerId = null,
        )
        compose.onNodeWithTag("feed_p1_menu").performClick()
        compose.onNodeWithTag("feed_p1_menu_cite").assertExists()
        compose.onNodeWithTag("feed_p1_menu_edit").assertDoesNotExist()
    }

    /** The menu's navigating rows work from the feed as from the detail. */
    @Test
    fun theCardsCiteRowStagesThePostInTheComposer() {
        var cited: String? = null
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1"))),
            viewerId = "someone-else",
            onCitePost = { cited = it },
        )
        compose.onNodeWithTag("feed_p1_menu").performClick()
        compose.onNodeWithTag("feed_p1_menu_cite").performClick()
        assertThat(cited).isEqualTo("p1")
    }

    /** The license row opens the terms on the card that asked for them. */
    @Test
    fun theCardsLicenseRowOpensTheTermsOverTheFeed() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(
                    testPost("p1", license = LicenseChoice(attribution = 1.0, provenance = 0.0)),
                ),
            ),
            viewerId = "someone-else",
        )
        compose.onNodeWithTag("feed_p1_menu").performClick()
        compose.onNodeWithTag("feed_p1_menu_license").performClick()
        compose.onNodeWithTag("license_sheet_terms").assertExists()
    }

    /**
     * EVERY CARD'S ROWS ARE ITS OWN. A feed is a list of cards, so the tags
     * are per post — two cards' rows are never one tag.
     */
    @Test
    fun eachCardsRowsAreScopedToThatCard() {
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1"), testPost("p2"))),
            viewerId = "someone-else",
        )
        compose.onNodeWithTag("feed_p1_menu").performClick()
        compose.onNodeWithTag("feed_p1_menu_cite").assertExists()
        compose.onNodeWithTag("feed_p2_menu_cite").assertDoesNotExist()
    }

    /** A REMOVED POST HAS NO MENU AT ALL (`Removed.jsx:5-6`). */
    @Test
    fun aRemovedCardDropsTheMenuWholesale() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(
                    testPost("p1").copy(content = ModeratedField(null, FieldStatus.REDACTED)),
                ),
            ),
            viewerId = "author-1",
        )
        compose.onNodeWithTag("feed_post_p1").assertExists()
        compose.onNodeWithTag("feed_p1_menu").assertDoesNotExist()
    }

    // -- Composer --

    private fun renderComposer(
        state: ComposePostUiState,
        onSubmit: () -> Unit = {},
        onLicenseChange: (LicenseChoice) -> Unit = {},
        onOpenSensitive: () -> Unit = {},
        onCloseSensitive: () -> Unit = {},
        onSensitiveChange: (Boolean) -> Unit = {},
        onSensitiveReasonChange: (String) -> Unit = {},
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
                onOpenSensitive = onOpenSensitive,
                onCloseSensitive = onCloseSensitive,
                onSensitiveChange = onSensitiveChange,
                onSensitiveReasonChange = onSensitiveReasonChange,
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

    /**
     * HT-18. A media post's body IS its gallery, so its edit shows the
     * pictures and draws no words field: the field it used to draw was
     * one whose every value the server refuses, and saving it replaced
     * the media the surface never showed.
     */
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "+h1600dp")
    @Test
    fun aMediaPostsEditShowsItsGalleryInsteadOfAWordsField() {
        renderComposer(
            ComposePostUiState(
                editingId = "p1",
                attachments = listOf(
                    MediaAssetView(
                        id = "m1",
                        url = "https://media/m1",
                        altText = "A salt crust",
                        status = FieldStatus.NORMAL,
                        aspectRatio = 4f / 5f,
                        mimeType = "image/webp",
                    ),
                ),
            ),
        )
        compose.onNodeWithTag("compose_media").performScrollTo().assertExists()
        compose.onNodeWithTag("compose_media_note").performScrollTo().assertExists()
        compose.onNodeWithTag("compose_body").assertDoesNotExist()
    }

    /** A words post keeps the field its body actually lives in. */
    @Test
    fun aWordsPostsEditKeepsItsWordsField() {
        renderComposer(ComposePostUiState(editingId = "p1", body = "Salt maps"))
        compose.onNodeWithTag("compose_body").assertExists()
        compose.onNodeWithTag("compose_media").assertDoesNotExist()
    }

    // THE EDIT SURFACE'S OWN SENSITIVE ROW (`_shared.jsx:1390`), where the
    // menu's `Mark as sensitive` lands. A creation marks at its seal
    // instead, which is where the license it can still choose also lives.
    @Test
    fun theEditSurfaceCarriesTheSensitiveRow() {
        renderComposer(ComposePostUiState(editingId = "p1", body = "Salt maps"))
        compose.onNodeWithTag("compose_sensitive").performScrollTo().assertExists()
    }

    /** A creation marks at its seal instead, which is also where the
     *  license it can still choose lives. */
    @Test
    fun aCreationCarriesTheLicenseControlsAndNoSensitiveRow() {
        renderComposer(ComposePostUiState(body = "Salt maps"))
        compose.onNodeWithTag("compose_sensitive").assertDoesNotExist()
    }

    /** The row reads the mark it stands on, and offers the word that moves it. */
    @Test
    fun theSensitiveRowReadsTheMarkItStands() {
        renderComposer(ComposePostUiState(editingId = "p1", body = "Salt maps"))
        compose.onNodeWithTag("compose_sensitive").performScrollTo().assertExists()
        compose.onNodeWithText("Sensitive").assertExists()
        compose.onNodeWithText("Not marked").assertExists()
        compose.onNodeWithText("Mark").assertExists()
    }

    @Test
    fun aMarkedPostsRowSaysSoAndOffersTheChange() {
        renderComposer(
            ComposePostUiState(editingId = "p1", body = "Salt maps", sensitive = true),
        )
        compose.onNodeWithTag("compose_sensitive").performScrollTo().assertExists()
        compose.onNodeWithText("Marked").assertExists()
        compose.onNodeWithText("Change").assertExists()
    }

    /** The row's action asks for the sheet; it never marks by itself. */
    @Test
    fun theSensitiveRowsActionAsksForTheSheet() {
        var opened = 0
        renderComposer(
            ComposePostUiState(editingId = "p1", body = "Salt maps"),
            onOpenSensitive = { opened++ },
        )
        compose.onNodeWithText("Mark").performScrollTo().performClick()
        assertThat(opened).isEqualTo(1)
    }

    /** It is the seal's own sheet — one sheet for every surface that
     *  marks (ruling 42), so the words are the same in both places. */
    @Test
    fun theOpenMarkIsTheSealsOwnSheet() {
        renderComposer(
            ComposePostUiState(editingId = "p1", body = "Salt maps", sensitiveOpen = true),
        )
        compose.onNodeWithTag("compose_sensitive_sheet").assertExists()
        compose.onNodeWithTag("compose_sensitive_switch").assertExists()
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

    /**
     * THE THREAD IS A SHEET (`_shared.jsx:1247-1257`): a test that reads it
     * opens it the way a reader does — through the affordance row's count.
     */
    private fun openComments() {
        compose.onNodeWithTag("detail_post_comments").performClick()
        // The sheet animates in, so the thread's composition is not finished
        // when the click returns — a test that reads state rather than nodes
        // has no other sync point.
        compose.waitForIdle()
    }

    private fun renderDetail(
        state: DetailFixture,
        viewerId: String? = null,
        signedIn: Boolean? = true,
        onEdit: (String) -> Unit = {},
        onOpenActor: (String) -> Unit = {},
        onOpenTopic: (String) -> Unit = {},
        onSignInOrJoin: () -> Unit = {},
        onRefresh: () -> Unit = {},
        onLoadMoreComments: () -> Unit = {},
        onLoadMoreReplies: (com.cogra.domain.CommentView) -> Unit = {},
        onAddComment: () -> Unit = {},
        onReplyTo: (com.cogra.domain.CommentView) -> Unit = {},
        onEditComment: (com.cogra.domain.CommentView) -> Unit = {},
        onStance: (String, String) -> Unit = { _, _ -> },
        onReference: (String) -> Unit = {},
        onShare: (String) -> Unit = {},
        onOpenPost: (String) -> Unit = {},
        onCommentsDepart: (CommentsScroll) -> Unit = {},
    ) {
        compose.setContent {
            // The license sheet the comment menus raise stands OUTSIDE the
            // thread's own window, exactly as `CommentsSheetRoute` holds it.
            var licenseShown by remember { mutableStateOf<LicenseChoice?>(null) }
            PostDetailScreen(
                stanceControl = { target, tag -> onStance(target, tag) },
                state = state.detail,
                viewerId = viewerId,
                onRefresh = onRefresh,
                onEdit = onEdit,
                onOpenActor = onOpenActor,
                onOpenPost = onOpenPost,
                onOpenTopic = onOpenTopic,
                onReference = onReference,
                onShare = onShare,
                onReveal = { _, _ -> },
                onBack = {},
                // The sheet is its own state holder now, so the detail
                // test drives it as the app does: through the slot, with
                // the thread's own state beside the post's.
                commentsSheet = { onDismiss ->
                    CommentsSheet(
                        state = state.comments,
                        viewerId = viewerId,
                        signedIn = signedIn,
                        onDismiss = onDismiss,
                        onLoadMoreComments = onLoadMoreComments,
                        onAddComment = onAddComment,
                        onReplyTo = onReplyTo,
                        onEditComment = onEditComment,
                        onCommentSignedShown = {},
                        onLoadMoreReplies = onLoadMoreReplies,
                        onReveal = { _, _ -> },
                        onOpenActor = onOpenActor,
                        onOpenTopic = onOpenTopic,
                        onReference = onReference,
                        onLicense = { licenseShown = it },
                        onSignInOrJoin = onSignInOrJoin,
                        onDepart = onCommentsDepart,
                        stanceControl = { target, tag -> onStance(target, tag) },
                    )
                },
            )
            // Stacked, as `CommentsSheetRoute` mounts it: only a COMMENT's
            // terms reach this mount, and they stand over the thread's own
            // sheet (design/readme.md:2364).
            licenseShown?.let { license ->
                LicenseSheet(license = license, onDismiss = { licenseShown = null }, stacked = true)
            }
        }
    }

    /**
     * A detail surface and the thread its sheet stands on.
     *
     * The two are separate state holders since the sheet became the one
     * comments surface and took its thread with it — but a test that
     * renders a post WITH comments is describing both, so the fixture
     * builds both from the one call the tests already make.
     */
    private data class DetailFixture(val detail: PostDetailUiState, val comments: CommentsUiState)

    private fun detailFixture(
        loading: Boolean = true,
        refreshing: Boolean = false,
        post: PostView? = null,
        includePending: Boolean = true,
        notFound: Boolean = false,
        transportFault: TransportFault? = null,
        reveals: Map<String, SensitiveMark> = emptyMap(),
        comments: List<com.cogra.domain.CommentView> = emptyList(),
        commentsEndCursor: String? = null,
        commentsHaveMore: Boolean = false,
        loadingMore: Boolean = false,
        commentSigned: Boolean = false,
        replyThreads: Map<String, ReplyThread> = emptyMap(),
    ) = DetailFixture(
        detail = PostDetailUiState(
            loading = loading,
            refreshing = refreshing,
            post = post,
            includePending = includePending,
            notFound = notFound,
            transportFault = transportFault,
            reveals = reveals,
        ),
        comments = CommentsUiState(
            // A fixture describes a thread that has ARRIVED: the tests
            // that care about the read being out say so through the
            // sheet's own state instead.
            loading = false,
            comments = comments,
            total = comments.size,
            endCursor = commentsEndCursor,
            hasMore = commentsHaveMore,
            loadingMore = loadingMore,
            includePending = includePending,
            transportFault = transportFault,
            reveals = reveals,
            commentSigned = commentSigned,
            replyThreads = replyThreads,
        ),
    )

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
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(testComment("c1"), testComment("c2")),
            ),
            onStance = { target, _ -> stanced += target },
        )
        openComments()
        assertThat(stanced).containsExactly("p1", "c1", "c2")
    }

    @Test
    fun thePostAndItsThreadRender() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(testComment("c1")),
            ),
        )
        openComments()
        compose.onNodeWithTag("detail_body").assertExists()
        compose.onNodeWithTag("detail_comment_c1").assertExists()
        compose.onNodeWithTag("detail_no_comments").assertDoesNotExist()
    }

    /**
     * CR-01: the thread stands in a sheet the affordance row's count raises
     * (`_shared.jsx:1247-1257`, and graph.json's `comment count` edges), not
     * as a second half of the page.
     */
    @Test
    fun theThreadStandsInASheetTheCountRaises() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(testComment("c1")),
            ),
        )
        compose.onNodeWithTag("comments_sheet").assertDoesNotExist()
        compose.onNodeWithTag("detail_comment_c1").assertDoesNotExist()
        compose.onNodeWithTag("detail_add_comment").assertDoesNotExist()
        openComments()
        compose.onNodeWithTag("comments_sheet").assertExists()
        compose.onNodeWithTag("detail_comment_c1").assertExists()
        compose.onNodeWithTag("detail_add_comment").assertExists()
    }

    /**
     * THE SHEET IS THE ONE COMMENTS SURFACE (jakob 2026-09-15): a feed
     * card's count raises the same thread the detail's does, and raises
     * it FULL-FUNCTION — the composer's door and every comment's own
     * affordances, not a read-only preview.
     *
     * The card's TAP still opens the post; only the count raises the
     * thread, which is the master's own split.
     */
    @Test
    fun aFeedCardsCommentCountRaisesTheSameThreadTheDetailDoes() {
        val opened = mutableListOf<String>()
        val raised = mutableListOf<String>()
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1"))),
            onOpenPost = { opened += it },
            thread = CommentsUiState(loading = false, comments = listOf(testComment("c1"))),
            onThreadRaised = { raised += it },
            viewerId = "viewer",
        )
        compose.onNodeWithTag("comments_sheet").assertDoesNotExist()

        compose.onNodeWithTag("feed_post_p1_comments").performClick()
        compose.waitForIdle()

        assertThat(raised).containsExactly("p1")
        // The count raised the thread rather than navigating away.
        assertThat(opened).isEmpty()
        compose.onNodeWithTag("comments_sheet").assertExists()
        compose.onNodeWithTag("detail_comment_c1").assertExists()
        // Full-function: the composer's door and the comment's own ⋮.
        compose.onNodeWithTag("detail_add_comment").assertExists()
        compose.onNodeWithTag("comment_c1_menu").assertExists()
        compose.onNodeWithTag("comment_reply_c1").assertExists()
    }

    /**
     * THE READER COMES BACK WHERE THEY LEFT (jakob 2026-09-15). Signing a
     * reply is a round trip through a destination, so the sheet is drawn
     * again from nothing — and the place it was left in is half of what
     * the return carries.
     */
    @Config(qualifiers = "+h1600dp")
    @Test
    fun theSheetComesBackWhereTheReaderLeftIt() {
        val comments = (1..12).map { testComment("c$it") }
        var restored = 0
        renderSheet(
            CommentsUiState(loading = false, comments = comments),
            restoreTo = CommentsScroll(index = 9, offset = 0),
            onRestored = { restored += 1 },
        )
        compose.waitForIdle()

        // The thread stands at the comment the reader was looking at, not
        // at the top it would otherwise be drawn from.
        compose.onNodeWithTag("detail_comment_c10").assertIsDisplayed()
        compose.onNodeWithTag("detail_comment_c1").assertIsNotDisplayed()
        // And the place is consumed, so it cannot jump a second time.
        assertThat(restored).isEqualTo(1)
    }

    /** A thread that came back empty consumes the place all the same. */
    @Test
    fun anEmptyThreadStillConsumesThePlaceItCameBackWith() {
        var restored = 0
        renderSheet(
            CommentsUiState(loading = false, comments = emptyList()),
            restoreTo = CommentsScroll(index = 4, offset = 0),
            onRestored = { restored += 1 },
        )
        compose.waitForIdle()

        compose.onNodeWithTag("detail_no_comments").assertExists()
        assertThat(restored).isEqualTo(1)
    }

    /**
     * …and the place is reported on the way OUT, by the only thing that
     * knows it. Every door out of the thread reports it: the composer is
     * reached from a comment's Reply and from the foot's entry row alike.
     */
    @Test
    fun everyDoorIntoTheComposerReportsTheReadersPlaceFirst() {
        val departures = mutableListOf<CommentsScroll>()
        var replied = 0
        renderSheet(
            CommentsUiState(loading = false, comments = listOf(testComment("c1"))),
            onDepart = { departures += it },
            onReplyTo = { replied += 1 },
        )
        compose.onNodeWithTag("comment_reply_c1").performClick()
        compose.waitForIdle()
        assertThat(departures).hasSize(1)
        assertThat(replied).isEqualTo(1)

        compose.onNodeWithTag("detail_add_comment").performClick()
        compose.waitForIdle()
        assertThat(departures).hasSize(2)
    }

    /** The sheet on its own, as both surfaces mount it. */
    private fun renderSheet(
        state: CommentsUiState,
        restoreTo: CommentsScroll? = null,
        onRestored: () -> Unit = {},
        onDepart: (CommentsScroll) -> Unit = {},
        onReplyTo: (com.cogra.domain.CommentView) -> Unit = {},
        onAddComment: () -> Unit = {},
        viewerId: String? = "viewer",
    ) {
        compose.setContent {
            CommentsSheet(
                state = state,
                viewerId = viewerId,
                signedIn = true,
                onDismiss = {},
                onLoadMoreComments = {},
                onAddComment = onAddComment,
                onReplyTo = onReplyTo,
                onEditComment = {},
                onCommentSignedShown = {},
                onLoadMoreReplies = {},
                onReveal = { _, _ -> },
                onOpenActor = {},
                onOpenTopic = {},
                onReference = {},
                onLicense = {},
                onSignInOrJoin = {},
                onDepart = onDepart,
                restoreTo = restoreTo,
                onRestored = onRestored,
            )
        }
    }

    // Pull-to-refresh belongs to the top of the thread: a reader
    // correcting upward from the middle of a long post is scrolling,
    // not asking for a re-read.
    //
    // NATIVE GRAPHICS, or there is no long post: Robolectric's default
    // draw path measures text to nothing, so the body below would lay out
    // shorter than the screen and the swipes would move a list already at
    // both ends of itself (the same reason the gallery test asks for it).
    // The premise is asserted below rather than assumed, because a list
    // that cannot scroll makes the correction a pull FROM the top — which
    // is the gesture that SHOULD refresh.
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Test
    fun anUpwardDragAwayFromTheTopScrollsInsteadOfRefreshing() {
        var refreshes = 0
        renderDetail(
            detailFixture(
                loading = false,
                // A post long enough to scroll: the thread stands in its own
                // sheet now, so the page's own length is the post's.
                post = testPost("p1", body = "Body p1. ".repeat(400)),
            ),
            onRefresh = { refreshes++ },
        )
        // Down the post, well past the header…
        val titleAtRest = compose.onNodeWithTag("detail_title").getUnclippedBoundsInRoot().top
        repeat(3) {
            compose.onNodeWithTag("detail_list").performTouchInput { swipeUp() }
        }
        // …which is the premise the rest of this test rests on, so it is
        // asserted rather than assumed: a list that never moved would make
        // the correction below a pull from the top, which SHOULD refresh.
        val titleScrolled = compose.onNodeWithTag("detail_title").getUnclippedBoundsInRoot().top
        assertThat(titleScrolled.value).isLessThan(titleAtRest.value)
        // …then a correction back up that the thread itself absorbs.
        compose.onNodeWithTag("detail_list").performTouchInput {
            down(center)
            moveBy(Offset(0f, 200f))
            advanceEventTime(250)
            up()
        }
        assertThat(refreshes).isEqualTo(0)
    }

    // THE DETAIL'S BAR IS PINNED (jakob 2026-09-15). Collapsing the top is
    // the reading roots' motion, not every page's: this bar carries the
    // post's one menu and its way back (`_shared.jsx:341-346` — the card's
    // own ⋮ yields here), so a bar that left with the scroll would take
    // every act on the post off screen mid-read.
    @Test
    fun theDetailsTopBarStaysPutUnderScroll() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1", body = "Body p1. ".repeat(400)),
            ),
        )
        val before = compose.onNodeWithTag("detail_menu").getUnclippedBoundsInRoot()
        repeat(3) {
            compose.onNodeWithTag("detail_list").performTouchInput { swipeUp() }
        }
        compose.onNodeWithTag("detail_menu").assertIsDisplayed()
        compose.onNodeWithTag("detail_back").assertIsDisplayed()
        val after = compose.onNodeWithTag("detail_menu").getUnclippedBoundsInRoot()
        assertThat(after.top.value).isEqualTo(before.top.value)
    }

    // Landing is per node: a landed post can carry a comment that is
    // still settling, and the marker follows the node it belongs to.
    @Test
    fun theSettlingMarkerFollowsTheNodeThatIsPending() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1", landing = Landing.landed(2)),
                comments = listOf(
                    testComment("c1", landing = Landing.Pending),
                    testComment("c2", landing = Landing.landed(2)),
                ),
            ),
        )
        openComments()
        compose.onNodeWithTag("detail_pending").assertDoesNotExist()
        compose.onNodeWithTag("comment_pending_c1").assertExists()
        compose.onNodeWithTag("detail_comment_c1").assertExists()
        compose.onNodeWithTag("comment_pending_c2").assertDoesNotExist()
    }

    @Test
    fun aPendingPostIsMarkedOnItsDetail() {
        renderDetail(
            detailFixture(
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
    // THE TERMS ARE NEVER A STATE OF THE CARD (`ReaderPostMenu.jsx:27-29`):
    // the license is a rare read, so it arrives from the menu in a sheet over
    // the surface the reader asked from.
    @Test
    fun theLicenseLeavesThePostAndEveryCommentForTheMenusSheet() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1", license = LicenseChoice(attribution = 1.0, provenance = 0.0)),
                comments = listOf(testComment("c1")),
            ),
        )
        openComments()
        compose.onNodeWithTag("detail_license_terms").assertDoesNotExist()
        compose.onNodeWithTag("comment_license_terms_c1").assertDoesNotExist()

        compose.onNodeWithTag("detail_menu").performClick()
        compose.onNodeWithTag("detail_menu_license").performClick()
        compose.onNodeWithTag("license_sheet_terms").assertExists()
    }

    // THE READER'S READINGS, not the author's (`LicenseChooser.jsx:36-49`).
    // The chooser's hints told a reuser they were owed the credit they in fact
    // owe; the block addresses the reuser, and both axes always stand.
    @Test
    fun theLicenseBlockSpeaksToTheReuserOnBothAxes() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1", license = LicenseChoice(attribution = 1.0, provenance = 0.0)),
            ),
        )
        compose.onNodeWithTag("detail_menu").performClick()
        compose.onNodeWithTag("detail_menu_license").performClick()

        compose.onNodeWithText("Credit").assertExists()
        compose.onNodeWithText("Required for every use").assertExists()
        // The zero axis still stands: a dropped row would read as a shorter
        // license rather than a term that obliges nothing.
        compose.onNodeWithText("Public record of use").assertExists()
        compose.onNodeWithText("Not logged").assertExists()
        // Never the author's voice.
        compose.onNodeWithText("Every use credits the maker.").assertDoesNotExist()
    }

    /** Both axes at zero is the one reading readers have a word for. */
    @Test
    fun theBothAxesZeroPairIsNamedOnTheCaptionLine() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1", license = LicenseChoice(attribution = 0.0, provenance = 0.0)),
            ),
        )
        compose.onNodeWithTag("detail_menu").performClick()
        compose.onNodeWithTag("detail_menu_license").performClick()
        compose.onNodeWithTag("license_sheet_terms_public_domain").assertExists()
        // The rows below still spell what it means.
        compose.onNodeWithText("Not required").assertExists()
        compose.onNodeWithText("Not logged").assertExists()
    }

    /** The rows are `READER_POST_MENU` (`_shared.jsx:376`). */
    @Test
    fun aNonCreatorGetsTheReaderMenuAndNoEditRow() {
        renderDetail(
            detailFixture(loading = false, post = testPost("p1")),
            viewerId = "someone-else",
        )
        compose.onNodeWithTag("detail_menu").performClick()
        compose.onNodeWithTag("detail_menu_save").assertExists()
        compose.onNodeWithTag("detail_menu_cite").assertExists()
        compose.onNodeWithTag("detail_menu_hide").assertExists()
        compose.onNodeWithTag("detail_menu_license").assertExists()
        compose.onNodeWithTag("detail_menu_edit").assertDoesNotExist()
        compose.onNodeWithTag("detail_menu_remove").assertDoesNotExist()
    }

    /**
     * The rows are `OWN_POST_MENU` (`_shared.jsx:421-428`). Cite takes the
     * reader menu's own position, second, so the thumb finds one row in one
     * place on every menu that has it.
     */
    @Test
    fun theCreatorGetsTheOwnPostMenuAndEditOpensFromIt() {
        var editing: String? = null
        renderDetail(
            detailFixture(loading = false, post = testPost("p1")),
            viewerId = "author-1",
            onEdit = { editing = it },
        )
        compose.onNodeWithTag("detail_menu").performClick()
        compose.onNodeWithTag("detail_menu_save").assertExists()
        compose.onNodeWithTag("detail_menu_cite").assertExists()
        compose.onNodeWithTag("detail_menu_sensitive").assertExists()
        compose.onNodeWithTag("detail_menu_remove").assertExists()
        compose.onNodeWithTag("detail_menu_license").assertExists()
        // A reader's rows are not on an author's menu.
        compose.onNodeWithTag("detail_menu_hide").assertDoesNotExist()

        val save = compose.onNodeWithTag("detail_menu_save").getUnclippedBoundsInRoot().top
        val cite = compose.onNodeWithTag("detail_menu_cite").getUnclippedBoundsInRoot().top
        val edit = compose.onNodeWithTag("detail_menu_edit").getUnclippedBoundsInRoot().top
        val sensitive = compose.onNodeWithTag("detail_menu_sensitive").getUnclippedBoundsInRoot().top
        val remove = compose.onNodeWithTag("detail_menu_remove").getUnclippedBoundsInRoot().top
        val license = compose.onNodeWithTag("detail_menu_license").getUnclippedBoundsInRoot().top
        assertThat(save.value).isLessThan(cite.value)
        assertThat(cite.value).isLessThan(edit.value)
        assertThat(edit.value).isLessThan(sensitive.value)
        assertThat(sensitive.value).isLessThan(remove.value)
        assertThat(remove.value).isLessThan(license.value)

        compose.onNodeWithTag("detail_menu_edit").performClick()
        assertThat(editing).isEqualTo("p1")
    }

    // SENSITIVE STAYS IN EDIT (jakob 2026-09-14): marking a published post is
    // always a signed action changing it, so the row is a door into the edit
    // flow — the intentioned one beside Edit's general one.
    @Test
    fun markAsSensitiveIsADoorIntoTheEditFlow() {
        var editing: String? = null
        renderDetail(
            detailFixture(loading = false, post = testPost("p1")),
            viewerId = "author-1",
            onEdit = { editing = it },
        )
        compose.onNodeWithTag("detail_menu").performClick()
        compose.onNodeWithTag("detail_menu_sensitive").performClick()
        assertThat(editing).isEqualTo("p1")
    }

    // THE COMMENT'S ROWS (`_shared.jsx:392`), and the missing Hide row is
    // RULED (jakob 2026-09-12): hiding names an actor, reached from the
    // commenter's own profile.
    @Test
    fun aCommentCarriesSaveCiteOpinionsAndLicenseButNoHide() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(testComment("c1")),
            ),
        )
        openComments()
        compose.onNodeWithTag("comment_c1_menu").performClick()
        compose.onNodeWithTag("comment_menu_save_c1").assertExists()
        compose.onNodeWithTag("comment_menu_cite_c1").assertExists()
        compose.onNodeWithTag("comment_menu_opinions_c1").assertExists()
        compose.onNodeWithTag("comment_menu_license_c1").assertExists()
        compose.onNodeWithTag("comment_menu_hide_c1").assertDoesNotExist()
    }

    // IT IS DRAWN STACKED ON PURPOSE (`CommentMenu.jsx:18-23`): the thread
    // already lives in a sheet, so the comment's own menu is a sheet on a
    // sheet — both stand at once (design/readme.md:2364). The tonal rung
    // itself is pinned in SheetContainerColorTest; this pins the mount.
    @Test
    fun theCommentsMenuStandsOverTheThreadsOwnSheet() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(testComment("c1")),
            ),
        )
        openComments()
        compose.onNodeWithTag("comment_c1_menu").performClick()
        compose.onNodeWithTag("comments_sheet").assertExists()
        compose.onNodeWithTag("comment_c1_menu_sheet").assertExists()
    }

    // The post's own menu opens over the plain page — no sheet stands
    // beneath it, so it never stacks (design/readme.md:2364).
    @Test
    fun thePostsOwnMenuOpensOverThePageAlone() {
        renderDetail(detailFixture(loading = false, post = testPost("p1")))
        compose.onNodeWithTag("detail_menu").performClick()
        compose.onNodeWithTag("comments_sheet").assertDoesNotExist()
        compose.onNodeWithTag("detail_menu_sheet").assertExists()
    }

    // ONE SHEET, TWO MENUS (`CommentLicense.jsx:9-10`): raised from a
    // comment's row it comes up over the thread, still a sheet on a sheet.
    @Test
    fun aCommentsLicenseComesUpOverTheThreadsOwnSheet() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(testComment("c1")),
            ),
        )
        openComments()
        compose.onNodeWithTag("comment_c1_menu").performClick()
        compose.onNodeWithTag("comment_menu_license_c1").performClick()
        compose.onNodeWithTag("comments_sheet").assertExists()
        compose.onNodeWithTag("license_sheet_terms").assertExists()
    }

    // THE INTRODUCED-BUT-INERT LAW (jakob 2026-09-14): a row whose destination
    // is not built yet stands and does nothing.
    @Test
    fun theRowsWithoutDestinationsStandAndDoNothing() {
        renderDetail(
            detailFixture(loading = false, post = testPost("p1")),
            viewerId = "someone-else",
        )
        compose.onNodeWithTag("detail_menu").performClick()
        compose.onNodeWithTag("detail_menu_save").performClick()
        // The screen is where it was: the row acted on nothing.
        compose.onNodeWithTag("detail_card").assertExists()

        compose.onNodeWithTag("detail_menu").performClick()
        compose.onNodeWithTag("detail_menu_hide").performClick()
        compose.onNodeWithTag("detail_card").assertExists()
    }

    // A VIDEO POST'S DETAIL IS ITS OWN BOARD (`screens/PostDetailVideo.jsx`):
    // the clip is pinned ABOVE the card, wearing the full transport, and the
    // card beneath it is the post as it always reads. DV-02/DV-03/DV-05.
    @Test
    fun aVideoPostsDetailPinsTheClipAboveTheCardAndNotInsideIt() {
        renderDetail(
            detailFixture(loading = false, post = testPost("p1").copy(attachments = listOf(clip()))),
        )

        val pinned = compose.onNodeWithTag(PINNED_CLIP_TAG).getUnclippedBoundsInRoot()
        val card = compose.onNodeWithTag("detail_card").getUnclippedBoundsInRoot()
        assertThat(pinned.bottom.value).isAtMost(card.top.value)
        // The clip LEFT the card: the body has no gallery left to draw.
        compose.onNodeWithTag("detail_gallery").assertDoesNotExist()
        // The card is still the post as it always reads.
        compose.onNodeWithTag("detail_title").assertExists()
    }

    @Test
    fun aPostOfPicturesKeepsItsGalleryInTheCard() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1").copy(
                    attachments = listOf(
                        MediaAssetView("m1", "https://media/m1", null, FieldStatus.NORMAL, 1f),
                    ),
                ),
            ),
        )

        compose.onNodeWithTag(PINNED_CLIP_TAG).assertDoesNotExist()
        compose.onNodeWithTag("detail_gallery").assertExists()
    }

    /** A removed record is the skeleton: there is no clip left to pin. */
    @Test
    fun aRemovedVideoPostPinsNothing() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1").copy(
                    attachments = listOf(clip(status = FieldStatus.REDACTED)),
                    attachmentsStatus = FieldStatus.REDACTED,
                ),
            ),
        )

        compose.onNodeWithTag(PINNED_CLIP_TAG).assertDoesNotExist()
        compose.onNodeWithTag("detail_gallery").assertDoesNotExist()
        // The skeleton says so where the body was.
        compose.onNodeWithText("Removed by its author").assertExists()
    }

    private fun clip(status: FieldStatus = FieldStatus.NORMAL) = MediaAssetView(
        id = "m1",
        url = "https://media/clip.mp4",
        altText = null,
        status = status,
        aspectRatio = 0.5625f,
        mimeType = "video/mp4",
        durationMs = 41_000,
    )

    /** The dialog ships; the removal is slice 8's, whole (jakob 2026-09-14). */
    @Test
    fun removeOpensTheThinkTwiceDialogAndRemovesNothing() {
        renderDetail(
            detailFixture(loading = false, post = testPost("p1")),
            viewerId = "author-1",
        )
        compose.onNodeWithTag("detail_menu").performClick()
        compose.onNodeWithTag("detail_menu_remove").performClick()
        compose.onNodeWithTag("post_remove_confirm").assertExists()

        compose.onNodeWithTag("post_remove_confirm_remove").performClick()
        compose.onNodeWithTag("post_remove_confirm").assertDoesNotExist()
        // The post is still on the screen: nothing was removed.
        compose.onNodeWithTag("detail_card").assertExists()
    }

    /**
     * `ReplyEntry` 7: the thread's foot opens the composer rather than
     * being one. Words are written on the wizard, so nothing here takes
     * a keystroke.
     */
    @Test
    fun theThreadsFootOpensTheComposerPinnedToThePost() {
        var opened = false
        renderDetail(
            detailFixture(loading = false, post = testPost("p1")),
            onAddComment = { opened = true },
        )
        openComments()
        // Pinned at the sheet's foot, so it never has to be scrolled to.
        compose.onNodeWithTag("detail_add_comment").performClick()
        assertThat(opened).isTrue()
    }

    @Test
    fun theCommentComposerSwapsForTheSignInEntryForAGuest() {
        var joining = false
        renderDetail(
            detailFixture(loading = false, post = testPost("p1")),
            signedIn = false,
            onSignInOrJoin = { joining = true },
        )
        openComments()
        compose.onNodeWithTag("detail_add_comment").assertDoesNotExist()
        compose.onNodeWithTag("detail_comment_signin").performClick()
        assertThat(joining).isTrue()
    }

    @Test
    fun aResolvingPhaseShowsNeitherCommentAffordance() {
        renderDetail(
            detailFixture(loading = false, post = testPost("p1")),
            signedIn = null,
        )
        openComments()
        compose.onNodeWithTag("detail_add_comment").assertDoesNotExist()
        compose.onNodeWithTag("detail_comment_signin").assertDoesNotExist()
    }

    @Test
    fun anUnknownPostRendersNotFound() {
        renderDetail(detailFixture(loading = false, notFound = true))
        compose.onNodeWithTag("detail_not_found").assertExists()
    }

    @Test
    fun aRefreshFaultKeepsTheThreadReadable() {
        var retried = false
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(testComment("c1")),
                transportFault = TransportFault.REFRESH,
            ),
            onRefresh = { retried = true },
        )
        openComments()
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
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(testComment("c1")),
                commentsHaveMore = true,
                transportFault = TransportFault.APPEND,
            ),
            onLoadMoreComments = { more = true },
        )
        openComments()
        compose.onNodeWithTag("detail_comment_c1").assertExists()
        compose.onNodeWithTag("detail_transport_banner").assertDoesNotExist()
        compose.onNodeWithTag("detail_more_comments").assertDoesNotExist()
        compose.onNodeWithTag("detail_more_comments_error").performScrollTo().assertExists()
        compose.onNodeWithTag("detail_more_comments_retry").performClick()
        assertThat(more).isTrue()
    }

    // -- The comment thread (slice 2.1: edit affordance, nesting) --

    private fun comment(
        id: String,
        authorId: String = "author-1",
        edited: Boolean = false,
        replyCount: Int = 0,
    ) = testComment(id).let { base ->
        base.copy(
            author = base.author?.copy(id = authorId),
            updatedAt = if (edited) base.updatedAt.plusSeconds(60) else base.createdAt,
            createdAt = base.createdAt,
            replyCount = replyCount,
        )
    }

    @Test
    fun theViewersOwnCommentOffersEditOthersDoNot() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("mine", authorId = "viewer"), comment("theirs")),
            ),
            viewerId = "viewer",
        )
        openComments()
        compose.onNodeWithTag("comment_edit_mine").assertExists()
        compose.onNodeWithTag("comment_edit_theirs").assertDoesNotExist()
    }

    @Test
    fun anEditedCommentCarriesTheSoftMarker() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1", edited = true), comment("c2")),
            ),
        )
        openComments()
        compose.onNodeWithTag("comment_edited_c1").assertExists()
        compose.onNodeWithTag("comment_edited_c2").assertDoesNotExist()
    }

    /** `ReplyMedia` 6 — Edit on an own comment opens `CommentEdit`. */
    @Test
    fun theEditAffordanceOpensTheEditScreen() {
        var editing: com.cogra.domain.CommentView? = null
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("mine", authorId = "viewer")),
            ),
            viewerId = "viewer",
            onEditComment = { editing = it },
        )
        openComments()
        compose.onNodeWithTag("comment_edit_mine").performScrollTo().performClick()
        assertThat(editing?.id).isEqualTo("mine")
    }

    /** Nothing is edited in place any more: the screen owns the edit. */
    @Test
    fun theThreadHoldsNoInlineEditor() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("mine", authorId = "viewer")),
            ),
            viewerId = "viewer",
        )
        openComments()
        compose.onNodeWithTag("comment_edit_input").assertDoesNotExist()
        compose.onNodeWithTag("comment_edit_save").assertDoesNotExist()
        compose.onNodeWithTag("comment_edit_cancel").assertDoesNotExist()
    }

    /**
     * Replies arrive **counted, not carried** (Q49): a branch shows its
     * count and nothing else until a reader opens it, so no reply is on
     * screen and the collapsed line stands in its place.
     */
    @Test
    fun aBranchIsCollapsedBehindItsCount() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1", replyCount = 2)),
            ),
        )
        openComments()
        compose.onNodeWithTag("detail_comment_r1").assertDoesNotExist()
        compose.onNodeWithTag("replies_more_c1").assertExists()
    }

    /** A comment nobody answered offers nothing to open. */
    @Test
    fun aBranchlessCommentOffersNoReplyLine() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1", replyCount = 0)),
            ),
        )
        openComments()
        compose.onNodeWithTag("replies_more_c1").assertDoesNotExist()
    }

    /** Once opened, the fetched replies are what nests under it. */
    @Test
    fun anOpenedBranchNestsItsReplies() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1", replyCount = 1)),
                replyThreads = mapOf(
                    "c1" to ReplyThread(items = listOf(comment("r1")), hasMore = false),
                ),
            ),
        )
        openComments()
        compose.onNodeWithTag("detail_comment_r1").assertExists()
    }

    @Test
    fun theReplyAffordanceIsSignedInOnly() {
        val state = detailFixture(
            loading = false,
            post = testPost("p1"),
            comments = listOf(comment("c1")),
        )
        renderDetail(state, signedIn = false)
        openComments()
        compose.onNodeWithTag("comment_reply_c1").assertDoesNotExist()
    }

    /**
     * `ReplyEntry` 5: Reply opens the composer pre-targeted at **that**
     * comment, rather than growing a box under it.
     */
    @Test
    // The post now wears its own card, header and title, so the default
    // viewport no longer composes as far as the second comment.
    @Config(qualifiers = "+h1600dp")
    fun replyOpensTheComposerPreTargetedAtThatComment() {
        var replied: com.cogra.domain.CommentView? = null
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1"), comment("c2")),
            ),
            onReplyTo = { replied = it },
        )
        openComments()
        compose.onNodeWithTag("comment_reply_c2").performScrollTo().performClick()
        assertThat(replied?.id).isEqualTo("c2")
    }

    @Test
    fun theThreadHoldsNoInlineReplyComposer() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1")),
            ),
        )
        openComments()
        compose.onNodeWithTag("comment_reply_input").assertDoesNotExist()
        compose.onNodeWithTag("comment_reply_submit").assertDoesNotExist()
    }

    @Test
    fun authorChipsRenderOnPostAndComments() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1")),
            ),
        )
        openComments()
        compose.onNodeWithTag("detail_author").assertExists()
        compose.onNodeWithTag("comment_c1_author").assertExists()
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

    // -- The detail is a card, author first, title above the media --

    @Test
    fun theDetailDrawsThePostAsACard() {
        renderDetail(detailFixture(loading = false, post = testPost("p1")))
        compose.onNodeWithTag("detail_card").assertExists()
    }

    /** PEOPLE FIRST: the author leads, above the title and the body. */
    @Test
    fun theAuthorLeadsTheDetailRatherThanTrailingIt() {
        renderDetail(detailFixture(loading = false, post = testPost("p1")))

        val author = compose.onNodeWithTag("detail_author", useUnmergedTree = true)
            .fetchSemanticsNode().positionInRoot.y
        val title = compose.onNodeWithTag("detail_title", useUnmergedTree = true)
            .fetchSemanticsNode().positionInRoot.y
        val body = compose.onNodeWithTag("detail_body", useUnmergedTree = true)
            .fetchSemanticsNode().positionInRoot.y
        assertThat(author).isLessThan(title)
        assertThat(title).isLessThan(body)
    }

    /** The title titles the thing, so it is the card's heading, not the band's. */
    @Test
    fun theDetailTitleIsTheCardsHeadingAndNotTheBands() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1").copy(
                    title = ModeratedField("Salt maps", FieldStatus.NORMAL),
                ),
            ),
        )
        compose.onNodeWithTag("detail_title", useUnmergedTree = true)
            .assertTextEquals("Salt maps")
        compose.onAllNodesWithText("Salt maps").assertCountEquals(1)
    }

    // -- What a removal leaves standing (Removed.jsx) --

    /** The license rode the payload, so a redacted record has none to show. */
    @Test
    fun aRemovedPostPrintsNoLicenseAndNoTopics() {
        renderDetail(detailFixture(loading = false, post = removedPost()))

        // The body region carries the caller's own tag, so the mark is
        // read by the line it draws.
        compose.onNodeWithText("Removed by its author").assertExists()
        compose.onNodeWithTag("detail_license_terms", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("detail_post_topics_line", useUnmergedTree = true).assertDoesNotExist()
    }

    /**
     * A REMOVED POST HAS NO MENU LEFT — back is the whole header
     * (`Removed.jsx:5-6`): no ⋮, and so none of its rows.
     */
    @Test
    fun aRemovedOwnPostLosesItsWholeMenu() {
        renderDetail(
            detailFixture(loading = false, post = removedPost()),
            viewerId = "author-1",
        )
        compose.onNodeWithTag("detail_menu").assertDoesNotExist()
    }

    /**
     * The skeleton survives: author, age, stance, comments, share.
     *
     * Above the narrow-share breakpoint, per the same note as
     * `theCardWearsTheAffordanceRowAndNoGatedControl`.
     */
    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun aRemovedPostKeepsItsSkeleton() {
        renderDetail(detailFixture(loading = false, post = removedPost().copy(commentCount = 2)))

        compose.onNodeWithTag("detail_author", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("detail_age", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("detail_post_comments", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("detail_post_share", useUnmergedTree = true).assertExists()
    }

    private fun removedPost() = testPost("p1").copy(
        content = ModeratedField(null, FieldStatus.REDACTED),
        attachments = emptyList(),
    )

    // -- Words XOR media, the clamps, and the opener --
    //
    // The rules themselves are pinned in `PostBodyTest`; these two say
    // the two surfaces ask for the right reading.

    /** Past the clamp the opener stands, and it unfolds in place. */
    @Test
    // Real glyph metrics: legacy graphics measure every string at zero
    // width, so nothing would ever overflow the clamp. The tall
    // viewport puts the opener — eighteen lines down — on screen.
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    @Config(qualifiers = "+h1600dp")
    fun aFoldedFeedBodyOpensWhereItStands() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(
                    testPost("p1").copy(content = ModeratedField(LONG_BODY, FieldStatus.NORMAL)),
                ),
            ),
        )
        compose.onNodeWithTag("feed_post_p1_opener", useUnmergedTree = true)
            .assertTextEquals("More")
        compose.onNodeWithTag("feed_post_p1_opener", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("feed_post_p1_opener", useUnmergedTree = true)
            .assertTextEquals("Less")
    }

    /** The detail is the read surface: it clamps nothing, so it never opens. */
    @Test
    fun theDetailCarriesNoOpener() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1").copy(
                    content = ModeratedField(LONG_BODY, FieldStatus.NORMAL),
                ),
            ),
        )
        compose.onNodeWithTag("detail_opener", useUnmergedTree = true).assertDoesNotExist()
    }

    // -- The card header: author left, age right --

    /** The boards' compact age — a number and its unit, no word between. */
    @Test
    fun theAgeReadsAsTheBoardsDrawIt() {
        val now = java.time.Instant.parse("2026-09-09T12:00:00Z")
        fun ago(minutes: Long) = compactAge(now.minusSeconds(minutes * 60), now)

        assertThat(ago(0)).isEqualTo("0m")
        assertThat(ago(35)).isEqualTo("35m")
        assertThat(ago(60)).isEqualTo("1h")
        assertThat(ago(60 * 4)).isEqualTo("4h")
        assertThat(ago(60 * 24 * 3)).isEqualTo("3d")
    }

    /** A clock behind the node's own time never reads as the future. */
    @Test
    fun anAgeNeverRunsBackwards() {
        val now = java.time.Instant.parse("2026-09-09T12:00:00Z")
        assertThat(compactAge(now.plusSeconds(600), now)).isEqualTo("0m")
    }

    @Test
    fun aCardWearsItsAge() {
        renderFeed(FeedUiState(loading = false, posts = listOf(testPost("p1"))))
        compose.onNodeWithTag("feed_p1_age", useUnmergedTree = true).assertExists()
    }

    @Test
    fun aCommentWearsItsAgeToo() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1")),
            ),
        )
        openComments()
        compose.onNodeWithTag("comment_c1_age", useUnmergedTree = true).assertExists()
    }

    // -- The affordance row (PostCard.jsx 300-358) --

    /**
     * Stance, comment, share — and the two the staging rule gates.
     *
     * ABOVE THE NARROW-SHARE BREAKPOINT (design/readme.md, jakob
     * 2026-09-17, sharpened 2026-09-22 — PR #794): Robolectric's own
     * default sandbox is 320dp wide, which is BELOW the breakpoint, so
     * this pins the wide case explicitly rather than by the default's
     * accident.
     */
    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun theCardWearsTheAffordanceRowAndNoGatedControl() {
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1").copy(commentCount = 3))),
        )
        compose.onNodeWithTag("feed_post_p1_comments", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("feed_post_p1_share", useUnmergedTree = true).assertExists()
        // The Post Score's drill-down is an acknowledged gap and the
        // contract carries no score; the ⋮ opens a menu W3 builds.
        compose.onNodeWithTag("feed_post_p1_score", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("feed_post_p1_overflow", useUnmergedTree = true).assertDoesNotExist()
    }

    /** The count is spoken, never drawn as a word — the row is glyphs. */
    @Test
    fun theCommentAffordanceSpeaksItsCount() {
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1").copy(commentCount = 1))),
        )
        compose.onNodeWithTag("feed_post_p1_comments", useUnmergedTree = true)
            .assertContentDescriptionEquals("1 comment")
    }

    /** No number beside the glyph where there is none to state. */
    @Test
    fun anUncommentedPostDrawsTheGlyphAlone() {
        renderFeed(FeedUiState(loading = false, posts = listOf(testPost("p1"))))
        compose.onNodeWithTag("feed_post_p1_comments", useUnmergedTree = true)
            .assertContentDescriptionEquals("0 comments")
        compose.onNodeWithTag("feed_post_p1_comments", useUnmergedTree = true)
            .assertTextEquals()
    }

    /**
     * On the feed the count raises the thread, and the card's own tap is
     * what opens the post.
     *
     * It used to do both: the count fell back to the card's tap because
     * the thread had nowhere to stand over a feed. It has one now (jakob
     * 2026-09-15), so the count reaches its drawn destination and the two
     * intents are two controls again.
     */
    @Test
    fun theCommentCountRaisesTheThreadFromTheFeedAndTheCardsTapOpensThePost() {
        var opened: String? = null
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1").copy(commentCount = 2))),
            onOpenPost = { opened = it },
            thread = CommentsUiState(loading = false, comments = listOf(testComment("c1"))),
        )
        // The card's own tap: "read the post".
        compose.onNodeWithTag("feed_post_p1").performClick()
        assertThat(opened).isEqualTo("p1")

        // The count, a different intent: "read the replies" — answered
        // over the feed rather than by leaving it.
        opened = null
        compose.onNodeWithTag("feed_post_p1_comments", useUnmergedTree = true).performClick()
        compose.waitForIdle()
        assertThat(opened).isNull()
        compose.onNodeWithTag("comments_sheet").assertExists()
    }

    /** On the detail the count raises the thread's own sheet (`ReplyEntry`). */
    @Test
    fun theCommentCountRaisesTheThreadOnTheDetail() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1").copy(commentCount = 2),
                comments = listOf(testComment("c1")),
            ),
        )
        compose.onNodeWithTag("detail_post_comments").assert(hasClickAction())
        openComments()
        compose.onNodeWithTag("detail_comment_c1").assertExists()
    }

    // Above the narrow-share breakpoint — the row still carries Share there.
    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun shareHandsThePostOnFromBothSurfaces() {
        val shared = mutableListOf<String>()
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1"))),
            onShare = { shared += it },
        )
        compose.onNodeWithTag("feed_post_p1_share", useUnmergedTree = true).performClick()
        assertThat(shared).containsExactly("p1")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp")
    fun theShareControlNamesWhatItShares() {
        renderDetail(detailFixture(loading = false, post = testPost("p1")))
        compose.onNodeWithTag("detail_post_share", useUnmergedTree = true)
            .assertContentDescriptionEquals("Share this post")
    }

    // -- The narrow-share fold (design/readme.md, jakob 2026-09-17,
    // sharpened 2026-09-22 — PR #794 / 820c7195: the inequality is strict,
    // since 360dp is mainstream android and the narrow treatment is for
    // the genuinely small phone, not the common one) --

    /**
     * STRICTLY BELOW 360dp THE ROW SHEDS SHARE, ON THE FEED CARD.
     * Robolectric's own default sandbox is 320dp wide — under the
     * breakpoint — so this pins the narrow case explicitly (at 359dp)
     * rather than leaning on that default by accident.
     */
    @Test
    @Config(qualifiers = "w359dp-h640dp")
    fun theFeedCardsRowShedsShareBelowTheNarrowBreakpoint() {
        renderFeed(FeedUiState(loading = false, posts = listOf(testPost("p1"))))
        compose.onNodeWithTag("feed_post_p1_share", useUnmergedTree = true).assertDoesNotExist()
    }

    /** The detail's own row sheds it the same way. */
    @Test
    @Config(qualifiers = "w359dp-h640dp")
    fun theDetailsRowShedsShareBelowTheNarrowBreakpoint() {
        renderDetail(detailFixture(loading = false, post = testPost("p1")))
        compose.onNodeWithTag("detail_post_share", useUnmergedTree = true).assertDoesNotExist()
    }

    /**
     * AT 360dp THE WIDE ROW STANDS — the inequality is strict (jakob
     * 2026-09-22), so the breakpoint itself is unaffected, not just widths
     * above it.
     */
    @Test
    @Config(qualifiers = "w360dp-h640dp")
    fun theRowKeepsShareAtTheBreakpointItself() {
        renderFeed(FeedUiState(loading = false, posts = listOf(testPost("p1"))))
        compose.onNodeWithTag("feed_post_p1_share", useUnmergedTree = true).assertExists()
    }

    /**
     * THE READER'S ⋮ LEADS WITH SHARE below the breakpoint, on the feed
     * card's own menu.
     */
    @Test
    @Config(qualifiers = "w359dp-h640dp")
    fun theFeedCardsReaderMenuLeadsWithShareBelowTheNarrowBreakpoint() {
        val shared = mutableListOf<String>()
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1"))),
            viewerId = "someone-else",
            onShare = { shared += it },
        )
        compose.onNodeWithTag("feed_p1_menu").performClick()
        compose.onNodeWithTag("feed_p1_menu_share").assertExists().performClick()
        assertThat(shared).containsExactly("p1")
    }

    /**
     * …and on the detail's page-header menu, which is the reader's menu
     * too (`_shared.jsx:341-346` — the card's own dot yields to it).
     */
    @Test
    @Config(qualifiers = "w359dp-h640dp")
    fun theDetailsReaderMenuLeadsWithShareBelowTheNarrowBreakpoint() {
        val shared = mutableListOf<String>()
        renderDetail(
            detailFixture(loading = false, post = testPost("p1")),
            viewerId = "someone-else",
            onShare = { shared += it },
        )
        compose.onNodeWithTag("detail_menu").performClick()
        compose.onNodeWithTag("detail_menu_share").assertExists().performClick()
        assertThat(shared).containsExactly("p1")
    }

    /** At the breakpoint itself the menu is unchanged — no Share row at all. */
    @Test
    @Config(qualifiers = "w360dp-h640dp")
    fun theReadersMenuHasNoShareRowAtTheBreakpointItself() {
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1"))),
            viewerId = "someone-else",
        )
        compose.onNodeWithTag("feed_p1_menu").performClick()
        compose.onNodeWithTag("feed_p1_menu_share").assertDoesNotExist()
    }

    /**
     * No board draws Share leaving the author's own menu — the ruling
     * names only the reader's (design/readme.md). Pinned so a future
     * change to this scope is deliberate, not drift.
     */
    @Test
    @Config(qualifiers = "w359dp-h640dp")
    fun theOwnPostMenuNeverGainsShareEvenBelowTheNarrowBreakpoint() {
        renderFeed(
            FeedUiState(loading = false, posts = listOf(testPost("p1"))),
            viewerId = "author-1",
        )
        compose.onNodeWithTag("feed_p1_menu").performClick()
        compose.onNodeWithTag("feed_p1_menu_share").assertDoesNotExist()
    }

    /** The web page, not an in-app route: the receiver may have no app. */
    @Test
    fun theSharedLinkIsThePostsPageOnTheWeb() {
        assertThat(postShareUrl("https://cogra.example", "p1"))
            .isEqualTo("https://cogra.example/posts/p1")
    }

    // -- The topics line: two chips, then the counts in words --

    /** Never a wrap, never a second row: the third topic is a count. */
    @Test
    fun theTopicsLineDrawsTwoChipsAndCountsTheRest() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(
                    testPost("p1").copy(
                        topics = listOf(
                            testTopicClaim("rust"),
                            testTopicClaim("kotlin"),
                            testTopicClaim("compose"),
                        ),
                    ),
                ),
            ),
        )
        compose.onNodeWithTag("feed_post_p1_topic_rust").assertExists()
        compose.onNodeWithTag("feed_post_p1_topic_kotlin").assertExists()
        compose.onNodeWithTag("feed_post_p1_topic_compose").assertDoesNotExist()
        // The card is one clickable, so its plain text merges into it —
        // the counts are read off the unmerged tree.
        compose.onNodeWithTag("feed_post_p1_topics_counts", useUnmergedTree = true)
            .assertTextEquals("· 1 topic")
    }

    /** A card never lists its references inline — it states how many. */
    @Test
    fun theTopicsLineCountsReferencesRatherThanListingThem() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(
                    testPost("p1").copy(
                        topics = listOf(testTopicClaim("rust")),
                        references = listOf(
                            testReferenceClaim(testMentionTarget("ada")),
                            testReferenceClaim(testMentionTarget("sol")),
                        ),
                    ),
                ),
            ),
        )
        compose.onNodeWithTag("feed_post_p1_topics_counts", useUnmergedTree = true)
            .assertTextEquals("· 2 references")
        compose.onNodeWithTag("feed_post_p1_reference_l1-user-ada", useUnmergedTree = true)
            .assertDoesNotExist()
    }

    /** Both halves fold into one trailing string, in the master's order. */
    @Test
    fun theCountsJoinTopicsAndReferencesInOneLine() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(
                    testPost("p1").copy(
                        topics = List(5) { testTopicClaim("t$it") },
                        references = listOf(testReferenceClaim(testMentionTarget("ada"))),
                    ),
                ),
            ),
        )
        compose.onNodeWithTag("feed_post_p1_topics_counts", useUnmergedTree = true)
            .assertTextEquals("· 3 topics · 1 reference")
    }

    /** Two topics and nothing else leaves no counts to state. */
    @Test
    fun twoTopicsAloneStateNoCounts() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(
                    testPost("p1").copy(
                        topics = listOf(testTopicClaim("rust"), testTopicClaim("kotlin")),
                    ),
                ),
            ),
        )
        compose.onNodeWithTag("feed_post_p1_topics_counts", useUnmergedTree = true)
            .assertDoesNotExist()
    }

    /** A chip is never cut — jakob's ruling, 2026-09-09 (HT-14). */
    @Test
    fun aNameTooLongForItsPillIsStatedByTheCountsInstead() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(
                    testPost("p1").copy(
                        topics = listOf(testTopicClaim(OVERLONG_TOPIC), testTopicClaim("rust")),
                    ),
                ),
            ),
        )
        compose.onNodeWithTag("feed_post_p1_topic_$OVERLONG_TOPIC").assertDoesNotExist()
        compose.onNodeWithTag("feed_post_p1_topic_rust").assertExists()
        compose.onNodeWithTag("feed_post_p1_topics_counts", useUnmergedTree = true)
            .assertTextEquals("· 1 topic")
    }

    /** Neither fits: the line falls all the way back to the counts. */
    @Test
    fun twoUnfittableNamesLeaveTheCountsAlone() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(
                    testPost("p1").copy(
                        topics = listOf(
                            testTopicClaim(OVERLONG_TOPIC),
                            testTopicClaim(OVERLONG_TOPIC + "two"),
                        ),
                    ),
                ),
            ),
        )
        compose.onNodeWithTag("feed_post_p1_topics_line", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("feed_post_p1_topics_counts", useUnmergedTree = true)
            .assertTextEquals("· 2 topics")
    }

    /** Nothing to say, nothing drawn. */
    @Test
    fun aPostWithNoTopicsOrReferencesDrawsNoLine() {
        renderFeed(FeedUiState(loading = false, posts = listOf(testPost("p1"))))
        compose.onNodeWithTag("feed_post_p1_topics_line", useUnmergedTree = true)
            .assertDoesNotExist()
    }

    /** On a summary card the chips still navigate, beside the counts. */
    @Test
    fun aTopicChipOpensItsTopic() {
        var opened: String? = null
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(testPost("p1").copy(topics = listOf(testTopicClaim("rust")))),
            ),
            onOpenTopic = { opened = it },
        )
        compose.onNodeWithTag("feed_post_p1_topic_rust").performClick()
        assertThat(opened).isEqualTo("rust")
    }

    /**
     * On the DETAIL the whole line is one control (`TopicsLine.jsx`: the
     * chips go inert inside it), so a chip there opens what the line opens
     * rather than swallowing the tap.
     */
    @Test
    fun aChipInsideTheDetailsLineOpensTheSheetInstead() {
        var opened: String? = null
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1").copy(topics = listOf(testTopicClaim("rust"))),
            ),
            onOpenTopic = { opened = it },
        )
        compose.onNodeWithTag("detail_post_topic_rust").performClick()
        assertThat(opened).isNull()
        compose.onNodeWithTag("detail_post_refs_sheet").assertExists()
    }

    /** The comment card wears the same line the post does. */
    @Test
    fun aCommentWearsTheSameTopicsLine() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(
                    comment("c1").copy(
                        topics = listOf(testTopicClaim("kotlin")),
                        references = listOf(testReferenceClaim(testMentionTarget("ada"))),
                    ),
                ),
            ),
        )
        openComments()
        compose.onNodeWithTag("comment_c1_topic_kotlin").assertTextEquals("#kotlin")
        compose.onNodeWithTag("comment_c1_topics_counts", useUnmergedTree = true)
            .assertTextEquals("· 1 reference")
    }

    // -- The tags-and-references sheet: the reveal the counts open --

    /**
     * A summary card's counts raise the sheet (graph.json: every `reference
     * count` edge advances to `RefsSheet`), and the tag's pair is written
     * with only one sign — confidence is census-bounded to [0, 1].
     */
    @Test
    fun theCountsOpenTheSheetOnASummaryCard() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(
                    testPost("p1").copy(
                        topics = listOf(testTopicClaim("photography", relevance = 0.4, confidence = 0.9)),
                        references = listOf(testReferenceClaim(testMentionTarget("mira"))),
                    ),
                ),
            ),
        )
        compose.onNodeWithTag("feed_post_p1_refs_sheet").assertDoesNotExist()
        compose.onNodeWithTag("feed_post_p1_topics_counts", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("feed_post_p1_refs_sheet").assertExists()
        compose.onNodeWithTag("feed_post_p1_refs_topic_photography_pair", useUnmergedTree = true)
            .assertTextEquals("+0.40 / 0.90")
        compose.onNodeWithTag("feed_post_p1_refs_topic_photography_face", useUnmergedTree = true)
            .assertTextEquals("🔗")
    }

    /**
     * THE SHEET IS THE DOOR, NOT THE DESTINATION (`CograOverflowMenu`'s own
     * rule). The opener remembers that it was raised (`rememberSaveable`), so
     * a row that navigated with the sheet still standing left Back restoring
     * the surface AND the sheet over it — a trap with no way out but a second
     * Back. The row drops the sheet as it acts.
     */
    @Test
    fun aTagRowDropsTheSheetOnItsWayOut() {
        renderFeed(
            FeedUiState(
                loading = false,
                posts = listOf(
                    testPost("p1").copy(
                        topics = listOf(testTopicClaim("photography", relevance = 0.4, confidence = 0.9)),
                        references = listOf(testReferenceClaim(testMentionTarget("mira"))),
                    ),
                ),
            ),
        )
        compose.onNodeWithTag("feed_post_p1_topics_counts", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("feed_post_p1_refs_sheet").assertExists()
        compose.onNodeWithTag("feed_post_p1_refs_topic_photography").performClick()
        compose.onNodeWithTag("feed_post_p1_refs_sheet").assertDoesNotExist()
    }

    /**
     * On the detail the WHOLE line is the opener, and a citation's pair keeps
     * a sign on both axes — the difference between the two families is what
     * the two shapes carry.
     */
    @Test
    fun theWholeLineOpensTheSheetOnTheDetail() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1").copy(
                    references = listOf(
                        testReferenceClaim(
                            testContentTarget("p2"),
                            relevance = 0.55,
                            support = 0.2,
                        ),
                    ),
                ),
            ),
        )
        compose.onNodeWithTag("detail_post_topics_line").performClick()
        compose.onNodeWithTag("detail_post_refs_sheet").assertExists()
        compose.onNodeWithTag("detail_post_refs_reference_l1-p2_pair", useUnmergedTree = true)
            .assertTextEquals("+0.55 / +0.20")
        compose.onNodeWithTag("detail_post_refs_reference_l1-p2_face", useUnmergedTree = true)
            .assertTextEquals("😊")
    }

    /**
     * The settling mark shows HERE and only here, in both families: a
     * settling tag and a settling citation are the same fact about two
     * families, and it rides the pair rather than the name.
     */
    @Test
    fun theSheetIsWhereASettlingActSaysSo() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1").copy(
                    topics = listOf(testTopicClaim("coastroad", pending = true)),
                    references = listOf(testReferenceClaim(testMentionTarget("mira"), pending = false)),
                ),
            ),
        )
        compose.onNodeWithTag("detail_post_topics_line").performClick()
        compose.onNodeWithTag("detail_post_refs_topic_coastroad_pending", useUnmergedTree = true)
            .assertExists()
        compose.onNodeWithTag("detail_post_refs_reference_l1-user-mira_pending", useUnmergedTree = true)
            .assertDoesNotExist()
    }

    /**
     * THE COUNT IS THE LIST'S LENGTH: a citation whose far end this instance
     * cannot type still stands as a substrate fact, so it still gets a row.
     */
    @Test
    fun theSheetCountsACitationItCannotType() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1").copy(references = listOf(testReferenceClaim(null))),
            ),
        )
        compose.onNodeWithTag("detail_post_topics_line").performClick()
        compose.onNodeWithTag("detail_post_refs_reference_l1-untypeable").assertExists()
    }

    /**
     * ONE SHEET AT A TIME: a comment's line is read inside the thread's own
     * sheet, and the board draws no sheet over a sheet — so the comment's
     * counts stay the plain fact they were.
     */
    @Test
    fun aCommentsCountsOpenNoSecondSheet() {
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(
                    comment("c1").copy(
                        references = listOf(testReferenceClaim(testMentionTarget("ada"))),
                    ),
                ),
            ),
        )
        openComments()
        compose.onNodeWithTag("comment_c1_topics_counts", useUnmergedTree = true).performClick()
        compose.onNodeWithTag("comment_c1_refs_sheet").assertDoesNotExist()
    }

    // -- What the composer is pinned to (graph.json `ReplyEntry` 5, 7) --

    /**
     * "Add a comment" pins the post: the card leads with its title, and
     * the line under it is the body the answer is about.
     */
    @Test
    fun thePostBecomesAPinnedTarget() {
        val target = testPost("p1").asReplyTarget()

        assertThat(target.id).isEqualTo("p1")
        assertThat(target.kind).isEqualTo(ReplyTargetKind.Post)
        assertThat(target.actLabel).endsWith("post")
    }

    /**
     * "Reply" pre-targets the comment. A comment has no title, so its
     * own opening words become one — and the seal then says it answers a
     * comment rather than the post.
     */
    @Test
    fun aCommentBecomesAPreTargetedTarget() {
        val target = comment("c1").asReplyTarget()

        assertThat(target.id).isEqualTo("c1")
        assertThat(target.kind).isEqualTo(ReplyTargetKind.Comment)
        assertThat(target.actLabel).endsWith("comment")
        assertThat(target.title).isNotEmpty()
    }

    /** The card draws one line, so the words are clipped before they ride a route. */
    @Test
    fun aLongBodyIsClippedForTheCard() {
        val long = "x".repeat(400)
        val target = comment("c1")
            .let { it.copy(content = it.content.copy(value = long)) }
            .asReplyTarget()

        assertThat(target.snippet.length).isLessThan(long.length)
        assertThat(target.snippet).endsWith("…")
        assertThat(target.title.length).isLessThan(target.snippet.length)
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
        renderComposer(
            ComposePostUiState(tagSection = TagSectionState(tags = tagRows("rust"))),
            onTuneTag = { tuned = it },
        )
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

    // -- The Reference affordance and the finder (D20) --

    // CITING RIDES THE MENU on every content (`_shared.jsx:165-175`), post and
    // comment alike — its drawn home is the ⋮'s `Cite in a new post` row.
    @Test
    fun thePostsMenuCitesThePostItWasOpenedOn() {
        val referenced = mutableListOf<String>()
        renderDetail(
            detailFixture(loading = false, post = testPost("p1"), comments = emptyList()),
            viewerId = "someone-else",
            onReference = { referenced += it },
        )
        compose.onNodeWithTag("detail_menu").performClick()
        compose.onNodeWithTag("detail_menu_cite").performClick()
        assertThat(referenced).containsExactly("p1")
    }

    @Test
    fun aCommentsMenuCitesTheCommentItWasOpenedOn() {
        val referenced = mutableListOf<String>()
        renderDetail(
            detailFixture(
                loading = false,
                post = testPost("p1"),
                comments = listOf(comment("c1")),
            ),
            signedIn = true,
            onReference = { referenced += it },
        )
        openComments()
        compose.onNodeWithTag("comment_c1_menu").performClick()
        compose.onNodeWithTag("comment_menu_cite_c1").performClick()
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

/** Well past the 18-line ceiling at any plausible card width. */
private val LONG_BODY = "Salt maps of the coast road, walked at low tide. ".repeat(80)

/**
 * A topic name that cannot draw whole inside the chip's cap.
 *
 * Longer than a real one needs to be: the JVM sandbox has no real fonts,
 * so Robolectric measures every glyph at roughly a pixel, and a name
 * that overflows on a phone still fits here. The mechanism under test is
 * the measurement against the cap, and this length crosses it in both
 * places.
 */
private val OVERLONG_TOPIC = "saltmarsh".repeat(12)
