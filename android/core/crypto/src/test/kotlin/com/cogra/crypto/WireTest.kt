package com.cogra.crypto

import com.google.common.truth.Truth.assertThat
import org.junit.Assert.assertThrows
import org.junit.Test

private fun fullProposal() = Proposal(
    body = StructuralBody(
        author = "alice",
        seq = 7u,
        family = Family.REVIEW,
        middle = NodeId.parse("mint:act:bob:1:publish"),
        target = NodeId.parse("prof:bob"),
        pD = 0.25,
        pI = -0.5,
        settlementRef = ActId.parse("act:bob:2:accept"),
        license = "CC-BY-4.0",
        assertedParents = listOf(ActId.parse("act:bob:1:publish")),
    ),
    payload = "body bytes".toByteArray(),
    deps = listOf(ActId.parse("act:bob:1:publish")),
)

private fun minimalProposal() = Proposal(
    body = StructuralBody(
        author = "a",
        seq = 0u,
        family = Family.REGISTRATION,
        middle = null,
        target = NodeId.parse("prof:a"),
        pD = 1.0,
        pI = 1.0,
        settlementRef = null,
        license = null,
        assertedParents = emptyList(),
    ),
    payload = ByteArray(0),
    deps = emptyList(),
)

class WireTest {

    @Test
    fun proposalRoundTrips() {
        for (p in listOf(fullProposal(), minimalProposal())) {
            assertThat(decodeProposal(encodeProposal(p))).isEqualTo(p)
        }
    }

    @Test
    fun theWireBodyIsTheCanonicalSigningBase() {
        val p = fullProposal()
        val d = CborDecoder(encodeProposal(p))
        assertThat(d.array()).isEqualTo(4UL)
        assertThat(d.uint()).isEqualTo(1UL)
        assertThat(d.bytes()).isEqualTo(p.body.canonicalBytes())
    }

    @Test
    fun verifiedActRoundTrips() {
        val act = VerifiedAct(
            proposal = fullProposal(),
            authorPubkey = ByteArray(32) { 1 },
            nonce = ByteArray(32) { 2 },
            preSignature = ByteArray(64) { 3 },
            contentSalt = ByteArray(32) { 4 },
            depsSalt = ByteArray(32) { 5 },
            contentCommitment = ByteArray(32) { 6 },
            depsCommitment = ByteArray(32) { 7 },
            hostSeal = ByteArray(64) { 8 },
        )
        val decoded = decodeVerifiedAct(encodeVerifiedAct(act))
        assertThat(decoded.proposal).isEqualTo(act.proposal)
        assertThat(decoded.authorPubkey).isEqualTo(act.authorPubkey)
        assertThat(decoded.nonce).isEqualTo(act.nonce)
        assertThat(decoded.preSignature).isEqualTo(act.preSignature)
        assertThat(decoded.contentSalt).isEqualTo(act.contentSalt)
        assertThat(decoded.depsSalt).isEqualTo(act.depsSalt)
        assertThat(decoded.contentCommitment).isEqualTo(act.contentCommitment)
        assertThat(decoded.depsCommitment).isEqualTo(act.depsCommitment)
        assertThat(decoded.hostSeal).isEqualTo(act.hostSeal)
    }

    @Test
    fun preCommitmentRoundTrips() {
        val blob = encodePreCommitment(ByteArray(32) { 9 }, ByteArray(64) { 7 })
        val decoded = decodePreCommitment(blob)
        assertThat(decoded.nonce).isEqualTo(ByteArray(32) { 9 })
        assertThat(decoded.preSignature).isEqualTo(ByteArray(64) { 7 })
    }

    @Test
    fun malformedInputIsRefusedNotMisread() {
        // Wrong version.
        val wrongVersion = CborEncoder().array(4u).uint(99u)
            .bytes("x".toByteArray()).bytes(ByteArray(0)).array(0u).finish()
        assertThrows(WireException::class.java) { decodeProposal(wrongVersion) }
        // Wrong shape.
        val wrongShape = CborEncoder().array(2u).uint(1u).bytes("x".toByteArray()).finish()
        assertThrows(WireException::class.java) { decodeProposal(wrongShape) }
        // Truncated input.
        val good = encodeProposal(fullProposal())
        assertThrows(WireException::class.java) {
            decodeProposal(good.copyOfRange(0, good.size - 3))
        }
        // Trailing garbage.
        assertThrows(WireException::class.java) { decodeProposal(good + byteArrayOf(0)) }
        // A bad identifier inside an otherwise valid envelope.
        val badBody = CborEncoder().array(9u)
            .text("not-an-act-id").nul().text("prof:a")
            .float(1.0).float(1.0).nul().nul().array(0u).uint(1u).finish()
        val badIdentifier = CborEncoder().array(4u).uint(1u)
            .bytes(badBody).bytes(ByteArray(0)).array(0u).finish()
        assertThrows(WireException::class.java) { decodeProposal(badIdentifier) }
        // A wrong body version inside a valid envelope.
        val badVersionBody = CborEncoder().array(9u)
            .text("act:a:1:opinion").nul().text("prof:a")
            .float(1.0).float(1.0).nul().nul().array(0u).uint(2u).finish()
        val badBodyVersion = CborEncoder().array(4u).uint(1u)
            .bytes(badVersionBody).bytes(ByteArray(0)).array(0u).finish()
        assertThrows(WireException::class.java) { decodeProposal(badBodyVersion) }
        // The same refusals hold for the other envelopes.
        assertThrows(WireException::class.java) {
            decodeVerifiedAct(CborEncoder().array(2u).uint(1u).bytes(ByteArray(0)).finish())
        }
        assertThrows(WireException::class.java) {
            decodePreCommitment(CborEncoder().array(3u).uint(9u).bytes(ByteArray(0)).bytes(ByteArray(0)).finish())
        }
        assertThrows(WireException::class.java) { decodePreCommitment(ByteArray(0)) }
    }
}
