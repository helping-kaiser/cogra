package com.cogra.core.designsystem.v2.atom

import androidx.compose.material3.SnackbarData
import androidx.compose.material3.SnackbarVisuals
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import com.cogra.core.designsystem.CograSnackbar
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.NameLineHandle
import com.cogra.core.designsystem.NameUnits
import com.cogra.core.designsystem.NodeSnackbarVisuals
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The shared atoms carry the long-name law (NamesLong.md; readme §13): each
 * one-line master passes its text through `nameInLine`, each wrapping master
 * through `nameInText`. Geometry is the conformance harness's claim; these pin
 * that every atom routes its words through the mechanism, at the board's
 * longest legal handle.
 */
@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class AtomNamesTest {

    @get:Rule
    val compose = createComposeRule()

    private val handle = "@maximiliana_featherstone_haugh"

    private fun splitsAt(yielding: String) = SemanticsMatcher.expectValue(NameLineHandle, yielding)

    private fun unitsAre(vararg units: String) = SemanticsMatcher.expectValue(NameUnits, units.toList())

    // NamesLong.md:7 — Notifications' row: the handle is cut, the act stays whole.
    @Test
    fun aRowTitleWhoseWordsFollowTheHandleCutsTheHandle() {
        compose.setContent {
            Cogra2PreviewTheme {
                ContentRow(
                    title = "$handle commented on your post",
                    disc = ContentRowDisc.Monogram("Max"),
                    testTag = "row",
                    node = DataNode("notifications.list.row"),
                )
            }
        }
        compose.onNodeWithTag("notifications.list.row.title")
            .assertTextEquals("$handle commented on your post")
            .assert(splitsAt(handle))
    }

    // NamesLong.md:5,7 — a page title the words follow (`@x · Opinions`).
    @Test
    fun aPageTitleWhoseWordsFollowTheHandleCutsTheHandle() {
        compose.setContent {
            Cogra2PreviewTheme { PageHeader(title = "$handle · Opinions", onBack = {}, testTag = "header") }
        }
        compose.onNodeWithTag("header_title")
            .assertTextEquals("$handle · Opinions")
            .assert(splitsAt(handle))
    }

    // NamesLong.md:11,13,15 — the dialog's title and body.
    @Test
    fun aDialogsTitleAndBodyKeepTheHandleOneUnit() {
        compose.setContent {
            Cogra2PreviewTheme {
                DialogSurface(
                    title = "Change your handle to $handle?",
                    paragraphs = listOf("Links to $handle stop working the moment it changes."),
                    onScrimPress = {},
                    node = DataNode("changeHandle.dialog"),
                    actions = { CograButton("Keep it", {}, testTag = "keep") },
                )
            }
        }
        compose.onNodeWithTag("changeHandle.dialog.title").assert(unitsAre("$handle?"))
        compose.onNodeWithText("Links to $handle stop working the moment it changes.").assert(unitsAre(handle))
    }

    // NamesLong.md:11,13 — FeedHidden's snackbar.
    @Test
    fun aSnackbarKeepsTheHandleOneUnit() {
        val message = "$handle is hidden — their posts stay out of your feed."
        compose.setContent {
            Cogra2PreviewTheme {
                CograSnackbar(StaticSnackbar(NodeSnackbarVisuals(message, DataNode("feed.snackbar"))))
            }
        }
        compose.onNodeWithTag("feed.snackbar.message").assertTextEquals(message).assert(unitsAre(handle))
    }

    // NamesLong.md:11 — the borrowed-view band's line, its `'s` riding with the handle.
    @Test
    fun theBorrowedViewBandKeepsTheHandleOneUnit() {
        compose.setContent {
            Cogra2PreviewTheme {
                BorrowedViewBand(
                    handle = handle.drop(1),
                    line = "Browsing from $handle's view — join to build your own.",
                )
            }
        }
        compose.onNodeWithTag("borrowed_view_line").assert(unitsAre("$handle's"))
    }

    @Test
    fun aQuotedRowsTitleKeepsTheHandleOneUnit() {
        compose.setContent {
            Cogra2PreviewTheme { QuotedRow(title = "The long way home — $handle", node = DataNode("kept.quote")) }
        }
        compose.onNodeWithTag("kept.quote.title").assert(unitsAre(handle))
    }

    @Test
    fun aSettingsRowsStatusKeepsTheHandleOneUnit() {
        compose.setContent {
            Cogra2PreviewTheme {
                SettingsRow(
                    label = "Handle",
                    kind = SettingsRowKind.Inert,
                    status = "Mentioned as $handle.",
                    node = DataNode("settings.handle"),
                )
            }
        }
        compose.onNodeWithTag("settings.handle.status").assert(unitsAre("$handle."))
    }

    // `Report @x?` (the profile menu's confirm sheet).
    @Test
    fun aSheetTitleKeepsTheHandleOneUnit() {
        compose.setContent {
            Cogra2PreviewTheme { SheetTitle(text = "Report $handle?", modifier = Modifier.testTag("sheet_title")) }
        }
        compose.onNodeWithText("Report $handle?").assert(unitsAre("$handle?"))
    }

    // A notice (`No opinions by @x yet.`).
    @Test
    fun anEmptyStateKeepsTheHandleOneUnit() {
        compose.setContent {
            Cogra2PreviewTheme { EmptyState(testTag = "empty", title = "No opinions by $handle yet.") }
        }
        // `yet.` — the stop is the sentence's, not the handle's.
        compose.onNodeWithTag("empty").assert(unitsAre(handle))
    }

    @Test
    fun aQuietNoteKeepsTheHandleOneUnit() {
        compose.setContent {
            Cogra2PreviewTheme {
                QuietNote("Every path here starts with an opinion $handle gave.", Modifier.testTag("note"))
            }
        }
        compose.onNodeWithTag("note").assert(unitsAre(handle))
    }

    /** A shown snackbar, for drawing the atom outside a host. */
    private class StaticSnackbar(override val visuals: SnackbarVisuals) : SnackbarData {
        override fun performAction() = Unit

        override fun dismiss() = Unit
    }
}
