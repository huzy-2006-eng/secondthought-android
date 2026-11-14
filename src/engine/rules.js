// Port of backend/app/detect/rules.py (patterns exported verbatim from Python by tools/export_engine.py)
import { normalize } from "./normalize.js";
import { backSlice, fwdSlice, test, finditer } from "./pyre.js";

let RULES = null, H = null;

export function initRules(data) {
  RULES = data.rules.map((r) => ({
    ...r,
    re: new RegExp(r.pattern, "giu"),
    after: r.exclude_after ? new RegExp(r.exclude_after, "giu") : null,
    before: r.exclude_before ? new RegExp(r.exclude_before, "giu") : null,
  }));
  H = Object.fromEntries(Object.entries(data.helpers).map(([k, v]) => [k, new RegExp(v, "gu")]));
}

const negated = (view, start) => test(H._NEGATION_BEFORE, backSlice(view, start, 40));

export function matchRules(text) {
  const n = typeof text === "string" ? normalize(text) : text;
  const asksSpeaker = test(H._REQUEST_TO_SPEAKER, n.norm) && test(H._CRED_WORDS, n.norm);
  const hits = [];
  for (const rule of RULES) {
    for (const view of [n.norm, n.deleet]) {
      let found = null;
      for (const m of finditer(rule.re, view)) {
        const end = m.index + m[0].length;
        if (rule.negatable && negated(view, m.index) && !asksSpeaker) continue;
        if (rule.after && test(rule.after, fwdSlice(view, end, 40))) continue;
        if (rule.before && test(rule.before, backSlice(view, m.index, 50))) continue;
        found = m; break;
      }
      if (found) { hits.push({ rule_id: rule.id, tactic: rule.tactic, strength: rule.strength, snippet: found[0], hint: rule.hint }); break; }
    }
  }
  return hits;
}

export function protectiveCredentialAdvice(text) {
  const n = typeof text === "string" ? normalize(text) : text;
  if (!(test(H._CRED_WORDS, n.norm) && test(H._PROTECTIVE, n.norm))) return false;
  const asksSpeaker = test(H._REQUEST_TO_SPEAKER, n.norm);
  return !asksSpeaker && !matchRules(n).some((h) => h.tactic === "credentials");
}
