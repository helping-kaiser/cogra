// The hidden set's law (hidden-actors packet §5.1): read whole, newest first;
// a hide or unhide answers at the tap and reverts on failure, its line on the
// row it was made from; one write in flight per actor, the last intent wins;
// an account change drops everything. web's twin is `hidden-set.test.ts`.

package com.cogra.domain.hidden

import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingHiddenRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Test
import java.io.IOException
import java.time.Instant

@OptIn(ExperimentalCoroutinesApi::class)
class HiddenSetTest {

    private val ada = HiddenPerson("a", "ada", "Ada", avatarUrl = null, redacted = false)
    private val juno = HiddenPerson("j", "juno", "Juno", avatarUrl = null, redacted = false)
    private val session = FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") }

    private fun entry(person: HiddenPerson, at: String) = HiddenEntry(person, Instant.parse(at))

    private fun kotlinx.coroutines.test.TestScope.store(repository: RecordingHiddenRepository) =
        HiddenSet(repository, session, backgroundScope).also {
            it.now = { Instant.parse("2026-10-13T12:00:00Z") }
            runCurrent()
        }

    @Test
    fun theSetIsReadWholeMostRecentlyHiddenFirst() = runTest {
        val repository = RecordingHiddenRepository().apply {
            served = Outcome.Success(listOf(entry(ada, "2026-10-01T00:00:00Z"), entry(juno, "2026-10-05T00:00:00Z")))
        }
        val hidden = store(repository)
        assertThat(hidden.ensure()).isTrue()
        assertThat(hidden.view.value.entries.map { it.person.id }).containsExactly("j", "a").inOrder()
        assertThat(hidden.view.value.status).isEqualTo(HiddenStatus.READ)
        // A set already read answers at once.
        assertThat(hidden.ensure()).isTrue()
        assertThat(repository.reads).isEqualTo(1)
    }

    @Test
    fun aFailedFirstReadHidesNobodyAndSaysSo() = runTest {
        val repository = RecordingHiddenRepository().apply { served = Outcome.Failed(IOException("down")) }
        val hidden = store(repository)
        assertThat(hidden.ensure()).isFalse()
        assertThat(hidden.view.value.status).isEqualTo(HiddenStatus.FAILED)
        assertThat(hidden.view.value.has("a")).isFalse()
    }

    @Test
    fun aHideJoinsTheSetAtTheTapAndHoldsTheServersMoment() = runTest {
        val repository = RecordingHiddenRepository()
        val hidden = store(repository)
        hidden.ensure()
        hidden.hide(ada, origin = "post-1")
        assertThat(hidden.view.value.has("a")).isTrue()
        runCurrent()
        assertThat(repository.hides).containsExactly("a" to null)
        assertThat(hidden.view.value.entries.single().hiddenAt).isEqualTo(repository.hiddenAt)
    }

    @Test
    fun aFailedHideRevertsAndItsOriginRowSaysSoRetryAskingAgain() = runTest {
        val repository = RecordingHiddenRepository().apply {
            hideAnswers.addLast(Outcome.Failed(IOException("down")))
        }
        val hidden = store(repository)
        hidden.ensure()
        hidden.hide(ada, origin = "post-1")
        runCurrent()

        assertThat(hidden.view.value.has("a")).isFalse()
        assertThat(hidden.view.value.failure("post-1")?.kind).isEqualTo(HiddenComfort.HIDE)
        assertThat(hidden.view.value.failure("post-2")).isNull()
        hidden.retry("post-1")
        runCurrent()
        assertThat(hidden.view.value.has("a")).isTrue()
        assertThat(hidden.view.value.failure("post-1")).isNull()
        assertThat(repository.hides).hasSize(2)
    }

    @Test
    fun anUndoTappedWhileTheHideIsInFlightGoesAfterItAndTheNewestIntentWins() = runTest {
        val repository = RecordingHiddenRepository()
        val hidden = store(repository)
        hidden.ensure()
        hidden.hide(ada, origin = "post-1")
        val shown = hidden.view.value.entries.single()
        hidden.unhide(shown, origin = "post-1", kind = HiddenComfort.UNDO_HIDE)
        hidden.hide(ada, origin = "post-1")
        hidden.unhide(shown, origin = "post-1", kind = HiddenComfort.UNDO_HIDE)
        assertThat(hidden.view.value.has("a")).isFalse()
        runCurrent()
        assertThat(repository.hides.map { it.first }).containsExactly("a")
        assertThat(repository.unhides).containsExactly("a")
        assertThat(hidden.view.value.has("a")).isFalse()
    }

    @Test
    fun anUndoOfAnUnhidePutsTheRowBackWithItsOldAge() = runTest {
        val old = entry(juno, "2026-08-12T09:00:00Z")
        val repository = RecordingHiddenRepository().apply { served = Outcome.Success(listOf(old)) }
        val hidden = store(repository)
        hidden.ensure()
        hidden.unhide(old, origin = "j")
        runCurrent()
        assertThat(hidden.view.value.count).isEqualTo(0)

        hidden.hide(juno, origin = "j", at = old.hiddenAt, kind = HiddenComfort.UNDO_UNHIDE)
        runCurrent()
        assertThat(hidden.view.value.entries.single().hiddenAt).isEqualTo(old.hiddenAt)
        assertThat(repository.hides).containsExactly("j" to old.hiddenAt)
    }

    @Test
    fun aFreshReadClearsTheLinesAndLetsTheReadSpeak() = runTest {
        val repository = RecordingHiddenRepository().apply {
            hideAnswers.addLast(Outcome.Failed(IOException("down")))
        }
        val hidden = store(repository)
        hidden.ensure()
        hidden.hide(ada, origin = "post-1")
        runCurrent()
        repository.served = Outcome.Success(listOf(entry(ada, "2026-10-12T00:00:00Z")))
        hidden.refetch()
        assertThat(hidden.view.value.failure("post-1")).isNull()
        assertThat(hidden.view.value.has("a")).isTrue()
    }

    @Test
    fun theHiddenSetBelongsToTheSignedInAccount() = runTest {
        val repository = RecordingHiddenRepository().apply {
            served = Outcome.Success(listOf(entry(juno, "2026-08-12T09:00:00Z")))
        }
        val hidden = store(repository)
        hidden.ensure()
        runCurrent()
        session.tokens.value = AuthTokens("b", "r", "u2")
        runCurrent()
        assertThat(hidden.view.value.count).isEqualTo(0)
        assertThat(hidden.view.value.status).isEqualTo(HiddenStatus.UNREAD)
    }
}
