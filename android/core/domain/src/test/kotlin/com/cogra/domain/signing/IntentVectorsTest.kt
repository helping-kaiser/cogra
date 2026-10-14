// Pins the intent check to `intent-vectors.json` (repo root), exported from
// the Rust reference (`crates/common/tests/intent_vectors.rs`): the same
// expectations, the same canonical proposal bytes, the same verdicts web's
// intent.test.ts reads. Never transcribe a vector value.

package com.cogra.domain.signing

import com.cogra.crypto.Family
import com.cogra.crypto.decodeProposal
import com.cogra.crypto.hexToBytes
import com.google.common.truth.Truth.assertThat
import com.google.common.truth.Truth.assertWithMessage
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Test
import java.io.File

private val vectors: JsonObject by lazy {
    Json.parseToJsonElement(File("../../../intent-vectors.json").readText()).jsonObject
}

private fun JsonElement.str(key: String): String = jsonObject.getValue(key).jsonPrimitive.content

private fun JsonElement.strOrNull(key: String): String? =
    jsonObject.getValue(key).takeUnless { it is JsonNull }?.jsonPrimitive?.content

private fun doubleOfBits(hex: String): Double =
    java.lang.Double.longBitsToDouble(java.lang.Long.parseUnsignedLong(hex, 16))

private fun nodeOf(json: JsonElement): NodeExpectation? {
    if (json is JsonNull) return null
    return when (json.str("kind")) {
        "node" -> NodeExpectation.Node(json.str("id"))
        "ownMint" -> NodeExpectation.OwnMint
        "mintedBy" -> NodeExpectation.MintedBy(json.jsonObject.getValue("write").jsonPrimitive.int)
        "ownProfile" -> NodeExpectation.OwnProfile
        else -> error("unknown node expectation ${json.str("kind")}")
    }
}

private fun writeOf(json: JsonElement): ExpectedWrite = ExpectedWrite(
    family = Family.parse(json.str("family")),
    middle = nodeOf(json.jsonObject.getValue("middle")),
    target = checkNotNull(nodeOf(json.jsonObject.getValue("target"))),
    pDirected = doubleOfBits(json.str("pDirectedBits")),
    pInterest = doubleOfBits(json.str("pInterestBits")),
    license = json.strOrNull("license"),
    parents = if (json.str("parents") == "ownChainHead") Parents.OWN_CHAIN_HEAD else Parents.NONE,
    payload = if (json.str("payload") == "present") PayloadPresence.PRESENT else PayloadPresence.EMPTY,
)

private fun nettingOf(json: JsonElement): ExpectedNetting = ExpectedNetting(
    family = Family.parse(json.str("family")),
    middle = json.strOrNull("middle"),
    target = json.str("target"),
    rawPDirected = doubleOfBits(json.str("rawPDirectedBits")),
    rawPInterest = doubleOfBits(json.str("rawPInterestBits")),
    cost = json.jsonObject.getValue("cost").jsonPrimitive.int,
)

private fun verdictOf(case: JsonElement): String {
    val expectation = case.jsonObject.getValue("expectation")
    val expected = Expectation(
        writes = expectation.jsonObject.getValue("writes").jsonArray.map { writeOf(it) },
        netting = expectation.jsonObject.getValue("netting").jsonArray.map { nettingOf(it) },
    )
    val batch = case.jsonObject.getValue("batch").jsonArray.map {
        decodeProposal(it.jsonPrimitive.content.hexToBytes())
    }
    return try {
        checkIntent(expected, vectors.str("author"), batch)
        "accept"
    } catch (_: IntentMismatchException) {
        "refuse"
    }
}

class IntentVectorsTest {

    @Test
    fun `the file is the contract version this client reads`() {
        assertThat(vectors.getValue("version").jsonPrimitive.content).isEqualTo("1")
        assertThat(vectors.getValue("cases").jsonArray).isNotEmpty()
    }

    @Test
    fun `the device reaches every intent verdict the vectors state`() {
        for (case in vectors.getValue("cases").jsonArray) {
            assertWithMessage(case.str("case")).that(verdictOf(case)).isEqualTo(case.str("verdict"))
        }
    }

    @Test
    fun `a license renders exactly as the server's canonical string`() {
        assertThat(canonicalLicense(0.0, 0.0)).isEqualTo("a=0;o=0")
        assertThat(canonicalLicense(0.5, 1.0)).isEqualTo("a=0.5;o=1")
        assertThat(canonicalLicense(1.0, 0.5)).isEqualTo("a=1;o=0.5")
    }

    @Test
    fun `a topic names its canonical Type`() {
        assertThat(topicNode("#Rust")).isEqualTo("name:rust")
    }

    @Test
    fun `a joined part's minted references point at its own writes`() {
        val joined = joinExpectations(
            listOf(
                Expectation(listOf(stanceRecord("prof:ab", 0.1, 0.1))),
                Expectation(
                    listOf(
                        postGenesis(0.1, "a=0;o=0"),
                        tagClaim(NodeExpectation.MintedBy(0), "x", 0.1, 1.0),
                    ),
                ),
            ),
        )
        assertThat(joined.writes[2].middle).isEqualTo(NodeExpectation.MintedBy(1))
    }
}
