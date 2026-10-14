package com.cogra.feature.notifications

import com.cogra.domain.AuthTokens
import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.notifications.Notification
import com.cogra.domain.notifications.NotificationActor
import com.cogra.domain.notifications.NotificationBell
import com.cogra.domain.notifications.NotificationKind
import com.cogra.domain.notifications.NotificationPage
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingHiddenRepository
import com.cogra.domain.testing.RecordingNotificationsRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.time.Instant

/** The list's reads and its two marks (Notifications.md:29, :31; PR-11's client half). */
@OptIn(ExperimentalCoroutinesApi::class)
class NotificationsViewModelTest {
    private val repository = RecordingNotificationsRepository()
    private val bell = NotificationBell(repository)
    private val newest = Instant.parse("2026-10-14T11:00:00Z")
    private val hidden = HiddenSet(
        RecordingHiddenRepository(),
        FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") },
        CoroutineScope(Dispatchers.Unconfined),
    )

    private fun model() = NotificationsViewModel(repository, bell, hidden)

    private fun row(id: String, at: Instant, handle: String = "ada") = Notification(
        id = id,
        kind = NotificationKind.COMMENT,
        createdAt = at,
        readAt = null,
        actor = NotificationActor("u-$handle", handle, ModeratedField(handle, FieldStatus.NORMAL), null),
        subject = null,
        context = null,
        pair = null,
        applicationId = null,
    )

    private fun serve(vararg rows: Notification) {
        repository.pages[null] = Outcome.Success(NotificationPage(rows.toList(), endCursor = null, hasNextPage = false))
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `opening the list clears the bell and marks the newest row seen`() = runTest {
        repository.bellAnswers += Outcome.Success(true)
        bell.freshRootLoad()
        serve(row("n1", newest), row("n2", newest.minusSeconds(60)))
        val model = model()
        assertThat(bell.lit.value).isFalse()
        assertThat(model.state.value.notifications.map { it.id }).containsExactly("n1", "n2").inOrder()
        assertThat(repository.seen).containsExactly(newest)
    }

    @Test
    fun `an empty list sends no mark`() = runTest {
        model()
        assertThat(repository.seen).isEmpty()
    }

    @Test
    fun `a tap clears its row and is marked read`() = runTest {
        serve(row("n1", newest))
        val model = model()
        model.opened(model.state.value.notifications.single())
        assertThat(model.state.value.opened).containsExactly("n1")
        assertThat(repository.reads).containsExactly("n1")
    }

    @Test
    fun `hiding someone elsewhere drops their rows from the held list`() = runTest {
        serve(row("n1", newest), row("n2", newest.minusSeconds(60), handle = "sol"))
        val model = model()
        model.resumed()
        // The reader hid @sol from a profile opened off a row; the server
        // drops the rows, and the list reads again on its return.
        serve(row("n1", newest))
        model.resumed()
        assertThat(model.state.value.notifications.map { it.id }).containsExactly("n1")
    }
}
