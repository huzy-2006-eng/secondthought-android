// Sender-ID check for Indian SMS (TRAI DLT headers). Runs on the phone, no network.
// A real bank or agency texts from its registered header (e.g. VM-HDFCBK-S). Scammers text from
// ordinary mobile numbers, foreign numbers or lookalike headers (HDFCBN1, 1CICIB, SB1INB...).
// This gives a signal the content checks cannot: a perfectly polite "bank" message still fails
// when it comes from a mobile number.
// The same rules are implemented in Java (SenderCheck.java) for the live SMS check; both read
// public/engine/senders.json and are kept in step by tools/sender_parity.mjs.

let D = null, CUES = null, URGENT = null;

export function initSenders(data) {
  D = data;
  CUES = new RegExp(data.claim_cues, "i");
  URGENT = new RegExp(data.urgent_cues, "i");
  for (const e of D.entities) {
    e._names = e.names.map((n) => new RegExp(`(^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i"));
  }
}
export const sendersReady = () => D !== null;

const CATEGORY = { P: "promotional", S: "service", T: "transactional", G: "government" };

/** What kind of sender is this? mobile / intl / shortcode / header / name / none */
export function parseSender(raw) {
  const s = (raw || "").trim();
  if (!s) return { type: "none" };
  const digits = s.replace(/[\s\-().]/g, "");
  if (/^\+?\d{3,15}$/.test(digits)) {
    const d = digits.replace(/^\+/, "");
    if (digits.startsWith("+") && !d.startsWith("91")) return { type: "intl", value: s };
    const local = d.length === 12 && d.startsWith("91") ? d.slice(2) : d.length === 11 && d.startsWith("0") ? d.slice(1) : d;
    if (/^[6-9]\d{9}$/.test(local)) return { type: "mobile", value: "+91 " + local.slice(0, 5) + " " + local.slice(5) };
    if (local.length === 10) return { type: "landline", value: s };
    if (d.length > 10) return { type: "intl", value: s };
    return { type: "shortcode", value: s };
  }
  // XY-HEADER-S, XY-HEADER, HEADER-S, HEADER  (header letters/digits, 3..11 so lookalikes like SBIINB1 parse)
  const m = s.toUpperCase().match(/^(?:([A-Z]{2})[-\s])?([A-Z0-9]{3,11})(?:[-\s]([PSTG]))?$/);
  // Promotional headers can be 6 digits (AD-650022-P); they always come with the operator prefix or a suffix.
  const numericPromo = m && /^\d{6}$/.test(m[2]) && (m[1] || m[3]);
  if (m && (/[A-Z]/.test(m[2]) || numericPromo) && (s === s.toUpperCase() || /^[A-Za-z]{2}-/.test(s))) {
    return { type: "header", prefix: m[1] || null, header: m[2], category: m[3] || null, value: s.toUpperCase() };
  }
  return { type: "name", value: s };  // a saved contact name, an email, etc.
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
  }
  return dp[a.length][b.length];
}
const unleet = (h) => Array.from(h).map((c) => D.lookalike_digits[c] ?? c).join("");

/** Which organisation does the TEXT speak as? Brand name + an "official" cue ("Dear customer", "your account", "KYC"...). */
export function claimedEntity(text) {
  const t = text || "";
  if (!CUES.test(t)) return null;
  let best = null, at = Infinity;
  for (const e of D.entities) for (const re of e._names) {
    const m = re.exec(t);
    if (m && m.index < at) { at = m.index; best = e; }
  }
  return best;
}
const mentions = (e, text) => e._names.some((re) => re.test(text));

/** Which organisation does the HEADER belong to (exact known header), or look like? */
function headerOwner(header) {
  for (const e of D.entities) if (e.headers.includes(header)) return { entity: e, exact: true };
  return null;
}
function lookalike(header) {
  const plain = unleet(header);
  if (/^\d+$/.test(header)) return null;  // 6-digit promotional IDs are a normal format, not a disguise
  const hasDigit = /\d/.test(header);
  for (const e of D.entities) {
    if (e.headers.includes(header)) continue;
    // digits standing in for letters: 1CICIB, SB1INB, HDFC8K
    if (hasDigit && (e.headers.includes(plain) || e.tokens.some((tk) => tk.length >= 4 && plain.includes(tk) && !header.includes(tk)))) return e;
    // brand + extra characters: real headers are exactly 6 characters (SBIINB1, HDFCBANK)
    if (header.length !== 6 && e.tokens.some((tk) => tk.length >= 3 && plain.includes(tk))) return e;
    // one letter off a known header, without the brand's own name in it: HDFCKB, ICICBI, AXISBX is not caught (has AXIS)
    if (header.length === 6 && !e.tokens.some((tk) => header.includes(tk)) && e.headers.some((h) => editDistance(plain, h) === 1)) return e;
  }
  return null;
}

/**
 * Check the sender against what the message claims to be.
 * Returns null when there is nothing to say, else
 * { level: "bad"|"warn"|"good"|"info", code, title, detail, floor, sender, claimed, owner }
 */
export function checkSender(raw, text) {
  if (!D) return null;
  const sender = parseSender(raw);
  if (sender.type === "none") return null;
  const claimed = claimedEntity(text);
  const urgent = URGENT.test(text || "");
  const out = (level, code, title, detail, floor = 0, owner = null) => ({ level, code, title, detail, floor, sender, urgent, claimed: claimed ? { id: claimed.id, name: claimed.name, kind: claimed.kind } : null, owner: owner ? { id: owner.id, name: owner.name } : null });
  const who = claimed ? claimed.name : "";
  const kindWord = { bank: "Banks", payment: "Payment apps", government: "Government departments", telecom: "Phone companies", utility: "Electricity companies", courier: "Courier companies" };

  if (sender.type === "mobile" || sender.type === "landline") {
    if (claimed) return out("bad", "mobile_claim", `Claims to be ${who}, but sent from a phone number`,
      `${kindWord[claimed.kind]} send SMS from registered sender IDs (like VM-HDFCBK-S), never from a personal number such as ${sender.value}. Real ${who} messages cannot come from this sender.`, 80);
    return out("info", "mobile", "Sent from a personal phone number", `${sender.value} is an ordinary number, so this is not an official message from a bank or government office.`);
  }
  if (sender.type === "intl") {
    if (claimed) return out("bad", "intl_claim", `Claims to be ${who}, but sent from a foreign number`,
      `Indian ${kindWord[claimed.kind].toLowerCase()} do not text you from international numbers like ${sender.value}.`, 85);
    return out("warn", "intl", "Sent from a foreign number", `${sender.value} is not an Indian number. Be careful with any link or request in it.`, /https?:|www\.|\.[a-z]{2,}\//i.test(text || "") ? 40 : 0);
  }
  if (sender.type === "shortcode" || sender.type === "name") return null;

  // A DLT header
  const { header, category } = sender;
  const cat = category ? ` (${CATEGORY[category]})` : "";
  const own = headerOwner(header);
  const look = own ? null : lookalike(header);
  if (look) return out("bad", "lookalike", `Fake sender ID: looks like ${look.name}, but isn't`,
    `"${header}" imitates ${look.name}'s sender ID${look.headers.length ? ` (real ones look like ${look.headers.slice(0, 2).join(", ")})` : ""}. Registered sender IDs are exactly 6 characters, without stand-in digits.`, 85, look);
  if (own) {
    const e = own.entity;
    if (claimed && claimed.id !== e.id && ["bank", "government", "payment"].includes(claimed.kind) && !mentions(e, text)) {
      return out("bad", "mismatch", `Sender is ${e.name}, but the message claims to be ${who}`,
        `"${header}" belongs to ${e.name}. A real ${who} message would not come from another organisation's sender ID.`, 75, e);
    }
    if (category === "P" && ["bank", "payment"].includes(e.kind) && URGENT.test(text || "")) {
      return out("warn", "promo_category", `Account message sent as an advert (-P)`,
        `${e.name} sends account, OTP and KYC messages as Service (-S) or Transactional (-T). This one is marked Promotional.`, 45, e);
    }
    return out("good", "known", `Known sender ID of ${e.name}${cat}`,
      `"${header}" is a registered sender ID of ${e.name}. Scammers can't send from it, so the bank-style wording isn't counted against this message. Links in it are still checked.`, 0, e);
  }
  if (category === "G" && claimed?.kind === "government") {
    return out("good", "gov_category", `Sent in the Government category (-G)`, `Only TRAI-approved government senders get the -G suffix.`);
  }
  if (/^\d{6}$/.test(header)) {
    if (urgent && claimed && ["bank", "payment", "government"].includes(claimed.kind)) {
      return out("warn", "promo_category", `Account message from ${who} sent as an advert`,
        `"${header}" is a 6-digit promotional (advert) sender ID. ${who} sends OTP, KYC and account messages as Service or Transactional, from its own sender ID.`, 45);
    }
    if (urgent) return out("warn", "promo_urgent", "Urgent account request sent as an advert (-P)", "This came from a 6-digit promotional (advert) sender ID. Real OTP, KYC and account messages never come as adverts.", 40);
    return out("info", "promo_numeric", `Advert from a registered sender${claimed ? ` (says it's ${who})` : ""}`,
      `"${header}" is a 6-digit promotional sender ID registered with TRAI, the normal way businesses send adverts. Adverts never need your OTP, PIN or KYC: ignore any that ask.`);
  }
  if (claimed) {
    const carries = claimed.tokens.some((tk) => header.includes(tk));
    if (carries) return out("info", "unlisted", `"${header}" is not in our list of ${who} sender IDs`,
      `It may still be real. You can confirm it on the TRAI sender ID portal before acting.`);
    if (["bank", "payment"].includes(claimed.kind)) {
      return out("warn", "unrelated_header", `Claims to be ${who}, but the sender ID is "${header}"`,
        `${who} messages come from its own sender IDs${claimed.headers.length ? ` (like ${claimed.headers.slice(0, 2).join(", ")})` : ""}. "${header}" does not carry ${who}'s name.`, 50);
    }
    return out("info", "unlisted", `"${header}" is not a sender ID we know for ${who}`, `Confirm it on the TRAI sender ID portal before acting on it.`);
  }
  if (category === "P" && urgent) {
    return out("warn", "promo_urgent", "Urgent account request sent as an advert (-P)", "Banks and services send OTP, KYC and account messages as Service or Transactional, not Promotional.", 40);
  }
  return out("info", "registered", `Registered business sender${cat}`,
    `"${header}" is a TRAI-registered sender ID, not a personal number. Still, never share codes or PINs.`);
}

/** Combine the sender check into an engine result (score floor + a reason first in the list). */
export function withSender(result, sc, thresholds = { scam: 60, suspicious: 35 }) {
  if (!sc) return result;
  let score = Math.max(result.score, sc.floor || 0);
  let reasons0 = result.reasons;
  // A known, registered sender ID can't be used by scammers (DLT ties it to the bank). Bank-style wording
  // alone then stops counting against it, unless a link in it looks bad: links are still judged on their own.
  if (sc.code === "known" && (result.parts?.links || 0) < thresholds.suspicious) {
    if (score >= thresholds.suspicious) sc = { ...sc, cleared: result.score };
    score = Math.min(score, 20);
    reasons0 = result.reasons.filter((r) => r.kind === "link");
  } else if (["promo_numeric", "registered", "unlisted"].includes(sc.code) && !sc.urgent && result.score < thresholds.scam && (result.parts?.links || 0) < thresholds.suspicious) {
    // A registered business sender (not a personal number), no urgent account request, links look fine:
    // mild "sounds like an advert/notice" wording alone is not treated as suspicious.
    if (score >= thresholds.suspicious) sc = { ...sc, cleared: result.score };
    score = Math.min(score, 30);
  } else if (sc.code === "known") {
    sc = { ...sc, level: "warn", title: sc.title + ", but a link in it looks unsafe", detail: `The sender ID is real, but the link does not look like ${sc.owner.name}'s. Open the official app or website yourself instead.` };
  }
  const verdict = score >= thresholds.scam ? "scam" : score >= thresholds.suspicious ? "suspicious" : "looks safe";
  const reasons = sc.level === "bad" || sc.level === "warn" ? [{ kind: "sender", text: sc.title + ".", advice: sc.detail }, ...reasons0] : reasons0;
  return { ...result, score, verdict, reasons, sender: sc, parts: { ...result.parts, sender: sc.level === "bad" ? Math.max(sc.floor, 80) : sc.level === "warn" ? sc.floor : sc.level === "good" ? 0 : null } };
}

/**
 * Pull a sender ID out of text read from a screenshot: "14:02 • VM-SBIINB\nDear Customer..."
 * Returns { sender, text } (text with the sender line removed) or null.
 */
export function senderFromScreenshot(text) {
  const lines = (text || "").split(/\n/).slice(0, 4);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/(?:^|[\s•·|])([A-Z]{2}-[A-Z0-9]{3,11}(?:-[PSTG])?)(?=$|[\s•·|])/) || lines[i].match(/^\s*(\+?\d[\d\s-]{9,15}\d)\s*$/);
    if (m) {
      const rest = (text || "").split(/\n/);
      rest.splice(i, 1);
      return { sender: m[1].trim(), text: rest.join("\n").trim() };
    }
  }
  return null;
}
