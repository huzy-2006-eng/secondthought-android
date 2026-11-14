// ScammerTrap, on the phone: reads each scammer message with the detection engine and answers in kind,
// steering the scammer to repeat payment details. No server, no network, nothing uploaded.
import { LINES } from "./lines.js";

const PAYMENT = new Set(["upi", "account", "iban", "crypto"]);
const RX = {
  cred: /\b(otp|o\.t\.p|pin|cvv|password|passcode|code|c[oó]digo|clave)\b|ओटीपी|पिन|पासवर्ड|कोड/iu,
  personal: /\b(tell|send|give|share|confirm|provide|verify|what is|what's|batao|bhejo|bataiye|dime|d[ií]game|env[ií]e)\b.{0,15}\b(your|ur|apna|apni|apne|su|tu)\b.{0,20}\b(full name|name|address|aadhaar|aadhar|pan|date of birth|dob|card( number)?|account number|bank details|photo|selfie|id proof|dni|direcci[oó]n)\b|(नाम|पता|आधार|पैन) (बताओ|बताइए|भेजो)/iu,
  urgent: /\b(hurry|fast|quick(ly)?|immediately|right now|asap|jaldi|turant|abhi|r[aá]pido|ya mismo|ahora mismo)\b|जल्दी|तुरंत/iu,
  police: /\b(police|cbi|crime branch|cyber cell|customs|narcotics|court|warrant|arrest|giraftar|polic[ií]a|juzgado)\b|पुलिस|गिरफ्तार/iu,
  bank: /\b(bank|kyc|account|khata|card|sim|pan|aadhaar|aadhar|upi|yono|cuenta|banco|tarjeta)\b|बैंक|खाता|केवाईसी/iu,
  hinglish: /\b(hai|hain|hoon|hu|raha|rahi|rahe|bol|aapka|aapke|aapki|kijiye|karo|karein|nahi|mujhe|batao|bataiye|ji|beta|madam ji|paise)\b/giu,
  spanish: /[ñ¿¡]|\b(buenos|d[ií]as|le llamo|llamamos|usted|se[nñ]or|se[nñ]ora|su cuenta|su banco|ha ganado)\b/giu,
  paidCheck: /\b(did|have|has) (you|u) (send|sent|pay|paid|transfer|transferred|done)\b|\b(payment|money|transfer) (done|sent|received|kiya|hua)\b|\bsend (the )?screenshot\b|\b(bheja|bhej diya|ho gaya) kya\b|\bpaid\?|\b(ya )?(lo )?(ha|has) (enviado|pagado)\b|भेजा क्या|हो गया क्या/iu,
  delivery: /\b(parcel|package|courier|shipment|delivery|customs|redelivery|paquete|env[ií]o)\b|पार्सल|कूरियर/iu,
  job: /\b(part[- ]time|work from home|job offer|tasks?|like (and|&) subscribe|rate (hotels|products)|earn (rs|₹|\$)?\s?\d+ ?(per|a) day|trabajo desde casa)\b|घर बैठे/iu,
  greeting: /^\s*(hi|hello|hey|namaste|namaskar|hola|good (morning|evening))\b[\s!.,]*$/iu,
};

const TOPIC_FROM_HINT = { gov: "gov", safe_account: "kyc", investment: "invest", upi_receive: "marketplace", advance_fee: "reward",
  romance: "romance", giftcard: "gov", family: "family", marketplace: "marketplace", tech_support: "tech" };

export class Decoy {
  constructor(engine) {
    this.engine = engine;
    this.lang = null;
    this.scammer = [];        // scammer messages (stay on this phone)
    this.ids = new Map();     // kind:value -> entity
    this.used = new Set();
    this.topic = null;
    this.answered = new Set();  // scam topics already answered in kind (each new one gets its own reply)
    this.asked = new Set();   // which follow-ups we've already asked for
    this.paidChecks = 0;
  }

  pick(intent) {
    const bank = LINES[this.lang] || LINES.en;
    const options = bank[intent] || LINES.en[intent];
    let pool = options.filter((o) => !this.used.has(o));
    if (!pool.length && intent !== "stall") pool = (bank.stall || LINES.en.stall).filter((o) => !this.used.has(o)); // never repeat yourself
    if (!pool.length) pool = options;
    const line = pool[(this.scammer.length * 7 + options.length) % pool.length];
    this.used.add(line);
    return line;
  }

  /** What the engine sees in this message: tactics, scam topic, new identifiers. */
  read(text) {
    const hits = this.engine.matchRules(text);
    const tactics = new Set(hits.map((h) => h.tactic));
    for (const [t, p] of Object.entries(this.engine.tacticScores(text, "message"))) if (p >= 0.5) tactics.add(t);
    let topic = null;
    for (const h of hits) if (h.hint && TOPIC_FROM_HINT[h.hint]) { topic = TOPIC_FROM_HINT[h.hint]; break; }
    if (topic === "gov" && !RX.police.test(text) && RX.bank.test(text)) topic = "kyc";
    if (!topic) {
      if (tactics.has("family_impersonation")) topic = "family";
      else if (RX.delivery.test(text)) topic = "delivery";
      else if (RX.job.test(text)) topic = "job";
      else if (tactics.has("reward")) topic = /\b(invest|trading|returns?|profit|crypto)\b/iu.test(text) ? "invest" : "reward";
      else if (tactics.has("remote_access")) topic = "tech";
      else if ((tactics.has("threat") || tactics.has("authority")) && RX.police.test(text)) topic = "gov";
      else if ((tactics.has("threat") || tactics.has("credentials")) && RX.bank.test(text)) topic = "kyc";
    }
    const fresh = [];
    for (const e of this.engine.extract(text)) {
      if (!e.shareable) continue;
      const k = `${e.kind}:${e.value}`;
      if (!this.ids.has(k)) { this.ids.set(k, e); fresh.push(e); }
    }
    return { tactics, topic, fresh };
  }

  /** The engine's language guess, plus single strong markers so the very first reply already matches. */
  guessLang() {
    const all = this.scammer.join(" ");
    const g = this.engine.detectLang(this.scammer);
    if (g !== "en") return g;
    if ((all.match(RX.spanish) || []).length >= 1) return "es";
    if ((all.match(RX.hinglish) || []).length >= 2) return "hi-Latn";
    return "en";
  }

  kinds() { return new Set(Array.from(this.ids.values()).map((e) => e.kind)); }

  /** The decoy's reply to one scammer message, and why it chose it. */
  reply(text) {
    const msg = (text || "").trim();
    this.scammer.push(msg);
    if (!this.lang || this.scammer.length <= 3) this.lang = this.guessLang();
    const { tactics, topic, fresh } = this.read(msg);
    if (topic) this.topic = topic;            // follow the scammer if they switch story
    const k = this.kinds();
    const havePayment = [...k].some((x) => PAYMENT.has(x));
    const freshPayment = fresh.some((e) => PAYMENT.has(e.kind));
    let intent;

    // The scammer GIVING bank details ("sort code .. account ..") is not the scammer ASKING for a code.
    const givesDetails = freshPayment || /\b(sort code|ifsc|iban|account( number| no\.?)?|a\/c|upi( id)?)\b\s*[:\-]?\s*[\w.@-]*\d/iu.test(msg);
    const asksCode = /\b(tell|share|send|give|read|forward|enter|type|batao|bata do|bhejo|d[ií]game|dime|env[ií]eme)\b.{0,25}\b(otp|o\.t\.p|pin|cvv|password|passcode|code|c[oó]digo|clave)\b|\b(otp|pin|code|c[oó]digo)\b.{0,25}\b(batao|bata do|bhejo|tell me|to me|d[ií]game)\b|(ओटीपी|पिन|कोड).{0,25}(बताओ|बताइए|भेजो)/iu.test(msg);
    if (givesDetails) intent = "got_payment";
    else if ((tactics.has("credentials") && RX.cred.test(msg)) || asksCode) intent = "secret";
    else if (tactics.has("remote_access")) intent = "remote";
    else if (fresh.some((e) => e.kind === "url") && !havePayment) intent = "got_link";
    else if (RX.paidCheck.test(msg)) intent = this.paidChecks++ < 2 ? "paid_check" : "stall";
    else if (RX.personal.test(msg)) intent = "personal";
    else if (topic && !this.answered.has(topic)) { intent = topic; this.answered.add(topic); }
    else if (this.topic && !this.answered.has(this.topic)) { intent = this.topic; this.answered.add(this.topic); }
    else if (this.scammer.length === 1 && tactics.has("authority") && !tactics.has("payment")) intent = "official";
    else if (this.scammer.length === 1 && (RX.greeting.test(msg) || !tactics.size)) intent = "open";
    else if (!havePayment && tactics.has("threat") && !tactics.has("payment") && !this.asked.has("scared")) { this.asked.add("scared"); intent = "scared"; }
    else if (RX.urgent.test(msg) && this.asked.has("payment") && !this.asked.has("hurry")) { this.asked.add("hurry"); intent = "hurry"; }
    else if (!havePayment) { this.asked.add("payment"); intent = "ask_payment"; }
    else intent = this.followUp(k);

    return { text: this.pick(intent), intent, topic: this.topic, lang: this.lang, caught: fresh };
  }

  /** Once we have a payment detail: get the bank/IFSC, a second account, the name, a phone number. */
  followUp(k) {
    const payments = [...k].filter((x) => PAYMENT.has(x)).length;
    const accountsOnly = Array.from(this.ids.values()).filter((e) => e.kind === "account").length;
    if (accountsOnly && !k.has("ifsc") && !k.has("iban") && !this.asked.has("bank")) { this.asked.add("bank"); return "ask_bank"; }
    if (payments < 2 && (this.asked.has("alt") ? this.asked.size < 4 : true)) { this.asked.add("alt" + this.asked.size); this.asked.add("alt"); return "ask_alt"; }
    if (!this.asked.has("name")) { this.asked.add("name"); return "ask_name"; }
    if (!k.has("phone") && !this.asked.has("phone")) { this.asked.add("phone"); return "ask_phone"; }
    return "stall";
  }

  /** Learn from a conversation that happened before the handover (e.g. the call so far), without replying. */
  prime(texts) {
    for (const t of texts) {
      this.scammer.push(t);
      const { topic } = this.read(t);
      if (topic && !this.topic) this.topic = topic;
    }
    if (this.scammer.length) { this.lang = this.guessLang(); if (this.topic) this.answered.add(this.topic); }
  }

  /** Everything caught so far (for the complaint report and the scam network). */
  caught() { return Array.from(this.ids.values()); }
}
