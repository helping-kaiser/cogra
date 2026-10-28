// The read surfaces: the tab roots and the read drill-ins, the screens the
// bottom bar frames (design.md §6), plus the ceremony that opens over the
// feed root.

package com.cogra.app.navigation

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.toRoute
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.StanceAxes
import com.cogra.core.designsystem.StanceZeroWords
import com.cogra.domain.notifications.NotificationTarget
import com.cogra.domain.stance.StanceTarget
import com.cogra.feature.content.CHATS_FROM_FEED
import com.cogra.feature.content.CHATS_FROM_MESSAGE
import com.cogra.feature.content.CHATS_FROM_OWN_PROFILE
import com.cogra.feature.content.CardDoors
import com.cogra.feature.content.ChatsComingSoonRoute
import com.cogra.feature.content.FeedRoute
import com.cogra.feature.content.HistoryDoors
import com.cogra.feature.content.HistoryRoute
import com.cogra.feature.content.PostDetailRoute
import com.cogra.feature.content.SavedRoute
import com.cogra.feature.home.NewerVersionAnnouncement
import com.cogra.feature.home.VouchedInScreen
import com.cogra.feature.notifications.NotificationsRoute
import com.cogra.feature.notifications.RootBellViewModel
import com.cogra.feature.profile.COMMENTS_ORIGIN
import com.cogra.feature.profile.FEED_ORIGIN
import com.cogra.feature.profile.HISTORY_ORIGIN
import com.cogra.feature.profile.NOTIFICATIONS_ORIGIN
import com.cogra.feature.profile.POST_ORIGIN
import com.cogra.feature.profile.ProfileRoute
import com.cogra.feature.profile.SAVED_ORIGIN
import com.cogra.feature.profile.topicOrigin
import com.cogra.feature.stance.StanceControlRoute
import com.cogra.feature.topics.TOPIC_FROM_HISTORY
import com.cogra.feature.topics.TopicRoute

/** The Feed tab's root. */
internal fun NavGraphBuilder.feedRoot(shell: ShellScope) {
    composable<Feed> { entry -> shell.FeedDestination(entry) }
}

/** The vouch-back's ceremony (`VouchedIn`), which opens over the feed root alone. */
internal fun NavGraphBuilder.vouchedIn(shell: ShellScope) = with(shell) {
    composable<VouchedIn> { entry ->
        val route = entry.toRoute<VouchedIn>()
        VouchedInScreen(
            handle = route.handle,
            name = route.name,
            avatarUrl = route.avatarUrl,
            // The member's own feed — the root already under this
            // entry, so it comes back where the reader left it.
            onGoToFeed = {
                if (!navController.popBackStack(Feed, inclusive = false)) {
                    navController.navigate(Feed) { launchSingleTop = true }
                }
            },
        )
    }
}

/** The read drill-ins: what a tab's stack holds above its root. */
internal fun NavGraphBuilder.readDrillIns(shell: ShellScope) {
    composable<PostDetail> { entry -> shell.PostDetailDestination(entry) }
    composable<Topic> { entry -> shell.TopicDestination(entry) }
    composable<Profile> { entry -> shell.ProfileDestination(entry) }
    // NOTIFICATIONS (Notifications.md): reached from the bell on a root
    // band; every row opens its thing with a back arrow reading `Back to
    // Notifications`, and the list's own arrow pops to the bell's root.
    composable<Notifications> { entry -> shell.NotificationsDestination(entry) }
    // SAVED (Saved.md): reached from the own profile's ⋮, a feed of
    // every kept thing as its kind's own card; every door opens its
    // thing with a back arrow reading `Back to Saved`. A post card's
    // comment count raises the thread over Saved, as over the feed, so
    // the thread's return is read here the same way.
    composable<Saved> { entry -> shell.SavedDestination(entry) }
    // HISTORY (History.md): reached from the own profile's ⋮, Saved's sibling,
    // a feed of every seen thing as its kind's own card; every door opens
    // its thing with a back arrow reading `Back to History`.
    composable<History> { entry -> shell.HistoryDestination(entry) }
    composable<ChatsComingSoon> { entry ->
        ChatsComingSoonRoute(
            from = entry.toRoute<ChatsComingSoon>().from,
            onBack = { shell.navController.navigateUp() },
        )
    }
}

