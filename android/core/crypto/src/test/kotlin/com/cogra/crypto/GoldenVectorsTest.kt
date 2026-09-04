// Pins this module to `client-crypto-vectors.json` (repo root) — the
// cross-language golden vectors exported from the Rust reference
// (`make vectors`). Every group is exercised: the deterministic CBOR
// subset, the tagged hashing and Ed25519 signing, the structural bodies,
// the complete admission handshake, and the key-backup blob.

package com.cogra.crypto

import com.google.common.truth.Truth.assertThat
import com.google.common.truth.Truth.assertWithMessage
import java.io.File
import java.util.Base64
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertThrows
import org.junit.Test

private val vectors: JsonElement by lazy {
    // The repo-root contract file, exactly as the Rust exporter wrote it.
    Json.parseToJsonElement(File("../../../client-crypto-vectors.json").readText())
}

private fun JsonElement.str(key: String): String =
    jsonObject.getValue(key).jsonPrimitive.content

private fun JsonElement.strOrNull(key: String): String? =
    jsonObject.getValue(key).let { if (it is JsonNull) null else it.jsonPrimitive.content }

private fun bodyOf(json: JsonElement): StructuralBody = StructuralBody(
    author = json.str("author"),
    seq = json.str("seq").toULong(),
    family = Family.parse(json.str("family")),
    middle = json.strOrNull("middle")?.let { NodeId.parse(it) },
    target = NodeId.parse(json.str("target")),
    pD = json.str("pD").toDouble(),
    pI = json.str("pI").toDouble(),
    settlementRef = json.strOrNull("settlementRef")?.let { ActId.parse(it) },
    license = json.strOrNull("license"),
    assertedParents = json.jsonObject.getValue("assertedParents").jsonArray
        .map { ActId.parse(it.jsonPrimitive.content) },
)

class GoldenVectorsTest {

    // A compatibility check, not a currency one: the file says which
    // shape of vectors it holds, and this client reads that shape. It
    // says nothing about whether the file was regenerated recently —
    // that is the Gradle input's job (build.gradle.kts).
    @Test
    fun theVectorsFileIsTheContractVersionThisClientReads() {
        assertThat(vectors.str("version")).isEqualTo("2")
    }

    @Test
    fun encodingVectorsMatch() {
        // The same 22 values the exporter encodes, in the same order.
        val produced: List<Pair<String, ByteArray>> = listOf(
            "uint 0" to CborEncoder().uint(0u).finish(),
            "uint 23" to CborEncoder().uint(23u).finish(),
            "uint 24" to CborEncoder().uint(24u).finish(),
            "uint 255" to CborEncoder().uint(255u).finish(),
            "uint 256" to CborEncoder().uint(256u).finish(),
            "uint 65535" to CborEncoder().uint(65535u).finish(),
            "uint 65536" to CborEncoder().uint(65536u).finish(),
            "uint 4294967295" to CborEncoder().uint(4_294_967_295u).finish(),
            "uint 4294967296" to CborEncoder().uint(4_294_967_296u).finish(),
            "bytes ''" to CborEncoder().bytes(byteArrayOf()).finish(),
            "bytes 0102" to CborEncoder().bytes(byteArrayOf(1, 2)).finish(),
            "text ''" to CborEncoder().text("").finish(),
            "text 'cogra'" to CborEncoder().text("cogra").finish(),
            "text 'héllo → ✓'" to CborEncoder().text("héllo → ✓").finish(),
            "float 0.0" to CborEncoder().float(0.0).finish(),
            "float 1.0" to CborEncoder().float(1.0).finish(),
            "float -1.0" to CborEncoder().float(-1.0).finish(),
            "float 0.5" to CborEncoder().float(0.5).finish(),
            "float -0.25" to CborEncoder().float(-0.25).finish(),
            "null" to CborEncoder().nul().finish(),
            "array(0)" to CborEncoder().array(0u).finish(),
            "array(2)[uint 1, array(1)[text 'x']]" to
                CborEncoder().array(2u).uint(1u).array(1u).text("x").finish(),
        )
        val expected = vectors.jsonObject.getValue("encoding").jsonArray
        assertThat(produced.size).isEqualTo(expected.size)
        for ((case, vector) in produced.zip(expected)) {
            assertThat(vector.str("value")).isEqualTo(case.first)
            assertThat(case.second.toHex()).isEqualTo(vector.str("cborHex"))
        }
    }

