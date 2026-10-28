// The bottom bar's destination slots as navigation: one nested graph per
// tab, the tab a screen stands in read off the graph, and the moves the
// shell's navigation contract makes between tabs (roadmap.md "The MVP
// milestone"; design/readme.md §13 "The bottom bar's re-tap ladder").
//
// The shape is Compose Navigation's documented one for a bottom bar with
// per-tab back stacks: each tab a nested graph (developer.android.com
// "Nested graphs"), a tab switch that pops to the start saving state and
// restores the arriving tab's (".../backstack/multi-back-stacks"), and the
// selected item derived from the current destination's hierarchy — the
// Now in Android sample's `isRouteInHierarchy`.

package com.cogra.app.navigation

import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavController
import androidx.navigation.NavDestination
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph
import androidx.navigation.toRoute
import com.cogra.app.ui.NavSlot
import kotlin.reflect.KClass

/**
 * A bottom-bar slot that is a destination: its nested graph, the slot that
 * lights for it, and its root. A slot root is one entry here and one
 * `navigation<…>` block in the shell's NavHost — all four destination slots
 * stand (the fifth, New post, is an action).
 */
internal enum class TopLevelTab(val graph: KClass<*>, val graphRoute: Any, val slot: NavSlot) {
    FEED(FeedTab::class, FeedTab, NavSlot.Feed),
    EXPLORE(ExploreTab::class, ExploreTab, NavSlot.Search),
    WALLET(WalletTab::class, WalletTab, NavSlot.Wallet),
    PROFILE(ProfileTab::class, ProfileTab, NavSlot.Profile),
    ;

    /**
     * Whether [entry] is this tab's root. The Profile tab's root and the
     * profiles stacked on it share a destination; the root is the one with
     * no handle — the reader's own (Profile.md).
     */
    fun isRoot(entry: NavBackStackEntry): Boolean = when (this) {
        FEED -> entry.destination.hasRoute<Feed>()
        EXPLORE -> entry.destination.hasRoute<Explore>()
        WALLET -> entry.destination.hasRoute<Wallet>()
        PROFILE -> entry.destination.hasRoute<Profile>() && entry.toRoute<Profile>().handle == null
    }
}

/**
 * The tab whose stack this destination stands in, read off the graph — the
 * originating root a drill-in keeps lit (BottomNav.prompt.md: "The
 * originating root stays lit on a drill-in"). Null outside every tab: the
 * entry funnel and the mailed links' landings.
 */
internal fun NavDestination?.tab(): TopLevelTab? {
    val hierarchy = this?.hierarchy ?: return null
    return TopLevelTab.entries.firstOrNull { tab -> hierarchy.any { it.hasRoute(tab.graph) } }
}

/**
 * The slot of [tab] tapped — one tap, the ladder's rungs (design/readme.md
 * §13). Another tab comes back in the state it was left; the tab already
 * showing pops to its own root, at the scroll it was left; and at that root
 * the tap is the root's own re-tap, handed to [onReselect].
 */
internal fun NavController.selectTab(tab: TopLevelTab, onReselect: () -> Unit) {
    val entry = currentBackStackEntry ?: return
    when {
        entry.destination.tab() != tab -> switchTo(tab)
        tab.isRoot(entry) -> onReselect()
        else -> popToRoot(tab)
    }
}

/**
 * Pops [tab]'s stack to its root, at the scroll it was left.
 *
 * By destination, not by route value: the Profile tab's root and the
 * profiles stacked on it share one destination, and a route-valued pop
 * matches on the arguments' encoded form — which the root's absent handle
 * does not survive. A pop to the destination lands on the topmost entry of
 * it; while that is a profile stacked on the root rather than the root,
 * the next pop goes on past it.
 */
private fun NavController.popToRoot(tab: TopLevelTab) {
    val rootId = graph.findNode(tab.graphRoute)?.let { (it as? NavGraph)?.startDestinationId } ?: return
    while (true) {
        val top = currentBackStackEntry ?: return
        if (tab.isRoot(top)) return
        val popped = if (top.destination.id == rootId) popBackStack() else popBackStack(rootId, inclusive = false)
        if (!popped) return
    }
}

/**
 * The documented tab switch: pop to the start of the tabs — Feed's root,
 * the bottom of every reader's stack — saving what stood above it, and
 * restore what [tab] was left with (a tab never opened arrives fresh).
 */
private fun NavController.switchTo(tab: TopLevelTab) {
    navigate(tab.graphRoute) {
        popUpTo<Feed> { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

/**
 * Lands on Feed's root from anywhere, the stack the feed was left with
 * dropped.
 *
 * The roadmap's back rule ("from another tab's root to Feed's root") and
 * every landing the design sends to the feed itself — an application's
 * close, the vouch-back's ceremony, a post published or expired — arrive at
 * the root, not at whatever the feed was left at. The feed's left stack is
 * saved state the controller holds against the Feed tab, and a landing that
 * walked past it must spend it: left standing, a later tap on the Feed slot
 * would bring back a drill-in the reader had already backed out of. So it
 * is restored and dropped in one move, before anything draws.
 *
 * [keepLeaving] keeps the tab being left, as a tab switch does; false
 * closes it, as Back out of its root does.
 */
internal fun NavController.landOnFeedRoot(keepLeaving: Boolean) {
    if (currentBackStackEntry?.destination.tab() != TopLevelTab.FEED) {
        navigate(FeedTab) {
            popUpTo<Feed> { saveState = keepLeaving }
            launchSingleTop = true
            restoreState = true
        }
    }
    popBackStack<Feed>(inclusive = false)
}

/**
 * Forgets every tab's left stack: a new session starts every tab fresh
 * (design/readme.md §13, "The state is the session's"), and none may come
 * back carrying the last account's screens. A tab with its own saved graph
 * is cleared outright; the feed, whose root stays on the stack, spends its
 * left stack where it stands.
 */
internal fun NavController.forgetLeftStacks() {
    TopLevelTab.entries.filter { it != TopLevelTab.FEED }.forEach { clearBackStack(it.graphRoute) }
    if (currentBackStackEntry?.destination.tab() == TopLevelTab.FEED) {
        navigate(FeedTab) {
            launchSingleTop = true
            restoreState = true
        }
        popBackStack<Feed>(inclusive = false)
    }
}

/** Opens the app afresh on Feed's root: the whole stack goes, and every tab's left stack with it. */
internal fun NavController.startOnFeedRoot() {
    navigate(FeedTab) { popUpTo(0) { inclusive = true } }
    forgetLeftStacks()
}
