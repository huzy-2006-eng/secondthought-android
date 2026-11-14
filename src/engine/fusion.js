// Port of backend/app/detect/fusion.py: cumulative, explainable conversation risk.
import { normalize } from "./normalize.js";
import { matchRules, protectiveCredentialAdvice } from "./rules.js";
import { extract, redact } from "./extract.js";
import { pyRound } from "./pyre.js";

const K = 55.0;
export const INTERVENE_AT = 60;
const REARM_DELTA = 15;
export const ML_THRESHOLD = 0.5;
const ML_SCALE = 0.6;
const USER_SPEAKER_SCALE = 0.5;
const LEVELS = [[80, "critical"], [INTERVENE_AT, "high"], [35, "caution"], [0, "safe"]];

let TACTICS = null, COMBOS = null, SCAM_TYPES = null;
export function initTaxonomy(tax) { TACTICS = tax.tactics; COMBOS = tax.combos; SCAM_TYPES = tax.scam_types; }
export const tactics = () => TACTICS;

function originalSpan(text, snippet) {
  const i = text.toLowerCase().indexOf(snippet);
  return i >= 0 ? text.slice(i, i + snippet.length) : snippet;
}

export function levelFor(score) {
  for (const [th, name] of LEVELS) if (score >= th) return name;
  return "safe";
}

export class ConversationRisk {
  constructor(sessionId = null) {
    this.session_id = sessionId;
    this.turn = 0;
    this.signals = [];
    this.best = new Map();       // insertion order matters (Python dict)
    this.turnsWith = new Map();
    this.hints = new Map();
    this.intelPoints = 0;
    this.intelReasons = [];
    this.entities = new Map();
    this.score = 0;
    this.dismissedAt = null;
    this.firstAlertTurn = null;
    this.transcript = [];
  }

  addUtterance(text, speaker = "other", mlScores = null) {
    this.turn += 1;
    const scale = speaker === "user" ? USER_SPEAKER_SCALE : 1.0;
    const stored = redact(text, speaker === "user");
    const n = normalize(text);
    const fresh = [];
    for (const hit of matchRules(n)) {
      const quote = redact(originalSpan(text, hit.snippet), speaker === "user");
      fresh.push({ tactic: hit.tactic, strength: hit.strength * scale, source: "rule", evidence: stored, snippet: quote, rule_id: hit.rule_id, turn: this.turn, hint: hit.hint });
    }
    if (speaker === "user") mlScores = null;
    const protective = Boolean(mlScores && Object.keys(mlScores).length) && protectiveCredentialAdvice(n);
    for (const [tactic, prob] of Object.entries(mlScores || {})) {
      if (protective && (tactic === "credentials" || tactic === "isolation")) continue;
      if (tactic in TACTICS && prob >= ML_THRESHOLD) {
        fresh.push({ tactic, strength: prob * ML_SCALE, source: "ml", evidence: stored, snippet: stored, rule_id: `ml_${tactic}`, turn: this.turn, hint: null });
      }
    }
    this.absorb(fresh);

    const ents = [];
    for (const e of extract(text)) {
      if (speaker === "user" && e.kind !== "amount") continue;
      const d = { ...e, speaker, turn: this.turn };
      const key = e.kind + "\u0000" + e.value;
      if (!this.entities.has(key)) this.entities.set(key, d);
      ents.push(d);
    }
    this.transcript.push({ turn: this.turn, speaker, text: stored });
    return this.snapshot(fresh, ents);
  }

  applyIntel(matches) {
    for (const m of matches) {
      if (this.intelReasons.some((r) => r.kind === m.kind && r.value === m.value)) continue;
      const pts = 15 + 8 * Math.min(parseInt(m.reports ?? 1, 10), 5);
      this.intelPoints += pts;
      this.intelReasons.push({ ...m, points: pts });
    }
    return this.snapshot([], []);
  }

  dismiss() { this.dismissedAt = this.score; return this.snapshot([], []); }

  absorb(fresh) {
    const seen = new Set();
    for (const s of fresh) {
      this.signals.push(s);
      if (s.hint) this.hints.set(s.hint, (this.hints.get(s.hint) || 0) + 1);
      const cur = this.best.get(s.tactic);
      if (cur === undefined || s.strength > cur.strength) this.best.set(s.tactic, s);
      const k = s.tactic + "\u0000" + s.turn;
      if (!seen.has(k)) { seen.add(k); this.turnsWith.set(s.tactic, (this.turnsWith.get(s.tactic) || 0) + 1); }
    }
  }

