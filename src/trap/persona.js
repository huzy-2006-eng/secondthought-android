// ScammerTrap, on the phone. For every scammer message:
//   1. the trained intent model (tools/trap/train_intents.py) says what the scammer is doing (top 2 readings),
//   2. the detection engine's rules and identifier extraction catch what must never be missed
//      (OTP/PIN requests, app installs, payment details, links, numbers),
//   3. the decoy reacts to the story (loan, lottery, police...) AND answers the actual request
//      ("call this number" -> "I can't hear on calls, write it here"), remembering the conversation.
// It never writes a number, never repeats a line, and works offline.
import { LINES, forPersona } from "./lines.js";

const PAYMENT = new Set(["upi", "account", "iban", "crypto"]);
const TOPIC_OF = { offer_loan: "loan", offer_reward: "reward", offer_job: "job", offer_invest: "invest", threat_legal: "gov",
  threat_account: "kyc", family_emergency: "family", delivery: "delivery", romance: "romance", tech_support: "tech",
  marketplace: "marketplace", intro_official: "official" };
const REACTION = { loan: "loan", reward: "reward", job: "job", invest: "invest", gov: "gov", kyc: "kyc", family: "family",
  delivery: "delivery", romance: "romance", tech: "tech", marketplace: "marketplace", official: "official" };
const RX = {
  asksCode: /\b(tell|share|send|give|read|forward|enter|type|batao|bata do|bhejo|bolo|d[ií]game|dime|env[ií]eme|lea)\b.{0,25}\b(otp|o\.t\.p|pin|cvv|password|passcode|code|c[oó]digo|clave)\b|\b(otp|pin|code|c[oó]digo)\b.{0,25}\b(batao|bata do|bhejo|bolo|tell me|to me|d[ií]game|share)\b|(ओटीपी|पिन|कोड).{0,25}(बताओ|बताइए|भेजो)/iu,
  givesDetails: /\b(sort code|ifsc|iban|account( number| no\.?)?|a\/c|upi( id)?)\b\s*[:\-]?\s*[\w.@-]*\d/iu,
  payToNumber: /\b(send|pay|transfer|gpay|google pay|phonepe|paytm|bhejo|bhej do|daalo)\b.{0,30}\b(on|to|at|pe|par)?\s*(my|this|same|mere|is|mi)\s*(number|mobile|phone|no\.?|n[uú]mero)\b|\b(number|mobile) pe (paise|gpay|paytm|bhejo)/iu,
  callWord: /\b(call|ring|phone|dial|missed call|whatsapp)\b|कॉल|llame/iu,
};

export class Decoy {
  constructor(engine, persona = "grandmother") {
    this.engine = engine;
    this.persona = persona;      // "grandmother" | "grandfather" (a fictional decoy, never the user)
    this.lang = null;
    this.scammer = [];
    this.ids = new Map();
    this.used = new Set();
    this.topic = null;            // the current story (loan, lottery, police...)
    this.reacted = new Set();     // stories already reacted to
    this.followed = new Set();    // stories whose follow-up question was asked
    this.asked = new Set();
    this.paidChecks = 0;
    this.feeAsked = false;
  }

  pick(intent) {
    const bank = LINES[this.lang] || LINES.en;
    const options = bank[intent] || LINES.en[intent] || LINES.en.stall;
    let pool = options.filter((o) => !this.used.has(o));
    if (!pool.length && intent !== "stall") pool = (bank.stall || LINES.en.stall).filter((o) => !this.used.has(o));
    if (!pool.length) pool = options;
    const line = pool[(this.scammer.length * 7 + options.length) % pool.length];
    this.used.add(line);
    return forPersona(line, this.lang, this.persona);
  }

  guessLang() {
    const recent = this.scammer.slice(-3);
    const all = recent.join(" ");
    const g = this.engine.detectLang(recent);
    if (g !== "en") return g;
    if ((all.match(/[ñ¿¡]|\b(buenos|d[ií]as|le llamo|usted|se[nñ]or|se[nñ]ora|su cuenta|ha ganado|pr[eé]stamo)\b/giu) || []).length >= 1) return "es";
    if ((all.match(/\b(hai|hain|hoon|hu|raha|rahi|bol|aapka|aapke|aapki|kijiye|karo|nahi|mujhe|batao|bataiye|ji|beta|paise|bhejo|jaldi)\b/giu) || []).length >= 2) return "hi-Latn";
    return "en";
  }

