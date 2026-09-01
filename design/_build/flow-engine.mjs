// The user-flow engine: resolves the flows declared in flows.json against the
// screen graph, and writes the blessed witnesses to flows.resolved.json.
//
// Reachability alone is semantics-blind — a sign-and-submit board reaches the
// profile through its cancel-X, and no avatar-edit flow may be satisfied that
// way. Three layers keep the answer honest:
//
//   1. Kinds prune. The search walks `advance` arcs alone; cancel, back, nav
//      and detour edges are not paths, so an abandonment can never stand in
//      for a conclusion.
//   2. Pins kill the residue. Where a leg still resolves two ways the engine
//      refuses to guess — an ambiguous leg is a hard failure, and the fix is a
//      waypoint or a via pin naming the route meant.
//   3. Witnesses freeze the meaning. Every resolution is written out and
//      committed; a resolution that no longer matches the committed witness
//      fails until someone re-blesses it deliberately.
//
// The arc, not the edge, is the unit of travel: a multi-outcome advance edge
// contributes one arc per board outcome, which is how one Next control carries
// two flows apart (AvatarCrop's standalone seal and its edit-screen return).

const DEPTH_CAP = 12; // a leg longer than this wants a waypoint, not a search
const BUDGET = 200000; // expansions before the engine admits the leg is tangled

// ---------------------------------------------------------------- graph view

export function buildArcs(graph) {
  const arcsFrom = new Map(); // board -> arc[]   (advance, board outcomes only)
  const edgeByVia = new Map(); // "Board/3" -> edge   (every kind)
  const gapsFrom = new Map(); // board -> "Board/3: text"[]
  for (const e of graph.edges ?? []) {
    edgeByVia.set(`${e.from}/${e.via}`, e);
    for (const o of e.to ?? []) {
      if (o.gap !== undefined) {
        if (!gapsFrom.has(e.from)) gapsFrom.set(e.from, []);
        gapsFrom.get(e.from).push(`${e.from}/${e.via}: ${o.gap}`);
      }
      if (e.kind !== "advance" || o.board === undefined) continue;
      if (!arcsFrom.has(e.from)) arcsFrom.set(e.from, []);
      arcsFrom.get(e.from).push({ from: e.from, via: e.via, label: e.label, to: o.board, case: o.case });
    }
  }
  return { arcsFrom, edgeByVia, gapsFrom };
}

const matchesPin = (arc, pin) =>
  arc.via === pin.via && (pin.case === undefined || arc.case === pin.case) && (pin.to === undefined || arc.to === pin.to);

// Boards from which `target` is reachable over advance arcs. Walking only
// these turns "prove this leg has one route" from an exponential dead-end
// crawl into a walk of the routes themselves.
function reaching(arcsFrom, target) {
  const back = new Map();
  for (const [, arcs] of arcsFrom) {
    for (const a of arcs) {
      if (!back.has(a.to)) back.set(a.to, []);
      back.get(a.to).push(a.from);
    }
  }
  const seen = new Set([target]);
  const queue = [target];
  while (queue.length) {
    for (const p of back.get(queue.pop()) ?? []) {
      if (seen.has(p)) continue;
      seen.add(p);
      queue.push(p);
    }
  }
  return seen;
}

// ------------------------------------------------------------- leg resolving

