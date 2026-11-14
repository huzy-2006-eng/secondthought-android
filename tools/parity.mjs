// On-device vs server parity test. Run after tools/parity_expected.py:  node tools/parity.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { loadEngine } from "../src/engine/index.js";
import { matchRules } from "../src/engine/rules.js";
import { normalize } from "../src/engine/normalize.js";
import { modelProbability } from "../src/engine/urls.js";
import { nodeLoader } from "./node_loader.mjs";

const exp = JSON.parse(gunzipSync(readFileSync(new URL("./parity/expected.json.gz", import.meta.url))).toString("utf8"));
const e = await loadEngine(nodeLoader);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pct = (n, d) => (d ? (100 * n / d).toFixed(2) + "%" : "n/a");
const mism = { verdict: [], score: [], conv: [], url: [] };

// ---------------- messages
const M = { n: 0, verdict: 0, score: 0, score1: 0, parts: 0, tactics: 0, rules: 0, entities: 0, redacted: 0, msgp: 0, ms: 0 };
const bySource = {};
for (const c of exp.messages) {
  const t0 = performance.now();
  const r = e.check(c.text);
  M.ms += performance.now() - t0;
  M.n++;
  const s = (bySource[c.source] ||= { n: 0, verdict: 0 }); s.n++;
  if (r.verdict === c.verdict) { M.verdict++; s.verdict++; } else if (mism.verdict.length < 15) mism.verdict.push({ text: c.text.slice(0, 120), py: [c.verdict, c.score, c.parts], js: [r.verdict, r.score, r.parts] });
  if (r.score === c.score) M.score++; else if (mism.score.length < 15) mism.score.push({ text: c.text.slice(0, 120), py: [c.score, c.parts, c.tactics], js: [r.score, r.parts, r.tactics.map((x) => x.tactic).sort()] });
  if (Math.abs(r.score - c.score) <= 1) M.score1++;
  if (eq(r.parts, c.parts)) M.parts++;
  if (eq(r.tactics.map((x) => x.tactic).sort(), c.tactics)) M.tactics++;
  if (eq(matchRules(normalize(c.text)).map((h) => h.rule_id).sort(), c.rules)) M.rules++;
  if (eq(e.extract(c.text).map((x) => [x.kind, x.value]), c.entities)) M.entities++;
  if (e.redact(c.text) === c.redacted) M.redacted++;
  if ((c.msg_p === null && r.message_probability === null) || (c.msg_p !== null && r.message_probability !== null && Math.abs(c.msg_p - r.message_probability) <= 0.005)) M.msgp++;
}

// ---------------- conversations
const C = { n: 0, turns: 0, turnScore: 0, turnIntervene: 0, firstAlert: 0, finalScore: 0, scamType: 0 };
for (const c of exp.conversations) {
  const conv = e.conversation();
  let js = [];
  for (const t of c.turns) { const s = conv.add(t.text, t.speaker); js.push({ score: s.score, intervene: s.intervene }); }
  C.n++;
  c.expected.forEach((x, i) => { C.turns++; if (x.score === js[i].score) C.turnScore++; if (x.intervene === js[i].intervene) C.turnIntervene++; });
  const first = (arr) => arr.findIndex((x) => x.intervene);
  if (first(c.expected) === first(js)) C.firstAlert++; else mism.conv.push({ id: c.id, py: c.expected.map((x) => x.score), js: js.map((x) => x.score) });
  if (c.expected.at(-1).score === js.at(-1).score) C.finalScore++;
  if (conv.snapshot().scam_type === c.scam_type) C.scamType++;
}

// ---------------- urls
const U = { n: 0, prob: 0, pModel: 0, verdict: 0, maxDiff: 0 };
for (const c of exp.urls) {
  U.n++;
  const r = e.checkUrl(c.url);
  const p = modelProbability(c.url);
  const d = Math.abs(p - c.p_model);
  U.maxDiff = Math.max(U.maxDiff, d);
  if (d <= 1e-3) U.pModel++;
  if (Math.abs(r.probability - c.probability) <= 0.001) U.prob++;
  if (r.verdict === c.verdict) U.verdict++; else if (mism.url.length < 15) mism.url.push({ url: c.url, py: [c.verdict, c.probability, c.source], js: [r.verdict, r.probability, r.source] });
}

const report = {
  messages: { n: M.n, verdict: pct(M.verdict, M.n), score_exact: pct(M.score, M.n), score_within_1: pct(M.score1, M.n), parts_exact: pct(M.parts, M.n),
    tactics: pct(M.tactics, M.n), rules: pct(M.rules, M.n), entities: pct(M.entities, M.n), redaction: pct(M.redacted, M.n), message_model: pct(M.msgp, M.n),
    avg_ms_per_message: +(M.ms / M.n).toFixed(2), by_source: Object.fromEntries(Object.entries(bySource).map(([k, v]) => [k, `${v.verdict}/${v.n}`])) },
  conversations: { n: C.n, turns: C.turns, turn_score_exact: pct(C.turnScore, C.turns), turn_intervene: pct(C.turnIntervene, C.turns),
    first_alert_turn: `${C.firstAlert}/${C.n}`, final_score: `${C.finalScore}/${C.n}`, scam_type: `${C.scamType}/${C.n}` },
  urls: { n: U.n, model_probability_within_0_001: pct(U.pModel, U.n), max_model_diff: +U.maxDiff.toExponential(2), final_probability: pct(U.prob, U.n), verdict: pct(U.verdict, U.n) },
  engine_load_ms: e.loadMs,
  mismatches: mism,
};
writeFileSync(new URL("./parity/report.json", import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, mismatches: Object.fromEntries(Object.entries(mism).map(([k, v]) => [k, v.length])) }, null, 2));
