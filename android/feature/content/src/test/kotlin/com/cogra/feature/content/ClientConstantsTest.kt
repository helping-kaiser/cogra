// Pins this surface's mirrors of backend numbers to
// `client-constants.json` (repo root, `make constants`) — the same
// arrangement core:crypto has with the golden vectors and `app` has
// with the design tokens.
//
// These are the numbers a composer refuses on. A cap the backend moved
// and this build did not is either a file refused here that the server
// would have taken, or one sent and refused at prepare after the
// author waited out the upload. Neither is something the reader can
// act on, so the values are never transcribed into code the artifact
// does not also state.

package com.cogra.feature.content

import com.cogra.domain.repo.ContentRepository
import com.cogra.feature.content.reply.ReplyWizardViewModel
import com.cogra.feature.content.wizard.ComposeWizardState
import com.cogra.feature.content.wizard.ComposeWizardViewModel
import com.google.common.truth.Truth.assertThat
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Test
import java.io.File

private val constants: JsonObject by lazy {
    Json.parseToJsonElement(File("../../../client-constants.json").readText()).jsonObject
}

private fun group(name: String): JsonObject = constants.getValue(name).jsonObject

private fun JsonObject.int(key: String): Int = getValue(key).jsonPrimitive.content.toInt()

private fun JsonObject.long(key: String): Long = getValue(key).jsonPrimitive.content.toLong()

class ClientConstantsTest {

    // One still cap for both surfaces, and one clip cap each. The post
    // and comment caps differ; that they differ is the contract's
    // business, and this is where the two composers prove they read it.
    @Test
    fun `the byte caps the composers screen against are the contract's`() {
        val media = group("media")
        assertThat(ComposeWizardViewModel.MAX_PICTURE_BYTES).isEqualTo(media.long("stillBytes"))
        assertThat(ReplyWizardViewModel.MAX_PICTURE_BYTES).isEqualTo(media.long("stillBytes"))
        assertThat(ComposeWizardViewModel.MAX_VIDEO_BYTES).isEqualTo(media.long("postVideoBytes"))
        assertThat(ReplyWizardViewModel.MAX_VIDEO_BYTES).isEqualTo(media.long("commentVideoBytes"))
    }

    @Test
    fun `the attachment counts are the contract's`() {
        val media = group("media")
        assertThat(ComposeWizardState.MAX_POST_ASSETS).isEqualTo(media.int("postAttachments"))
        assertThat(ContentRepository.MAX_COMMENT_ATTACHMENTS)
            .isEqualTo(media.int("commentAttachments"))
    }

    @Test
    fun `the feed page size is the contract's default`() {
        assertThat(FEED_PAGE_SIZE).isEqualTo(group("paging").int("defaultPageSize"))
    }
}