    @Test
    fun taggedHashVectorsMatch() {
        for (case in vectors.jsonObject.getValue("sha256Tagged").jsonArray) {
            val parts = case.jsonObject.getValue("partsHex").jsonArray
                .map { it.jsonPrimitive.content.hexToBytes() }
            assertThat(sha256Tagged(case.str("tagUtf8"), parts).toHex())
                .isEqualTo(case.str("digestHex"))
        }
    }

    @Test
    fun signingVectorsMatch() {
        val signing = vectors.jsonObject.getValue("signing")
        val key = ActorKey.fromSeed(signing.str("seedHex").hexToBytes())
        assertThat(key.publicKeyBytes().toHex()).isEqualTo(signing.str("publicKeyHex"))
        assertThat(key.address()).isEqualTo(signing.str("l0Address"))
        for (sample in signing.jsonObject.getValue("samples").jsonArray) {
            val tag = sample.str("tagUtf8")
            val msg = sample.str("msgUtf8").toByteArray(Charsets.UTF_8)
            // Ed25519 is deterministic: byte-equality, not just verification.
            val signature = key.signTagged(tag, msg)
            assertThat(signature.toHex()).isEqualTo(sample.str("signatureHex"))
            assertThat(verify(key.publicKeyBytes(), tag, msg, signature)).isTrue()
        }
    }

    // Every one of these verifies under the plain RFC 8032 equation, or
    // is the wrong length for a signature at all. Agreeing to refuse
    // them is what keeps a witness from being replayed onto an act it
    // never covered — the reference refuses each, so this must too.
    @Test
    fun signatureRefusalVectorsAreRefused() {
        for (case in vectors.jsonObject.getValue("signatureRefusals").jsonArray) {
            val accepted = verify(
                case.str("publicKeyHex").hexToBytes(),
                case.str("tagUtf8"),
                case.str("msgUtf8").toByteArray(Charsets.UTF_8),
                case.str("signatureHex").hexToBytes(),
            )
            assertWithMessage("%s: %s", case.str("case"), case.str("refusal"))
                .that(accepted)
                .isFalse()
        }
    }

    // The census, by wire name and by the act id a family renders into.
    // Order is this client's own; membership is the contract.
    @Test
    fun familyVectorsMatch() {
        val cases = vectors.jsonObject.getValue("families").jsonArray
        assertThat(cases.map { it.str("wireName") })
            .containsExactlyElementsIn(
                Family.entries.filter { it != Family.UNKNOWN }.map { it.wireName },
            )
        for (case in cases) {
            val rendered = ActId("alice-addr", 1UL, Family.parse(case.str("wireName"))).toString()
            assertWithMessage(case.str("wireName")).that(rendered).isEqualTo(case.str("actId"))
        }
    }

    // What must NOT parse. A decoder that accepts a malformed frame is
    // as much a divergence as one that decodes it differently.
    @Test
    fun rejectionVectorsAreRefused() {
        for (case in vectors.jsonObject.getValue("rejections").jsonArray) {
            val label = case.str("case")
            when (val what = case.str("what")) {
                "decodeProposal" -> assertThrows(label, WireException::class.java) {
                    decodeProposal(case.str("hex").hexToBytes())
                }
                "parseActId" -> assertThrows(label, IdentifierException::class.java) {
                    ActId.parse(case.str("text"))
                }
                else -> throw AssertionError("unknown rejection kind `$what`")
            }
        }
    }

    @Test
    fun structuralBodyVectorsMatch() {
        for (case in vectors.jsonObject.getValue("structuralBodies").jsonArray) {
            val body = bodyOf(case)
            assertThat(body.actId().toString()).isEqualTo(case.str("actId"))
            assertThat(body.canonicalBytes().toHex()).isEqualTo(case.str("canonicalBytesHex"))
        }
    }