// Every simple route from `from` to `to`, stopping the moment a second one
// turns up — one route is an answer, two are a question for the author.
export function resolveLeg(arcsFrom, from, to, pin) {
  if (from === to && !pin) return { routes: [[]] };

  const live = reaching(arcsFrom, to);
  const first = (arcsFrom.get(from) ?? []).filter((a) => (pin ? matchesPin(a, pin) : true));
  if (pin && first.length === 0) return { routes: [], pinMissed: true };
  if (!first.some((a) => a.to === to || live.has(a.to))) return { routes: [] };

  const routes = [];
  const path = [];
  const seen = new Set([from]);
  let steps = 0;
  let blown = false;

  const walk = (at, arcs) => {
    for (const a of arcs) {
      if (++steps > BUDGET) { blown = true; return; }
      if (a.to === to) {
        path.push(a);
        routes.push([...path]);
        path.pop();
        if (routes.length >= 2) return;
        continue;
      }
      if (seen.has(a.to) || !live.has(a.to) || path.length + 1 >= DEPTH_CAP) continue;
      seen.add(a.to);
      path.push(a);
      walk(a.to, arcsFrom.get(a.to) ?? []);
      path.pop();
      seen.delete(a.to);
      if (routes.length >= 2 || blown) return;
    }
  };
  walk(from, first);
  return { routes, blown };
}

// ------------------------------------------------------------ outcome picking

function pickOutcome(edge, sel, what) {
  const wanted = (edge.to ?? []).filter(
    (o) => (sel.case === undefined || o.case === sel.case) && (sel.to === undefined || o.board === sel.to),
  );
  if (wanted.length === 1) return { outcome: wanted[0] };
  const shapes = (edge.to ?? []).map((o) => `${o.board ?? o.terminal ?? "gap"}${o.case ? ` (${o.case})` : ""}`);
  if (wanted.length === 0) return { error: `${what} names no outcome of ${edge.from}/${edge.via} — it offers ${shapes.join(" · ")}` };
  return { error: `${what} matches ${wanted.length} outcomes of ${edge.from}/${edge.via} — add "case" or "to" to say which of ${shapes.join(" · ")}` };
}

const arrow = (a) => `${a.from} · ${a.via} «${a.label}» → ${a.to}${a.case ? ` — ${a.case}` : ""}`;

// ----------------------------------------------------------- flow resolving

function resolveStart(flow, view, fails) {
  const { edgeByVia } = view;
  const s = flow.start ?? {};

  if (s.control !== undefined) {
    const except = new Set(s.except ?? []);
    const matches = [];
    for (const [, e] of edgeByVia) if (e.label === s.control && !except.has(e.from)) matches.push(e);
    if (matches.length === 0) {
      fails.push(`flow "${flow.name}": no edge is labelled «${s.control}»`);
      return null;
    }
    const lands = new Map(); // board -> boards carrying the control
    const undesigned = [];
    for (const e of matches) {
      const boards = (e.to ?? []).filter((o) => o.board !== undefined);
      if (boards.length === 0) {
        undesigned.push(`${e.from}/${e.via}: ${(e.to ?? []).map((o) => o.gap ?? o.terminal).join(" · ")}`);
        continue;
      }
      for (const o of boards) {
        if (!lands.has(o.board)) lands.set(o.board, []);
        lands.get(o.board).push(e.from);
      }
    }
    if (lands.size === 0) {
      fails.push(`flow "${flow.name}": «${s.control}» reaches no board at all — every one of its ${matches.length} edges is undesigned`);
      return null;
    }
    if (lands.size > 1) {
      const spread = [...lands].map(([b, from]) => `${b} (from ${[...from].sort().join(", ")})`).join(" · ");
      fails.push(
        `flow "${flow.name}": the start control «${s.control}» diverges — it lands on ${lands.size} different boards: ${spread}. ` +
          `A control-selector start must mean one thing everywhere; name the odd boards in "except", or start from a board.`,
      );
      return null;
    }
    const [board, from] = [...lands][0];
    return {
      board,
      step: `start · «${s.control}» on ${from.length} board${from.length === 1 ? "" : "s"} → ${board}`,
      startsOn: [...from].sort(),
      startsUndesigned: undesigned.sort(),
      used: matches.map((e) => `${e.from}/${e.via}`),
    };
  }

  if (s.board === undefined) {
    fails.push(`flow "${flow.name}": start declares neither a board nor a control`);
    return null;
  }
  if (s.via === undefined) return { board: s.board, from: [s.board], step: `start · ${s.board}`, used: [] };

  const edge = edgeByVia.get(`${s.board}/${s.via}`);
  if (!edge) {
    fails.push(`flow "${flow.name}": start edge ${s.board}/${s.via} is not in the graph`);
    return null;
  }
  const { outcome, error } = pickOutcome(edge, s, `flow "${flow.name}": the start`);
  if (error) { fails.push(error); return null; }
  if (outcome.board === undefined) {
    fails.push(`flow "${flow.name}": the start edge ${s.board}/${s.via} does not open a board`);
    return null;
  }
  return {
    board: outcome.board,
    from: [s.board, outcome.board], // the flow begins on the board the start edge leaves
    step: `start · ${s.board} · ${s.via} «${edge.label}» → ${outcome.board}${outcome.case ? ` — ${outcome.case}` : ""}`,
    used: [`${s.board}/${s.via}`],
  };
}

