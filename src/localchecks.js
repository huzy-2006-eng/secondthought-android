// Checks that combine the on-device engine with the scam-report network (identifiers only, when online).
import { api } from "./api.js";
import { getEngine } from "./engine/browser.js";

/** Look identifiers (UPI IDs, numbers, accounts, links) up in the scam-report network. Never sends message text. */
export async function lookupIdentifiers(entities) {
  const ids = entities.filter((e) => e.shareable).slice(0, 8);
  const hits = await Promise.all(ids.map((e) => api.lookup(e.kind, e.value).catch(() => null)));
  return { online: hits.some((h) => h !== null) || !ids.length, matches: hits.filter((h) => h && h.reports > 0) };
}

/** Port of the server's payment_check: should this transfer be paused? */
export async function paymentCheck(score, payee, amount) {
  const engine = await getEngine();
  const reasons = [];
  let pause = false;
  if (score >= engine.INTERVENE_AT) { pause = true; reasons.push(`You are in a conversation with a scam risk of ${score}/100.`); }
  let hits = [];
  let offline = false;
  if (payee) {
    const ents = engine.extract(payee).filter((e) => e.shareable);
    const r = await lookupIdentifiers(ents);
    hits = r.matches; offline = !r.online;
    if (!hits.length && !offline) {
      for (const kind of ["upi", "account", "iban", "phone"]) {
        const h = await api.lookup(kind, payee.trim()).catch(() => null);
        if (h && h.reports > 0) hits.push(h);
      }
    }
  }
  for (const h of hits) {
    pause = true;
    reasons.push(`This payee appears in ${h.reports} earlier scam report(s) from ${h.reporters} independent reporter(s).` + (h.includes_demo_data ? " (includes demo data)" : ""));
  }
  if (score >= 35 && !pause) reasons.push("Some warning signs in your conversation. Take a moment before paying.");
  const cooling = pause ? (score >= 80 || hits.length ? 60 : 30) : 0;
  const questions = ["Did they contact you first?", "Are they telling you to keep this secret or stay on the line?",
    "Are they rushing you or threatening you?", "Have you checked with someone you trust, using a number you already have?"];
  return { decision: pause ? "pause" : "proceed", cooling_off_seconds: cooling, reasons, questions: pause ? questions : [], payee_reports: hits, amount, offline };
}