@Composable
private fun ShellScope.FeedDestination(entry: NavBackStackEntry) {
    val (signedResult, consumeSigned) = entry.navResult(contentSignedKey)
    val (actorRestored, consumeRestored) = entry.navResult(actorRestoredKey)
    val (expiredLabel, consumeExpired) = entry.navResult(contentExpiredKey)
    // THE COMMENTS SHEET IS RAISED HERE TOO, so the feed reads
    // the thread's return exactly as the detail does: the
    // return belongs to the sheet, not to the surface under it.
    val thread = entry.threadReturn(navController)
    val accountId by authState.accountId.collectAsStateWithLifecycle()
    // THE BELL LIGHTS ON THIS ROOT'S FRESH LOAD (FeedUnread.md:5):
    // once per entry, and again on the reader's pull.
    val rootBell: RootBellViewModel? = if (signedIn == true) hiltViewModel(entry) else null
    FeedRoute(
        signedIn = signedIn,
        reselectSignal = reselects(TopLevelTab.FEED),
        // A guest's Report asks them to join instead of raising
        // the confirm (ReportConfirm.md:21).
        onRequireAccount = { requireJoin() }.takeIf { signedIn == false },
        onReply = { target -> navController.openReplyWizard(target) },
        onEditComment = { commentId, parentTitle ->
            navController.navigate(EditComment(commentId, parentTitle))
        },
        onSignInOrJoin = { navController.navigate(Login) },
        commentsReturn = thread.value,
        onCommentsReturnConsumed = thread.onConsumed,
        onCommentsDepart = thread.onDepart,
        expiredLabel = expiredLabel,
        onExpiredDismissed = consumeExpired,
        onOpenDraft = {
            consumeExpired()
            navController.navigate(ComposePost())
        },
        onOpenPost = { id -> navController.navigate(PostDetail(id)) },
        // The profile names its way back by the door it came through.
        onOpenActor = { handle -> navController.navigate(Profile(handle, from = FEED_ORIGIN)) },
        onOpenCommentActor = { handle -> navController.navigate(Profile(handle, from = COMMENTS_ORIGIN)) },
        // A comment card's doors (FeedKinds.md): the post's comment section,
        // landed on the comment, the composer aimed at it on the comment glyph.
        onOpenComment = { postId, commentId, aimReply ->
            navController.navigate(PostDetail(postId, commentId = commentId, aimReply = aimReply))
        },
        // `Tag a new post with it` (FeedKinds.md): the composer at its first
        // stage, the tag riding staged.
        onComposeWithTag = { name -> navController.navigate(ComposePost(tag = name)) },
        onOpenTopic = { name -> navController.navigate(Topic(name)) },
        // The card's ⋮ reaches the same two destinations the
        // detail's menu does: a feed card's rows are the post's
        // rows, so they cannot lead somewhere else.
        viewerId = accountId,
        onEditPost = { id -> navController.navigate(ComposePost(id)) },
        onCitePost = { id ->
            navController.navigate(ComposePost(referenceTargetId = id))
        },
        // The chats affordance the band carries (jakob
        // 2026-09-01). A signed-out tap opens the guest gate,
        // which is the edge the canvas draws (`graph.json`
        // "FeedBare" → `GuestGate`); a signed-in tap reaches
        // the coming-soon destination (`graph.json` "Feed" →
        // `ChatsComingSoon`, backlog item 68). Nothing is
        // drawn while the auth state is still unknown — the
        // two readings differ, and guessing puts the wrong
        // action on the tap for a frame.
        onChats = when (signedIn) {
            false -> {
                { requireJoin() }
            }
            true -> {
                { navController.navigate(ChatsComingSoon(CHATS_FROM_FEED)) }
            }
            null -> null
        },
        bell = bellFor("feed"),
        refreshSignal = signedResult,
        onRefreshSignalConsumed = consumeSigned,
        keyBanner = keyBanner,
        borrowedViewBand = borrowedViewBand,
        deletionBand = deletionBand(DataNode("feed") / "deletionBand"),
        banners = { statusBanners(actorRestored, consumeRestored) },
        vouchCard = vouchCard,
        onPulled = {
            onFeedPulled()
            rootBell?.pulled()
        },
    )
    // A newer version, said once per release on a cold open's
    // feed — to members, applicants and guests alike
    // (FeedNewerVersion.md).
    val context = LocalContext.current
    NewerVersionAnnouncement(onUpdateNow = { openStoreListing(context) })
}

