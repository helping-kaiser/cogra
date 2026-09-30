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
// The node check reads the registry render-screens writes (`designs/canonical/
// nodes.json`, design ⇄ impl seam 002/004, backlog item 111), in two halves:
//
// - A token shaped like a node path (`feed.card.actionRow`, a trailing 's or
//   comma allowed) must be a registered path — in every sidecar, so a line can
//   never name an element the built boards do not carry.
// - On a REGISTERED screen, plain words that name one of its nodes fail: the
//   line must write the path. A node is recognized by its name's words
//   (`mediaRow` is "media row", hyphens read as spaces) when that name is a
//   compound — a one-word name like `card` or `title` is also an everyday
//   word, so its plain-word use stays a review discipline, as a prohibition
//   written without NEVER does. A screen with no registered IDs keeps its
//   plain words until its round of the ID sweep lands.
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

// The registry, and per registered screen the compound node names its plain
// words would spell.
const registryFile = join(canonical, "nodes.json");
const registry = existsSync(registryFile) ? JSON.parse(readFileSync(registryFile, "utf8")) : { screens: {} };
const registered = new Set();
const phrases = new Map();
for (const [board, { nodes }] of Object.entries(registry.screens ?? {})) {
  const byPhrase = new Map();
  for (const path of Object.keys(nodes)) {
    registered.add(path);
    const words = path.split(".").at(-1).split(/(?=[A-Z])/).map((w) => w.toLowerCase());
    if (words.length < 2) continue;
    const phrase = words.join(" ");
    if (!byPhrase.has(phrase)) byPhrase.set(phrase, []);
    byPhrase.get(phrase).push(path);
  }
  phrases.set(board, byPhrase);
}
const PATH_TOKEN = /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/;
const bareToken = (t) => t.replace(/'s$/, "").replace(/[,;:]+$/, "");

// Node failures for one line: unregistered paths anywhere, and on a registered
// screen the plain words of a compound node name.
function nodeCheck(line, board) {
  const found = [];
  const toks = line.trim().split(/\s+/);
  for (const t of toks) {
    const bare = bareToken(t);
    if (PATH_TOKEN.test(bare) && !registered.has(bare)) found.push(`${bare} is not a registered node path — nodes.json holds every path a line may name`);
  }
  const byPhrase = phrases.get(board);
  if (byPhrase) {
    const prose = toks
      .filter((t) => !PATH_TOKEN.test(bareToken(t)))
      .join(" ")
      .toLowerCase()
      .replace(/-/g, " ");
    for (const [phrase, paths] of byPhrase) {
      if (new RegExp(`(?:^|[^a-z0-9])${phrase}s?(?=$|[^a-z0-9])`).test(prose)) {
        found.push(`"${phrase}" names a registered node on ${board} — write ${paths.join(" or ")}; plain words stay only for concepts with no node`);
      }
    }
  }
  return found;
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
    for (const f of nodeCheck(line, screen)) fails.push(`${at}: ${f}`);
    const key = line.trim().split(/\s+/).join(" ");
    if (seen.has(key)) fails.push(`${at}: repeats line ${seen.get(key)} — one rule stands once`);
    else seen.set(key, n + 1);
  });
  counts.push(
    `${file} ${tally.WHEN + tally.ALWAYS} lines (${tally.WHEN} WHEN · ${tally.ALWAYS} ALWAYS) · ${phrases.has(screen) ? "node paths (registered)" : "plain words (not registered)"}`,
  );
}

for (const c of counts) console.log(`  ${c}`);
for (const f of fails) console.log(`FAIL ${f}`);
const held = sidecars.filter((f) => phrases.has(f.replace(/\.md$/, ""))).length;
console.log(
  `check-behavior: ${sidecars.length} sidecars · ${registered.size} registered node paths on ${phrases.size} screens · ${held} sidecar${held === 1 ? "" : "s"} held to node paths · ${fails.length ? `${fails.length} failure${fails.length === 1 ? "" : "s"}` : "ok"} in ${Date.now() - t0} ms`,
);
if (fails.length) process.exit(1);
