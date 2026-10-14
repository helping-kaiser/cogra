// Hidden accounts over settings (SettingsHidden.md; hidden-actors packet §5.4,
// §6), under Robolectric, bound to the registered `settings.people.hidden` and
// `settings.hiddenSheet.*` paths.

package com.cogra.feature.settings

import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.hidden.HiddenEntry
import com.cogra.domain.hidden.HiddenPerson
import com.cogra.domain.hidden.HiddenSet
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.RecordingHiddenRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class SettingsHiddenSheetTest {

    @get:Rule
    val compose = createComposeRule()

    private fun node(tag: String) = compose.onNodeWithTag(tag, useUnmergedTree = true)

    private fun top(tag: String): Float = node(tag).fetchSemanticsNode().positionInRoot.y

    private fun hiddenPerson(id: String, handle: String, name: String, at: String) =
        HiddenEntry(HiddenPerson(id, handle, name, avatarUrl = null, redacted = false), Instant.parse(at))

    /** The page under a hidden set holding [entries], read before the first frame. */
    private fun renderHidden(
        entries: List<HiddenEntry>,
        repository: RecordingHiddenRepository = RecordingHiddenRepository(),
    ): RecordingHiddenRepository {
        repository.served = Outcome.Success(entries)
        val store = HiddenSet(
            repository,
            FakeTokenStore().apply { tokens.value = AuthTokens("a", "r", "u1") },
            CoroutineScope(Dispatchers.Unconfined),
        )
        runBlocking { store.ensure() }
        compose.setContent {
            SettingsScreen(
                state = SettingsUiState(account = account(), actorKeyHere = true, now = NOW),
                versionName = "0.1.0",
                actions = SettingsActions(),
                doors = SettingsDoors(),
                hidden = store,
            )
        }
        return repository
    }

    /** The Unhide of the row keyed [handle]. */
    private fun unhideOf(handle: String) = compose.onNode(
        hasTestTag("settings.hiddenSheet.list.account.trailing.unhide") and
            hasAnyAncestor(hasTestTag("settings.hiddenSheet.list.account:$handle")),
        useUnmergedTree = true,
    )

    /** Settings.md:37-39 — with nobody hidden the row is inert and reads None. */
    @Test
    fun hiddenRowIsInertAndReadsNoneWhenNobodyIsHidden() {
        renderHidden(emptyList())
        node("settings.people.hidden").performScrollTo()
        node("settings.people.hidden.value").assertTextEquals("None")
        node("settings.people.hidden").performClick()
        node("settings.hiddenSheet").assertDoesNotExist()
    }

    /** SettingsHidden.md:3-17 — the count opens the sheet, rows newest first, no count in the title. */
    @Test
    fun aRowReadsNameHandleAndHiddenAgeWithUnhide() {
        renderHidden(
            listOf(
                hiddenPerson("j", "juno", "Juno Baptiste", "2026-10-10T12:00:00Z"),
                hiddenPerson("a", "ada", "Ada Okonkwo", "2026-09-29T12:00:00Z"),
            ),
        )
        node("settings.people.hidden").performScrollTo()
        node("settings.people.hidden.value").assertTextEquals("2")
        node("settings.people.hidden").performClick()
        compose.onNode(
            hasText("Hidden accounts") and hasAnyAncestor(hasTestTag("settings.hiddenSheet.title")),
            useUnmergedTree = true,
        ).assertExists()
        assertThat(top("settings.hiddenSheet.list.account:juno"))
            .isLessThan(top("settings.hiddenSheet.list.account:ada"))
        compose.onNode(
            hasText("Unhide") and hasAnyAncestor(hasTestTag("settings.hiddenSheet.list.account:juno")),
            useUnmergedTree = true,
        ).assertExists()
    }

    /** SettingsHidden.md:23, :27 — Unhide takes the row; the last one closes the sheet onto None. */
    @Test
    fun unhidingTheLastClosesOntoSettingsReadingNone() {
        val repository = renderHidden(listOf(hiddenPerson("j", "juno", "Juno Baptiste", "2026-10-10T12:00:00Z")))
        node("settings.people.hidden").performScrollTo()
        node("settings.people.hidden").performClick()
        unhideOf("juno").performClick()
        compose.waitForIdle()

        assertThat(repository.unhides).containsExactly("j")
        node("settings.hiddenSheet").assertDoesNotExist()
        node("settings.people.hidden.value").assertTextEquals("None")
    }
}
