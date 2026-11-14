// SecondThought on-device engine: the same rules and trained models as the server, running in the app.
// Nothing you check here leaves the phone.
import { initRules, matchRules } from "./rules.js";
import { initTaxonomy, ConversationRisk, INTERVENE_AT } from "./fusion.js";
import { initUrls, setBlocklist, checkUrl } from "./urls.js";
import { TextModel } from "./textmodel.js";
import { normalize } from "./normalize.js";
import { checkText } from "./checker.js";
import { extract, redact } from "./extract.js";
import { pyRe } from "./pyre.js";

// Port of backend/app/lang.py: en | hi-Latn (Hinglish) | hi (Devanagari) | es
const HINGLISH = pyRe(String.raw`\b(hai|hain|hoon|karo|kariye|kijiye|aap|aapka|aapke|mein|nahi|paise|bhej|batao|jaldi|abhi|kya|ji|bhai|bhaiya|mat|wala|rupaye)\b`);
const SPANISH = pyRe(String.raw`[ñ¿¡]|\b(usted|dinero|cuenta|banco|gracias|por favor|hola|qué|pero|tiene|necesito|ahora|señor|señora|mamá|papá)\b`);
export function detectLang(texts) {
  const t = Array.isArray(texts) ? texts.join(" ") : texts;
  if (/[\u0900-\u097f]/u.test(t)) return "hi";
  const low = t.toLowerCase();
  const es = (low.match(SPANISH) || []).length, hi = (low.match(HINGLISH) || []).length;
  if (es >= 2 && es > hi) return "es";
  if (hi >= 2) return "hi-Latn";
  return "en";
}

const prep = (text) => normalize(text).deleet;  // identical preprocessing to training (ml.prep)

/** loader: { text(name) -> Promise<string>, binary(name) -> Promise<ArrayBuffer> } */
export async function loadEngine(loader, { blocklist = true } = {}) {
  const t0 = Date.now();
  const [rules, tax, urlModel, popular] = await Promise.all([
    loader.text("rules.json").then(JSON.parse), loader.text("taxonomy.json").then(JSON.parse),
    loader.text("url_model.json").then(JSON.parse), loader.text("top_domains.txt"),
  ]);
  initRules(rules); initTaxonomy(tax); initUrls(urlModel, popular, null);
  const model = async (name) => {
    const [meta, terms, idf, coef] = await Promise.all([loader.text(`${name}.json`).then(JSON.parse), loader.text(`${name}.terms.txt`), loader.binary(`${name}.idf.f32`), loader.binary(`${name}.coef.bin`)]);
    return new TextModel(meta, terms, idf, coef);
  };
  const [tacticMsg, message, tacticCall, trapIntent] = await Promise.all([model("tactic_msg"), model("message"), model("tactic_call"), model("trap_intent").catch(() => null)]);
  const models = { tacticMsg, message, tacticCall, prep };
  // The 390k-domain phishing list is big: "background" loads it after the engine is ready.
  const blockReady = blocklist ? loader.text("phishing_domains.txt").then(setBlocklist).catch(() => {}) : Promise.resolve();
  if (blocklist !== "background") await blockReady;
  const loadMs = Date.now() - t0;

  return {
    loadMs,
    check: (text) => checkText(text, models),
    checkUrl,
    extract,
    redact,
    matchRules,
    detectLang,
    INTERVENE_AT,
    tacticScores: (text, domain = "call") => {
      const m = domain === "message" ? tacticMsg : tacticCall;
      return text.trim() ? m.predict(prep(text)) : {};
    },
    /** Share of words in the text that are real words (known to the message model's vocabulary). */
    knownWordRatio: (text) => {
      const toks = (prep(text).match(/[\p{L}\p{N}_]+/gu) || []).filter((w) => !/^\d+$/.test(w));
      if (!toks.length) return 0;
      const wordIndex = message.index[message.meta.parts.findIndex((p) => p.analyzer !== "char_wb")];
      const callIndex = tacticCall.index[tacticCall.meta.parts.findIndex((p) => p.analyzer !== "char_wb")];
      return toks.filter((w) => wordIndex.has(w) || callIndex.has(w)).length / toks.length;
    },
    /** ScammerTrap: what is the scammer doing in this message? {intent: probability} (model trained by tools/trap/). */
    intentScores: (text) => (trapIntent && text.trim() ? trapIntent.predict(prep(text)) : {}),
    messageProbability: (text) => (text.trim() ? message.predict(prep(text)).scam : null),
    /** A live conversation scored on the phone (calls use the conversation-trained tactic model). */
    conversation: (id = null) => {
      const c = new ConversationRisk(id);
      return {
        risk: c,
        add: (text, speaker = "other") => c.addUtterance(text, speaker, text.trim() ? tacticCall.predict(prep(text)) : {}),
        dismiss: () => c.dismiss(),
        applyIntel: (m) => c.applyIntel(m),
        snapshot: () => c.snapshot([], []),
      };
    },
  };
}
