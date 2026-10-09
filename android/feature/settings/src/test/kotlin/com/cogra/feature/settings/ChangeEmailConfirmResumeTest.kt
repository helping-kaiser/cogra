// The confirmation re-reads its change whenever it comes back on screen —
// the link's side lands in another app (the mail app, a browser), so a return
// is exactly when the change may have moved (jakob's hand test 2026-10-09).
// Driven by the activity's real lifecycle under Robolectric: stopped while
// the reader is away, resumed when they come back.

package com.cogra.feature.settings

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.lifecycle.Lifecycle
import com.cogra.domain.Outcome
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ChangeEmailConfirmResumeTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val settings = ScriptedSettings()

    private val exits = mutableListOf<String?>()

    private fun open() {
        val vm = ChangeEmailConfirmViewModel(settings)
        compose.setContent {
            ChangeEmailConfirmRoute(onBack = {}, onExit = { exits += it }, viewModel = vm)
        }
        compose.waitForIdle()
    }

    /** The reader leaves for the mail app and comes back. */
    private fun awayAndBack() {
        compose.activityRule.scenario.moveToState(Lifecycle.State.CREATED)
        compose.activityRule.scenario.moveToState(Lifecycle.State.RESUMED)
        compose.waitForIdle()
    }

    @Test
    fun `the arrival reads the change once`() {
        settings.read = Outcome.Success(account(pendingEmailChange = pending()))
        open()
        assertThat(settings.reads).isEqualTo(1)
        node("changeEmail.pair.linkSide").assertTextEquals("sol@ferreira.studio — still waiting")
    }

    @Test
    fun `coming back re-reads, and a link landed meanwhile reads confirmed`() {
        settings.read = Outcome.Success(account(pendingEmailChange = pending()))
        open()
        // The link was opened first; the code is still owed here.
        settings.read = Outcome.Success(account(pendingEmailChange = pending(linkConfirmed = true)))
        awayAndBack()
        assertThat(settings.reads).isEqualTo(2)
        node("changeEmail.pair.linkSide").assertTextEquals("sol@ferreira.studio — confirmed")
    }

    @Test
    fun `coming back to a change that finished meanwhile returns to settings`() {
        settings.read = Outcome.Success(account(pendingEmailChange = pending(codeConfirmed = true)))
        open()
        settings.read = Outcome.Success(account().copy(email = "sol@ferreira.studio"))
        awayAndBack()
        // Settings' Email row reads the outcome; the page says nothing over it.
        assertThat(exits).containsExactly(null)
    }

    private fun node(tag: String) = compose.onNodeWithTag(tag, useUnmergedTree = true)
}