    @Test
    fun handshakeVectorsMatch() {
        val hs = vectors.jsonObject.getValue("handshake")
        val actor = ActorKey.fromSeed(vectors.jsonObject.getValue("signing").str("seedHex").hexToBytes())
        val hostPubkey = hs.jsonObject.getValue("host").str("publicKeyHex").hexToBytes()

        val proposalJson = hs.jsonObject.getValue("proposal")
        val proposal = Proposal(
            body = bodyOf(proposalJson.jsonObject.getValue("body")),
            payload = proposalJson.str("payloadHex").hexToBytes(),
            deps = proposalJson.jsonObject.getValue("deps").jsonArray
                .map { ActId.parse(it.jsonPrimitive.content) },
        )
        assertThat(canonicalDeps(proposal.deps).toHex()).isEqualTo(hs.str("canonicalDepsHex"))
        assertThat(encodeProposal(proposal).toHex()).isEqualTo(hs.str("wireProposalHex"))
        assertThat(decodeProposal(hs.str("wireProposalHex").hexToBytes())).isEqualTo(proposal)

        // Pre-sign under the pinned nonce: every intermediate matches.
        val nonce = hs.str("nonceHex").hexToBytes()
        val pre = actor.preSignWith(proposal, nonce)
        assertThat(preDigest(Tags.PRE_DIGEST_CONTENT, nonce, proposal.payload).toHex())
            .isEqualTo(hs.str("contentPreDigestHex"))
        assertThat(preDigest(Tags.PRE_DIGEST_DEPS, nonce, canonicalDeps(proposal.deps)).toHex())
            .isEqualTo(hs.str("depsPreDigestHex"))
        assertThat(
            preCommitmentMsg(
                proposal.body,
                hs.str("contentPreDigestHex").hexToBytes(),
                hs.str("depsPreDigestHex").hexToBytes(),
            ).toHex(),
        ).isEqualTo(hs.str("preCommitmentMsgHex"))
        assertThat(pre.preSignature.toHex()).isEqualTo(hs.str("preSignatureHex"))
        assertThat(encodePreCommitmentOf(pre).toHex()).isEqualTo(hs.str("wirePreCommitmentHex"))

        // The sealed act: commitments recompute, the seal message and
        // wire form match, and the host seal verifies.
        val sealed = VerifiedAct(
            proposal = proposal,
            authorPubkey = actor.publicKeyBytes(),
            nonce = nonce,
            preSignature = pre.preSignature,
            contentSalt = hs.str("contentSaltHex").hexToBytes(),
            depsSalt = hs.str("depsSaltHex").hexToBytes(),
            contentCommitment = hs.str("contentCommitmentHex").hexToBytes(),
            depsCommitment = hs.str("depsCommitmentHex").hexToBytes(),
            hostSeal = hs.str("hostSealHex").hexToBytes(),
        )
        assertThat(
            commitment(Tags.COMMIT_CONTENT, sealed.contentSalt, proposal.payload).toHex(),
        ).isEqualTo(hs.str("contentCommitmentHex"))
        assertThat(
            commitment(Tags.COMMIT_DEPS, sealed.depsSalt, canonicalDeps(proposal.deps)).toHex(),
        ).isEqualTo(hs.str("depsCommitmentHex"))
        assertThat(sealed.sealMsg().toHex()).isEqualTo(hs.str("sealMsgHex"))
        assertThat(encodeVerifiedAct(sealed).toHex()).isEqualTo(hs.str("wireVerifiedActHex"))
        // Every field, not a sample of two: a decoder that swapped the
        // two same-length salts passed the old pair of assertions.
        assertThat(decodeVerifiedAct(hs.str("wireVerifiedActHex").hexToBytes())).isEqualTo(sealed)

        // The real approval path accepts the pinned act and reproduces
        // the pinned witness.
        val witness = actor.approve(pre, sealed, hostPubkey)
        assertThat(witness.actId.toString()).isEqualTo(hs.str("approvalActId"))
        assertThat(witness.approvalSignature.toHex()).isEqualTo(hs.str("approvalSignatureHex"))
    }

