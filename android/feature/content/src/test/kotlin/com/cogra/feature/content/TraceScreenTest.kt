// The score's trace, level by level — the sidecars compiled 1:1 (FeedEntry.md,
// FeedEntryKinds.md, FeedEntryMoved.md, RankPath.md, RankHop.md,
// RankRecords.md). The web's twin is `trace-view.test.tsx`. Assertions bind to
// the registered nodes; no width is ever asserted (Robolectric measures text
// near zero).

package com.cogra.feature.content

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.core.designsystem.LocalShowExactValues
import com.cogra.domain.score.TraceAnswer
import com.cogra.domain.score.TraceContext
import com.cogra.domain.score.TraceHeld
import com.cogra.domain.score.TraceOrigin
import com.cogra.domain.score.TraceThingKind
import com.cogra.domain.testing.TraceCast
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class TraceScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val opened = mutableListOf<TraceLevel>()
    private var unfolds = 0
    private var retries = 0

    private val postCover = TraceCover(
        kind = TraceThingKind.POST,
        title = "The long way home — @ada",
        snippet = "Took the coast road instead of the tunnel.",
        discName = "Ada Lindqvist",
        discSrc = null,
        markSrc = null,
        createdAt = TraceCast.POST_CREATED,
    )

    private fun args(
        level: TraceLevel = TraceLevel.Entry,
        origin: TraceOrigin = TraceOrigin.Feed,
        cover: TraceCover = postCover,
        kind: TraceThingKind = TraceThingKind.POST,
        settling: Boolean = false,
    ) = TraceArgs(TraceCast.POST_ID, kind, origin, settling, viewer = TraceCast.SOL.id, cover = cover, level = level)

    private fun answered(answer: TraceAnswer = TraceCast.ownAnswer(), borrowed: Boolean = false): TraceView {
        val viewer = if (borrowed) TraceCast.MIRA.id else TraceCast.SOL.id
        val context = TraceContext(
            viewer = viewer,
            borrowed = borrowed,
            named = TraceCast.NAMED,
            targetKind = TraceThingKind.POST,
            targetCreatedAt = TraceCast.POST_CREATED,
            now = TraceCast.NOW,
        )
        return TraceView.Answered(TraceHeld(viewer, answer, TraceCast.NAMED), context)
    }

    private fun render(view: TraceView, args: TraceArgs = args(), unfolded: Boolean = false, exact: Boolean = false) {
        compose.setContent {
            CompositionLocalProvider(LocalShowExactValues provides exact) {
                TraceScreen(
                    state = TraceUiState(view, unfolded),
                    args = args,
                    onBack = {},
                    onOpen = { opened += it },
                    onRetry = { retries += 1 },
                    onUnfold = { unfolds += 1 },
                )
            }
        }
    }

    private fun text(tag: String) = compose.onNodeWithTag(tag, useUnmergedTree = true)

    private fun inRow(row: String, part: String) = compose.onNodeIn(row, part, useUnmergedTree = true)

    // ── FeedEntry ────────────────────────────────────────────────────────

    @Test
    fun the_trace_lists_the_paths_strongest_first_each_stating_what_it_adds() {
        render(answered())
        listOf("+6.80", "+4.20", "+2.60", "+1.10").forEachIndexed { index, value ->
            inRow("feedEntry.path:${index + 1}", "feedEntry.path.value").assertTextEquals(value)
        }
        text("feedEntry.pathsLabel").assertTextEquals("Strongest first")
        inRow("feedEntry.path:1", "feedEntry.path.through").assertTextEquals("Through @ada")
        inRow("feedEntry.path:4", "feedEntry.path.through").assertTextEquals("Through @kel and @wren")
    }

    @Test
    fun every_path_starts_with_an_opinion_the_reader_gave() {
        render(answered())
        text("feedEntry.note").assertTextEquals("Every path here starts with an opinion you gave.")
        inRow("feedEntry.path:1", "feedEntry.path.trace")
            .assertContentDescriptionEquals("You, then @ada, then what reached you")
    }

    @Test
    fun a_borrowed_view_names_the_account_and_leads_every_trace_with_it() {
        render(answered(TraceCast.borrowedAnswer(), borrowed = true))
        text("feedEntry.note").assertTextEquals("Every path here starts with an opinion @mira gave.")
        inRow("feedEntry.path:1", "feedEntry.path.trace")
            .assertContentDescriptionEquals("@mira, then @ada, then what reached you")
    }

    @Test
    fun the_strongest_handful_stands_drawn_and_the_rest_ride_one_quiet_row() {
        render(answered())
        compose.onAllNodesWithTag("feedEntry.path:5").assertCountEquals(0)
        text("feedEntry.morePaths.label").assertTextEquals("2 more paths")
        text("feedEntry.morePaths.value").assertTextEquals("+0.50")
        compose.onNodeWithTag("feedEntry.morePaths").assertContentDescriptionEquals("Show 2 more paths")
    }

    @Test
    fun tap_morePaths_unfolds_the_weakest_paths_in_place_and_never_opens_a_page() {
        render(answered())
        // The quiet row stands under four path rows: brought into the viewport first.
        compose.onNodeWithTag("feedEntry.morePaths").performScrollTo().performClick()
        assertThat(unfolds).isEqualTo(1)
        assertThat(opened).isEmpty()
    }

    @Test
    fun unfolded_every_path_stands_and_the_quiet_row_is_gone() {
        render(answered(), unfolded = true)
        inRow("feedEntry.path:5", "feedEntry.path.value").assertTextEquals("+0.30")
        inRow("feedEntry.path:6", "feedEntry.path.value").assertTextEquals("+0.20")
        compose.onAllNodesWithTag("feedEntry.morePaths").assertCountEquals(0)
    }

    @Test
    fun the_drawn_paths_and_the_quiet_row_add_up_to_the_traces_own_score() {
        // The card wore 15.20; this live fetch found 14.70 — the trace sums to its own.
        val base = TraceCast.ownAnswer()
        val live = TraceAnswer(14.7, base.paths.mapIndexed { i, p -> if (i == 0) p.copy(contribution = 6.3) else p })
        render(answered(live))
        text("feedEntry.origin.flag.value").assertTextEquals("+14.70")
        val cents = (1..4).sumOf { cents(inRow("feedEntry.path:$it", "feedEntry.path.value")) } +
            cents(text("feedEntry.morePaths.value"))
        assertThat(cents).isEqualTo(1470L)
    }

    private fun cents(node: SemanticsNodeInteraction): Long {
        val shown = node.fetchSemanticsNode().config[SemanticsProperties.Text]
            .joinToString("") { it.text }
        return Math.round(shown.replace("−", "-").toDouble() * 100)
    }

    @Test
    fun a_path_row_opens_its_path() {
        render(answered())
        compose.onNodeWithTag("feedEntry.path:2").performClick()
        assertThat(opened).containsExactly(TraceLevel.Path(2))
    }

    @Test
    fun the_trace_carries_a_cover_of_the_thing_its_score_was_tapped_on() {
        render(answered())
        text("feedEntry.origin.quote.title").assertTextEquals("The long way home — @ada")
        text("feedEntry.origin.quote.snippet").assertTextEquals("Took the coast road instead of the tunnel.")
    }

    // ── FeedEntryKinds ───────────────────────────────────────────────────

    @Test
    fun the_top_block_wears_the_score_as_a_flag_its_glyph_and_its_signed_number() {
        render(answered())
        text("feedEntry.origin.flag.value").assertTextEquals("+15.20")
        compose.onNodeWithTag("feedEntry.origin.flag").assertContentDescriptionEquals("Feed score +15.20")
    }

    @Test
    fun the_top_block_names_a_person_by_name_over_handle_and_a_tag_beside_its_tile() {
        val person = TraceCover(TraceThingKind.PERSON, "Mira Okafor", "@mira", "Mira Okafor", null, null, null)
        render(answered(), args(kind = TraceThingKind.PERSON, cover = person))
        text("feedEntry.origin.quote.title").assertTextEquals("Mira Okafor")
        text("feedEntry.origin.quote.snippet").assertTextEquals("@mira")
    }

    @Test
    fun a_tags_top_block_is_its_name_beside_its_hash_tile() {
        render(answered(), args(kind = TraceThingKind.TOPIC, cover = topicCover("saltmaps")))
        text("feedEntry.origin.quote.title").assertTextEquals("#saltmaps")
        compose.onAllNodesWithTag("feedEntry.origin.quote.disc", useUnmergedTree = true).assertCountEquals(1)
        compose.onAllNodesWithTag("feedEntry.origin.quote.snippet", useUnmergedTree = true).assertCountEquals(0)
    }

    @Test
    fun the_back_arrow_reads_back_to_feed_given_the_score_was_tapped_on_a_feed_card() {
        render(answered())
        compose.onNodeWithTag("feedEntry.header.back").assertContentDescriptionEquals("Back to feed")
        text("feedEntry.header.title").assertTextEquals("Why this reached you")
    }

    @Test
    fun the_first_back_arrow_names_every_origin() {
        val cases = mapOf(
            TraceOrigin.Post("p1") to "Back to the post",
            TraceOrigin.Tag("saltmaps") to "Back to #saltmaps",
            TraceOrigin.History to "Back to History",
            TraceOrigin.Saved to "Back to Saved",
            TraceOrigin.OwnProfile to "Back to your profile",
            TraceOrigin.Profile("ada") to "Back to the profile",
        )
        val origin = mutableStateOf<TraceOrigin>(TraceOrigin.Feed)
        compose.setContent {
            TraceScreen(TraceUiState(answered()), args(origin = origin.value), {}, {}, {}, {})
        }
        cases.forEach { (from, label) ->
            origin.value = from
            compose.onNodeWithTag("feedEntry.header.back").assertContentDescriptionEquals(label)
        }
    }

    // ── FeedEntryMoved ───────────────────────────────────────────────────

    @Test
    fun a_trace_whose_fetch_finds_no_paths_reads_the_dash_and_the_moved_on_line() {
        render(answered(TraceAnswer(null, emptyList())))
        text("feedEntry.origin.flag.value").assertTextEquals("—")
        text("feedEntry.note").assertTextEquals("The paths that carried it here have moved on.")
        // NO ACTION, NO EMPTY STATE (FeedEntryMoved.md:11).
        compose.onAllNodesWithTag("feedEntry.path:1").assertCountEquals(0)
        compose.onAllNodesWithTag("feedEntry_retry").assertCountEquals(0)
    }

    @Test
    fun a_thing_still_settling_reads_the_dash_and_its_one_line() {
        render(TraceView.Settling, args(settling = true))
        text("feedEntry.origin.flag.value").assertTextEquals("—")
        text("feedEntry.note").assertTextEquals("Still settling — its paths count once it lands.")
        compose.onAllNodesWithTag("feedEntry.path:1").assertCountEquals(0)
    }

    @Test
    fun a_failed_read_says_so_under_a_cover_that_stands_and_never_substitutes_a_figure() {
        render(TraceView.Offline)
        text("feedEntry_fault").assertTextEquals("Can't reach the server. Check your connection and try again.")
        compose.onAllNodesWithTag("feedEntry.origin.flag.value", useUnmergedTree = true).assertCountEquals(0)
        text("feedEntry.origin.quote.title").assertTextEquals("The long way home — @ada")
        compose.onNodeWithTag("feedEntry_retry").performClick()
        assertThat(retries).isEqualTo(1)
    }

    @Test
    fun an_answer_that_is_an_error_reads_the_houses_line() {
        render(TraceView.Fault)
        text("feedEntry_fault").assertTextEquals("That didn't go through. Try again.")
    }

    // ── RankPath ─────────────────────────────────────────────────────────

    @Test
    fun the_paths_facts_stand_before_its_steps_and_no_step_carries_a_number() {
        render(answered(), args(level = TraceLevel.Path(1)))
        text("feedEntry.header.title").assertTextEquals("One path")
        compose.onNodeWithTag("feedEntry.header.back").assertContentDescriptionEquals("Back to the paths")
        text("feedEntry.adds.value").assertTextEquals("+6.80")
        text("feedEntry.newest.value").assertTextEquals("2h")
        text("feedEntry.stepsLabel").assertTextEquals("The steps")
        inRow("feedEntry.step:1", "feedEntry.step.title").assertTextEquals("Your opinion of @ada")
        inRow("feedEntry.step:1", "feedEntry.step.trailing").assertTextEquals("8d")
        inRow("feedEntry.step:2", "feedEntry.step.title").assertTextEquals("@ada published it")
        inRow("feedEntry.step:2", "feedEntry.step.trailing").assertTextEquals("2h")
        compose.onAllNodesWithTag("feedEntry.step.value", useUnmergedTree = true).assertCountEquals(0)
    }

    @Test
    fun a_step_opens_its_step() {
        render(answered(), args(level = TraceLevel.Path(1)))
        compose.onNodeWithTag("feedEntry_step_1_open").performClick()
        assertThat(opened).containsExactly(TraceLevel.Step(1, 1))
    }

    @Test
    fun a_borrowed_step_reads_in_the_third_person() {
        render(answered(TraceCast.borrowedAnswer(), borrowed = true), args(level = TraceLevel.Path(1)))
        inRow("feedEntry.step:1", "feedEntry.step.title").assertTextEquals("@mira's opinion of @ada")
    }

    // ── RankHop ──────────────────────────────────────────────────────────

    @Test
    fun the_step_states_its_folded_value_how_many_records_and_the_newest() {
        render(answered(), args(level = TraceLevel.Step(1, 1)))
        text("feedEntry.header.title").assertTextEquals("One step")
        compose.onNodeWithTag("feedEntry.header.back").assertContentDescriptionEquals("Back to the path")
        text("feedEntry.note").assertTextEquals("Your opinion of @ada — the first of this path's two steps.")
        text("feedEntry.behind.value").assertTextEquals("2 opinions")
        text("feedEntry.newest.value").assertTextEquals("8d")
        text("feedEntry.foldNote").assertTextEquals(
            "You have given @ada two opinions. They add up to one, and that one is what carries — " +
                "the same adding up the pad shows you as your current opinion.",
        )
    }

    @Test
    fun the_steps_value_is_its_face_alone_by_default() {
        render(answered(), args(level = TraceLevel.Step(1, 1)))
        compose.onAllNodesWithTag("feedEntry.carries.value.face", useUnmergedTree = true).assertCountEquals(1)
        compose.onAllNodesWithTag("feedEntry.carries.value.exact", useUnmergedTree = true).assertCountEquals(0)
    }

    @Test
    fun the_steps_value_shows_its_exact_pair_in_exact_mode() {
        render(answered(), args(level = TraceLevel.Step(1, 1)), exact = true)
        text("feedEntry.carries.value.exact").assertTextEquals("+0.55 / +0.20")
    }

    @Test
    fun tap_show_them_opens_the_signed_records_the_step_folds() {
        render(answered(), args(level = TraceLevel.Step(1, 1)))
        compose.onNodeWithTag("feedEntry.behind.action").performClick()
        assertThat(opened).containsExactly(TraceLevel.Records(1, 1))
    }

    @Test
    fun a_clipped_step_carries_the_limit_and_says_so() {
        render(answered(TraceCast.clippedAnswer()), args(level = TraceLevel.Step(1, 1)))
        text("feedEntry.foldNote").assert(
            SemanticsMatcher("ends on the limit") { node ->
                node.config[SemanticsProperties.Text].joinToString("") { it.text }
                    .endsWith("Added up, they go past the limit an opinion can reach, so the step carries the limit.")
            },
        )
    }

    // ── RankRecords ──────────────────────────────────────────────────────

    @Test
    fun the_records_open_under_a_line_naming_their_step_and_close_on_the_public_line() {
        render(answered(), args(level = TraceLevel.Records(1, 1)))
        text("feedEntry.header.title").assertTextEquals("What landed")
        compose.onNodeWithTag("feedEntry.header.back").assertContentDescriptionEquals("Back to the step")
        text("feedEntry.note").assertTextEquals("The two records behind your opinion of @ada.")
        text("feedEntry.closingNote")
            .assertTextEquals("These records are public. Anyone can run the same sum and land on the same number.")
    }

    @Test
    fun a_record_says_what_it_is_its_age_and_its_key_and_is_inert() {
        render(answered(), args(level = TraceLevel.Records(1, 1)))
        val first = "feedEntry.record:act:u-sol:0:opinion:u-ada"
        inRow(first, "feedEntry.record.what").assertTextEquals("Your opinion of @ada")
        inRow(first, "feedEntry.record.when").assertTextEquals("8d")
        inRow(first, "feedEntry.record.key").assertTextEquals("act:u-sol:0:opinion:u-ada")
        val older = "feedEntry.record:act:u-sol:1:opinion:u-ada"
        inRow(older, "feedEntry.record.when").assert(
            SemanticsMatcher("wears a date") { node ->
                node.config[SemanticsProperties.Text].joinToString("") { it.text }
                    .matches(Regex("\\d\\d\\.\\d\\d\\.\\d{4}"))
            },
        )
        // INERT, AND NO CONTROL COPIES THE KEY (RankRecords.md:13-15).
        compose.onNodeWithTag(first).assert(SemanticsMatcher.keyNotDefined(SemanticsActions.OnClick))
    }

    @Test
    fun records_past_the_limit_carry_the_line_under_them_and_the_raw_sum_in_exact_mode() {
        render(answered(TraceCast.clippedAnswer()), args(level = TraceLevel.Records(1, 1)), exact = true)
        text("feedEntry_clipped")
            .assertTextEquals("Added up, these go past the limit an opinion can reach, so the step carries the limit.")
        text("feedEntry_unclippedSum").assertTextEquals("+1.50 / +0.30 → +1.00 / +0.30")
    }
}
