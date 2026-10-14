// THE BELL'S DOT AND THE TWO READ MARKS (FeedUnread.md; notifications.md
// "Read state has two levels"; packet notifications-list §6.1, §6.4). web's
// twin is `web/src/lib/notifications/bell.ts` and `marks.ts`.
//
// One state for the whole shell, so every root band shows the same dot:
//
// - IT LIGHTS ONLY ON A FRESH ROOT LOAD. A root's own load asks the server
//   once ([freshRootLoad]) and the answer is the dot. Nothing listens in
//   between: an arrival while the reader sits on a root never lights it live,
//   and a return by back or the bar is not a fresh load — the root's
//   ViewModel survives on the back stack and does not load again.
// - IT CLEARS LOCALLY WHEN THE LIST OPENS ([listOpened]), at once.
//
// THE MARKS GO SILENTLY. Seeing has no surface: a mark that does not go
// through stays owed and is sent again at the next checkpoint (the list
// opening again), never shown. The pointer only moves forward on the server,
// so the latest `through` alone is kept; reads are a set, each sent until it
// lands.

package com.cogra.domain.notifications

import com.cogra.domain.Outcome
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NotificationBell @Inject constructor(private val repository: NotificationsRepository) {
    private val litState = MutableStateFlow(false)

    /** Whether the bell's dot is lit. */
    val lit: StateFlow<Boolean> = litState.asStateFlow()

    private val sending = Mutex()
    private var owedThrough: Instant? = null
    private val owedReads = linkedSetOf<String>()

    /** A root loaded fresh: the server's answer is the dot. A failed ask changes nothing. */
    suspend fun freshRootLoad() {
        (repository.hasUnread() as? Outcome.Success)?.let { answer -> litState.value = answer.value == true }
    }

    /** The list opened: the dot goes at once, and whatever is still owed is sent. */
    suspend fun listOpened() {
        litState.value = false
        flush()
    }

    /** Everything at or before [through] — the newest row the opened list holds — is seen. */
    suspend fun markSeen(through: Instant) {
        sending.withLock {
            val owed = owedThrough
            owedThrough = if (owed == null || through.isAfter(owed)) through else owed
        }
        flush()
    }

    /** A row was opened. */
    suspend fun markRead(id: String) {
        sending.withLock { owedReads.add(id) }
        flush()
    }

    /** What the queue still owes, for tests. */
    fun owed(): Pair<Instant?, List<String>> = owedThrough to owedReads.toList()

    /** A checkpoint: send whatever is still owed. */
    suspend fun flush() {
        sending.withLock {
            owedThrough?.let { through ->
                val seen = repository.markSeen(through) is Outcome.Success
                owedThrough = owedThrough.takeUnless { seen && it == through }
            }
            for (id in owedReads.toList()) {
                if (repository.markRead(id) is Outcome.Success) owedReads.remove(id)
            }
        }
    }

    /** Forget the dot — a sign-out or an account switch. */
    fun reset() {
        litState.value = false
    }
}
