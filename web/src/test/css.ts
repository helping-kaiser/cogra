// A STYLE DECLARATION AS THE CSSOM KEEPS IT. A browser does not hand back the
// string a component wrote: it rounds numbers to six significant digits,
// folds nested calc() and orders its terms (CSS Values 4, serialization).
// jsdom 31 does the same, so a test that compares an inline style against
// the raw string it expects is comparing two spellings, not two values.
// Running the expected value through a fresh declaration gives it the same
// spelling the element under test got, so the comparison stays exact.

/** The serialized value a style keeps after declaring `value` for `property`. */
export function declared(property: string, value: string): string {
  const probe = document.createElement("div").style;
  probe.setProperty(property, value);
  const kept = probe.getPropertyValue(property);
  if (kept === "") throw new Error(`the CSSOM rejects ${property}: ${value}`);
  return kept;
}
