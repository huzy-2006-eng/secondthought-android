// Port of backend/app/extract.py: identifiers (UPI, phone, account, IFSC, IBAN, URL, e-mail, crypto, amounts)
// and victim secrets (cards, OTPs, Aadhaar, PAN) which are masked.
import { toAsciiDigits } from "./normalize.js";
import { pyRe, finditer, search, backSlice } from "./pyre.js";

const DEFAULT_CC = "91";
export const SHAREABLE = new Set(["upi", "phone", "account", "ifsc", "iban", "url", "email", "crypto"]);
const DIGIT_WORDS = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  shunya: "0", ek: "1", do: "2", teen: "3", char: "4", chaar: "4", paanch: "5", panch: "5", chhe: "6", chhah: "6", saat: "7", aath: "8", nau: "9",
  cero: "0", uno: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5", seis: "6", siete: "7", ocho: "8", nueve: "9",
};
const REPEAT = { double: 2, triple: 3, doble: 2 };
const PSP = "okaxis|oksbi|okhdfcbank|okicici|paytm|ptyes|ptaxis|pthdfc|ptsbi|ybl|ibl|axl|upi|apl|yapl|ikwik|fbl|" +
  "kotak|icici|sbi|hdfcbank|axisbank|freecharge|jio|airtel|waicici|wahdfcbank|waaxis|wasbi|naviaxis";
const TLDS = "com|in|net|org|co|info|xyz|top|online|site|live|app|io|me|ly|link|click|shop|store|support|help|club|" +
  "vip|cc|tk|ml|ga|cf|gq|ru|cn|pw|biz|us|uk|es|mx|gov|edu|ai|dev|tech|icu|cyou|buzz|sbs|lat";

const EMAIL = String.raw`\b[\w.+\-]+@[a-z0-9\-]+(?:\.[a-z0-9\-]+)*\.[a-z]{2,}\b`;
const UPI = String.raw`(?<![\w.\-@])[a-z0-9][\w.\-]{1,255}@[a-z][a-z0-9]{1,63}\b(?!\.[a-z])`;
const URL_ = String.raw`\b(?:https?://[^\s<>"']+|www\.[^\s<>"']+|[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?(?:\.[a-z0-9\-]+)*\.(?:` + TLDS + String.raw`)\b(?::\d+)?(?:/[^\s<>"']*)?)`;
const CRYPTO = [
  ["eth", String.raw`\b0x[a-fA-F0-9]{40}\b`],
  ["btc", String.raw`\b(?:bc1[a-z0-9]{25,59}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b`],
  ["trx", String.raw`\bT[1-9A-HJ-NP-Za-km-z]{33}\b`],
];
const IBAN = String.raw`\b[a-z]{2}\d{2}(?: ?[a-z0-9]{4}){2,7}(?: ?[a-z0-9]{1,4})?\b`;
const ACCOUNT = String.raw`\b(?:account|a/c|acct|acc|khata|cuenta)\b(?:\s*(?:no\.?|number|num|#|nunber))?[^\d\n]{0,20}((?:\d[ \-]?){8,17}\d)(?!\d)`;
const IFSC = String.raw`\b[a-z]{4}0[a-z0-9]{6}\b`;
const PAN = String.raw`\b[a-z]{5}\d{4}[a-z]\b`;
const AADHAAR = String.raw`(?:aadhaar|aadhar|uid|आधार)[^\d]{0,30}([2-9]\d{3}[ \-]?\d{4}[ \-]?\d{4})(?!\d)`;
const SECRET = String.raw`\b(?:otp|code|pin|passcode|cvv|c[oó]digo|clave)\b[^\d\n]{0,20}(\d{3,8})(?!\d)`;
const SECRET_REV = String.raw`(?<!\d)(\d{4,8})\s+(?:is|hai|es)\s+(?:the\s+|my\s+|your\s+|mera\s+|el\s+)?(?:otp|code|pin|c[oó]digo)\b`;
const AMOUNT = [
  String.raw`(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)\s?(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|crores?|k|thousand)?\b`,
  String.raw`\b(\d[\d,]*(?:\.\d+)?)\s*(rupees|rupaye|rupay|dollars|euros|pounds|lakhs?|crores?)\b`,
];
const CARD = String.raw`(?<!\d)(?:\d[ \-]?){12,18}\d(?!\d)`;
const PHONE = String.raw`(?<![\w\d])\+?\d[\d \-().]{6,18}\d(?!\d)`;

