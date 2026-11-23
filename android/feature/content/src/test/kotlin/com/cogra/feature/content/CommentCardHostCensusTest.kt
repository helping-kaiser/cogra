// THE HOST CENSUS OF THE COMMENT CARD (jakob 2026-11-23, seam 405: the pointer's
// door holds "on every surface that draws the card"). The card is drawn only
// through `ListCommentCard`, which owns the pointer's door, so no host can wire
// it otherwise; and the files that call it are exactly [CommentCardHost]'s
// hosts, each of which [CommentPointerDoorTest] taps. A file that starts drawing
// the card fails here until it joins the census — and so the door's tests.

package com.cogra.feature.content

import com.google.common.truth.Truth.assertThat
import com.google.common.truth.Truth.assertWithMessage
import org.junit.Test
import java.io.File

class CommentCardHostCensusTest {

    private val sources = File("src/main/kotlin").walkTopDown().filter { it.extension == "kt" }.toList()

    private fun filesCalling(name: String) =
        sources.filter { Regex("""\b$name\(""").containsMatchIn(it.readText()) }.map { it.name }

    @Test
    fun theCardIsDrawnOnlyThroughTheListedCommentCard() {
        assertThat(sources).isNotEmpty()
        assertThat(filesCalling("CommentFeedCard")).containsExactly("CommentFeedCard.kt", "CardList.kt")
    }

    @Test
    fun theFilesThatDrawTheCardAreTheCensusHosts() {
        // A profile's Comments tab and a tag's page both stand on HostedCards.
        assertThat(filesCalling("ListCommentCard") - "CardList.kt")
            .containsExactly("FeedScreen.kt", "HistoryScreen.kt", "SavedScreen.kt", "HostedCards.kt")
        assertThat(CommentCardHost.entries.map { it.name })
            .containsExactly("FEED", "HISTORY", "SAVED", "PROFILE", "TAG_PAGE")
    }

    @Test
    fun noHostWiresThePointersDoorItself() {
        sources.filter { it.name != "CommentFeedCard.kt" && it.name != "CardList.kt" }.forEach {
            assertWithMessage(it.name).that(it.readText()).doesNotContain("onOpenTarget")
        }
    }
}
