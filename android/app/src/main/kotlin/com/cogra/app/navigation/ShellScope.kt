// What the shell hands every destination it hosts.

package com.cogra.app.navigation

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.setValue
import androidx.compose.runtime.toMutableStateList
import androidx.navigation.NavHostController
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.atom.BandBell
import com.cogra.domain.stance.StanceTarget
import com.cogra.feature.home.ApplicationSurface
import com.cogra.feature.home.BorrowedViewBandRoute
import com.cogra.feature.home.DeletionBandRoute
import com.cogra.feature.home.KeyRestoreBannerRoute
import com.cogra.feature.home.StatusBannersRoute
import com.cogra.feature.home.VOUCH_CARD
import com.cogra.feature.home.VouchCardRoute
import com.cogra.feature.stance.StanceControlRoute
import com.cogra.feature.stance.vouchBackVariant
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * The shell's side of every destination: the controller, the session's
 * standing, and the slots each screen draws the same way.
 *
 * The shell builds one per composition and every destination builder reads
 * it, so the graphs and the entry funnel share one wiring rather than each
 * closing over a copy of its own. The slots are the shell's because what
 * they say depends on the session — the band's guest reading, the key card,
 * the deletion band — and a screen that drew them itself could disagree
 * with the screen beside it.
 */
internal interface ShellScope {
    val navController: NavHostController

    /** The activity-scoped auth holder: the signed-in account id, the deletion standing. */
    val authState: AuthStateViewModel

    /**
     * Whether a session exists; null while the cold phase resolves, when
     * neither reading's affordances show (android.md "Screens").
     */
    val signedIn: Boolean?

    /** The bar's slot of [tab] re-tapped over the tab's own root, counted: the root answers each one. */
    fun reselects(tab: TopLevelTab): Int

    /** The key card under the header, signed in only. */
    val keyBanner: @Composable () -> Unit

    /** The band that says whose view a reader is borrowing (guest and member alike). */
    val borrowedViewBand: @Composable () -> Unit

    /** The vouch card, the feed's own first card (`VouchBack`). */
    val vouchCard: @Composable () -> Unit

    /**
     * The shell's account-status banners, fed the Restore result the root
     * read; [ApplicationSurface] says which screen they ride, so the
     * application card speaks in that screen's words.
     */
    val statusBanners: @Composable (restored: Boolean, onConsumed: () -> Unit, surface: ApplicationSurface) -> Unit

    /** The guest prompt behind an account-needing slot: ask, never bounce. */
    fun requireJoin()

    /** The feed was pulled: the readers riding it read again. */
    fun onFeedPulled()

    /** Holds (or drops) the email-change link a signed-out landing asked to sign in for. */
    fun holdEmailLink(token: String?)

    /** Holds (or drops) the ask link a guest raised the gate over, for the ask to come back (VouchAsk.md:23). */
    fun holdAskLink(askLinkId: String?)

    /** Says [line] on the shell's snackbar, outliving the destination that asked. */
    fun announce(line: String)

    /** The bell on the root band named [from]; null for a guest, who has no list. */
    fun bellFor(from: String): BandBell?

    /** Opens the vouch-back's ceremony over the feed root alone (VouchedIn.md:35). */
    fun openCeremony(handle: String, name: String?, avatarUrl: String?)

    /** The deletion band, wearing [node] where a board registers it. */
    fun deletionBand(node: DataNode?): @Composable () -> Unit
}

/**
 * The shell's own state: the counts its readers answer and the link a
 * signed-out landing held through sign-in, saved with the shell. The join
 * prompt is held here too but never saved — a dialog that was up is a
 * transient, and a transient never comes back (design/readme.md §13).
 */
@Stable
internal class ShellState(
    feedPulls: Int = 0,
    reselects: IntArray = IntArray(TopLevelTab.entries.size),
    heldEmailLink: String? = null,
    heldAskLink: String? = null,
) {
    /** The feed's own pulls, counted: the readers riding the feed (the band, the vouch card) read again with each. */
    var feedPulls by mutableIntStateOf(feedPulls)

    /** Each tab's re-taps over its own root, by the tab's ordinal: the root answers each one not yet answered. */
    private val reselects = reselects.toList().toMutableStateList()

    /**
     * The new address's link opened signed out, held through the sign-in it
     * asks for (ChangeEmailLinkedSignedOut.md: "the sign-in screen opens
     * holding the link"); applied and landed once the session exists.
     */
    var heldEmailLink by mutableStateOf(heldEmailLink)

    /**
     * The ask link a guest raised the gate over, held through the sign-in the
     * gate asks for (VouchAsk.md:23: "the ask comes back"); landed once the
     * session exists.
     */
    var heldAskLink by mutableStateOf(heldAskLink)

    /** The guest prompt is up (design.md §6): ask, never bounce. */
    var joinPrompt by mutableStateOf(false)

    fun reselects(tab: TopLevelTab): Int = reselects[tab.ordinal]

    /** The slot of [tab] tapped over the tab's own root. */
    fun reselect(tab: TopLevelTab) {
        reselects[tab.ordinal] += 1
    }

    companion object {
        val Saver: Saver<ShellState, Any> = listSaver(
            save = { listOf(it.feedPulls, it.reselects.toIntArray(), it.heldEmailLink, it.heldAskLink) },
            restore = { ShellState(it[0] as Int, it[1] as IntArray, it[2] as String?, it[3] as String?) },
        )
    }
}

