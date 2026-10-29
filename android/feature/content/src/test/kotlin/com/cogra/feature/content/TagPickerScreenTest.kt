// The tag picker's drawn laws (behavior/TagPicker.md, TagPickerTyping.md,
// TagPickerRefused.md), compiled line by line against the screen over a given
// state. What a gesture does to the state is `PickerEditorsTest`'s; here a
// gesture is the handler it calls. web's twin is `tag-picker.test.tsx`.

package com.cogra.feature.content

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performTextInput
import com.cogra.domain.topics.TagNameRefusal
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class TagPickerScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val handlers = RecordingTagPicker()

    private fun render(
        query: String,
        tags: List<String> = emptyList(),
        index: TagIndexAnswer? = null,
        origin: PickerOrigin = PickerOrigin.Post,
    ) {
        val section = TagSectionState(
            tags = tags.map { TagRow(it) },
            picker = TagPickerState(query = query, index = index),
        )
        compose.setContent { TagPicker(section, origin, handlers) }
    }

    private fun row(name: String) = compose.onNodeWithTag("tagPicker.tag:$name")

    private fun announced(words: String) = compose.onNodeWithTag("tagPicker.announcement", useUnmergedTree = true)
        .assert(hasContentDescription(words))

    // -- TagPicker.md --

    /** ALWAYS the list's first row is the canonicalized typed name GIVEN the typed name is a legal tag name. */
    @Test
    fun theFirstRowIsTheTypedNameCanonicalized() {
        render("#SaltMaps", index = TagIndexAnswer("saltmaps", listOf("saltmaps", "saltmapping")))
        row("saltmaps").assertExists()
        compose.onNodeWithTag("tagPicker.tag:saltmapping").assertExists()
    }

    /** ALWAYS a staged tag stands only in the staged section above the list. */
    @Test
    fun aStagedTagStandsOnlyInTheStagedSection() {
        render(
            "salt",
            tags = listOf("salt", "saltmarsh"),
            index = TagIndexAnswer("salt", listOf("saltmarsh", "saltmaps")),
        )
        row("salt").assertDoesNotExist()
        row("saltmarsh").assertDoesNotExist()
        row("saltmaps").assertExists()
        compose.onNodeWithTag("tagPicker.staged.tag:salt").assertExists()
        compose.onNodeWithTag("tagPicker.staged.tag:saltmarsh").assertExists()
    }

    /** WHEN press the action key GIVEN a legal name -> the first row is staged AND the move is said; it stays open. */
    @Test
    fun theActionKeyStagesTheFirstRowAndSaysSo() {
        render("Salt")
        compose.onNodeWithTag("tagPicker.nameField.input").performImeAction()
        assertThat(handlers.calls).containsExactly("stage:salt")
        announced(PICK_ADDED)
    }

    /** WHEN press the action key GIVEN the name is refused -> NEVER a tag is staged AND the refusal stays. */
    @Test
    fun theActionKeyOnARefusedNameStagesNothing() {
        render("salt maps")
        compose.onNodeWithTag("tagPicker.nameField.input").performImeAction()
        assertThat(handlers.calls).isEmpty()
        compose.onNodeWithTag("tagPicker.refusal").assertExists()
    }

    /** WHEN tap a row in the list -> it is staged AND the move is announced AND NEVER the picker closes. */
    @Test
    fun aTappedRowIsStagedAndSaid() {
        render("salt", index = TagIndexAnswer("salt", listOf("saltcrust")))
        row("saltcrust").performClick()
        assertThat(handlers.calls).containsExactly("stage:saltcrust")
        announced(PICK_ADDED)
    }

    /** WHEN tap the remove control of a staged row -> it is unstaged AND the move is announced. */
    @Test
    fun aStagedRowsCrossUnstagesItAndSaysSo() {
        render("", tags = listOf("saltflats"))
        compose.onNodeWithTag("tagPicker.staged.tag.remove").assert(hasContentDescription("Remove saltflats"))
            .performClick()
        assertThat(handlers.calls).containsExactly("unstage:saltflats")
        announced(PICK_REMOVED)
    }

    /** WHEN tap Done / press the header back -> the picker closes AND NEVER a staged tag is unstaged. */
    @Test
    fun doneAndTheHeaderBackAreOneLeave() {
        render("salt", tags = listOf("saltflats"))
        compose.onNodeWithTag("tagPicker.done").performClick()
        compose.onNodeWithTag("tagPicker.header.back").performClick()
        assertThat(handlers.calls).containsExactly("close", "close")
    }

    /** ALWAYS the back arrow reads Back to the post from a post's composer, Back to the comment from a reply's. */
    @Test
    fun theArrowNamesTheComposerItReturnsTo() {
        render("")
        compose.onNodeWithContentDescription("Back to the post").assertExists()
    }

    @Test
    fun fromACommentTheArrowNamesTheComment() {
        render("", origin = PickerOrigin.Comment)
        compose.onNodeWithContentDescription("Back to the comment").assertExists()
    }

    /** WHEN the picker opens -> tagPicker.nameField takes focus AND the keyboard rises. */
    @Test
    fun theNameFieldTakesFocus() {
        render("")
        compose.onNodeWithTag("tagPicker.nameField.input").assertIsFocused()
    }

    /** ALWAYS tagPicker.cap reads Up to 10 tags per post. GIVEN ten tags; every row is dimmed and takes no tap. */
    @Test
    fun atTheCapTheLineStandsAndEveryRowIsStill() {
        val ten = (1..10).map { "t$it" }
        render("salt", tags = ten, index = TagIndexAnswer("salt", listOf("saltmaps")))
        compose.onNodeWithTag("tagPicker.cap").assertTextEquals("Up to 10 tags per post.")
        row("salt").assertIsNotEnabled()
        row("saltmaps").assertIsNotEnabled()
        // WHEN press the keyboard's action key GIVEN ten tags -> NEVER a tag is staged.
        compose.onNodeWithTag("tagPicker.nameField.input").performImeAction()
        // WHEN tap the remove control of a staged row GIVEN ten tags -> it is unstaged.
        compose.onNodeWithTag("tagPicker.staged.tag:t1").assertExists()
        assertThat(handlers.calls).isEmpty()
    }

    @Test
    fun fromACommentTheCapSaysPerComment() {
        render("salt", tags = (1..10).map { "t$it" }, origin = PickerOrigin.Comment)
        compose.onNodeWithTag("tagPicker.cap").assertTextEquals("Up to 10 tags per comment.")
    }

    /** Below the cap no line stands and the rows take taps. */
    @Test
    fun belowTheCapNoLineStands() {
        render("salt", tags = listOf("t1"))
        compose.onNodeWithTag("tagPicker.cap").assertDoesNotExist()
        row("salt").performClick()
        assertThat(handlers.calls).containsExactly("stage:salt")
    }

    /** WHEN the candidates' read gets no answer -> the typed name's row stays first AND the noun line over Retry. */
    @Test
    fun aFaultLeavesTheTypedNameAndPutsTheLineOverRetry() {
        render("salt", index = TagIndexAnswer("salt", failed = true))
        row("salt").assertExists()
        compose.onNodeWithTag("tagPicker.fault").assertExists()
        compose.onNodeWithTag("tagPicker.fault.retry").performClick()
        assertThat(handlers.calls).containsExactly("retry")
    }

    @Test
    fun theFaultLineIsTheNounFormNeverTryAgain() {
        assertThat(TAG_PICKER_FAULT).isEqualTo("Can't reach the server — tags can't load right now.")
        assertThat(TAG_PICKER_FAULT).doesNotContain("try again")
    }

    /** ALWAYS no line stands where the candidates are GIVEN the read is in flight or found nothing. */
    @Test
    fun aReadInFlightStandsSilent() {
        render("salt")
        compose.onNodeWithTag("tagPicker.fault").assertDoesNotExist()
        row("salt").assertExists()
    }

    @Test
    fun aReadThatFoundNothingStandsSilent() {
        render("salt", index = TagIndexAnswer("salt"))
        compose.onNodeWithTag("tagPicker.fault").assertDoesNotExist()
        row("salt").assertExists()
    }

    // -- TagPickerTyping.md --

    /** The first row's second line is Signs as #name; the rule line stands under the field. */
    @Test
    fun theFirstRowSignsAsAndTheRuleStands() {
        render("#SaltMaps")
        compose.onNodeWithTag("tagPicker.tag.sub", useUnmergedTree = true).assertTextEquals("Signs as #saltmaps")
        compose.onNodeWithTag("tagPicker.rule").assertTextEquals(TAG_NAME_RULE)
        compose.onNodeWithTag("tagPicker.refusal").assertDoesNotExist()
    }

    /** WHEN typing -> the first row follows the name; the status message never speaks the typing. */
    @Test
    fun typingFollowsTheNameAndSaysNothing() {
        render("salt")
        compose.onNodeWithTag("tagPicker.footnote").assertTextEquals(TAG_PICKER_FOOTNOTE)
        assertThat(handlers.calls).isEmpty()
    }

    // -- TagPickerRefused.md --

    /** The error ring and the charset refusal in the rule's place; no first row; an empty list. */
    @Test
    fun aCharacterNoNameMayCarryIsRefusedAtTheField() {
        render("#salt maps", index = TagIndexAnswer("salt", listOf("saltmaps")))
        compose.onNodeWithTag("tagPicker.nameField.input")
            .assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Error))
        compose.onNodeWithTag("tagPicker.refusal").assertTextEquals(TagNameRefusal.CHARSET.words())
        compose.onNodeWithTag("tagPicker.rule").assertDoesNotExist()
        compose.onNodeWithTag("tagPicker.tag:salt").assertDoesNotExist()
        compose.onNodeWithTag("tagPicker.tag:saltmaps").assertDoesNotExist()
    }

    /** A letter outside the ASCII atom (`café`) names no Type: the charset refusal, nothing to stage. */
    @Test
    fun aNonAsciiNameIsRefused() {
        render("café")
        compose.onNodeWithTag("tagPicker.refusal").assertTextEquals(TagNameRefusal.CHARSET.words())
        compose.onNodeWithTag("tagPicker.nameField.input").performImeAction()
        assertThat(handlers.calls).isEmpty()
    }

    /** WHEN typing -> the raw text is reported as typed; the canonical form is the row's, not the field's. */
    @Test
    fun typingReportsTheRawText() {
        render("")
        compose.onNodeWithTag("tagPicker.nameField.input").performTextInput("Rust")
        assertThat(handlers.calls).containsExactly("query:Rust")
    }

    @Test
    fun aNamePastTheAtomIsTheLengthRefusal() {
        render("a".repeat(129))
        compose.onNodeWithTag("tagPicker.refusal").assertTextEquals("A tag name is at most 128 characters.")
    }

    /** WHEN tap Done GIVEN a refused name -> the picker closes AND NEVER the refused name adds a tag. */
    @Test
    fun leavingWithARefusedNameAddsNothing() {
        render("#salt maps")
        compose.onNodeWithTag("tagPicker.done").performClick()
        assertThat(handlers.calls).containsExactly("close")
    }

    /** The one "?" is named by the dialog it opens. */
    @Test
    fun theHelpIsTagging() {
        render("")
        compose.onNodeWithTag("tagPicker.header.help").assert(hasContentDescription("Tagging")).performClick()
        compose.onNodeWithTag("picker_help_tagging").assertExists()
    }
}
