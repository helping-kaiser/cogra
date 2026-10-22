package com.cogra.feature.content.wizard

import com.cogra.domain.AttachmentClaim
import com.cogra.domain.signing.SentContent
import com.cogra.domain.signing.wireReason

/**
 * The request the seal sends — read twice: once by the prepare and once
 * by the payload expectation, so the device checks the envelope against
 * exactly what it asked for (PayloadExpectation.kt).
 */
internal fun ComposeWizardState.sentContent(): SentContent = SentContent(
    title = title.ifBlank { null },
    description = descriptionContent,
    // The XOR, structurally: a media post sends no content at all, and
    // a words post no gallery.
    content = body.takeIf { mode == BodyMode.Words },
    // The poster rides the clip's own placement, never a gallery entry
    // of its own — which is what keeps "ten pictures or one video" one
    // counting rule.
    attachments = if (mode == BodyMode.Media) {
        picked.mapNotNull { asset ->
            asset.mediaId?.let {
                AttachmentClaim(
                    mediaId = it,
                    altText = asset.altText.ifBlank { null },
                    coverMediaId = coverMediaId.takeIf { _ -> asset.isVideo },
                    // TAKEN (frame 1, silently) vs CHOSEN — the fact
                    // `storesFirstFrame` already names, gated the same way
                    // as the id itself so a picture post never claims it.
                    coverTaken = coverChoice.storesFirstFrame.takeIf { asset.isVideo } ?: false,
                )
            }
        }
    } else {
        emptyList()
    },
    // Always sent explicitly, never omitted: an edit payload is the
    // complete state, so an omitted mark UNMARKS. Sending the switch's
    // current value is what keeps create and edit the same code.
    sensitive = sensitive,
    // Blank counts as none, said here rather than left to the transport:
    // an empty string is a value, and "no reason" is what the author
    // actually chose.
    sensitiveReason = wireReason(sensitive, sensitiveReason.ifBlank { null }),
)
