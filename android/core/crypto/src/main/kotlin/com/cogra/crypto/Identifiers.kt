// Identifier algebra (reference: crates/common/src/l1/identifier.rs):
//   I ::= addr(a) | prof(a) | name(s) | mint(α)
// with α an authored-act identifier act(author, s_q, family). The
// canonical text encoding is the deployment's verbatim record-identifier
// form: `addr:<a>`, `prof:<a>`, `name:<s>`, `mint:<act>` with
// `<act> = act:<author-addr>:<seq>:<family>`.

package com.cogra.crypto

/** An identifier that does not parse under the algebra. */
class IdentifierException(message: String) : Exception(message)

/**
 * The record families of the L1 edge census, by census wire name — plus
 * [UNKNOWN], the stand-in for a family this client version does not
 * know. UNKNOWN is not a census member: it never parses, and asking for
 * its wire name throws, so it can never be encoded or signed.
 */
enum class Family(private val wire: String?) {
    REGISTRATION("registration"),
    PUBLISH("publish"),
    OPINION("opinion"),
    AFFINITY("affinity"),
    PARTICIPANT("participant"),
    OWNER("owner"),
    JOIN_REQUEST("join-request"),
    ACCEPT("accept"),
    RATIFY("ratify"),
    WITHDRAW("withdraw"),
    RESCIND("rescind"),
    LEAVE("leave"),
    TAG("tag"),
    REVIEW("review"),
    BID("bid"),
    INVITATION("invitation"),
    DE_INVITE("de-invite"),
    SEND("send"),
    REFERENCE("reference"),

    /** A family this client version does not know — never sign it. */
    UNKNOWN(null),
    ;

    val wireName: String
        get() = wire ?: throw IdentifierException("UNKNOWN family has no wire name")

    companion object {
        fun parse(s: String): Family =
            entries.find { it.wire == s }
                ?: throw IdentifierException("unknown family `$s`")
    }
}

/**
 * Charset for L0 addresses and Type names inside identifiers: ASCII
 * alphanumerics plus `-`, `_`, `.` — keeps the `:`-separated canonical
 * text encoding unambiguous.
 */
private fun requireAtom(s: String): String {
    val valid = s.isNotEmpty() &&
        s.length <= 128 &&
        s.all { it in 'A'..'Z' || it in 'a'..'z' || it in '0'..'9' || it in "-_." }
    if (!valid) throw IdentifierException("invalid atom `$s`: must be 1-128 chars of [A-Za-z0-9._-]")
    return s
}

/**
 * An authored-act identifier: act(author, s_q, family) — chosen by the
 * actor before submission, no host-assigned component.
 */
data class ActId(val author: String, val seq: ULong, val family: Family) {
    init {
        requireAtom(author)
        if (family == Family.UNKNOWN) throw IdentifierException("act identifier cannot carry the UNKNOWN family")
    }

    override fun toString(): String = "act:$author:$seq:${family.wireName}"

    companion object {
        fun parse(s: String): ActId {
            val rest = s.removePrefix("act:")
            if (rest == s) throw IdentifierException("unparseable identifier `$s`")
            val parts = rest.split(":", limit = 3)
            if (parts.size != 3) throw IdentifierException("unparseable identifier `$s`")
            val seq = parts[1].toULongOrNull()
                ?: throw IdentifierException("invalid sequence value `${parts[1]}`")
            return ActId(parts[0], seq, Family.parse(parts[2]))
        }
    }
}

/**
 * A node identifier, classed by outermost constructor: grounded
 * (`addr`, `prof`), named (`name`), minted (`mint`).
 */
sealed class NodeId {
    /** Actor — grounded in an L0 address. */
    data class Addr(val address: String) : NodeId() {
        init {
            requireAtom(address)
        }

        override fun toString(): String = "addr:$address"
    }

    /** Profile — one atom, two identifiers with its Actor. */
    data class Prof(val address: String) : NodeId() {
        init {
            requireAtom(address)
        }

        override fun toString(): String = "prof:$address"
    }

    /** Type — a commons compared by exact byte equality. */
    data class Name(val name: String) : NodeId() {
        init {
            requireAtom(name)
        }

        override fun toString(): String = "name:$name"
    }

    /** Minted node — names its genesis act, never itself. */
    data class Mint(val act: ActId) : NodeId() {
        override fun toString(): String = "mint:$act"
    }

    companion object {
        fun parse(s: String): NodeId = when {
            s.startsWith("addr:") -> Addr(s.removePrefix("addr:"))
            s.startsWith("prof:") -> Prof(s.removePrefix("prof:"))
            s.startsWith("name:") -> Name(s.removePrefix("name:"))
            s.startsWith("mint:") -> Mint(ActId.parse(s.removePrefix("mint:")))
            else -> throw IdentifierException("unparseable identifier `$s`")
        }
    }
}