@Composable
private fun ShellScope.PostDetailDestination(entry: NavBackStackEntry) {
    val (signedResult, consumeSigned) = entry.navResult(contentSignedKey)
    val thread = entry.threadReturn(navController)
    val accountId by authState.accountId.collectAsStateWithLifecycle()
    val detailRoute = entry.toRoute<PostDetail>()
    PostDetailRoute(
        postId = detailRoute.postId,
        from = detailRoute.from,
        landOn = detailRoute.commentId,
        aimReply = detailRoute.aimReply,
        published = detailRoute.published,
        viewerId = accountId,
        signedIn = signedIn,
        onRequireAccount = { requireJoin() }.takeIf { signedIn == false },
        onEdit = { id -> navController.navigate(ComposePost(id)) },
        // `ReplyEntry` 5 and 7 — the composer, pinned to
        // whatever the thread said it answers.
        onReply = { target -> navController.openReplyWizard(target) },
        // `ReplyMedia` 6 — `CommentEdit`, on an own comment.
        onEditComment = { commentId, parentTitle ->
            navController.navigate(EditComment(commentId, parentTitle))
        },
        onOpenActor = { handle -> navController.navigate(Profile(handle, from = POST_ORIGIN)) },
        onOpenCommentActor = { handle -> navController.navigate(Profile(handle, from = COMMENTS_ORIGIN)) },
        // A post cited from the tags-and-references sheet; a cited
        // comment lands on the post carrying it, which has no
        // permalink of its own.
        onOpenPost = { id -> navController.navigate(PostDetail(id)) },
        onOpenTopic = { name -> navController.navigate(Topic(name)) },
        onReference = { id ->
            navController.navigate(ComposePost(referenceTargetId = id))
        },
        onSignInOrJoin = { navController.navigate(Login) },
        onBack = { navController.navigateUp() },
        refreshSignal = signedResult,
        onRefreshSignalConsumed = consumeSigned,
        commentsReturn = thread.value,
        onCommentsReturnConsumed = thread.onConsumed,
        onCommentsDepart = thread.onDepart,
        deletionBand = deletionBand(node = null),
    )
}

@Composable
private fun ShellScope.TopicDestination(entry: NavBackStackEntry) {
    val route = entry.toRoute<Topic>()
    val topic = route.name
    TopicRoute(
        name = topic,
        from = route.from,
        onOpenPost = { id -> navController.navigate(PostDetail(id)) },
        onOpenActor = { handle -> navController.navigate(Profile(handle, from = topicOrigin(topic))) },
        onBack = { navController.navigateUp() },
        // The page's one action, wired here because what a
        // signed-out tap does is the shell's to say — the
        // same guest gate the bar's slots raise. Nothing is
        // drawn while the auth state is unknown: the two
        // readings differ, and guessing puts the wrong
        // action on the tap for a frame.
        stanceControl = signedIn?.let { signed ->
            {
                StanceControlRoute(
                    target = StanceTarget.Topic(topic),
                    testTagPrefix = "topic_affinity",
                    axes = StanceAxes.Affinity,
                    // Disconnected, never severed (jakob's I2
                    // ruling, copy-voice.md "the topic
                    // disconnects") — the same split
                    // `StanceAxes.Affinity` already makes for
                    // the two signed slots.
                    zeroWords = StanceZeroWords.Disconnected,
                    // It NAMES WHAT IT STANCES, hash and all:
                    // this page carries more than one stance
                    // control and the accessible name is what
                    // says which is which (`TagPage`).
                    targetLabel = "#$topic",
                    wide = true,
                    onRequireAccount = { requireJoin() }.takeIf { !signed },
                )
            }
        },
        deletionBand = deletionBand(node = null),
    )
}