function luhn(digits) {
  let total = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = +digits[i];
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    total += d; alt = !alt;
  }
  return total % 10 === 0;
}

function ibanOk(s) {
  s = s.replace(/ /g, "").toUpperCase();
  if (s.length < 15 || s.length > 34) return false;
  const r = s.slice(4) + s.slice(0, 4);
  let mod = 0;
  for (const c of r) {
    const v = parseInt(c, 36);
    if (Number.isNaN(v)) return false;
    for (const d of String(v)) mod = (mod * 10 + +d) % 97;
  }
  return mod === 1;
}

const strip = (w, chars) => { let a = 0, b = w.length; while (a < b && chars.includes(w[a])) a++; while (b > a && chars.includes(w[b - 1])) b--; return w.slice(a, b); };
const rstrip = (w, chars) => { let b = w.length; while (b > 0 && chars.includes(w[b - 1])) b--; return w.slice(0, b); };

/** "nine eight seven double six five" -> "987665", "ramesh at the rate paytm" -> "ramesh@paytm". */
export function spokenToText(text) {
  let t = text.replace(pyRe(String.raw`\s+at\s+the\s+rate\s+(?:of\s+)?`, "i"), "@");
  t = t.replace(pyRe(String.raw`\b([\w.\-]{2,})\s+at\s+(` + PSP + String.raw`)(?![\w\-]|\.\w)`, "i"), "$1@$2");
  t = t.replace(pyRe(String.raw`(?<=\w)\s*@\s*(?=\w)`), "@");
  t = t.replace(pyRe(String.raw`\s+dot\s+(?=(?:` + TLDS + String.raw`)\b)`, "i"), ".");

  const tokens = finditer(/\S+/gu, t);
  const out = []; let i = 0, last = 0;
  while (i < tokens.length) {
    let j = i, digits = "";
    while (j < tokens.length) {
      const w = strip(tokens[j][0], ",.;:").toLowerCase();
      const nxt = j + 1 < tokens.length ? strip(tokens[j + 1][0], ",.;:").toLowerCase() : "";
      if (w in REPEAT && nxt in DIGIT_WORDS) { digits += DIGIT_WORDS[nxt].repeat(REPEAT[w]); j += 2; }
      else if (Object.prototype.hasOwnProperty.call(DIGIT_WORDS, w)) { digits += DIGIT_WORDS[w]; j += 1; }
      else if (/^\p{Nd}+$/u.test(w) && digits) { digits += w; j += 1; }
      else break;
    }
    if (digits.length >= 4) {
      out.push(t.slice(last, tokens[i].index));
      out.push(digits);
      const trail = tokens[j - 1][0];
      out.push(trail.slice(rstrip(trail, ",.;:").length));
      last = tokens[j - 1].index + tokens[j - 1][0].length;
      i = j;
    } else i += 1;
  }
  out.push(t.slice(last));
  return out.join("");
}

function prepare(text) {
  let t = toAsciiDigits(text.normalize("NFKC"));
  t = spokenToText(t);
  let low = "";
  for (const c of t) {
    const l = c.toLowerCase();
    low += (Array.from(l).length === 1 && l.length === c.length) ? l : c;
  }
  return [t, low];
}

function mask(kind, value) {
  if (kind === "card") return "•••• •••• •••• " + value.slice(-4);
  if (kind === "aadhaar") return "XXXX XXXX " + value.slice(-4);
  if (kind === "pan") return "XXXXX" + value.slice(5, 9) + "X";
  return "•".repeat(value.length);
}

