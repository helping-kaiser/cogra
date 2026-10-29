package com.cogra.feature.profile

import com.cogra.core.designsystem.v2.atom.ContentRowDisc
import com.cogra.crypto.Family
import com.cogra.domain.RecordAbout
import com.cogra.domain.RecordAct
import com.cogra.domain.RecordOpinion
import com.cogra.domain.RecordRow
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The chronicle's verbs, one per family it lists (copy-voice, the profile;
 * round 22, seam 245 ask 10), read from the record's own `act` (#324).
 */
class ChronicleVerbsTest {

    private fun row(
        family: Family,
        act: RecordAct = RecordAct.ORDINARY,
        about: RecordAbout? = null,
        handle: String? = null,
        untag: Boolean = false,
        opinion: RecordOpinion? = null,
    ) = RecordRow(
        id = "r",
        family = family,
        genesis = act == RecordAct.GENESIS,
        snippet = null,
        link = null,
        opinion = opinion,
        targetHandle = handle,
        act = act,
        about = about,
        untag = untag,
    )

    private val face = RecordOpinion(0.4, 0.3, severed = false)

    @Test
    fun theFirstRegistrationReadsJoinedAndLaterOnesUpdateTheProfile() {
        assertThat(verbOf(row(Family.REGISTRATION, RecordAct.GENESIS), own = true)).isEqualTo(R.string.chronicle_joined)
        assertThat(verbOf(row(Family.REGISTRATION), own = true)).isEqualTo(R.string.chronicle_profile_yours)
        assertThat(verbOf(row(Family.REGISTRATION), own = false)).isEqualTo(R.string.chronicle_profile_theirs)
    }

    @Test
    fun postsAndCommentsArePublishedOrCommentedThenEdited() {
        assertThat(verbOf(row(Family.PUBLISH, RecordAct.GENESIS), own = true)).isEqualTo(R.string.chronicle_published)
        assertThat(verbOf(row(Family.PUBLISH), own = true)).isEqualTo(R.string.chronicle_edited_post)
        assertThat(verbOf(row(Family.REVIEW, RecordAct.GENESIS), own = true)).isEqualTo(R.string.chronicle_commented)
        assertThat(verbOf(row(Family.REVIEW), own = true)).isEqualTo(R.string.chronicle_edited_comment)
    }

    @Test
    fun anOpinionIsGivenOnItsTargetNamedByKind() {
        val onPerson = row(Family.OPINION, about = RecordAbout.PERSON, handle = "mira", opinion = face)
        assertThat(verbOf(onPerson, own = true)).isEqualTo(R.string.chronicle_opinion)
        assertThat(asideOf(onPerson)).isEqualTo(R.string.chronicle_opinion_on to "mira")
        assertThat(asideOf(row(Family.OPINION, about = RecordAbout.POST, opinion = face)))
            .isEqualTo(R.string.chronicle_on_post to null)
        assertThat(asideOf(row(Family.OPINION, about = RecordAbout.COMMENT, opinion = face)))
            .isEqualTo(R.string.chronicle_on_comment to null)
        assertThat(discOf(onPerson)).isEqualTo(ContentRowDisc.Face(0.4, 0.3))
    }

    @Test
    fun theVouchThatLandedSomeoneReadsVouchedForThem() {
        val vouch = row(Family.OPINION, RecordAct.VOUCH, RecordAbout.PERSON, handle = "rafa", opinion = face)
        assertThat(verbOf(vouch, own = true)).isEqualTo(R.string.chronicle_vouched)
        assertThat(asideOf(vouch)).isEqualTo(R.string.chronicle_person to "rafa")
    }

    @Test
    fun everyRecordAWalkBackSignedReadsWalkedBackUnderTheShrug() {
        val counter = RecordOpinion(-0.4, -0.3, severed = true)
        val walkBack = row(Family.OPINION, RecordAct.WALK_BACK, RecordAbout.PERSON, handle = "mira", opinion = counter)
        assertThat(verbOf(walkBack, own = true)).isEqualTo(R.string.chronicle_walked_back)
        assertThat(asideOf(walkBack)).isEqualTo(R.string.chronicle_opinion_on to "mira")
        // Never the counter-record's own face, which would read as an opinion against.
        assertThat(discOf(walkBack)).isEqualTo(ContentRowDisc.WalkedBack)
    }

    @Test
    fun aTagIsTaggedOrUnTaggedByKindUnderTheHashMark() {
        assertThat(verbOf(row(Family.TAG, about = RecordAbout.POST), own = true))
            .isEqualTo(R.string.chronicle_tagged_post)
        assertThat(verbOf(row(Family.TAG, about = RecordAbout.COMMENT, untag = true), own = true))
            .isEqualTo(R.string.chronicle_untagged_comment)
        assertThat(discOf(row(Family.TAG, about = RecordAbout.POST))).isEqualTo(ContentRowDisc.Letter("#"))
    }

    @Test
    fun aCitationCitesAThingOrMentionsAPerson() {
        assertThat(verbOf(row(Family.REFERENCE, about = RecordAbout.POST), own = true))
            .isEqualTo(R.string.chronicle_cited_post)
        assertThat(verbOf(row(Family.REFERENCE, about = RecordAbout.COMMENT), own = true))
            .isEqualTo(R.string.chronicle_cited_comment)
        val mention = row(Family.REFERENCE, about = RecordAbout.PERSON, handle = "ada")
        assertThat(verbOf(mention, own = true)).isEqualTo(R.string.chronicle_mentioned)
        assertThat(asideOf(mention)).isEqualTo(R.string.chronicle_person to "ada")
        assertThat(discOf(mention)).isEqualTo(ContentRowDisc.Monogram("ada"))
    }

    @Test
    fun theVerbsAreCopyVoices() {
        val voice = java.io.File("../../../design/guidelines/copy-voice.md").readText().replace(Regex("\\s+"), " ")
        val strings = java.io.File("src/main/res/values/strings.xml").readText()
        for (verb in listOf(
            "Joined", "Vouched for", "Walked back an opinion", "Tagged a post", "Tagged a comment",
            "Un-tagged a post", "Un-tagged a comment", "Cited a post", "Cited a comment", "Mentioned",
            "Edited a post", "Edited a comment",
        )) {
            assertThat(voice).contains("`$verb`")
            assertThat(strings).contains(">$verb</string>")
        }
    }
}
