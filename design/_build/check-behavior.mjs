// Holds the behavior sidecars (`designs/canonical/behavior/<Screen>.md`) to the
// grammar their README sets out — the contract the implementation session's
// conformance harness compiles into platform tests. A line that drifts out of
// the grammar fails here, in the design gate, before any compiler sees it.
//
//   WHEN <trigger> [GIVEN <state>] -> <outcome> {AND <outcome>}
//   ALWAYS <invariant> [GIVEN <state>]
//   outcome := [NEVER] <observable> [WITHIN <duration | motion token>]
//
// A real parser over whitespace-separated tokens, not a pattern: the keywords
// are uppercase and reserved, a phrase is one or more words that are neither a
// keyword nor the arrow, and every production is walked in order — so a THEN,
// a GIVEN after the arrow, an empty phrase or a line of prose is named with
// its file and line rather than passed.
//
// Syntax is what this checks today. The node check — a plain word where a
// data-node path exists — needs the node-ID registry, and activates per screen
// as the ID sweep lands (backlog item 111). A prohibition written without
// NEVER is prose the parser cannot recognize as one; that stays a review
// discipline, named in the README.
//
// Run from this directory: node check-behavior.mjs   (exit 1 on any FAIL)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const t0 = Date.now();
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const canonical = join(root, "designs/canonical");
const behaviorDir = join(canonical, "behavior");
const rel = (file) => `designs/canonical/behavior/${file}`;

const KEYWORDS = new Set(["WHEN", "GIVEN", "ALWAYS", "AND", "NEVER", "WITHIN"]);
const ARROW = "->";
const THEN_MESSAGE =
  "THEN is not in the grammar — a sequence is separate WHEN lines, each GIVEN carrying the state the line before it left";

// A WITHIN bound is a literal duration or a motion token whose resolved value
// is one. The tokens come from `tokens.json`, the exported contract, so a bound
// naming a token the design does not carry — or one that is not a time, like
// `--nav-travel` or an easing curve — fails.
const DURATION = /^\d+(?:\.\d+)?(?:ms|s)$/;
const tokens = JSON.parse(readFileSync(join(root, "tokens.json"), "utf8"));
const motionTokens = new Set();
for (const source of ["motion.css", "transitions.css"]) {
  for (const [name, { resolved }] of Object.entries(tokens.files[source]?.tokens ?? {})) {
    if (DURATION.test(String(resolved).trim())) motionTokens.add(name);
  }
}

class GrammarError extends Error {}

// Parses one line; returns "WHEN" or "ALWAYS", or throws a GrammarError naming
// what the grammar expected where it stopped.
function parse(line) {
  const toks = line.trim().split(/\s+/);
  let i = 0;
  const peek = () => toks[i];
  const describe = (t) => (t === undefined ? "the end of the line" : `"${t}"`);

  for (const t of toks) {
    if (t === "THEN") throw new GrammarError(THEN_MESSAGE);
    if (t !== ARROW && t.includes(ARROW)) throw new GrammarError(`"${t}" — the arrow stands alone, a space on each side`);
  }

  // One or more words that are neither a keyword nor the arrow.
  const phrase = (what) => {
    const start = i;
    while (i < toks.length && !KEYWORDS.has(toks[i]) && toks[i] !== ARROW) i += 1;
    if (i === start) throw new GrammarError(`${what} is empty — found ${describe(peek())} where words belong`);
  };

  const outcome = () => {
    if (peek() === "NEVER") i += 1;
    phrase("an outcome");
    if (peek() === "WITHIN") {
      i += 1;
      const bound = peek();
      if (bound === undefined) throw new GrammarError("WITHIN has no bound — a duration (300ms, 1.5s) or a motion token");
      if (!DURATION.test(bound) && !motionTokens.has(bound)) {
        throw new GrammarError(
          `WITHIN ${describe(bound)} is neither a duration (300ms, 1.5s) nor a motion token tokens.json carries (${[...motionTokens].sort().join(", ")})`,
        );
      }
      i += 1;
    }
  };

  const head = peek();
  if (head === "WHEN") {
    i += 1;
    phrase("the trigger");
    if (peek() === "GIVEN") {
      i += 1;
      phrase("the GIVEN state");
    }
    if (peek() !== ARROW) {
      throw new GrammarError(`expected "->" after the ${toks.includes("GIVEN") ? "state" : "trigger"}, found ${describe(peek())}`);
    }
    i += 1;
    outcome();
    while (peek() === "AND") {
      i += 1;
      outcome();
    }
    if (peek() === "GIVEN") throw new GrammarError("GIVEN after the arrow — the state belongs between the trigger and ->");
    if (peek() !== undefined) throw new GrammarError(`expected AND, WITHIN or the end of the line after an outcome, found ${describe(peek())}`);
    return "WHEN";
  }
  if (head === "ALWAYS") {
    i += 1;
    phrase("the invariant");
    if (peek() === "GIVEN") {
      i += 1;
      phrase("the GIVEN state");
    }
    if (peek() === ARROW) throw new GrammarError("ALWAYS takes no arrow — an invariant is one statement; a trigger with outcomes is a WHEN line");
    if (peek() !== undefined) throw new GrammarError(`expected GIVEN or the end of the line after the invariant, found ${describe(peek())}`);
    return "ALWAYS";
  }
  throw new GrammarError(
    "not a grammar line — every line opens with WHEN or ALWAYS; prose belongs in the README, readme §13 or the screen's docblock",
  );
}

const fails = [];
const counts = [];
const sidecars = existsSync(behaviorDir)
  ? readdirSync(behaviorDir).filter((f) => f.endsWith(".md") && f !== "README.md").sort()
  : [];

for (const file of sidecars) {
  const screen = file.replace(/\.md$/, "");
  if (!existsSync(join(canonical, `${screen}.dc.html`))) {
    fails.push(`${rel(file)}: names no canonical screen — a sidecar is <Screen>.md for designs/canonical/<Screen>.dc.html`);
  }
  const lines = readFileSync(join(behaviorDir, file), "utf8").split("\n");
  const firstBody = lines.findIndex((l) => l.trim() !== "");
  if (firstBody === -1 || !/^# \S/.test(lines[firstBody])) {
    fails.push(`${rel(file)}:${firstBody + 1}: a sidecar opens with its level-one heading`);
  }
  const tally = { WHEN: 0, ALWAYS: 0 };
  const seen = new Map();
  lines.forEach((raw, n) => {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "" || /^#{1,6} /.test(line)) return;
    const at = `${rel(file)}:${n + 1}`;
    try {
      tally[parse(line)] += 1;
    } catch (err) {
      if (!(err instanceof GrammarError)) throw err;
      fails.push(`${at}: ${err.message}`);
      return;
    }
    const key = line.trim().split(/\s+/).join(" ");
    if (seen.has(key)) fails.push(`${at}: repeats line ${seen.get(key)} — one rule stands once`);
    else seen.set(key, n + 1);
  });
  counts.push(`${file} ${tally.WHEN + tally.ALWAYS} lines (${tally.WHEN} WHEN · ${tally.ALWAYS} ALWAYS)`);
}

for (const c of counts) console.log(`  ${c}`);
for (const f of fails) console.log(`FAIL ${f}`);
console.log(
  `check-behavior: ${sidecars.length} sidecars · syntax ${fails.length ? `${fails.length} failure${fails.length === 1 ? "" : "s"}` : "ok"} · node check inactive until the ID registry lands in ${Date.now() - t0} ms`,
);
if (fails.length) process.exit(1);
