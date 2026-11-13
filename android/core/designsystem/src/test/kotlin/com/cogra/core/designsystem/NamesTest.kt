package com.cogra.core.designsystem

import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * The long-name law's mechanism (NamesLong.md; `nameInLine` / `nameInText`,
 * ActorChip.jsx). Widths are never asserted here (Robolectric measures text
 * near zero): the cut is tested through an injected measure, the drawing in
 * the conformance harness.
 */
@RunWith(RobolectricTestRunner::class)
class NamesTest {

    @get:Rule
    val compose = createComposeRule()

    private val longHandle = "@maximiliana_featherstone_haugh"

    /** Ten pixels a character, so a width is a count. */
    private val tenEach: (String) -> Int = { it.filterNot { c -> c == WORD_JOINER }.length * 10 }

    // NamesLong.md:7 — the handle standing in a one-line place is the part cut.
    @Test
    fun aLineWhoseWordsFollowTheHandleSplitsAroundIt() {
        assertThat(nameLine("$longHandle commented on your post"))
            .isEqualTo(NameLine("", longHandle, " commented on your post"))
        assertThat(nameLine("Through @ada · 3 hops")).isEqualTo(NameLine("Through ", "@ada", " · 3 hops"))
    }

    // NamesLong.md:9 — a line the handle ends clips at its end, untouched.
    @Test
    fun aLineTheHandleEndsOrThatNamesNobodyStaysOneText() {
        assertThat(nameLine("Hide $longHandle")).isNull()
        assertThat(nameLine("on $longHandle")).isNull()
        assertThat(nameLine(longHandle)).isNull()
        assertThat(nameLine("Gave an opinion")).isNull()
        assertThat(nameLine("Mail ada@example.com today")).isNull()
    }

    @Test
    fun theFirstHandleIsTheOneThatYields() {
        assertThat(nameLine("@ada and @mira agree")?.handle).isEqualTo("@ada")
    }

    // NamesLong.md:15 — trailing punctuation rides with the unit.
    @Test
    fun aUnitCarriesItsTrailingPunctuation() {
        val text = "Change your handle to $longHandle?"
        val unit = nameUnits(text).single()
        assertThat(text.substring(unit.start, unit.nameEnd)).isEqualTo(longHandle)
        assertThat(text.substring(unit.nameEnd, unit.end)).isEqualTo("?")
        val band = "Browsing from @noa's view"
        val owned = nameUnits(band).single()
        assertThat(band.substring(owned.nameEnd, owned.end)).isEqualTo("'s")
    }

    @Test
    fun aGivenNameIsAUnitAndEveryHandleIsOne() {
        val name = "Max Wilhelmina Featherstonehaugh Okonkwo-Lindqvist"
        val text = "$name invited you, and @ada approved."
        val units = nameUnits(text, listOf(name))
        assertThat(units.map { text.substring(it.start, it.nameEnd) }).containsExactly(name, "@ada").inOrder()
        assertThat(nameUnits("Mail ada@example.com")).isEmpty()
    }

    // NamesLong.md:13 — a unit never stands on two lines: no break opportunity inside it.
    @Test
    fun aJoinedUnitHasAWordJoinerBetweenEveryGrapheme() {
        assertThat(joined("@ab?")).isEqualTo("@${WORD_JOINER}a${WORD_JOINER}b${WORD_JOINER}?")
        assertThat(joined("Max W").filterNot { it == WORD_JOINER }).isEqualTo("Max W")
        assertThat(joined("Max W")).contains(" ${WORD_JOINER}W")
    }

    // NamesLong.md:15 — longer than a full line: cut at its end with "…", the punctuation kept.
    @Test
    fun aUnitPastAFullLineIsEndCutAndKeepsItsPunctuation() {
        val handle = "@" + "m".repeat(30)
        val text = "Change your handle to $handle?"
        val shown = shapeNamesInText(text, nameUnits(text), lineWidth = 200, widthOf = tenEach)
        val plain = shown.filterNot { it == WORD_JOINER }
        // 18 characters, the ellipsis and the `?` make the 200px line.
        assertThat(plain).isEqualTo("Change your handle to @" + "m".repeat(17) + "$ELLIPSIS?")
        assertThat(tenEach(plain.removePrefix("Change your handle to "))).isAtMost(200)
    }

    // NamesLong.md:17 — wrapping text is never ellipsized as a whole.
    @Test
    fun aUnitThatFitsALineIsOnlyJoinedAndTheWordsStayWhole() {
        val text = "$longHandle is hidden — their posts stay out of your feed."
        val shown = shapeNamesInText(text, nameUnits(text), lineWidth = 400, widthOf = tenEach)
        assertThat(shown.filterNot { it == WORD_JOINER }).isEqualTo(text)
        assertThat(shown).startsWith(joined(longHandle))
        assertThat(shapeNamesInText(text, nameUnits(text), lineWidth = null, widthOf = tenEach))
            .isEqualTo(shown)
    }

    @Test
    fun aCutThatFitsNotOneGraphemeLeavesTheEllipsis() {
        assertThat(cutName("@abc", "?", lineWidth = 15, widthOf = tenEach)).isEqualTo(ELLIPSIS)
    }

    @Test
    fun aSplitLineSpeaksItsWholeTextAndMarksTheHandle() {
        compose.setContent {
            Cogra2PreviewTheme {
                NameInLine("$longHandle commented on your post", Modifier.testTag("line"))
            }
        }
        compose.onNodeWithTag("line")
            .assertTextEquals("$longHandle commented on your post")
            .assert(SemanticsMatcher.expectValue(NameLineHandle, longHandle))
    }

    @Test
    fun aLineTheHandleEndsIsOneTextWithNoMark() {
        compose.setContent {
            Cogra2PreviewTheme { NameInLine("Hide $longHandle", Modifier.testTag("line")) }
        }
        compose.onNodeWithTag("line")
            .assertTextEquals("Hide $longHandle")
            .assert(SemanticsMatcher.keyNotDefined(NameLineHandle))
    }

    @Test
    fun wrappingTextSpeaksAsWrittenAndDrawsItsUnitsJoined() {
        val text = "$longHandle is hidden — their posts stay out of your feed."
        compose.setContent {
            Cogra2PreviewTheme { NameInText(text, Modifier.testTag("text")) }
        }
        val node = compose.onNodeWithTag("text").assertTextEquals(text).fetchSemanticsNode()
        val shown = node.config[NameInTextShown]
        assertThat(shown).contains(WORD_JOINER.toString())
        assertThat(shown.filterNot { it == WORD_JOINER }).isEqualTo(text)
        assertThat(node.config[SemanticsProperties.Text].single().text).isEqualTo(text)
    }

    @Test
    fun textNamingNobodyIsAPlainText() {
        compose.setContent {
            Cogra2PreviewTheme { NameInText("Nothing here names anyone.", Modifier.testTag("text")) }
        }
        compose.onNodeWithTag("text")
            .assertTextEquals("Nothing here names anyone.")
            .assert(SemanticsMatcher.keyNotDefined(NameInTextShown))
    }
}