export function resolveFlow(flow, view) {
  const { arcsFrom, edgeByVia } = view;
  const fails = [];
  const start = resolveStart(flow, view, fails);
  if (!start) return { name: flow.name, status: "failed", fails };

  const end = flow.end ?? {};
  const endEdge = edgeByVia.get(`${end.board}/${end.via}`);
  if (!endEdge) {
    fails.push(`flow "${flow.name}": end edge ${end.board}/${end.via} is not in the graph`);
    return { name: flow.name, status: "failed", fails };
  }
  const picked = pickOutcome(endEdge, end, `flow "${flow.name}": the end`);
  if (picked.error) {
    fails.push(picked.error);
    return { name: flow.name, status: "failed", fails };
  }

  // points[j] departs by points[j].pin toward points[j + 1].
  const points = [{ board: start.board }, ...(flow.waypoints ?? []), { board: end.board }];
  const steps = [start.step];
  const boards = [...(start.from ?? [start.board])];
  const used = [...start.used];

  for (let j = 0; j < points.length - 1; j += 1) {
    const a = points[j];
    const b = points[j + 1];
    const pin = a.via === undefined ? null : { via: a.via, case: a.case, to: a.to };
    if (!arcsFrom.has(a.board) && a.board !== b.board) {
      fails.push(`flow "${flow.name}": ${a.board} has no advance edge to leave by — the leg to ${b.board} cannot start`);
      continue;
    }
    const { routes, blown, pinMissed } = resolveLeg(arcsFrom, a.board, b.board, pin);
    if (pinMissed) {
      fails.push(`flow "${flow.name}": the pin on ${a.board} (via ${a.via}${a.case ? `, case "${a.case}"` : ""}${a.to ? `, to ${a.to}` : ""}) matches no advance arc leaving ${a.board}`);
      continue;
    }
    if (blown) {
      fails.push(`flow "${flow.name}": the leg ${a.board} → ${b.board} is too tangled to settle within budget — add a waypoint to cut it short`);
      continue;
    }
    if (routes.length === 0) {
      fails.push(`flow "${flow.name}": no advance path runs ${a.board} → ${b.board}. Only advance edges are walked, so a route that exists through a cancel, back, nav or detour control is not one.`);
      continue;
    }
    if (routes.length > 1) {
      const shown = routes.map((r, i) => `  route ${i + 1}: ${r.map(arrow).join("  ⇢  ")}`).join("\n");
      fails.push(
        `flow "${flow.name}": the leg ${a.board} → ${b.board} resolves more than one way — the engine will not guess.\n${shown}\n` +
          `  Pin it: add a waypoint on ${a.board} with the "via" (and "case" or "to") of the step meant.`,
      );
      continue;
    }
    for (const arc of routes[0]) {
      steps.push(arrow(arc));
      boards.push(arc.to);
      used.push(`${arc.from}/${arc.via}`);
    }
  }

  if (fails.length) return { name: flow.name, status: "failed", fails };

  const o = picked.outcome;
  const landing = o.board !== undefined ? o.board : o.gap !== undefined ? `gap: ${o.gap}` : `${o.terminal}`;
  steps.push(`end · ${end.board} · ${end.via} «${endEdge.label}» → ${landing}${o.case ? ` — ${o.case}` : ""}`);
  used.push(`${end.board}/${end.via}`);
  if (o.board !== undefined) boards.push(o.board);

  const result = {
    name: flow.name,
    description: flow.description,
    status: o.gap !== undefined ? "blocked by gap" : "resolved",
    steps,
    boards: [...new Set(boards)],
  };
  if (o.gap !== undefined) result.blockedBy = o.gap;
  if (start.startsOn) result.startsOn = start.startsOn;
  if (start.startsUndesigned?.length) result.startsUndesigned = start.startsUndesigned;
  return { ...result, fails: [], startBoard: boards[0], finalBoard: boards[boards.length - 1], used };
}