  breakdown() {
    const parts = new Map();
    for (const [t, s] of this.best) {
      const repeat = Math.min(this.turnsWith.get(t) - 1, 2);
      parts.set(t, TACTICS[t].weight * s.strength * (1 + 0.15 * repeat));
    }
    const combos = [];
    for (const [a, b, bonus] of COMBOS) {
      if (this.best.has(a) && this.best.has(b)) {
        const pts = bonus * Math.min(this.best.get(a).strength, this.best.get(b).strength);
        combos.push({ tactics: [a, b], points: pyRound(pts, 1), _raw: pts });
      }
    }
    let raw = 0;
    for (const v of parts.values()) raw += v;
    for (const c of combos) raw += c.points;   // Python sums the rounded points
    raw += this.intelPoints;
    return [raw, parts, combos.map(({ _raw, ...c }) => c)]; // eslint-disable-line no-unused-vars
  }

  scamType() {
    const t = new Set(this.best.keys()), h = (k) => this.hints.get(k) || 0;
    const any = (...xs) => xs.some((x) => t.has(x));
    let key;
    if (t.has("family_impersonation") && any("payment", "isolation", "threat")) key = "family_emergency";
    else if (h("marketplace") && any("payment", "credentials")) key = "marketplace";
    else if (h("tech_support") && t.has("remote_access")) key = "tech_support";
    else if (h("gov") && (t.has("threat") || t.has("authority")) && t.size >= 3) key = "gov";
    else if (h("safe_account")) key = "safe_account";
    else if (h("investment")) key = "investment";
    else if (h("upi_receive")) key = "upi_receive";
    else if (t.has("credentials") && t.has("authority")) key = "kyc";
    else if (t.has("remote_access") && t.size >= 2) key = "remote";
    else if (h("advance_fee") && t.size >= 2) key = "advance_fee";
    else if (h("romance") && t.has("payment")) key = "romance";
    else if (h("giftcard")) key = "giftcard";
    else return null;
    return SCAM_TYPES[key];
  }

  explanation(ranked) {
    if (!ranked.length || this.score < 35) return "No scam pattern so far.";
    const phrases = ranked.slice(0, 3).map((r) => TACTICS[r.tactic].phrase);
    const body = phrases.length === 1 ? phrases[0] : phrases.slice(0, -1).join(", ") + " and " + phrases[phrases.length - 1];
    let text = `The other person ${body}.`;
    if (this.intelReasons.length) {
      const n = Math.max(...this.intelReasons.map((r) => r.reports ?? 1));
      text += ` A payment detail they gave has appeared in ${n} earlier scam report${n !== 1 ? "s" : ""}.`;
    }
    return text;
  }

  snapshot(fresh, newEntities) {
    const [raw, parts, combos] = this.breakdown();
    const score = pyRound(100 * (1 - Math.exp(-raw / K)));
    this.score = Math.max(this.score, score);
    const intervene = this.score >= INTERVENE_AT && (this.dismissedAt === null || this.score >= this.dismissedAt + REARM_DELTA);
    if (intervene && this.firstAlertTurn === null) this.firstAlertTurn = this.turn;

    const ranked = [];
    const order = Array.from(parts.entries()).sort((a, b) => b[1] - a[1]); // stable, like Python sorted
    for (const [t, pts] of order) {
      const sigs = this.signals.filter((s) => s.tactic === t);
      const evidence = [], seen = new Set();
      for (const s of [...sigs].sort((a, b) => b.strength - a.strength)) {
        if (!seen.has(s.snippet)) { seen.add(s.snippet); evidence.push({ quote: s.snippet, turn: s.turn, source: s.source }); }
        if (evidence.length === 3) break;
      }
      ranked.push({
        tactic: t, label: TACTICS[t].label, advice: TACTICS[t].advice,
        strength: pyRound(this.best.get(t).strength, 2), points: pyRound(pts, 1),
        sources: Array.from(new Set(sigs.map((s) => s.source))).sort(), evidence,
      });
    }
    return {
      session_id: this.session_id, turn: this.turn, score: this.score, level: levelFor(this.score), intervene,
      dismissed: this.dismissedAt !== null, first_alert_turn: this.firstAlertTurn,
      scam_type: this.score >= INTERVENE_AT ? this.scamType() : null,
      explanation: this.explanation(ranked), tactics: ranked, combos, intel: this.intelReasons,
      new_signals: fresh, new_entities: newEntities, entities: Array.from(this.entities.values()),
    };
  }
}
