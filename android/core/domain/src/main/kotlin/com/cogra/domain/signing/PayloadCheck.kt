// A write's payload against its expectation, through the device's own
// envelope decoder (core:crypto Envelope.kt; web mirror: intent.ts
// `payloadMatches`). IntentCheck.kt asks; this answers.

package com.cogra.domain.signing

import com.cogra.crypto.AvatarSlot
import com.cogra.crypto.CograContent
import com.cogra.crypto.CograProfile
import com.cogra.crypto.EnvelopeAsset
import com.cogra.crypto.EnvelopeException
import com.cogra.crypto.decodeContent
import com.cogra.crypto.decodeProfile

private fun assetMatches(
    e: AssetExpectation,
    a: EnvelopeAsset,
): Boolean =
    e is AssetExpectation.Asset &&
        a.digest == e.digest &&
        a.mime == e.mime &&
        a.altText == e.altText &&
        a.cover == e.cover &&
        a.coverTaken == e.coverTaken &&
        a.uploadDigest != null &&
        a.uploadDigest == e.uploadDigest

private fun contentMatches(
    e: ExpectedContent,
    c: CograContent,
): Boolean =
    c.node == e.node &&
        c.title == e.title &&
        c.description == e.description &&
        c.body == e.body &&
        c.media.size == e.media.size &&
        c.media.indices.all { assetMatches(e.media[it], c.media[it]) } &&
        c.sensitive?.reason == e.sensitive?.reason &&
        (c.sensitive == null) == (e.sensitive == null)

private fun avatarMatches(
    e: AvatarExpectation,
    slot: AvatarSlot,
): Boolean =
    when (e) {
        AvatarExpectation.Untouched -> slot == AvatarSlot.Untouched
        AvatarExpectation.Cleared -> slot == AvatarSlot.Cleared
        is AvatarExpectation.Replaced -> slot is AvatarSlot.Replaced && assetMatches(e.asset, slot.asset)
    }

private fun profileMatches(
    e: ExpectedProfile,
    p: CograProfile,
): Boolean =
    p.node == e.node &&
        p.displayName == e.displayName &&
        p.bio == e.bio &&
        p.websiteUrl == e.websiteUrl &&
        avatarMatches(e.avatar, p.avatar)

/** Whether [payload] is what [e] ordered; a payload the decoder refuses never is. */
internal fun payloadMatches(
    e: PayloadExpectation,
    payload: ByteArray,
): Boolean =
    when (e) {
        PayloadExpectation.Empty -> payload.isEmpty()
        is PayloadExpectation.Content ->
            try {
                contentMatches(e.content, decodeContent(payload))
            } catch (_: EnvelopeException) {
                false
            }
        is PayloadExpectation.Profile ->
            try {
                profileMatches(e.profile, decodeProfile(payload))
            } catch (_: EnvelopeException) {
                false
            }
    }