// ------------------------------------------------------------------- the run

export function resolveAll(graph, flowsDoc) {
  const view = buildArcs(graph);
  const fails = [];
  const seenNames = new Set();
  const results = [];

  for (const flow of flowsDoc.flows ?? []) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(flow.name ?? "")) {
      fails.push(`flows.json: "${flow.name}" is not a kebab-case name`);
      continue;
    }
    if (seenNames.has(flow.name)) fails.push(`flows.json: two flows are named "${flow.name}"`);
    seenNames.add(flow.name);
    if (!flow.description) fails.push(`flow "${flow.name}": no description — a flow says its intent in words`);
    const r = resolveFlow(flow, view);
    if (r.status === "failed") fails.push(...r.fails);
    else results.push(r);
  }

  return { results, fails, view };
}

// The blessing artifact: every resolution written out, plus the reverse index
// that answers "how many continuations does this shared screen owe" and the
// triage that separates gaps a declared journey walks past from the rest.
export function bless(results, view) {
  const boardsOnFlows = {};
  for (const r of results) {
    for (const b of r.boards) {
      const row = (boardsOnFlows[b] ??= { flows: [], endpoint: [] });
      row.flows.push(r.name);
      if (b === r.startBoard || b === r.finalBoard) row.endpoint.push(r.name);
    }
  }
  for (const row of Object.values(boardsOnFlows)) {
    row.flows.sort();
    row.endpoint.sort();
  }

  // Gap triage: a gap sits on a flow when its own board is one a flow walks.
  const onFlowBoards = new Set(Object.keys(boardsOnFlows));
  const onFlow = [];
  const offFlow = [];
  for (const [board, list] of view.gapsFrom) {
    for (const g of list) (onFlowBoards.has(board) ? onFlow : offFlow).push(g);
  }
  onFlow.sort();
  offFlow.sort();

  const witness = {
    $doc:
      "Blessed flow witnesses — generated by check-flows.mjs, committed on purpose. " +
      "Reviewing this file IS the blessing: each flow's resolved chain is frozen here, one step per line, " +
      "and a resolution that drifts from it fails the gate until someone re-blesses with `node check-flows.mjs --rebless`. " +
      "Never hand-edit; regenerate.",
    flows: results.map((r) => {
      const out = { name: r.name, description: r.description, status: r.status };
      if (r.blockedBy) out.blockedBy = r.blockedBy;
      if (r.startsOn) out.startsOn = r.startsOn;
      if (r.startsUndesigned) out.startsUndesigned = r.startsUndesigned;
      out.steps = r.steps;
      out.boards = r.boards;
      return out;
    }),
    boardsOnFlows: Object.fromEntries(Object.keys(boardsOnFlows).sort().map((b) => [b, boardsOnFlows[b]])),
    gapsOnFlows: onFlow,
  };

  return { witness, triage: { onFlow, offFlow } };
}

export const serialize = (witness) => `${JSON.stringify(witness, null, 2)}\n`;