function phoneValue(digits, raw) {
  if (raw.trim().startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? "+" + digits : null;
  if (digits.length === 10 && "6789".includes(digits[0]) && DEFAULT_CC === "91") return "+91" + digits;
  if (digits.length === 12 && digits.startsWith("91") && "6789".includes(digits[2])) return "+" + digits;
  if (digits.length === 11 && digits.startsWith("0") && "6789".includes(digits[1])) return "+91" + digits.slice(1);
  if (digits.length >= 10 && digits.length <= 13) return digits;
  return null;
}

/** Entities with the original raw span (internal; Python's Entity objects). */
function extractEntities(text) {
  const [t, low] = prepare(text);
  const taken = [];
  const found = [];
  const free = (a, b) => taken.every(([x, y]) => b <= x || a >= y);
  const add = (a, b, kind, value, sensitive = false, meta = {}) => {
    if (!free(a, b)) return false;
    taken.push([a, b]);
    if (sensitive) value = mask(kind, value);
    found.push([a, { kind, value, raw: t.slice(a, b), sensitive, shareable: SHAREABLE.has(kind) && !sensitive, meta }]);
    return true;
  };
  const g1 = (m) => [m.indices[1][0], m.indices[1][1]];

  for (const m of finditer(pyRe(EMAIL), low)) add(m.index, m.index + m[0].length, "email", m[0]);
  for (const m of finditer(pyRe(UPI), low)) add(m.index, m.index + m[0].length, "upi", m[0], false, { psp: m[0].split("@")[1] });
  for (const m of finditer(pyRe(URL_), low)) {
    const raw = rstrip(m[0], ".,;:)!?'\"");
    const host = raw.replace(/^https?:\/\//u, "").split("/")[0].split(":")[0];
    if (!/^[\d.]+$/u.test(host) && host.includes(".")) {
      add(m.index, m.index + raw.length, "url", raw, false, { domain: host.startsWith("www.") ? host.slice(4) : host });
    }
  }
  for (const [chain, p] of CRYPTO) for (const m of finditer(pyRe(p), t)) add(m.index, m.index + m[0].length, "crypto", m[0], false, { chain });
  for (const m of finditer(pyRe(IBAN), low)) if (ibanOk(m[0])) add(m.index, m.index + m[0].length, "iban", m[0].replace(/ /g, "").toUpperCase());
  for (const m of finditer(pyRe(ACCOUNT, "d"), low)) {
    const digits = m[1].replace(/\D/gu, "");
    if (digits.length >= 9 && digits.length <= 18) add(...g1(m), "account", digits);
  }
  for (const m of finditer(pyRe(IFSC), low)) add(m.index, m.index + m[0].length, "ifsc", m[0].toUpperCase());
  for (const m of finditer(pyRe(PAN), low)) add(m.index, m.index + m[0].length, "pan", m[0].toUpperCase(), true);
  for (const m of finditer(pyRe(AADHAAR, "d"), low)) add(...g1(m), "aadhaar", m[1].replace(/\D/gu, ""), true);
  for (const p of [SECRET, SECRET_REV]) for (const m of finditer(pyRe(p, "d"), low)) add(...g1(m), "secret_code", m[1], true);
  for (const p of AMOUNT) for (const m of finditer(pyRe(p), low)) add(m.index, m.index + m[0].length, "amount", m[0].trim());
  for (const m of finditer(pyRe(CARD), low)) {
    const digits = m[0].replace(/\D/gu, "");
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits) && "3456".includes(digits[0])) add(m.index, m.index + m[0].length, "card", digits, true);
  }
  for (const m of finditer(pyRe(PHONE), t)) {
    const raw = m[0], digits = raw.replace(/\D/gu, "");
    const before = backSlice(low, m.index, 4);
    if (search(/(₹|rs\.?|\$|€|£)\s?$/u, before)) continue;
    const value = phoneValue(digits, raw);
    if (value) add(m.index, m.index + raw.length, "phone", value);
  }

  found.sort((a, b) => a[0] - b[0]);
  const seen = new Set(), out = [];
  for (const [, e] of found) {
    const key = e.kind + "\u0000" + e.value;
    if (!seen.has(key)) { seen.add(key); out.push(e); }
  }
  return out;
}

/** Entity dicts {kind, value, raw, sensitive, shareable, meta}; raw is masked for sensitive ones (Entity.to_dict). */
export function extract(text) {
  return extractEntities(text).map((e) => (e.sensitive ? { ...e, raw: e.value } : e));
}

/** Mask victim secrets (and, for the user's own words, their identifiers) before anything is kept. */
export function redact(text, own = false) {
  let [t] = prepare(text);
  const ents = extractEntities(text).sort((a, b) => Array.from(b.raw).length - Array.from(a.raw).length);
  for (const e of ents) {
    if (!e.raw) continue;
    if (e.sensitive) t = t.replaceAll(e.raw, `[${e.kind.toUpperCase()} REDACTED]`);
    else if (own && SHAREABLE.has(e.kind)) t = t.replaceAll(e.raw, `[MY ${e.kind.toUpperCase()}]`);
  }
  return t;
}