@Composable
private fun ShellScope.ProfileDestination(entry: NavBackStackEntry) {
    val route = entry.toRoute<Profile>()
    val (handleChanged, consumeHandleChanged) = entry.navResult(handleChangedKey)
    val (profileSaved, consumeProfileSaved) = entry.navResult(profileSavedKey)
    val (actorRestored, consumeRestored) = entry.navResult(actorRestoredKey)
    // The own profile is a ROOT: its fresh load reads the bell
    // (Profile.md:41; FeedUnread.md:5). Another actor's is a drill-in.
    val ownRoot = route.handle == null && signedIn == true
    if (ownRoot) hiltViewModel<RootBellViewModel>(entry)
    val tabRoot = TopLevelTab.PROFILE.isRoot(entry)
    if (tabRoot) AnotherTabsRootBack()
    ProfileRoute(
        handle = route.handle,
        // The bar's Profile slot re-tapped over this root (Profile.md:61-63).
        reselectSignal = if (tabRoot) reselects(TopLevelTab.PROFILE) else 0,
        bell = if (ownRoot) bellFor("profile") else null,
        handleChangedResult = handleChanged,
        onHandleChangedResultConsumed = consumeHandleChanged,
        profileSavedResult = profileSaved,
        onProfileSavedResultConsumed = consumeProfileSaved,
        onEdit = { navController.navigate(ProfileEdit) },
        onOpenSettings = { navController.navigate(Settings) },
        onOpenInvites = { navController.navigate(Invites) },
        onOpenPost = { id -> navController.navigate(PostDetail(id)) },
        // The own-profile tab has no back arrow; another
        // actor's profile is a drill-in.
        onBack = if (route.handle == null) null else ({ navController.navigateUp() }),
        // Only the reader's own profile carries the shell
        // banners: another actor's is a drill-in.
        keyBanner = { if (route.handle == null) keyBanner() },
        deletionBand = deletionBand(node = null),
        banners = {
            if (route.handle == null) statusBanners(actorRestored, consumeRestored)
        },
        // A signing on the member who vouched the reader in opens
        // the ceremony, by Set or by the hold (ProfileOther.md:37).
        onVouchedBack = { profile ->
            openCeremony(profile.handle, profile.displayName.value, profile.avatar?.url)
        },
        // The own ⋮'s Saved row (ProfileOwnMenu.md).
        onOpenSaved = { navController.navigate(Saved) },
        // The own ⋮'s History row (ProfileOwnMenu.md).
        onOpenHistory = { navController.navigate(History) },
        onRequireAccount = { requireJoin() }.takeIf { signedIn == false },
        from = route.from,
        // The band's chats on the own root (Profile.md:39), and Message on
        // another's: the chats coming-soon; a guest meets the gate
        // (ProfileOther.md:51-53).
        onChats = { navController.navigate(ChatsComingSoon(CHATS_FROM_OWN_PROFILE)) }.takeIf { ownRoot },
        onMessage = { navController.navigate(ChatsComingSoon(CHATS_FROM_MESSAGE)) },
    )
}

/**
 * SYSTEM BACK ON ANOTHER TAB'S ROOT LANDS ON FEED'S ROOT (roadmap.md "The
 * MVP milestone", ruled 2026-09-10): the tab closes, and the feed shows its
 * root rather than the drill-in it was left at — which is also spent, so a
 * later tap on the Feed slot cannot bring it back ([landOnFeedRoot]).
 */
@Composable
private fun ShellScope.AnotherTabsRootBack() {
    BackHandler { navController.landOnFeedRoot(keepLeaving = false) }
}

