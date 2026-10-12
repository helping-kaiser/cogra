package com.cogra.feature.content

import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.ModeratedField
import com.cogra.domain.PostView
import com.cogra.domain.testing.testPost
import com.cogra.domain.testing.testReferenceClaim
import com.cogra.domain.testing.testTopicClaim
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.time.Instant

/**
 * HOW A FRESH READ LANDS ON A DETAIL THAT HOLDS WHAT WAS OPENED
 * (PostDetail.md:5-15; seam 120; FC-G1) — the web's `detail-freeze.test.ts`,
 * case for case.
 */
class DetailFreezeTest {

    private val opened: PostView = testPost("p1").copy(
        attachments = listOf(asset("m1"), asset("m2", cover = asset("c2"))),
        topics = listOf(testTopicClaim("cats")),
        references = listOf(testReferenceClaim(target = null, targetId = "l1-a")),
    )
    private val edited = opened.copy(updatedAt = Instant.ofEpochSecond(EDITED))

    @Test
    fun nothingPaintedPaintsTheAnswer() {
        assertThat(landingOf(null, edited, asked = false)).isEqualTo(DetailLanding.PAINT)
    }

    @Test
    fun theReadersOwnAskLandsOverTheOpenedVersion() {
        assertThat(landingOf(opened, edited, asked = true)).isEqualTo(DetailLanding.ASKED)
    }

    @Test
    fun aNewEditStampIsAnotherVersionAndWaits() {
        assertThat(landingOf(opened, edited, asked = false)).isEqualTo(DetailLanding.HOLD)
    }

    @Test
    fun aChangedTagOrCitationSetWaitsTheSameWayWithNoNewEdit() {
        val retagged = opened.copy(topics = opened.topics + testTopicClaim("dogs"))
        val untagged = opened.copy(topics = emptyList())
        val recited = opened.copy(references = listOf(testReferenceClaim(target = null, targetId = "l1-b")))
        assertThat(landingOf(opened, retagged, asked = false)).isEqualTo(DetailLanding.HOLD)
        assertThat(landingOf(opened, untagged, asked = false)).isEqualTo(DetailLanding.HOLD)
        assertThat(landingOf(opened, recited, asked = false)).isEqualTo(DetailLanding.HOLD)
    }

    @Test
    fun theSameVersionIsTakenSilentlyCountsAndWeightsIncluded() {
        val again = opened.copy(
            commentCount = 4,
            topics = listOf(testTopicClaim("cats", relevance = 0.9)),
            references = listOf(testReferenceClaim(target = null, targetId = "l1-a", relevance = 0.7)),
        )
        assertThat(landingOf(opened, again, asked = false)).isEqualTo(DetailLanding.SAME)
    }

    @Test
    fun theClaimSetsAreComparedByWhichClaimsStandNotByOrder() {
        val two = opened.copy(topics = listOf(testTopicClaim("cats"), testTopicClaim("dogs")))
        val swapped = opened.copy(topics = listOf(testTopicClaim("dogs"), testTopicClaim("cats")))
        assertThat(isNewerVersion(two, swapped)).isFalse()
    }

    @Test
    fun aRedactionPatchesThroughWhateverElseTheReadChanged() {
        val removed = edited.copy(title = ModeratedField(null, FieldStatus.REDACTED))
        assertThat(landingOf(opened, removed, asked = false)).isEqualTo(DetailLanding.REDACTION)
    }

    @Test
    fun everyPartOfThePostCounts() {
        assertThat(newlyRedacted(opened, opened.copy(content = ModeratedField(null, FieldStatus.REDACTED))))
            .isTrue()
        assertThat(newlyRedacted(opened, opened.copy(attachmentsStatus = FieldStatus.REDACTED))).isTrue()
        assertThat(
            newlyRedacted(opened, opened.copy(attachments = listOf(asset("m1"), asset("m2", FieldStatus.REDACTED)))),
        ).isTrue()
        assertThat(
            newlyRedacted(
                opened,
                opened.copy(attachments = listOf(asset("m1"), asset("m2", cover = asset("c2", FieldStatus.REDACTED)))),
            ),
        ).isTrue()
        val tag = testTopicClaim("cats")
        val redactedTag = tag.copy(hashtag = tag.hashtag.copy(name = ModeratedField(null, FieldStatus.REDACTED)))
        assertThat(newlyRedacted(opened, opened.copy(topics = listOf(redactedTag)))).isTrue()
    }

    @Test
    fun aRedactionAlreadyOnScreenIsNotNewsSoTheRestStillWaits() {
        val shown = opened.copy(attachmentsStatus = FieldStatus.REDACTED)
        val thenEdited = shown.copy(updatedAt = Instant.ofEpochSecond(EDITED))
        assertThat(newlyRedacted(shown, thenEdited)).isFalse()
        assertThat(landingOf(shown, thenEdited, asked = false)).isEqualTo(DetailLanding.HOLD)
    }

    @Test
    fun anAttachmentIsFollowedByItsOwnIdSoAReorderIsNotARedaction() {
        val first = opened.copy(attachments = listOf(asset("m1", FieldStatus.REDACTED), asset("m2")))
        val reordered = opened.copy(attachments = listOf(asset("m2"), asset("m1", FieldStatus.REDACTED)))
        assertThat(newlyRedacted(first, reordered)).isFalse()
    }

    private fun asset(id: String, status: FieldStatus = FieldStatus.NORMAL, cover: MediaAssetView? = null) =
        MediaAssetView(
            id = id,
            url = "https://example.invalid/$id.webp",
            altText = null,
            status = status,
            aspectRatio = 1f,
            mimeType = "image/webp",
            cover = cover,
        )

    private companion object {
        const val EDITED = 3_600L
    }
}
