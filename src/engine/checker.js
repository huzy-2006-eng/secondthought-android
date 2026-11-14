// Port of backend/app/detect/checker.py: one explained verdict for a message, link or QR text.
import { ConversationRisk } from "./fusion.js";
import { extract } from "./extract.js";
import { checkUrl } from "./urls.js";
import { pyRound, cpSlice } from "./pyre.js";

const MSG_WEIGHT = 0.85, AGREE_BONUS = 8, SCAM_AT = 60, SUSPICIOUS_AT = 35;
const looksLikeBareUrl = (text) => /^\s*\S+\.\S+\s*$/u.test(text) && !text.trim().includes(" ");

export function checkText(text, models) {
  text = cpSlice((text || "").trim(), 0, 5000);
  const conv = new ConversationRisk();
  const tac = models.tacticMsg ? models.tacticMsg.predict(models.prep(text)) : {};
  const snap = conv.addUtterance(text, "other", text.trim() ? tac : {});
  const tacticScore = snap.score;

  const msgP = looksLikeBareUrl(text) || !models.message || !text.trim() ? null : models.message.predict(models.prep(text)).scam;
  const msgScore = msgP !== null ? pyRound(100 * msgP * MSG_WEIGHT) : 0;

  const urls = extract(text).filter((e) => e.kind === "url");
  const urlsChecked = !urls.length && looksLikeBareUrl(text) ? [checkUrl(text)] : urls.slice(0, 5).map((e) => checkUrl(e.value));
  const urlScore = pyRound(100 * Math.max(0, ...urlsChecked.map((u) => u.probability)));

  const parts = { tactics: tacticScore, message_model: msgScore, links: urlScore };
  const strong = Object.values(parts).filter((v) => v >= 50);
  const score = Math.min(100, Math.max(...Object.values(parts)) + AGREE_BONUS * Math.max(0, strong.length - 1));
  const verdict = score >= SCAM_AT ? "scam" : score >= SUSPICIOUS_AT ? "suspicious" : "looks safe";

  const reasons = [];
  for (const t of snap.tactics) {
    const quote = t.evidence.length ? t.evidence[0].quote : "";
    reasons.push({ kind: "tactic", text: `${t.label}: "${quote}"`, advice: t.advice });
  }
  if (msgP !== null && msgP >= 0.5) reasons.push({ kind: "model", text: `Wording closely matches known scam/spam messages (${pyRound(msgP * 100)}% match).` });
  for (const u of urlsChecked) {
    if (u.verdict !== "looks safe") for (const r of u.reasons.slice(0, 3)) reasons.push({ kind: "link", text: `Link ${u.domain || u.url} ${r}.` });
    else if (u.source === "reputation") reasons.push({ kind: "link", text: `Link goes to ${u.domain}, a well-known website.` });
  }
  return {
    verdict, score, parts, scam_type: snap.scam_type, explanation: snap.explanation, reasons, tactics: snap.tactics,
    links: urlsChecked, entities: snap.entities, message_probability: msgP === null ? null : pyRound(msgP, 3), on_device: true,
  };
}
