// THE WRITE RULE IS A NOTICE, NOT A FAULT (PadWriteRule.md): which refusal
// codes a signing surface reads as the rule refusing — the contract's own
// `WRITE_RULE_FAILED` (the prepare pre-check: W1 solvency, W2 stamps, the
// signing budget) and the throttle's `RATE_LIMITED`, which the stance pad
// already read this way. Nothing is staged, signed or spent under either.

package com.cogra.domain.stance

import com.cogra.domain.ErrorCode
import com.cogra.domain.UserError

/** The codes the pads answer with the write rule's notice. */
val WRITE_RULE_CODES: Set<ErrorCode> = setOf(ErrorCode.WRITE_RULE_FAILED, ErrorCode.RATE_LIMITED)

/** Whether [errors] are the write rule refusing rather than a fault. */
fun isWriteRule(errors: List<UserError>): Boolean = errors.any { it.code in WRITE_RULE_CODES }
