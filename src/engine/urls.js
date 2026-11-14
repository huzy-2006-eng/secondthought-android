// Port of backend/app/detect/urls.py: lexical features, plain-language reasons, XGBoost model, lists.
import { pyRound } from "./pyre.js";

let M = null, L = null, POPULAR = null, BLOCK = null;
const S = {};
export function initUrls(model, popularText, blockText) {
  M = model; L = model.lists;
  for (const k of ["multi_suffixes", "suspicious_tlds", "common_tlds", "shorteners", "free_hosts", "risky_extensions"]) S[k] = new Set(L[k]);
  POPULAR = popularText != null ? new Set(popularText.split("\n").map((s) => s.trim().toLowerCase()).filter(Boolean)) : new Set();
  BLOCK = blockText != null ? new Set(blockText.split("\n").filter(Boolean)) : new Set();
}
export const setBlocklist = (text) => { BLOCK = new Set(text.split("\n").filter(Boolean)); };

export function normalizeUrl(url) {
  let u = url.trim();
  u = u.replace(/^["'<>]+|["'<>]+$/gu, "");
  u = u.replace(/[.,;)]+$/u, "");
  u = u.replace(/^[a-z][a-z0-9+.\-]*:\/\//iu, "");
  u = u.replace(/^www\d?\./iu, "");
  return u;
}

function manualSplit(u) {
  const m = /^([^/?#]*)([^?#]*)\??([^#]*)/u.exec(u);
  const netloc = m[1], path = m[2], query = m[3];
  const host = netloc.split("@").pop().split(":")[0].replace(/^\[+|\]+$/gu, "").toLowerCase().replace(/\.+$/u, "");
  return [host, "", path, query];
}

/** urllib.parse.urlsplit("http://" + u) -> (hostname, port, path, query), falling back like the Python code. */
export function split(url) {
  const u = normalizeUrl(url);
  let rest = ("http://" + u).replace(/[\t\r\n]/gu, "").slice(7);
  let frag = "", query = "";
  const nl = rest.search(/[/?#]/u);
  let netloc = nl < 0 ? rest : rest.slice(0, nl);
  rest = nl < 0 ? "" : rest.slice(nl);
  if (rest.includes("#")) { const i = rest.indexOf("#"); frag = rest.slice(i + 1); rest = rest.slice(0, i); }
  if (rest.includes("?")) { const i = rest.indexOf("?"); query = rest.slice(i + 1); rest = rest.slice(0, i); }
  void frag;
  const path = rest;
  if ((netloc.includes("[") && !netloc.includes("]")) || (netloc.includes("]") && !netloc.includes("["))) return manualSplit(u);
  const hostinfo = netloc.slice(netloc.lastIndexOf("@") + 1);
  let hostname, port;
  const br = hostinfo.indexOf("[");
  if (br >= 0) {
    const bracketed = hostinfo.slice(br + 1);
    const close = bracketed.indexOf("]");
    hostname = close >= 0 ? bracketed.slice(0, close) : bracketed;
    const after = close >= 0 ? bracketed.slice(close + 1) : "";
    port = after.includes(":") ? after.slice(after.indexOf(":") + 1) : "";
    if (!isIPv6(hostname.split("%")[0]) && !/^v[0-9a-f]+\..+$/iu.test(hostname)) return manualSplit(u);
  } else {
    const c = hostinfo.indexOf(":");
    hostname = c >= 0 ? hostinfo.slice(0, c) : hostinfo;
    port = c >= 0 ? hostinfo.slice(c + 1) : "";
  }
  if (/[^\x00-\x7f]/u.test(netloc)) {
    const n = netloc.replace(/[@:#?]/gu, "");
    const nk = n.normalize("NFKC");
    if (n !== nk && /[/?#@:]/u.test(nk)) return manualSplit(u);
  }
  let host = hostname.toLowerCase().replace(/\.+$/u, "");
  let portS = "";
  if (port) {
    if (/^[0-9]+$/u.test(port)) { const p = parseInt(port, 10); portS = p >= 1 && p <= 65535 ? String(p) : ""; }
  }
  return [host, portS, path, query];
}

function isIPv4(h) {
  const p = h.split(".");
  return p.length === 4 && p.every((x) => /^[0-9]{1,3}$/u.test(x) && (x === "0" || x[0] !== "0") && +x <= 255);
}
function isIPv6(h) {
  if (!h.includes(":")) return false;
  let s = h.split("%")[0];
  let v4 = 0;
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) { if (!isIPv4(tail)) return false; s = s.slice(0, lastColon + 1) + "0:0"; v4 = 1; }
  void v4;
  const dbl = s.split("::");
  if (dbl.length > 2) return false;
  const grp = (x) => (x === "" ? [] : x.split(":"));
  const parts = dbl.length === 2 ? [...grp(dbl[0]), ...grp(dbl[1])] : grp(s);
  if (!parts.every((g) => /^[0-9a-f]{1,4}$/iu.test(g))) return false;
  return dbl.length === 2 ? parts.length < 8 : parts.length === 8;
}
function isIP(host) { return isIPv4(host) || isIPv6(host) || /^(0x[0-9a-f]+|\d{8,10})$/u.test(host); }

export function registeredDomain(host) {
  if (isIP(host)) return host;
  const labels = host.split(".");
  if (labels.length >= 3 && S.multi_suffixes.has(labels.slice(-2).join("."))) return labels.slice(-3).join(".");
  return labels.slice(-2).join(".");
}

function entropy(s) {
  const cs = Array.from(s);
  if (!cs.length) return 0;
  const c = new Map();
  for (const ch of cs) c.set(ch, (c.get(ch) || 0) + 1);
  let e = 0;
  for (const v of c.values()) e -= (v / cs.length) * Math.log2(v / cs.length);
  return e;
}

function editDistanceLe(a, b, k) {
  if (Math.abs(a.length - b.length) > k) return null;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i, ...new Array(b.length).fill(0)];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0));
      if (prev2 !== null && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
    }
    if (Math.min(...cur) > k) return null;
    prev2 = prev; prev = cur;
  }
  return prev[prev.length - 1] <= k ? prev[prev.length - 1] : null;
}

const LEET = { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a" };
const leet = (s) => Array.from(s).map((c) => LEET[c] ?? c).join("");
const tokens = (text) => text.toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean);

function official(brand, reg) {
  const off = L.brands[brand];
  if (reg === off || reg.endsWith("." + off) || off.endsWith("." + reg)) return true;
  const dot = reg.indexOf(".");
  const label = dot < 0 ? reg : reg.slice(0, dot), suffix = dot < 0 ? "" : reg.slice(dot + 1);
  const last = suffix.includes(".") ? suffix.slice(suffix.lastIndexOf(".") + 1) : suffix;
  return (label === brand || label === off.split(".")[0]) && !S.suspicious_tlds.has(last);
}

function brandSignals(host, path, query) {
  const reg = registeredDomain(host);
  const regTokens = tokens(reg.split(".")[0]);
  const hostPrefix = reg.length ? host.slice(0, host.length - reg.length) : host;
  const other = [...tokens(hostPrefix), ...tokens(path), ...tokens(query)];
  let outside = null, lookalike = null;
  const brands = Object.keys(L.brands);
  for (const tok of [...regTokens, ...other]) {
    const clean = leet(tok);
    for (const brand of brands) {
      if (official(brand, reg)) continue;
      if (clean === brand) {
        if (tok !== brand && lookalike === null) lookalike = brand;
        else if (outside === null) outside = brand;
      } else if (regTokens.includes(tok) && brand.length >= 5 && lookalike === null && !(clean in L.brands)) {
        const d = editDistanceLe(clean, brand, brand.length < 8 ? 1 : 2);
        if (d !== null && d > 0) lookalike = brand;
      }
    }
  }
  if (lookalike === outside) outside = null;
  return [outside, lookalike];
}

/** urllib.parse.unquote: %XX runs decoded as UTF-8 with replacement characters. */
function unquote(s) {
  if (!s.includes("%")) return s;
  return s.replace(/(?:%[0-9a-fA-F]{2})+/gu, (run) => {
    const bytes = new Uint8Array(run.length / 3);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(run.slice(3 * i + 1, 3 * i + 3), 16);
    return new TextDecoder("utf-8").decode(bytes);
  });
}

const cps = (s) => Array.from(s);
const ext = (path) => { const last = path.split("/").pop(); return last.includes(".") ? path.slice(path.lastIndexOf(".") + 1).toLowerCase() : ""; };
const count = (s, sub) => (sub ? s.split(sub).length - 1 : 0);
const isFree = (host, reg) => S.free_hosts.has(host) || S.free_hosts.has(reg) || Array.from(S.free_hosts).some((f) => host.endsWith("." + f));

export function features(url) {
  const u = normalizeUrl(url);
  const [host, port, path, query] = split(u);
  const low = unquote(u).toLowerCase();
  const labels = host ? host.split(".") : [""];
  const reg = registeredDomain(host);
  const tld = labels[labels.length - 1];
  const toks = low.split(/[/.\-_?=&:%+~#]/u).filter(Boolean);
  const [outside, lookalike] = brandSignals(host, path, query);
  const e = ext(path);
  const uc = cps(u), n = Math.max(uc.length, 1);
  const hc = cps(host);
  return [
    uc.length, hc.length, cps(path).length, cps(query).length,
    count(host, "."), count(host, "-"), hc.filter((c) => /\p{Nd}/u.test(c)).length, Math.max(0, labels.length - reg.split(".").length),
    +isIP(host), +Boolean(port), +host.includes("xn--"), +uc.some((c) => c.codePointAt(0) > 127),
    +S.suspicious_tlds.has(tld), +S.common_tlds.has(tld), cps(tld).length,
    path.split("/").filter(Boolean).length, query.split("&").filter(Boolean).length, count(u, "@"), +path.includes("//"),
    count(u, "%"), uc.filter((c) => /\p{Nd}/u.test(c)).length / n, uc.filter((c) => !/[\p{L}\p{N}]/u.test(c)).length / n,
    entropy(host), entropy(u), Math.max(0, ...toks.map((t) => cps(t).length)),
    L.suspicious_words.reduce((a, w) => a + count(low, w), 0), +(outside !== null), +(lookalike !== null),
    +(S.shorteners.has(host) || S.shorteners.has(reg)), +isFree(host, reg),
    +S.risky_extensions.has(e), +["php", "html", "htm", "asp", "aspx"].includes(e),
    +/[a-z0-9\-]+\.(com|net|org|in)[/\-.]/u.test(path.toLowerCase()), +(cps(low).slice(4).join("").includes("http") || host.includes("https")),
    hc.filter((c) => "aeiou".includes(c)).length / Math.max(hc.length, 1), count(u, "-"), Math.max(0, ...labels.map((lb) => cps(lb).length)),
  ];
}

export function reasons(url) {
  const u = normalizeUrl(url);
  const [host, , path, query] = split(u);
  const reg = registeredDomain(host);
  const tld = host.includes(".") ? host.slice(host.lastIndexOf(".") + 1) : "";
  const [outside, lookalike] = brandSignals(host, path, query);
  const low = unquote(u).toLowerCase();
  const out = [];
  if (lookalike) out.push(`'${host || reg}' imitates ${lookalike} (the real site is ${L.brands[lookalike]})`);
  if (outside) out.push(`mentions '${outside}' but the site is ${reg}, not ${L.brands[outside]}`);
  if (isIP(host)) out.push("uses a raw IP address instead of a website name");
  if (host.includes("xn--") || cps(host).some((c) => c.codePointAt(0) > 127)) out.push("uses look-alike international characters in the address");
  if (S.shorteners.has(host) || S.shorteners.has(reg)) out.push("is a link shortener that hides the real destination");
  if (isFree(host, reg)) out.push(`is hosted on ${S.free_hosts.has(host) ? host : reg}, where anyone can publish a page (common for throwaway phishing)`);
  if (S.suspicious_tlds.has(tld)) out.push(`uses the .${tld} ending, which is cheap and heavily abused`);
  const words = L.suspicious_words.filter((w) => low.includes(w));
  if (words.length >= 2) out.push("contains bait words: " + words.slice(0, 4).join(", "));
  if (count(u, "@")) out.push("contains '@', which can disguise the real destination");
  if (count(host, "-") >= 2 || host.split(".").length >= 5) out.push("has an unusually complicated address");
  const e = ext(path);
  if (S.risky_extensions.has(e)) out.push(`downloads a .${e} file, which can install software on your device`);
  return out;
}

export function modelProbability(url) {
  const x = features(url).map(Math.fround);
  let margin = Math.log(M.base_score / (1 - M.base_score));
  for (const [left, right, feat, cond, defLeft] of M.trees) {
    let i = 0;
    while (left[i] !== -1) {
      const v = x[feat[i]];
      i = Number.isNaN(v) ? (defLeft[i] ? left[i] : right[i]) : (v < Math.fround(cond[i]) ? left[i] : right[i]);
    }
    margin += Math.fround(cond[i]);
  }
  return 1 / (1 + Math.exp(-margin));
}

export function checkUrl(url) {
  const [host] = split(url);
  const reg = registeredDomain(host);
  let why = reasons(url);
  let prob = modelProbability(url);
  const threshold = M.threshold ?? 0.5;
  let source = "model";
  const popular = POPULAR.has(reg);
  const sharedPlatform = S.free_hosts.has(host) || S.shorteners.has(host) || S.free_hosts.has(reg) || S.shorteners.has(reg);
  const hosted = sharedPlatform || [...S.free_hosts, ...S.shorteners].some((f) => host.endsWith("." + f));
  const blocked = (BLOCK.has(host) || BLOCK.has(reg)) && !sharedPlatform && !popular;
  if (!blocked && (S.shorteners.has(host) || S.shorteners.has(reg))) prob = Math.min(prob, 0.6);
  if (blocked) { prob = Math.max(prob, 0.99); why.unshift("listed in a public phishing blocklist"); source = "blocklist"; }
  else if (popular && !hosted) { prob = Math.min(prob, 0.15); why = [`${reg} is a well-known website`]; source = "reputation"; }
  const verdict = prob >= Math.max(threshold, 0.8) ? "dangerous" : prob >= threshold * 0.6 ? "suspicious" : "looks safe";
  return { url, host, domain: reg, probability: pyRound(prob, 3), verdict, reasons: why, source };
}
