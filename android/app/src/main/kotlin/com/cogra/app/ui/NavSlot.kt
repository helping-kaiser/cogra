package com.cogra.app.ui

import androidx.annotation.StringRes
import com.cogra.app.R

/**
 * A slot in the shell's bottom bar, in the order the master draws them
 * (`design/components/navigation/BottomNav.jsx`). The enum is the whole
 * five-slot vocabulary, and V1.0 renders all five (`BottomNav.jsx`: readme
 * §13, *The V1.0 scope cut*): the wallet's opens its coming-soon door.
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
