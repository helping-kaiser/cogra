// Pins the client-side fold to `stance-fold-vectors.json` (repo root),
// the cross-language vectors exported from the Rust reference — the
// same arrangement core:crypto has with the golden vectors.
//
// Values are compared as BITS, never as Doubles: `0.0 == -0.0` is true,
// and telling the two apart is the entire point of the last step of the
// clip. `java.lang.Double`'s bit conversions are the raw ones, so a
// negative zero that survived the fold fails here rather than passing
// silently and printing as "-0.00" on a device.
//
// The `severance` group is deliberately not asserted: android computes
// no severance batch and no cost. `SeveranceQuote` carries the
// backend's `severanceCost` verbatim off the wire (core:network's
// StanceRepositoryTest covers that), so there is nothing local for
// those vectors to pin.

package com.cogra.domain.stance

import com.google.common.truth.Truth.assertWithMessage
import java.io.File
import java.util.Locale
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Test

private val vectors: JsonObject by lazy {
    Json.parseToJsonElement(File("../../../stance-fold-vectors.json").readText()).jsonObject
}

private fun JsonElement.str(key: String): String = jsonObject.getValue(key).jsonPrimitive.content

private fun JsonElement.flag(key: String): Boolean = jsonObject.getValue(key).jsonPrimitive.boolean

/** The 16 hex digits of an IEEE-754 double, as the exporter writes them. */
private fun bitsOf(value: Double): String =
    String.format(Locale.ROOT, "%016x", java.lang.Double.doubleToRawLongBits(value))

private fun doubleOfBits(hex: String): Double =
    java.lang.Double.longBitsToDouble(java.lang.Long.parseUnsignedLong(hex, 16))

private fun pairOf(json: JsonElement): StancePair = StancePair(
    pDirected = doubleOfBits(json.str("pDirectedBits")),
    pInterest = doubleOfBits(json.str("pInterestBits")),
)

class StanceFoldVectorsTest {

    @Test
    fun `the clip matches the reference bit for bit`() {
        for (case in vectors.getValue("clip").jsonArray) {
            val folded = clipDimension(doubleOfBits(case.str("inputBits")))
            assertWithMessage(case.str("case"))
                .that(bitsOf(folded))
                .isEqualTo(case.str("outputBits"))
        }
    }

    @Test
    fun `every landing matches the reference`() {
        for (case in vectors.getValue("landings").jsonArray) {
            val label = case.str("case")
            val raw = pairOf(case.jsonObject.getValue("rawSum"))
            val pick = pairOf(case.jsonObject.getValue("pick"))
            val landed = localLanding(raw, pick)
            val expected = case.jsonObject.getValue("landing")

            assertWithMessage("%s: pDirected", label)
                .that(bitsOf(landed.net.pDirected))
                .isEqualTo(expected.str("pDirectedBits"))
            assertWithMessage("%s: pInterest", label)
                .that(bitsOf(landed.net.pInterest))
                .isEqualTo(expected.str("pInterestBits"))
            // The contract carries ONE `inert` flag — either axis at
            // zero. This client names the two axes apart because the
            // control does, so the contract's flag is their disjunction.
            assertWithMessage("%s: inert", label)
                .that(landed.inertDirected || landed.inertInterest)
                .isEqualTo(case.flag("inert"))
            assertWithMessage("%s: severed", label)
                .that(landed.severance)
                .isEqualTo(case.flag("severed"))
        }
    }
}
