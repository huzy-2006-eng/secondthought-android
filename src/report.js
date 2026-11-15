// Ready-to-file complaint, written ON THE PHONE (port of backend/app/report.py).
// The conversation never has to go to the server to make a report. The server is only used,
// optionally, to add the scammer's identifiers to the shared scam-report network.
import { getEngine } from "./engine/browser.js";

export const CHANNELS = {
  IN: { country: "India", where: "National Cyber Crime Reporting Portal: https://cybercrime.gov.in",
    phone: "Cyber fraud helpline 1930 (call immediately if money was sent)",
    bank: "Call your bank's official helpline to block the transaction and freeze the receiving account." },
  US: { country: "United States", where: "FTC: https://reportfraud.ftc.gov  and FBI IC3: https://www.ic3.gov",
    phone: "Call your bank or card issuer using the number on your card",
    bank: "Ask your bank to recall the payment; for gift cards, contact the card issuer at once." },
  UK: { country: "United Kingdom", where: "Action Fraud: https://www.actionfraud.police.uk (Scotland: Police Scotland on 101)",
    phone: "Call 159 to reach your bank's fraud team",
    bank: "UK banks must consider reimbursing authorised push payment fraud; report it to your bank quickly." },
  ES: { country: "España", where: "Policía Nacional: https://www.policia.es  o Guardia Civil",
    phone: "Línea de ayuda en ciberseguridad de INCIBE: 017",
    bank: "Llame a su banco por su número oficial para intentar anular la operación." },
  OTHER: { country: "Other", where: "Your local police and your national fraud or cybercrime reporting service",
    phone: "Your bank's official helpline (the number on your card)",
    bank: "Ask your bank to stop or recall the payment as soon as possible." },
};

const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/** snap: the on-device conversation snapshot; turns: [{speaker, text, at}] kept on the phone. */
export async function buildLocalReport({ snap, turns, channel, region = "IN", moneyLost = null }) {
  const engine = await getEngine();
  region = CHANNELS[region] ? region : "OTHER";
  const ch = CHANNELS[region];
  const ids = [], seen = new Set();
  for (const e of snap?.entities || []) {
    if (!e.shareable || e.speaker === "user") continue;
    const k = e.kind + "|" + e.value;
    if (!seen.has(k)) { seen.add(k); ids.push({ kind: e.kind, value: e.value }); }
  }
  const tactics = (snap?.tactics || []).map((t) => ({ tactic: t.label, quotes: (t.evidence || []).slice(0, 2).map((q) => q.quote) }));
  const transcript = (turns || []).map((t) => ({ speaker: t.speaker !== "user" ? "Caller/sender" : "Me", text: engine.redact(t.text) }));
  const score = snap?.score ?? 0, level = snap?.level || "low";
  const lines = [
    `COMPLAINT: suspected ${snap?.scam_type || "fraud attempt"}`,
    `Date and time: ${fmtTime(turns?.[0]?.at || Date.now())}`,
    `Channel: ${channel || "chat"}`,
    `Risk score from SecondThought: ${score}/100 (${level})`,
  ];
  if (moneyLost) lines.push(`Money lost: ${moneyLost}`);
  lines.push("", "What happened:", snap?.explanation || "Suspicious contact.", "", "Manipulation tactics observed:");
  for (const t of tactics) lines.push(`- ${t.tactic}` + (t.quotes[0] ? `: "${t.quotes[0]}"` : ""));
  lines.push("", "Details the other person gave (payment handles, accounts, numbers, links):");
  lines.push(...(ids.length ? ids.map((e) => `- ${e.kind.toUpperCase()}: ${e.value}`) : ["- none captured"]));
  lines.push("", "Conversation (my own codes and card numbers removed):");
  lines.push(...transcript.map((t) => `${t.speaker}: ${t.text}`));
  lines.push("", "Where to file this:", `- ${ch.where}`, `- ${ch.phone}`, `- ${ch.bank}`);
  return {
    region, country: ch.country, generated_at: Date.now(), scam_type: snap?.scam_type || null, score, level,
    explanation: snap?.explanation || "", tactics, identifiers: ids, transcript, file_with: ch, text: lines.join("\n"),
    note: "Prepared on this phone for you to file yourself. SecondThought does not send this to any authority.",
  };
}
