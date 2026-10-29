package com.cogra.core.designsystem.v2.atom

import androidx.annotation.StringRes
import androidx.compose.ui.graphics.vector.ImageVector
import com.cogra.core.designsystem.EMPTY_PICK_LABEL
import com.cogra.core.designsystem.SEVERED_LABEL

/** What fills a [ContentRow]'s disc, by the master's precedence. */
sealed interface ContentRowDisc {
    data class Glyph(val icon: ImageVector) : ContentRowDisc

    data class Picture(val url: Any, val name: String) : ContentRowDisc

    data class Monogram(val name: String) : ContentRowDisc

    /**
     * A stance's face where a picture would go, no digits (the chronicle's
     * opinion row) — `StanceValue` with `showPair={false}`. A row cannot tell a
     * walked-back `(0, 0)` from an empty-signed one by the numbers, so the data
     * says which: the bundle's own [severed] (`ContentRow`'s `face.severed`,
     * seam 245 ask 19). True speaks `Walked back`; absent or false, the
     * `(0, 0)` speaks `Says nothing` — an empty sign's.
     */
    data class Face(
        val directed: Double,
        val interest: Double,
        val severed: Boolean = false,
    ) : ContentRowDisc {
        /** The word a `(0, 0)` face speaks, from [severed]. */
        @get:StringRes
        val zeroLabel: Int get() = if (severed) SEVERED_LABEL else EMPTY_PICK_LABEL
    }

    /** 🤷 where a picture would go, for a stance walked back (the withdrawal notification). */
    data object WalkedBack : ContentRowDisc

    /**
     * A kind with no icon wears its letter (`ContentRow.jsx` `letter`): the `#`
     * every topic wears. [loud] is the door's filled disc, `primary` on
     * `onPrimary` — the one row that is an entrance rather than an entry.
     */
    data class Letter(val letter: String, val loud: Boolean = false) : ContentRowDisc

    /** A deleted account: the disc keeps its space and fills with nothing. */
    data object Redacted : ContentRowDisc
}
