// Exact decimal netting (edges.md §1: "netting is exact decimal
// arithmetic"; the reference is crates/common/src/l1/exact.rs, the web
// mirror src/lib/stance/exact.ts).
//
// A parameter travels as a double, but what it denotes is a decimal: its
// shortest round-trip rendering, the closest such when several qualify —
// the digits the reference's `ryu` and PostgreSQL's float8 output give.
// Summing those decimals is the same answer in every order; summing the
// doubles is not: 1.1 − 1 − 0.1 is 8.3e-17 in floating point, and a
// walk-back the backend calls exact would read as short of zero here.

package com.cogra.domain.stance

import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode

/**
 * The decimal a finite double denotes. Found by search — the fewest
 * significant digits whose correctly rounded value parses back to [x] —
 * rather than read off `Double.toString`, whose digits the JVM promises
 * shortest only from JDK 19 and ART does not promise at all.
 * `Double.parseDouble` is specified to round to nearest, and seventeen
 * significant digits always round-trip, so the search ends by then.
 */
fun decimalOf(x: Double): BigDecimal {
    require(x.isFinite()) { "$x denotes no decimal" }
    if (x == 0.0) return BigDecimal.ZERO
    val exact = BigDecimal(x)
    for (digits in 1..17) {
        val candidate = exact.round(MathContext(digits, RoundingMode.HALF_EVEN))
        if (candidate.toString().toDouble() == x) return candidate
    }
    return exact.round(MathContext(17, RoundingMode.HALF_EVEN))
}

/** Whether the decimals these doubles denote sum to exactly zero. */
fun netsToZero(values: Iterable<Double>): Boolean =
    values.fold(BigDecimal.ZERO) { sum, x -> sum.add(decimalOf(x)) }.signum() == 0
