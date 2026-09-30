// Holds the canvases' "? contents" notes to copy-voice (backlog item 109). Each
// note claims to carry the "?" dialogs' copy verbatim, and a claim no check
// reads drifts: the notes fell behind copy-voice ruling by ruling. So the
// blessed texts are read from copy-voice's own section, *The "?" dialogs*, and
// every section of the two notes is compared with the dialog it names:
//
//   canonical `help-contents`        — the V1.0 dialogs
//   postmvp   `wallet-help-contents` — the wallet's two
//
// A note section is `LABEL · 'Title' (where it opens): body`; the title names
// the copy-voice entry, and the body must be that entry's text. Every
// copy-voice dialog lives in exactly one note, so a dialog blessed without its
// note fails as surely as a note that drifted.
//
// Copy-voice's markup is not copy: a trailing italic annotation — `*(Payer-
// neutral …)*`, a capital after the parenthesis — ends the dialog's text, and
// the note renders the rest as plain text: emphasis stars dropped, so the
// `cg-exact` tail `🙂 *(+0.10)*` reads `🙂 (+0.10)`, and straight double quotes
// written as single ones, the way every note on the canvas quotes.
//
// Run from this directory: node check-help-notes.mjs   (exit 1 on any FAIL)
//   --write rewrites every note section's body from copy-voice, for a rebuild.

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const t0 = Date.now();
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const write = process.argv.includes("--write");

const NOTES = [
  { canvas: "designs/canonical/canvas.json", id: "help-contents" },
  { canvas: "designs/postmvp/canvas.json", id: "wallet-help-contents" },
];

const fails = [];

// ---- copy-voice's dialogs.
const voicePath = "guidelines/copy-voice.md";
const voice = readFileSync(join(root, voicePath), "utf8").split("\n");
const start = voice.findIndex((l) => l === '## The "?" dialogs');
if (start === -1) {
  console.log(`FAIL ${voicePath}: no '## The "?" dialogs' section — the check reads the blessed texts from it`);
  process.exit(1);
}
const dialogs = new Map(); // title -> { text, line }
for (let i = start + 1; i < voice.length && !voice[i].startsWith("## "); i += 1) {
  if (!voice[i].startsWith("- **")) continue;
  const at = i + 1;
  let entry = voice[i];
  while (i + 1 < voice.length && /^ {2}\S/.test(voice[i + 1])) entry += ` ${voice[(i += 1)].trim()}`;
  const m = /^- \*\*(.+?)\*\*(?: \([^)]*\))?: (.*)$/.exec(entry);
  if (!m) {
    fails.push(`${voicePath}:${at}: a dialog entry reads "- **Title** (where it opens): text" — this one does not parse`);
    continue;
  }
  const annotation = m[2].search(/\*\([A-Z]/);
  const body = annotation === -1 ? m[2] : m[2].slice(0, annotation);
  dialogs.set(m[1], { text: plain(body), line: at });
}

function plain(markdown) {
  return markdown.replace(/\*/g, "").replace(/"/g, "'").replace(/\s+/g, " ").trim();
}

// ---- the notes.
const SECTION = /^(.+?) · '([^']+)'((?: \(.*?\))?): ([\s\S]*)$/;
const placed = new Map(); // title -> where
for (const note of NOTES) {
  const path = join(root, note.canvas);
  const canvas = JSON.parse(readFileSync(path, "utf8"));
  const annotation = (canvas.annotations ?? []).find((a) => a.id === note.id);
  const where = `${note.canvas} · ${note.id}`;
  if (!annotation) {
    fails.push(`${where}: no such annotation — the note moved; re-declare it in check-help-notes.mjs`);
    continue;
  }
  const [head, ...sections] = annotation.text.split("\n\n");
  const rebuilt = [head];
  for (const section of sections) {
    const m = SECTION.exec(section);
    if (!m) {
      fails.push(`${where}: "${section.slice(0, 60)}…" is not a "LABEL · 'Title': text" section`);
      rebuilt.push(section);
      continue;
    }
    const [, label, title, opens, body] = m;
    const dialog = dialogs.get(title);
    if (!dialog) {
      fails.push(`${where}: '${title}' names no dialog in copy-voice's "?" section`);
      rebuilt.push(section);
      continue;
    }
    if (placed.has(title)) fails.push(`${where}: '${title}' is already carried by ${placed.get(title)} — one dialog, one note`);
    placed.set(title, where);
    if (body !== dialog.text) {
      let at = 0;
      while (at < body.length && body[at] === dialog.text[at]) at += 1;
      fails.push(
        `${where}: '${title}' drifts from copy-voice (${voicePath}:${dialog.line}) at character ${at + 1} — note "…${body.slice(Math.max(0, at - 20), at + 40)}…" vs copy-voice "…${dialog.text.slice(Math.max(0, at - 20), at + 40)}…"`,
      );
    }
    rebuilt.push(`${label} · '${title}'${opens}: ${dialog.text}`);
  }
  if (write) {
    annotation.text = rebuilt.join("\n\n");
    writeFileSync(path, `${JSON.stringify(canvas, null, 2)}\n`);
  }
}
for (const [title, { line }] of dialogs) {
  if (!placed.has(title)) fails.push(`${voicePath}:${line}: '${title}' is carried by no "? contents" note`);
}

const drifts = write ? fails.filter((f) => !f.includes("drifts from copy-voice")) : fails;
for (const f of drifts) console.log(`FAIL ${f}`);
console.log(
  `check-help-notes: ${dialogs.size} dialogs · ${placed.size} carried${write ? " · notes rewritten from copy-voice" : ""} · ${drifts.length ? `${drifts.length} failure${drifts.length === 1 ? "" : "s"}` : "ok"} in ${Date.now() - t0} ms`,
);
if (drifts.length) process.exit(1);
