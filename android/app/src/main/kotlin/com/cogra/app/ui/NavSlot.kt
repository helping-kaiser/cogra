package com.cogra.app.ui

import androidx.annotation.StringRes
import com.cogra.app.R

/**
 * A slot in the shell's bottom bar, in the order the master draws them
 * (`design/components/navigation/BottomNav.jsx`). The enum is the whole
 * five-slot vocabulary; which of them a build renders is [ShippingSlots]'s
 * business, because **a slot arrives with the slice that builds its
 * surface**.
 *
 * [Search] reads "Explore" rather than its route's name: `design.md` §7 keeps
 * implementation vocabulary off the screen, and "Explore" says what the
 * reader is doing — discovery through the people they are connected to,
 * rather than a global index.
 */
enum class NavSlot(@param:StringRes val label: Int) {
    Feed(R.string.bar_feed),
    Search(R.string.bar_explore),
    Compose(R.string.bar_compose),
    Wallet(R.string.bar_wallet),
    Profile(R.string.bar_profile),
}

/**
 * The slots whose surfaces exist today. Explore waits for slice 2.7's search
 * backend — jakob ruled 2026-09-09 that no surface is built against the
 * exact-match lookup before it — and the wallet waits for its own surfaces.
 * Neither is drawn as a dead slot: a bar item that opens nothing teaches the
 * reader the bar lies.
 */
val ShippingSlots: List<NavSlot> = listOf(NavSlot.Feed, NavSlot.Compose, NavSlot.Profile)
