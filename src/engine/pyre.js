// Helpers that make JavaScript behave like the server's Python, so on-device verdicts match it.

export const W = "\\p{L}\\p{N}_"; // Python's Unicode \w
const BOUND = `(?:(?<=[${W}])(?![${W}])|(?<![${W}])(?=[${W}]))`;

/** Translate a Python `re` pattern into an equivalent JavaScript u-flag pattern (\b, \w, \W are Unicode-aware in Python). */
export function py2js(p) {
  let out = "", inClass = false;
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "\\" && i + 1 < p.length) {
      const n = p[++i];
      if (n === "b" && !inClass) out += BOUND;
      else if (n === "w") out += inClass ? W : `[${W}]`;
      else if (n === "W") out += `[^${W}]`;
      else if (n === "-" && !inClass) out += "-";
      else if (n === "'" || n === '"') out += n;
      else out += "\\" + n;
      continue;
    }
    if (c === "[" && !inClass) inClass = true;
    else if (c === "]" && inClass) inClass = false;
    out += c;
  }
  return out;
}

const cache = new Map();
/** Compile a Python-syntax pattern. flags: any of "i", "d"; always Unicode + global. */
export function pyRe(pattern, flags = "") {
  const key = pattern + "\u0000" + flags;
  let r = cache.get(key);
  if (!r) { r = new RegExp(py2js(pattern), "gu" + flags); cache.set(key, r); }
  return r;
}

/** First match of a compiled (global) regex in s, like Python re.search. */
export function search(re, s) { re.lastIndex = 0; const m = re.exec(s); re.lastIndex = 0; return m; }
export function test(re, s) { return search(re, s) !== null; }
export function finditer(re, s) { re.lastIndex = 0; return Array.from(s.matchAll(re)); }

/** Python slicing counts code points; JS indexes UTF-16 units. These walk code points from a UTF-16 index. */
export function backSlice(s, end, n) {
  let i = end;
  for (let k = 0; k < n && i > 0; k++) {
    const c = s.charCodeAt(i - 1);
    i -= (c >= 0xdc00 && c <= 0xdfff && i >= 2 && (s.charCodeAt(i - 2) & 0xfc00) === 0xd800) ? 2 : 1;
  }
  return s.slice(i, end);
}
export function fwdSlice(s, start, n) {
  let i = start;
  for (let k = 0; k < n && i < s.length; k++) {
    const c = s.charCodeAt(i);
    i += (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) ? 2 : 1;
  }
  return s.slice(start, i);
}
export const cpLen = (s) => { let n = 0; for (const _ of s) n++; return n; }; // eslint-disable-line no-unused-vars
export const cpSlice = (s, a, b) => Array.from(s).slice(a, b).join("");

/** Python's round(): half to even. */
export function pyRound(x, nd = 0) {
  const m = 10 ** nd, y = x * m, f = Math.floor(y), diff = y - f;
  let r;
  if (Math.abs(diff - 0.5) < 1e-9) r = f % 2 === 0 ? f : f + 1;
  else r = Math.round(y);
  return nd ? r / m : r;
}

export const isAlpha = (c) => /\p{L}/u.test(c);
export const isAlnum = (c) => /[\p{L}\p{N}]/u.test(c);
export const isDigitU = (c) => /\p{Nd}/u.test(c);
export const isSpace = (c) => /\s/u.test(c) && c !== "﻿";
