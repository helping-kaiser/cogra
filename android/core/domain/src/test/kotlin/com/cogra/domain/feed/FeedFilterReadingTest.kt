// THE TRIGGER'S READING, compiled from the sidecars' trigger lines
// (FeedNarrowed.md, FeedTopic.md, FeedFar.md, FeedNothing.md, FeedSheet.md)
// — line for line the web twin's cases (`web/src/lib/feed/feed-filter.test.ts`),
// so both clients speak one reading.

package com.cogra.domain.feed

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class FeedFilterReadingTest {

    private val default = FeedFilter.DEFAULT
    private val saltmaps = FeedTopic("t", "saltmaps")

    @Test
    fun `the default is the drawn sheet's value, Ranked first (FeedSheet md 43)`() {
        assertThat(default).isEqualTo(
            FeedFilter(
                kinds = setOf(FeedKind.POST),
                topic = null,
                forms = setOf(FeedForm.TEXT, FeedForm.PHOTOS, FeedForm.VIDEO),
                order = FeedOrder.RANKED,
                people = PeopleScope.EVERYONE,
                peopleSign = PeopleSign.EITHER,
                showSeen = false,
                showSensitive = false,
                showRemoved = false,
                stillSettling = true,
            ),
        )
    }

    @Test
    fun `the ranker is sent its kinds and the topic's id and nothing else`() {
        assertThat(default.copy(topic = saltmaps, order = FeedOrder.NEWEST).rankArgs)
            .isEqualTo(FeedRankArgs(setOf(FeedKind.POST), "t"))
    }

    @Test
    fun `reads Posts at the default with no default of the reader's own (FeedNarrowed md 3)`() {
        assertThat(feedFilterSummary(default)).isEqualTo("Posts")
    }

    @Test
    fun `spells the deviations out while they fit 154 (FeedNarrowed md 7)`() {
        val narrowed = default.copy(forms = setOf(FeedForm.PHOTOS), order = FeedOrder.NEWEST)
        assertThat(feedFilterSummary(narrowed)).isEqualTo("Posts · photos · newest")
        assertThat(measureTriggerText("Posts · photos · newest")).isAtMost(BAND_CEILING_PX)
    }

    @Test
    fun `collapses the deviations past its kinds to a count when they do not fit (FeedNarrowed md 9)`() {
        val far = default.copy(
            forms = setOf(FeedForm.PHOTOS, FeedForm.VIDEO),
            order = FeedOrder.NEWEST,
            showSeen = true,
            stillSettling = false,
        )
        assertThat(feedFilterSummary(far)).isEqualTo("Posts · 4 changes")
    }

    @Test
    fun `reads settled only among its deviations with Still settling off (FeedNarrowed md 11)`() {
        assertThat(feedFilterSummary(default.copy(stillSettling = false))).isEqualTo("Posts · settled only")
    }

    @Test
    fun `names the topic by the tag's own name, leading the extras (FeedTopic md 3)`() {
        assertThat(feedFilterSummary(default.copy(topic = saltmaps))).isEqualTo("Posts · #saltmaps")
        assertThat(feedFilterSummary(default.copy(topic = saltmaps, order = FeedOrder.NEWEST)))
            .isEqualTo("Posts · 2 changes")
    }

    @Test
    fun `collapses a topic too wide for the pill with the extras, the kinds kept (FeedTopic md 5-7)`() {
        val wide = default.copy(topic = FeedTopic("t", "a".repeat(60)), order = FeedOrder.NEWEST)
        assertThat(feedFilterSummary(wide)).isEqualTo("Posts · 2 changes")
    }

    @Test
    fun `names one kind or counts the kinds that are on (FeedFar md 3-5)`() {
        assertThat(feedFilterSummary(default.copy(kinds = setOf(FeedKind.COMMENT)))).isEqualTo("Comments")
        assertThat(feedFilterSummary(default.copy(kinds = setOf(FeedKind.POST, FeedKind.COMMENT))))
            .isEqualTo("2 kinds")
        assertThat(feedFilterSummary(default.copy(kinds = FeedKind.entries.toSet()))).isEqualTo("All kinds")
        val far = default.copy(
            kinds = setOf(FeedKind.POST, FeedKind.COMMENT, FeedKind.PROFILE),
            forms = setOf(FeedForm.PHOTOS),
            order = FeedOrder.NEWEST,
            showSeen = true,
            stillSettling = false,
        )
        assertThat(feedFilterSummary(far)).isEqualTo("3 kinds · 4 changes")
    }

    @Test
    fun `reads Nothing with every kind off (FeedNothing md 3)`() {
        assertThat(feedFilterSummary(default.copy(kinds = emptySet()))).isEqualTo("Nothing")
    }

    @Test
    fun `reads your people, for — and collapses against past the budget (FeedSheet md 71, PR-42)`() {
        val yours = default.copy(people = PeopleScope.YOUR_PEOPLE)
        assertThat(feedFilterSummary(yours)).isEqualTo("Posts · your people")
        assertThat(feedFilterSummary(yours.copy(peopleSign = PeopleSign.FOR))).isEqualTo("Posts · your people, for")
        assertThat(feedFilterSummary(yours.copy(peopleSign = PeopleSign.AGAINST))).isEqualTo("Posts · 1 change")
    }

    @Test
    fun `speaks no sign kept under Everyone (FeedSheet md 27)`() {
        assertThat(feedFilterSummary(default.copy(peopleSign = PeopleSign.AGAINST))).isEqualTo("Posts")
    }

    @Test
    fun `reads the borrowed view's account's people (FeedSheet md, GIVEN the feed borrows a view)`() {
        assertThat(feedFilterSummary(default.copy(people = PeopleScope.YOUR_PEOPLE), default, "mira"))
            .isEqualTo("Posts · @mira's people")
    }

    @Test
    fun `speaks only the deviations from the READER's default, back toward the app's included (FeedSheet md 65-69)`() {
        val readers = default.copy(order = FeedOrder.NEWEST, showSeen = true, showSensitive = true)
        assertThat(feedFilterSummary(readers, readers)).isEqualTo("Posts")
        // The app's own default, read against that reader's: each axis's state.
        assertThat(feedFilterSummary(default, readers)).isEqualTo("Posts · 3 changes")
        assertThat(feedFilterSummary(readers.copy(order = FeedOrder.RANKED), readers)).isEqualTo("Posts · ranked")
        assertThat(feedFilterSummary(readers.copy(showSeen = false), readers)).isEqualTo("Posts · hiding seen")
        assertThat(feedFilterSummary(readers.copy(showSensitive = false), readers))
            .isEqualTo("Posts · hiding sensitive")
        val photosOnly = default.copy(forms = setOf(FeedForm.PHOTOS))
        assertThat(feedFilterSummary(default, photosOnly)).isEqualTo("Posts · all forms")
        val settledOnly = default.copy(stillSettling = false)
        assertThat(feedFilterSummary(default, settledOnly)).isEqualTo("Posts · + still settling")
    }

    @Test
    fun `joins the also chips switched on past the default to the + list`() {
        assertThat(feedFilterSummary(default.copy(showSensitive = true))).isEqualTo("Posts · + sensitive")
        assertThat(feedFilterSummary(default.copy(showSensitive = true, showRemoved = true)))
            .isEqualTo("Posts · 1 change")
    }

    @Test
    fun `an unfamiliar glyph measures as the widest, so it collapses early and never overflows`() {
        assertThat(measureTriggerText("é")).isEqualTo(measureTriggerText("@"))
        assertThat(measureTriggerText("")).isEqualTo(0.0)
    }
}
