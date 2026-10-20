// Exact decimal netting (edges.md §1: "netting is exact decimal
// arithmetic"; the reference is crates/common/src/l1/exact.rs).
//
// A parameter travels as a double, but what it denotes is a decimal: its
// shortest round-trip rendering. That is exactly what ECMAScript's
// Number::toString is specified to print — the fewest digits that read
// back to the same double, the closest such when several do — and the
// digits the reference's `ryu` and PostgreSQL's float8 output give, so the
// three name one decimal. Summing those decimals is the same answer in
// every order; summing the doubles is not: `1.1 - 1 - 0.1` is 8.3e-17 in
// floating point, and a walk-back the backend calls exact would read as
// short of zero here.

/** `units × 10^−scale`. */
type Decimal = { readonly units: bigint; readonly scale: number };

const NOTATION = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/;

/** The decimal a finite double denotes. Both zeros denote zero. */
export function decimalOf(x: number): Decimal {
  const match = Number.isFinite(x) ? NOTATION.exec(String(x)) : null;
  if (match === null) throw new RangeError(`${x} denotes no decimal`);
  const [, sign, whole, fraction = "", exponent = "0"] = match;
  const digits = BigInt(whole + fraction);
  const shift = Number(exponent) - fraction.length;
  const units = shift >= 0 ? digits * 10n ** BigInt(shift) : digits;
  return { units: sign === "-" ? -units : units, scale: shift >= 0 ? 0 : -shift };
}

/** Whether the decimals these doubles denote sum to exactly zero. */
export function netsToZero(values: readonly number[]): boolean {
  const terms = values.map(decimalOf);
  const scale = Math.max(0, ...terms.map((t) => t.scale));
  const sum = terms.reduce((acc, t) => acc + t.units * 10n ** BigInt(scale - t.scale), 0n);
  return sum === 0n;
}
