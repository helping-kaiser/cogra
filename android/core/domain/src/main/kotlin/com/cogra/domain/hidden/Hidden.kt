// What a hidden account is, to the device (hidden-actors packet §5.1), and the
// repository the hidden set reads and writes through. web's twin is
// `web/src/lib/hidden/hidden-set.ts`.

package com.cogra.domain.hidden

import com.cogra.domain.Outcome
import java.time.Instant

/** Who is hidden, as the menus name them and the sheet draws them. */
data class HiddenPerson(
    val id: String,
    /** Null for a deleted account, whose handle is never served (ER-G10). */
    val handle: String?,
    val displayName: String?,
    val avatarUrl: String?,
    /** A deleted account: the reserved disc and `Deleted account` (design digest item 56). */
    val redacted: Boolean,
) {
    /** Named by no handle: `Hide this account`, `This account is hidden` (`ActorChip.jsx:67`). */
    val nameless: Boolean get() = redacted || handle == null
}

/** One hidden account and when the reader hid it. */
data class HiddenEntry(val person: HiddenPerson, val hiddenAt: Instant)

/** Which comfort did not go through — what its row line's Retry asks again. */
enum class HiddenComfort { HIDE, UNHIDE, UNDO_HIDE, UNDO_UNHIDE }

/** A comfort that did not go through, standing on the row it was made from. */
data class HiddenFailure(val kind: HiddenComfort, val entry: HiddenEntry)

/** Whether the set has been read. */
enum class HiddenStatus { UNREAD, READING, READ, FAILED }

interface HiddenRepository {
    /** Every page of the reader's hidden accounts, newest first. */
    suspend fun hiddenActors(): Outcome<List<HiddenEntry>>

    /** `hideActor`: the moment the server holds. [at] restores an unhidden row's place. */
    suspend fun hideActor(actor: String, at: Instant?): Outcome<Instant>

    /** `unhideActor`; unhiding one not hidden is ok. */
    suspend fun unhideActor(actor: String): Outcome<Unit>
}

/** What the screens read: the set as the reader's acts left it, and the lines standing. */
data class HiddenView(
    val status: HiddenStatus = HiddenStatus.UNREAD,
    /** Most recently hidden first (SettingsHidden.md:11). */
    val entries: List<HiddenEntry> = emptyList(),
    /** By origin — the card, page or sheet row the gesture was made from. */
    val failures: Map<String, HiddenFailure> = emptyMap(),
) {
    private val ids: Set<String> by lazy { entries.mapTo(HashSet()) { it.person.id } }

    fun has(actor: String): Boolean = actor in ids

    val count: Int get() = entries.size

    fun failure(origin: String): HiddenFailure? = failures[origin]

    /**
     * Whether a row by [author] at [origin] leaves a list the hide reaches:
     * the person is hidden, unless a hide or its Undo made from that very row
     * did not go through — that row stands, carrying its line (design digest
     * item 55).
     */
    fun hides(author: String?, origin: String): Boolean =
        author != null && has(author) && failures[origin] == null
}