    @Test
    fun keyBackupVectorsMatch() {
        val kb = vectors.jsonObject.getValue("keyBackup")
        val seed = vectors.jsonObject.getValue("signing").str("seedHex").hexToBytes()
        val code = RecoveryCode(kb.str("recoveryCodeBytesHex").hexToBytes())

        assertThat(code.display()).isEqualTo(kb.str("recoveryCodeDisplay"))
        assertThat(kb.str("hkdfInfoUtf8")).isEqualTo("cogra:key-backup:v1")

        // The two halves of the seal, each pinned on its own. Asserting
        // only the blob would report a swapped HKDF argument order as
        // "the ciphertext differs", which names neither the derivation
        // nor the container.
        assertThat(keyBackupPlaintext(seed).toHex()).isEqualTo(kb.str("plaintextHex"))
        assertThat(keyBackupContentKey(code, kb.str("hkdfSaltHex").hexToBytes()).toHex())
            .isEqualTo(kb.str("contentKeyHex"))

        val blob = sealKeyBackupWith(
            seed = seed,
            code = code,
            salt = kb.str("hkdfSaltHex").hexToBytes(),
            nonce = kb.str("aesNonceHex").hexToBytes(),
        )
        assertThat(blob.toHex()).isEqualTo(kb.str("blobHex"))
        assertThat(Base64.getEncoder().encodeToString(blob)).isEqualTo(kb.str("blobBase64"))

        // The blob opens under the display form a user would retype.
        val retyped = RecoveryCode.fromInput(kb.str("recoveryCodeDisplay"))
        assertThat(retyped.bytes()).isEqualTo(code.bytes())
        assertThat(openKeyBackup(kb.str("blobHex").hexToBytes(), retyped)).isEqualTo(seed)
    }

    // Everything a person might type, and everything they might type
    // wrong. The separator class is the interesting half: no two
    // languages spell "whitespace" the same, so it is pinned rather
    // than inherited (KeyBackup.kt).
    @Test
    fun recoveryCodeInputVectorsMatch() {
        val cases = vectors.jsonObject.getValue("keyBackup").jsonObject
            .getValue("recoveryCodeInputs").jsonArray
        for (case in cases) {
            val label = case.str("case")
            val input = case.str("input")
            when (val expect = case.str("expect")) {
                "bytes" -> assertWithMessage(label)
                    .that(RecoveryCode.fromInput(input).bytes().toHex())
                    .isEqualTo(case.str("bytesHex"))
                // The one shape complaint a reader can act on.
                "length" -> assertThrows(label, RecoveryCodeLengthException::class.java) {
                    RecoveryCode.fromInput(input)
                }
                // A full-length input that will not decode is a wrong
                // code, which is what the GCM tag would have said next.
                "character", "padBits" -> {
                    val thrown = assertThrows(label, KeyBackupException::class.java) {
                        RecoveryCode.fromInput(input)
                    }
                    assertWithMessage(label)
                        .that(thrown)
                        .isNotInstanceOf(RecoveryCodeLengthException::class.java)
                }
                else -> throw AssertionError("unknown expectation `$expect`")
            }
        }
    }

    @Test
    fun keyBackupUploadProofVectorsMatch() {
        val kb = vectors.jsonObject.getValue("keyBackup")
        assertThat(UPLOAD_PROOF_TAG).isEqualTo(kb.str("uploadProofTagUtf8"))

        val actor = ActorKey.fromSeed(vectors.jsonObject.getValue("signing").str("seedHex").hexToBytes())
        val signature = signUpload(
            key = actor,
            challenge = kb.str("uploadChallengeHex").hexToBytes(),
            blob = kb.str("blobHex").hexToBytes(),
        )
        assertThat(signature.toHex()).isEqualTo(kb.str("uploadSignatureHex"))
    }
}