@Composable
private fun ShellScope.NotificationsDestination(entry: NavBackStackEntry) {
    val route = entry.toRoute<Notifications>()
    NotificationsRoute(
        from = route.from,
        onBack = { navController.navigateUp() },
        onOpen = { target ->
            when (target) {
                is NotificationTarget.Post -> navController.navigate(
                    PostDetail(target.postId, from = NOTIFICATIONS_ORIGIN),
                )
                is NotificationTarget.Comment -> navController.navigate(
                    PostDetail(target.postId, from = NOTIFICATIONS_ORIGIN, commentId = target.commentId),
                )
                is NotificationTarget.Person -> navController.navigate(
                    Profile(target.handle, from = NOTIFICATIONS_ORIGIN),
                )
                NotificationTarget.Invites -> navController.navigate(Invites)
                NotificationTarget.OwnFeed -> navController.landOnFeedRoot(keepLeaving = true)
            }
        },
    )
}

@Composable
private fun ShellScope.SavedDestination(entry: NavBackStackEntry) {
    val thread = entry.threadReturn(navController)
    val accountId by authState.accountId.collectAsStateWithLifecycle()
    SavedRoute(
        onBack = { navController.navigateUp() },
        doors = CardDoors(
            onOpenPost = { id -> navController.navigate(PostDetail(id, from = SAVED_ORIGIN)) },
            onOpenComment = { postId, commentId, aimReply ->
                navController.navigate(
                    PostDetail(postId, from = SAVED_ORIGIN, commentId = commentId, aimReply = aimReply),
                )
            },
            onOpenActor = { handle -> navController.navigate(Profile(handle, from = SAVED_ORIGIN)) },
            onOpenTopic = { name -> navController.navigate(Topic(name)) },
        ),
        viewerId = accountId,
        signedIn = signedIn,
        onEditPost = { id -> navController.navigate(ComposePost(id)) },
        onCitePost = { id -> navController.navigate(ComposePost(referenceTargetId = id)) },
        onReply = { target -> navController.openReplyWizard(target) },
        onEditComment = { commentId, parentTitle ->
            navController.navigate(EditComment(commentId, parentTitle))
        },
        onSignInOrJoin = { navController.navigate(Login) },
        commentsReturn = thread.value,
        onCommentsReturnConsumed = thread.onConsumed,
        onCommentsDepart = thread.onDepart,
    )
}

@Composable
private fun ShellScope.HistoryDestination(entry: NavBackStackEntry) {
    val thread = entry.threadReturn(navController)
    val accountId by authState.accountId.collectAsStateWithLifecycle()
    HistoryRoute(
        onBack = { navController.navigateUp() },
        doors = HistoryDoors(
            cards = CardDoors(
                onOpenPost = { id -> navController.navigate(PostDetail(id, from = HISTORY_ORIGIN)) },
                onOpenComment = { postId, commentId, aimReply ->
                    navController.navigate(
                        PostDetail(postId, from = HISTORY_ORIGIN, commentId = commentId, aimReply = aimReply),
                    )
                },
                onOpenActor = { handle -> navController.navigate(Profile(handle, from = HISTORY_ORIGIN)) },
                onOpenTopic = { name -> navController.navigate(Topic(name, from = TOPIC_FROM_HISTORY)) },
            ),
            // `Tag a new post with it` (History.md:63): the composer at its
            // first stage, the tag riding staged.
            onComposeWithTag = { name -> navController.navigate(ComposePost(tag = name)) },
        ),
        viewerId = accountId,
        signedIn = signedIn,
        onEditPost = { id -> navController.navigate(ComposePost(id)) },
        onCitePost = { id -> navController.navigate(ComposePost(referenceTargetId = id)) },
        onReply = { target -> navController.openReplyWizard(target) },
        onEditComment = { commentId, parentTitle ->
            navController.navigate(EditComment(commentId, parentTitle))
        },
        onSignInOrJoin = { navController.navigate(Login) },
        commentsReturn = thread.value,
        onCommentsReturnConsumed = thread.onConsumed,
        onCommentsDepart = thread.onDepart,
    )
}
