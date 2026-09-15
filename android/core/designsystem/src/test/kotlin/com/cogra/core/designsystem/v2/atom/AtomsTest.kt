package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertTouchHeightIsEqualTo
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** The 2.0 atoms' interactive branches and their accessibility guarantees. */
@RunWith(RobolectricTestRunner::class)
class AtomsTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun aChipAnnouncesSelectionRatherThanOnlyDrawingIt() {
        compose.setContent {
            Cogra2PreviewTheme {
                Column {
                    CograChip("Tall 4:5", selected = true, onClick = {}, testTag = "tall")
                    CograChip("Square 1:1", selected = false, onClick = {}, testTag = "square")
                }
            }
        }

        // Colour never carries meaning alone (design/readme.md §10).
        compose.onNodeWithTag("tall").assertIsSelected()
        compose.onNodeWithTag("square").assertIsNotSelected()
    }

    @Test
    fun aChipsRemoveAffordanceIsSeparatelyReachable() {
        var removed = false
        compose.setContent {
            Cogra2PreviewTheme {
                CograChip("#coastroad", selected = true, onRemove = { removed = true }, testTag = "topic")
            }
        }

        compose.onNodeWithTag("topic_remove").performClick()

        assertThat(removed).isTrue()
    }

    @Test
    fun everyChipClearsTheMinimumTouchTarget() {
        compose.setContent {
            Cogra2PreviewTheme {
                CograChip("Square 1:1", onClick = {}, testTag = "square")
            }
        }

        // Drawn at 32dp, tapped at 48dp — the target is expanded by hit area
        // rather than by growing the ink, so it is the touch bounds that
        // carry the guarantee.
        compose.onNodeWithTag("square").assertTouchHeightIsEqualTo(48.dp)
    }

    @Test
    fun aReadoutChipIsNotAControl() {
        compose.setContent {
            Cogra2PreviewTheme {
                CograReadoutChip("#fieldnotes", testTag = "tag")
            }
        }

        // The readout tone states a signed fact rather than offering one to
        // press (Chip.jsx's READOUT: no press, no state layer, no target).
        // The label lives on the inner Text node, not merged onto the outer
        // Box the test tag sits on, so the assertion targets the label text
        // directly rather than the tagged container.
        compose.onNodeWithTag("tag").assert(hasClickAction().not())
        compose.onNodeWithText("#fieldnotes").assertExists()
    }

    @Test
    fun aCompactPillStillClearsTheMinimumTouchTarget() {
        compose.setContent {
            Cogra2PreviewTheme {
                CograButton("Next", {}, size = ButtonSize.Compact, testTag = "next")
            }
        }

        compose.onNodeWithTag("next").assertTouchHeightIsEqualTo(48.dp)
    }

    @Test
    fun aDisabledPillDoesNotFire() {
        var clicked = false
        compose.setContent {
            Cogra2PreviewTheme {
                CograButton("Next", { clicked = true }, enabled = false, testTag = "next")
            }
        }

        compose.onNodeWithTag("next").assertIsNotEnabled().performClick()

        assertThat(clicked).isFalse()
    }

    @Test
    fun theWizardHeaderWiresItsTwoWaysOut() {
        var back = false
        var left = false
        compose.setContent {
            Cogra2PreviewTheme {
                WizardHeader(
                    title = "New post",
                    onBack = { back = true },
                    backContentDescription = "Back",
                    onLeave = { left = true },
                    testTag = "header",
                )
            }
        }

        compose.onNodeWithTag("header_back").performClick()
        compose.onNodeWithTag("header_leave").performClick()

        assertThat(back).isTrue()
        assertThat(left).isTrue()
    }

    @Test
    fun theHeaderCarriesNoForwardActionOnAnyStage() {
        // The forward action lives at the bottom of the stage, so the
        // top-right corner means one thing — leave — for the whole flow.
        // It used to mean Next on the early stages, and an author trained
        // on that corner left the flow by reaching for it
        // (jakob 2026-09-01).
        compose.setContent {
            Cogra2PreviewTheme {
                Column(Modifier.width(390.dp)) {
                    WizardHeader(title = "Crop", onBack = {}, onLeave = {}, testTag = "header")
                }
            }
        }

        compose.onNodeWithTag("header_action").assertDoesNotExist()
        compose.onNodeWithText("Next").assertDoesNotExist()
    }

    @Test
    fun theLeaveControlKeepsTheCornerWhateverTheTitle() {
        compose.setContent {
            Cogra2PreviewTheme {
                Column(Modifier.width(390.dp)) {
                    WizardHeader(title = "Crop", onBack = {}, onLeave = {}, testTag = "header")
                }
            }
        }

        // Nothing actionable follows the X, so a short title must not pull
        // it back toward the middle: the corner is what the author aims at.
        val header = compose.onNodeWithTag("header").getUnclippedBoundsInRoot()
        val leave = compose.onNodeWithTag("header_leave").getUnclippedBoundsInRoot()
        assertThat((header.right - leave.right).value).isWithin(TOLERANCE).of(0f)
    }

    @Test
    fun theSealsTrailingNoteIsANoteRatherThanAControl() {
        compose.setContent {
            Cogra2PreviewTheme {
                WizardHeader(title = "What you sign", onBack = {}, trailingNote = "Last step")
            }
        }

        // Wizard screens carry no step numbers; the seal carries this instead.
        compose.onNodeWithText("Last step").assertExists()
        compose.onNodeWithTag("wizard_action").assertDoesNotExist()
    }

    @Test
    fun thePageHeadersBackTargetIsReachableAtTheMinimumSize() {
        var back = false
        compose.setContent {
            Cogra2PreviewTheme {
                Column(Modifier.width(390.dp)) {
                    PageHeader(
                        title = "Join",
                        onBack = { back = true },
                        testTag = "header",
                    )
                }
            }
        }

        // 12dp of padding plus a centred glyph in a 48dp target — the
        // master's arithmetic, so the arrow lands on the 24dp screen
        // gutter without depending on the caller for anything.
        compose.onNodeWithTag("header_back").assertTouchHeightIsEqualTo(48.dp).performClick()

        assertThat(back).isTrue()
    }

    @Test
    fun aPageHeaderWithNoWayBackDrawsNoArrow() {
        // Every entry board draws the arrow, but the signed-out root has
        // nothing behind it — and an arrow that pops nothing exits the app.
        compose.setContent {
            Cogra2PreviewTheme {
                PageHeader(title = "Sign in", onBack = null, testTag = "header")
            }
        }

        compose.onNodeWithTag("header_back").assertDoesNotExist()
    }

    @Test
    fun theBandCarriesTheWordmarkAndNoScreenTitle() {
        compose.setContent {
            Cogra2PreviewTheme {
                Column(Modifier.width(390.dp)) {
                    CograBand(onChats = {}, testTag = "band")
                }
            }
        }

        compose.onNodeWithTag("band_wordmark").assertTextEquals("cogra")
        compose.onNodeWithTag("band_chats").assertTouchHeightIsEqualTo(48.dp)
    }

    @Test
    fun aBandWithoutMessagingDrawsNoChatsControl() {
        compose.setContent {
            Cogra2PreviewTheme {
                CograBand(onChats = null, testTag = "band")
            }
        }

        compose.onNodeWithTag("band_chats").assertDoesNotExist()
    }

    @Test
    fun theBorrowedViewBandNamesTheVantagePoint() {
        compose.setContent {
            Cogra2PreviewTheme {
                Column(Modifier.width(390.dp)) {
                    BorrowedViewBand(
                        handle = "mira",
                        displayName = "Mira Voss",
                        line = "Browsing from @mira's view — join to build your own.",
                        actionLabel = "Sign in or join",
                        onAction = {},
                        testTag = "borrowed",
                    )
                }
            }
        }

        // The label is what makes borrowed ranking honest (§9): the band
        // always says whose view this is.
        compose.onNodeWithTag("borrowed_line")
            .assertTextEquals("Browsing from @mira's view — join to build your own.")
        compose.onNodeWithTag("borrowed_action").assertExists()
    }

    @Test
    fun theSignedInApplicantsBandOffersNoWayIn() {
        compose.setContent {
            Cogra2PreviewTheme {
                Column(Modifier.width(390.dp)) {
                    BorrowedViewBand(
                        handle = "mira",
                        line = "Browsing from @mira's view while your application lands.",
                        testTag = "borrowed",
                    )
                }
            }
        }

        // The line changes but the vantage point does not; the reader is
        // already in, so the entry drops away.
        compose.onNodeWithTag("borrowed_action").assertDoesNotExist()
    }

    @Test
    fun anOptionalFieldSaysSoInItsAccessibleName() {
        compose.setContent {
            Cogra2PreviewTheme {
                CograTextField(
                    value = "",
                    onValueChange = {},
                    label = "Title",
                    optional = true,
                    testTag = "title",
                )
            }
        }

        // "Title, optional" rather than two unrelated fragments.
        compose.onNodeWithTag("title").assertExists()
        compose.onNodeWithText("Optional").assertExists()
    }

    // THE LATE COUNTER (design/components/forms/TextField.jsx:85-92): silent
    // outside the window, "N left" at the boundary, "N over" past the cap.
    @Test
    fun aFieldsCounterIsSilentOutsideItsWindow() {
        // Title's cap is 100, floor-driven: max(20, round(100/10)) = 20.
        assertThat(fieldCountReading("a".repeat(79), cap = 100)).isNull()
        // Description's cap is 500, tenth-driven: max(20, round(500/10)) = 50.
        assertThat(fieldCountReading("a".repeat(449), cap = 500)).isNull()
    }

    @Test
    fun aFieldsCounterAppearsAtTheExactWindowBoundary() {
        assertThat(fieldCountReading("a".repeat(80), cap = 100))
            .isEqualTo(FieldCountReading("20 left", over = false))
        assertThat(fieldCountReading("a".repeat(450), cap = 500))
            .isEqualTo(FieldCountReading("50 left", over = false))
    }

    @Test
    fun aFieldsCounterFlipsToOverPastItsCap() {
        // The board's own fixture: 507 of 500 reads "7 over"
        // (design/designs/canonical/screens/ComposeDetailsCaps.jsx:14-19).
        assertThat(fieldCountReading("a".repeat(507), cap = 500))
            .isEqualTo(FieldCountReading("7 over", over = true))
    }

    @Test
    fun aFieldsCounterCountsScalarValuesNotCodeUnits() {
        // An astral emoji is two UTF-16 code units and one scalar value.
        val value = "🎉".repeat(96) // 96 scalar values, cap 100 -> 4 left
        assertThat(value.length).isEqualTo(192)
        assertThat(fieldCountReading(value, cap = 100))
            .isEqualTo(FieldCountReading("4 left", over = false))
    }

    @Test
    fun usedOverridesTheArithmeticForATailFixture() {
        assertThat(fieldCountReading("only the tail", cap = 500, used = 507))
            .isEqualTo(FieldCountReading("7 over", over = true))
    }

    @Test
    fun aFieldWithNoCapShowsNoCounter() {
        compose.setContent {
            Cogra2PreviewTheme {
                CograTextField(value = "anything", onValueChange = {}, label = "Title", testTag = "title")
            }
        }

        compose.onNodeWithTag("title_count").assertDoesNotExist()
    }

    @Test
    fun aFieldOverItsCapShowsTheCountAndTheAtomsOwnErrorState() {
        compose.setContent {
            Cogra2PreviewTheme {
                CograTextField(
                    value = "a".repeat(105),
                    onValueChange = {},
                    label = "Title",
                    cap = 100,
                    error = "Too long — at most 100 characters.",
                    testTag = "title",
                )
            }
        }

        compose.onNodeWithTag("title_count").assertTextEquals("5 over")
        compose.onNodeWithTag("title_error").assertTextEquals("Too long — at most 100 characters.")
    }

    @Test
    fun aFieldCarriesNoLengthLimitSoTypingPastTheCapIsNeverTruncated() {
        compose.setContent {
            Cogra2PreviewTheme {
                var value by remember { mutableStateOf("") }
                CograTextField(
                    value = value,
                    onValueChange = { value = it },
                    label = "Title",
                    cap = 100,
                    testTag = "title",
                )
            }
        }

        compose.onNodeWithTag("title").performTextInput("a".repeat(105))
        // De-truncation: nothing in the atom bounds the value's length, so
        // the drawn "N over" state is reachable rather than unreachable
        // behind a native input limit.
        compose.onNodeWithTag("title_count").assertTextEquals("5 over")
    }

    @Test
    fun aSettingRowsActionFires() {
        var changed = false
        compose.setContent {
            Cogra2PreviewTheme {
                SettingRow(
                    label = "License",
                    value = "Public domain — your default",
                    actionText = "Change",
                    onAction = { changed = true },
                    testTag = "license",
                )
            }
        }

        compose.onNodeWithTag("license_action").performClick()

        assertThat(changed).isTrue()
    }

    @Test
    fun anInlineActionIsReachableAtTheMinimumTarget() {
        var clicked = false
        compose.setContent {
            Cogra2PreviewTheme {
                InlineAction("Write words instead", { clicked = true }, testTag = "words")
            }
        }

        compose.onNodeWithTag("words").assertTouchHeightIsEqualTo(48.dp).performClick()

        assertThat(clicked).isTrue()
    }

    @Test
    fun aStackedOverflowMenuStillOpensAndActsOnItsRows() {
        // The tonal rung is pinned directly in SheetContainerColorTest
        // (design/readme.md:2364); this only guards that `stacked` never
        // breaks the menu's own behaviour.
        var selected = false
        compose.setContent {
            Cogra2PreviewTheme {
                CograOverflowMenu(
                    items = listOf(MenuRow("License terms", "row_license") { selected = true }),
                    contentDescription = "More on this comment",
                    testTag = "comment_menu",
                    stacked = true,
                )
            }
        }

        compose.onNodeWithTag("comment_menu").performClick()
        compose.onNodeWithTag("comment_menu_sheet").assertExists()
        compose.onNodeWithTag("row_license").performClick()

        assertThat(selected).isTrue()
    }

    @Test
    fun theWayBackTakesTheDialogsEmphasisRatherThanTheDiscard() {
        compose.setContent {
            Cogra2PreviewTheme {
                DiscardConfirm(
                    subject = DiscardSubject.Reply,
                    onKeepWriting = {},
                    onDiscard = {},
                    testTag = "discard",
                )
            }
        }

        // Material composes `dismissButton` before `confirmButton`, and the
        // confirm slot is the filled, last-drawn one. The board puts the way
        // back there, so the answer this dialog exists to slow down cannot
        // hold the heaviest control on the screen.
        val buttons = compose.onAllNodes(
            hasClickAction() and hasAnyAncestor(hasTestTag("discard")),
        )
        buttons[0].assert(hasTestTag("discard_discard"))
        buttons[1].assert(hasTestTag("discard_keep"))
    }
}

/** Layout arithmetic lands on whole pixels, not whole dp. */
private const val TOLERANCE = 1f