  kinds() {
    const k = new Set(Array.from(this.ids.values()).map((e) => e.kind));
    if (this.payByNumber) k.add("upi");   // "pay to my number" = UPI on that phone number
    return k;
  }

  /** What the scammer is doing: model readings + rules + identifiers. */
  read(text) {
    const probs = this.engine.intentScores ? this.engine.intentScores(text) : {};
    const ranked = Object.entries(probs).sort((a, b) => b[1] - a[1]);
    const hits = this.engine.matchRules(text);
    const tactics = new Set(hits.map((h) => h.tactic));
    const fresh = [];
    for (const e of this.engine.extract(text)) {
      if (!e.shareable) continue;
      const k = `${e.kind}:${e.value}`;
      if (!this.ids.has(k)) { this.ids.set(k, e); fresh.push(e); }
    }
    // high-precision overrides from the engine
    let action = null;
    if (fresh.some((e) => PAYMENT.has(e.kind)) || RX.givesDetails.test(text)) action = "gives_payment";
    else if (RX.payToNumber.test(text)) action = fresh.some((e) => e.kind === "phone") ? "gives_payment" : "pay_number";
    else if (this.awaitingNumber && fresh.some((e) => e.kind === "phone")) action = "gives_payment";   // the number we just asked for
    else if (tactics.has("credentials") && RX.asksCode.test(text) || RX.asksCode.test(text)) action = "ask_otp";
    else if (tactics.has("remote_access")) action = "ask_install";
    else if (tactics.has("isolation") && !fresh.length) action = "isolation";
    // Unsure readings are ignored ("very soon" must not become a romance), and once a story is going,
    // switching to a different story needs a confident reading.
    const top = ranked.slice(0, 2).filter(([, p], i) => (i === 0 ? p >= 0.5 : p >= 0.45)).map(([l]) => l);
    const conf = Object.fromEntries(ranked);
    const topicLabel = top.find((l) => TOPIC_OF[l]);
    let topic = topicLabel ? TOPIC_OF[topicLabel] : null;
    if (topic && this.topic && topic !== this.topic && conf[topicLabel] < 0.8) topic = null;
    if (!action) action = top.find((l) => !TOPIC_OF[l]) || null;
    if (!action && fresh.some((e) => e.kind === "url")) action = "ask_click_link";
    if (!action && fresh.some((e) => e.kind === "phone") && RX.callWord.test(text)) action = "ask_call";
    return { top, topic, action, fresh, tactics };
  }

  /** The decoy's reply to one scammer message, and why. */
  reply(text) {
    const msg = (text || "").trim();
    this.scammer.push(msg);
    this.lang = this.guessLang();   // follow the scammer if they switch language
    const { top, topic, action, fresh, tactics } = this.read(msg);

    // Gibberish or an unclear message: say so, like a confused person would (don't move the story on).
    const known = this.engine.knownWordRatio ? this.engine.knownWordRatio(msg) : 1;
    const nothingFound = !fresh.length && !tactics.size && !topic && (!action || ["confirm", "question"].includes(action));
    if (nothingFound && (known < 0.5 || /^[^\p{L}\p{N}]*$/u.test(msg))) {
      this.unclearCount = (this.unclearCount || 0) + 1;
      const intent = this.unclearCount > 3 ? "stall" : "unclear";
      return { text: this.pick(intent), intent, readings: top, topic: this.topic, lang: this.lang, caught: [] };
    }
    this.unclearCount = 0;
    if (topic && topic !== "official") this.topic = topic;
    const parts = [];
    const why = [];

    // 1) react to a NEW story (once per story)
    const story = topic && !this.reacted.has(topic) ? topic : null;
    if (story) {
      this.reacted.add(story);
      const line = this.pick(REACTION[story]);
      parts.push(line); why.push(story);
      if (/[?？¿]/u.test(line)) this.followed.add(story);   // the reaction already asks something: don't ask twice
    }

    // 2) answer what they asked
    const act = this.answer(action, fresh, Boolean(story));
    if (act) { parts.push(this.pick(act)); why.push(act); }

    // 3) nothing asked: move the story forward, or steer to their payment details
    if (!act && !story) { const next = this.advance(); parts.push(this.pick(next)); why.push(next); }
    else if (!act && story && story !== "official" && !this.followed.has(story)) { this.followed.add(story); parts.push(this.pick("f_" + story)); why.push("f_" + story); }

    return { text: parts.join(" "), intent: why.join("+"), readings: top, topic: this.topic, lang: this.lang, caught: fresh };
  }

