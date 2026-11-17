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
    fun sealedActRoundTrips() {
        val sealed = fullSealed()
        assertThat(decodeSealedAct(encodeSealedAct(sealed))).isEqualTo(sealed)
    }

    private fun fullSealed() = SealedAct(
        act = VerifiedAct(
            body = fullProposal().body,
            preCommitment = ByteArray(32) { 9 },
            preSignature = ByteArray(64) { 3 },
            contentCommitment = ByteArray(32) { 6 },
            dependencyCommitment = ByteArray(32) { 7 },
            contentEdition = 2u,
            dependencyEdition = 1u,
        ),
        contentSalt = ByteArray(32) { 4 },
        dependencySalt = ByteArray(32) { 5 },
        hostSeal = ByteArray(64) { 8 },
    )

    @Test
    fun sealedActDecodeIsFieldOrderSensitive() {
        // Two same-length salts swapped: the whole-value comparison
        // catches it, which is what a field-by-field list only does if
        // every field was remembered.
        val sealed = fullSealed()
        val swapped = SealedAct(sealed.act, sealed.dependencySalt, sealed.contentSalt, sealed.hostSeal)
        assertThat(decodeSealedAct(encodeSealedAct(sealed))).isNotEqualTo(swapped)
    }

    @Test
    fun theSealedActIsTheElevenItemVersionTwoFrame() {
        val sealed = fullSealed()
        val decoded = decodeSealedAct(encodeSealedAct(sealed))
        assertThat(decoded.act.preCommitment).isEqualTo(sealed.act.preCommitment)
        assertThat(decoded.act.contentEdition).isEqualTo(2UL)
        assertThat(decoded.act.dependencyEdition).isEqualTo(1UL)
        val d = CborDecoder(encodeSealedAct(sealed))
        assertThat(d.array()).isEqualTo(11UL)
        assertThat(d.uint()).isEqualTo(2UL)
    }

    @Test
    fun preCommitmentRoundTrips() {
        val blob = PreCommitmentBlob(ByteArray(32) { 9 }, ByteArray(32) { 8 }, ByteArray(64) { 7 })
        val wire = encodePreCommitment(blob)
        assertThat(decodePreCommitment(wire)).isEqualTo(blob)
        val d = CborDecoder(wire)
        assertThat(d.array()).isEqualTo(4UL)
        assertThat(d.uint()).isEqualTo(2UL)
    }

    @Test
    fun aHandshakeFrameIsJudgedByItsVersionBeforeItsArity() {
        // A version-1 frame of the right v2 arity, and a v2 frame of the
        // one-nonce arity: each is refused, the first by its version.
        val oneNonceVersionAtV2Arity = CborEncoder().array(4u).uint(1u)
            .bytes(ByteArray(32)).bytes(ByteArray(32)).bytes(ByteArray(64)).finish()
        assertThat(assertThrows(WireException::class.java) { decodePreCommitment(oneNonceVersionAtV2Arity) })
            .hasMessageThat().isEqualTo("unsupported wire version 1")
        val v2AtOneNonceArity = CborEncoder().array(3u).uint(2u)
            .bytes(ByteArray(32)).bytes(ByteArray(64)).finish()
        assertThat(assertThrows(WireException::class.java) { decodePreCommitment(v2AtOneNonceArity) })
            .hasMessageThat().isEqualTo("malformed pre-commitment")
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
            decodeSealedAct(CborEncoder().array(2u).uint(2u).bytes(ByteArray(0)).finish())
        }
        val sealed = encodeSealedAct(fullSealed())
        assertThrows(WireException::class.java) { decodeSealedAct(sealed.copyOfRange(0, sealed.size - 3)) }
        assertThrows(WireException::class.java) { decodeSealedAct(sealed + byteArrayOf(0)) }
        assertThrows(WireException::class.java) {
            decodePreCommitment(
                CborEncoder().array(4u).uint(9u).bytes(ByteArray(0)).bytes(ByteArray(0)).bytes(ByteArray(0)).finish(),
            )
        }
        assertThrows(WireException::class.java) { decodePreCommitment(ByteArray(0)) }
    }
}