/**
 * The shell as its destinations see it, rebuilt with each composition of
 * the shell so every slot reads the session as it stands now.
 */
internal class Shell(
    override val navController: NavHostController,
    override val authState: AuthStateViewModel,
    override val signedIn: Boolean?,
    private val state: ShellState,
    private val bellLit: Boolean,
    private val snackbar: SnackbarHostState,
    private val scope: CoroutineScope,
) : ShellScope {
    override fun reselects(tab: TopLevelTab): Int = state.reselects(tab)

    // The slots every destination that has them draws the same way, written
    // once here, where the session and the controller are in hand, rather
    // than copied into each destination.
    override val keyBanner: @Composable () -> Unit = {
        if (signedIn == true) {
            KeyRestoreBannerRoute(onRestoreActor = { navController.navigate(Restore) })
        }
    }

    // The band rides both sides of the session — the guest reading carries
    // the shell's one sign-in-or-join entry, which is why the slot and not
    // the screen owns that navigation. Nothing is drawn while the auth
    // state is still unknown: the two readings differ, and guessing puts
    // the wrong sentence on screen for a frame.
    override val borrowedViewBand: @Composable () -> Unit = {
        signedIn?.let { signed ->
            BorrowedViewBandRoute(
                signedIn = signed,
                onSignInOrJoin = { navController.navigate(Login) },
                refreshSignal = state.feedPulls,
            )
        }
    }

    // The vouch card, the feed's own first card (`VouchBack`): its act is the
    // stance face toward the voucher — the tap blooms the vouch-back pad over
    // the shell, the hold signs the gentle default, and a taken signing either
    // way opens the ceremony (VouchBack.md:11, VouchBackPad.md:33).
    override val vouchCard: @Composable () -> Unit = {
        if (signedIn == true) {
            VouchCardRoute(
                stance = { voucher ->
                    StanceControlRoute(
                        target = StanceTarget.Node(voucher.id),
                        testTagPrefix = "vouch_back",
                        targetLabel = "@${voucher.handle}",
                        node = VOUCH_CARD / "stance",
                        variant = vouchBackVariant(VOUCH_CARD / "stance" / "pad"),
                        lineFaceInk = MaterialTheme.colorScheme.onTertiaryContainer,
                        onTaken = {
                            openCeremony(voucher.handle, voucher.displayName, voucher.avatar?.url)
                        },
                    )
                },
                refreshSignal = state.feedPulls,
            )
        }
    }

    override val statusBanners: @Composable (Boolean, () -> Unit, ApplicationSurface) -> Unit =
        { restored, onConsumed, surface ->
            if (signedIn == true) {
                StatusBannersRoute(
                    actorRestoredResult = restored,
                    onActorRestoredResultConsumed = onConsumed,
                    onStartKeyCeremony = { navController.navigate(KeyCeremony) },
                    snackbarHostState = snackbar,
                    surface = surface,
                )
            }
        }

    override fun requireJoin() {
        state.joinPrompt = true
    }

    override fun onFeedPulled() {
        state.feedPulls += 1
    }

    override fun holdEmailLink(token: String?) {
        state.heldEmailLink = token
    }

    override fun holdAskLink(askLinkId: String?) {
        state.heldAskLink = askLinkId
    }

    override fun announce(line: String) {
        scope.launch { snackbar.showSnackbar(line) }
    }

    // THE BELL'S DOT: one state the whole shell shows, lit only on a root's
    // fresh load (FeedUnread.md) — each root reads it through its own entry's
    // `RootBellViewModel`; a guest has no list and no bell.
    override fun bellFor(from: String): BandBell? =
        BandBell(lit = bellLit, onOpen = { navController.navigate(Notifications(from)) }).takeIf { signedIn == true }

    // THE CEREMONY OPENS OVER THE FEED ROOT ALONE (VouchedIn.md:35): the
    // pad, the card or the profile it was signed from never come back on
    // Back, so the entry is pushed over Feed's root with the tab it was
    // signed in closed — whichever tab that was.
    override fun openCeremony(handle: String, name: String?, avatarUrl: String?) {
        navController.landOnFeedRoot(keepLeaving = false)
        navController.navigate(VouchedIn(handle, name?.takeIf { it.isNotBlank() } ?: handle, avatarUrl)) {
            launchSingleTop = true
        }
    }

    // The deletion band rides the signed-in reader's surfaces only: a
    // deletion is an account's, and a signed-out reader has none. It wears
    // the registered `feed.deletionBand` where the board draws it (the feed)
    // and its own tag elsewhere.
    override fun deletionBand(node: DataNode?): @Composable () -> Unit = {
        if (signedIn == true) {
            DeletionBandRoute(signedIn = true, refreshSignal = state.feedPulls, node = node)
        }
    }
}
