// Saved's search: the one Explore rule over the saved set — web's twin is
// `saved-search.test.ts`, case for case.

package com.cogra.domain.saved

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class SavedSearchTest {

    private val post = Searchable.Post("ada", "The long way home", listOf("coastroad"))
    private val untitled = Searchable.Post("ada", null, emptyList())
    private val comment = Searchable.Comment("tobias", "The long way home", listOf("glovebox"))
    private val person = Searchable.Person("mira", "Mira Voss")

    private fun hit(item: Searchable, query: String) = matches(item, parseSavedQuery(query))

    @Test
    fun a_blank_query_narrows_nothing() {
        assertThat(parseSavedQuery("   ")).isEqualTo(SavedQuery.Blank)
        assertThat(hit(post, "")).isTrue()
        assertThat(hit(comment, "  ")).isTrue()
    }

    @Test
    fun only_a_leading_sigil_is_a_scope() {
        assertThat(parseSavedQuery("  @ada  long way "))
            .isEqualTo(SavedQuery.Scoped(tag = false, name = "ada", remainder = "long way"))
        assertThat(parseSavedQuery("#salt")).isEqualTo(SavedQuery.Scoped(tag = true, name = "salt", remainder = null))
        assertThat(parseSavedQuery("long @ada")).isEqualTo(SavedQuery.Unscoped("long @ada"))
    }

    @Test
    fun a_post_matches_by_title_word_the_last_as_a_prefix() {
        assertThat(hit(post, "long")).isTrue()
        assertThat(hit(post, "way ho")).isTrue()
        assertThat(hit(post, "LONG WAY")).isTrue()
        assertThat(hit(post, "lon way")).isFalse()
        assertThat(hit(post, "short way")).isFalse()
    }

    @Test
    fun an_untitled_post_is_never_matched_by_its_stand_in() {
        assertThat(hit(untitled, "ada")).isFalse()
        assertThat(hit(untitled, "pictures")).isFalse()
    }

    @Test
    fun a_comment_is_never_matched_unscoped() {
        assertThat(hit(comment, "long way")).isFalse()
        assertThat(hit(comment, "tobias")).isFalse()
    }

    @Test
    fun a_person_matches_by_handle_or_display_name_substring() {
        assertThat(hit(person, "mir")).isTrue()
        assertThat(hit(person, "voss")).isTrue()
        assertThat(hit(person, "a vo")).isTrue()
        assertThat(hit(person, "honey")).isFalse()
    }

    @Test
    fun a_query_with_no_word_matches_no_title() {
        assertThat(titleMatches("The long way home", "—")).isFalse()
    }

    @Test
    fun a_bare_handle_narrows_to_the_people_whose_handle_starts_with_it() {
        assertThat(hit(person, "@mi")).isTrue()
        assertThat(hit(post, "@ada")).isFalse()
        assertThat(hit(comment, "@tobias")).isFalse()
        assertThat(hit(person, "@voss")).isFalse()
        assertThat(hit(person, "@")).isFalse()
    }

    @Test
    fun the_remainder_matches_their_posts_by_title() {
        assertThat(hit(post, "@ada long")).isTrue()
        assertThat(hit(post, "@ADA long")).isTrue()
        assertThat(hit(post, "@tobias long")).isFalse()
    }

    @Test
    fun a_comment_matches_through_its_thread_root_title() {
        assertThat(hit(comment, "@tobias way home")).isTrue()
        assertThat(hit(comment, "@ada way home")).isFalse()
    }

    @Test
    fun the_persons_own_card_never_answers_a_content_search() {
        assertThat(hit(person, "@mira voss")).isFalse()
    }

    @Test
    fun a_bare_tag_matches_nothing_because_a_tag_is_never_saved() {
        assertThat(hit(post, "#coastroad")).isFalse()
        assertThat(hit(comment, "#glovebox")).isFalse()
        assertThat(hit(person, "#mira")).isFalse()
    }

    @Test
    fun the_remainder_matches_carried_posts_by_title_and_carried_comments_through_their_target() {
        assertThat(hit(post, "#coastroad long")).isTrue()
        assertThat(hit(post, "#CoastRoad long")).isTrue()
        assertThat(hit(comment, "#glovebox home")).isTrue()
        assertThat(hit(post, "#glovebox long")).isFalse()
        assertThat(hit(comment, "#glovebox short")).isFalse()
    }

    @Test
    fun a_name_no_tag_can_carry_scopes_to_nothing() {
        assertThat(hit(post, "##coastroad long")).isFalse()
    }
}
