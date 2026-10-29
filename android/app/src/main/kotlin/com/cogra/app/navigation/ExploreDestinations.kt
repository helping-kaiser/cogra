// The Explore and Wallet tab roots (BottomNav.jsx: V1.0 carries all five
// slots) and Your topics behind Explore's door. Each root is one
// `navigation<…Tab>` block and one [TopLevelTab] entry; what a root opens
// stands in its own tab's stack, so Explore stays lit over a result it opened
// (PostDetail.md:57).

package com.cogra.app.navigation

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import com.cogra.feature.content.CHATS_FROM_EXPLORE
import com.cogra.feature.content.CHATS_FROM_WALLET
import com.cogra.feature.content.POST_FROM_SEARCH
import com.cogra.feature.content.WalletComingSoonScreen
import com.cogra.feature.explore.ExploreDoors
import com.cogra.feature.explore.ExploreRoute
import com.cogra.feature.explore.YourTopicsRoute
import com.cogra.feature.notifications.RootBellViewModel
import com.cogra.feature.profile.SEARCH_ORIGIN
import com.cogra.feature.topics.TOPIC_FROM_SEARCH
import com.cogra.feature.topics.TOPIC_FROM_YOUR_TOPICS

/** The Explore tab's root. */
internal fun NavGraphBuilder.exploreRoot(shell: ShellScope) {
    composable<Explore> { entry -> shell.ExploreDestination(entry) }
}

/** The Wallet tab's root: its coming-soon door (WalletComingSoon.md). */
internal fun NavGraphBuilder.walletRoot(shell: ShellScope) {
    composable<Wallet> { entry -> shell.WalletDestination(entry) }
}

/** Your topics, behind Explore's door — a subpage with no bar (YourTopics.md). */
internal fun NavGraphBuilder.yourTopics(shell: ShellScope) {
    composable<YourTopics> {
        YourTopicsRoute(
            onBack = { shell.navController.navigateUp() },
            onOpenTopic = { name -> shell.navController.navigate(Topic(name, from = TOPIC_FROM_YOUR_TOPICS)) },
        )
    }
}

@Composable
private fun ShellScope.ExploreDestination(entry: NavBackStackEntry) {
    // THE BELL LIGHTS ON THIS ROOT'S FRESH LOAD (FeedUnread.md:5), as on every root.
    if (signedIn == true) hiltViewModel<RootBellViewModel>(entry)
    ExploreRoute(
        reselects = reselects(TopLevelTab.EXPLORE),
        // A guest's band stands bare (Explore.md:35); their chats ask to join.
        bell = bellFor("explore"),
        onChats = chatsFrom(CHATS_FROM_EXPLORE),
        doors = ExploreDoors(
            onOpenPost = { id -> navController.navigate(PostDetail(id, from = POST_FROM_SEARCH)) },
            // Search-into-a-thread: the post opens landed on the comment (design/readme.md).
            onOpenComment = { postId, commentId ->
                navController.navigate(PostDetail(postId, from = POST_FROM_SEARCH, commentId = commentId))
            },
            onOpenPerson = { handle -> navController.navigate(Profile(handle, from = SEARCH_ORIGIN)) },
            // The reader's own row opens their own profile (ExplorePerson.md:25).
            onOpenOwnProfile = { navController.selectTab(TopLevelTab.PROFILE, onReselect = {}) },
            onOpenTopic = { name -> navController.navigate(Topic(name, from = TOPIC_FROM_SEARCH)) },
            onOpenYourTopics = { navController.navigate(YourTopics) },
        ),
    )
}

@Composable
private fun ShellScope.WalletDestination(entry: NavBackStackEntry) {
    if (signedIn == true) hiltViewModel<RootBellViewModel>(entry)
    WalletComingSoonScreen(
        reselects = reselects(TopLevelTab.WALLET),
        onChats = chatsFrom(CHATS_FROM_WALLET),
        bell = bellFor("wallet"),
    )
}

/** The band's chats on a root: the coming-soon page, or the guest gate (WalletComingSoon.md:13). */
private fun ShellScope.chatsFrom(from: String): () -> Unit = {
    if (signedIn == true) navController.navigate(ChatsComingSoon(from)) else requireJoin()
}