  answer(action, fresh, reacted) {
    const k = this.kinds();
    switch (action) {
      case "gives_payment": {
        const viaNumber = this.awaitingNumber && fresh.some((e) => e.kind === "phone");
        if (viaNumber) { this.awaitingNumber = false; this.payByNumber = true; }
        return fresh.some((e) => PAYMENT.has(e.kind)) || viaNumber || !this.asked.has("got") ? (this.asked.add("got"), "got_payment") : this.followUp(k);
      }
      case "ask_otp": return "secret";
      case "ask_install": return "remote";
      case "ask_personal": return "personal";
      case "ask_call": return k.has("phone") ? "call" : "call_nonum";   // no number given yet: ask which one
      case "ask_click_link": return fresh.some((e) => e.kind === "url") ? "got_link" : "link_none";
      case "ask_fee": this.feeAsked = true; return [...k].some((x) => PAYMENT.has(x)) ? this.followUp(k) : "fee";
      case "ask_paid": return this.paidChecks++ < 2 ? "paid_check" : "stall";
      case "urgency": return this.asked.has("hurry") ? null : (this.asked.add("hurry"), "hurry");
      case "angry": return "angry";
      case "suspicion": return "suspicion";
      case "question": return "question";
      case "greeting": return this.scammer.length <= 2 && !reacted ? "open" : null;
      case "confirm": return null;
      case "isolation": return "isolation";
      case "pay_number": this.awaitingNumber = true; return "pay_number";
      default: return null;
    }
  }

  /** Nothing specific asked: continue the story once, then go for their payment details, then dig for more. */
  advance() {
    const k = this.kinds();
    if (this.topic && !this.followed.has(this.topic) && this.topic !== "official") { this.followed.add(this.topic); return "f_" + this.topic; }
    if (![...k].some((x) => PAYMENT.has(x))) {
      if (this.feeAsked) return "ask_payment";
      return this.asked.has("next") && this.asked.has("next2") ? "ask_payment" : (this.asked.add(this.asked.has("next") ? "next2" : "next"), "next");
    }
    return this.followUp(k);
  }

  followUp(k) {
    const payments = [...k].filter((x) => PAYMENT.has(x)).length;
    const hasAccount = [...this.ids.values()].some((e) => e.kind === "account");
    if (hasAccount && !k.has("ifsc") && !k.has("iban") && !this.asked.has("bank")) { this.asked.add("bank"); return "ask_bank"; }
    if (payments < 2 && !this.asked.has("alt2")) { this.asked.add(this.asked.has("alt1") ? "alt2" : "alt1"); return "ask_alt"; }
    if (!this.asked.has("name")) { this.asked.add("name"); return "ask_name"; }
    if (!k.has("phone") && !this.asked.has("phone")) { this.asked.add("phone"); return "ask_phone"; }
    return "stall";
  }

  /** Learn from the conversation before the handover (e.g. the call so far), without replying. */
  prime(texts) {
    for (const t of texts) {
      this.scammer.push(t);
      const { topic } = this.read(t);
      if (topic && topic !== "official") { this.topic = topic; this.reacted.add(topic); }
    }
    if (this.scammer.length) this.lang = this.guessLang();
  }

  caught() { return Array.from(this.ids.values()); }
}
