// Port of backend/app/detect/normalize.py
import { isAlpha } from "./pyre.js";

const ZERO_WIDTH = /[­​-‏‪-‮⁠-⁤﻿]/gu;
const HOMOGLYPHS = {
  "а": "a", "в": "b", "е": "e", "ё": "e", "к": "k", "м": "m", "н": "h", "о": "o", "р": "p", "с": "c", "т": "t", "у": "y",
  "х": "x", "і": "i", "ї": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "ӏ": "l", "ɡ": "g", "ո": "n", "ս": "u",
  "α": "a", "β": "b", "ε": "e", "ι": "i", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
};
const HOMO_RE = new RegExp("[" + Object.keys(HOMOGLYPHS).join("") + "]", "gu");
const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };
const SPACED = /(?<![a-z])(?:[a-z][\s.\-_*]){2,}[a-z](?![a-z])/gu;
const STRETCH = /([a-z])\1{2,}/gu;

/** Any Unicode decimal digit (Devanagari, Arabic-Indic, ...) to 0-9, like Python unicodedata.decimal. */
export function toAsciiDigits(text) {
  let out = "";
  for (const ch of text) {
    if (/\p{Nd}/u.test(ch) && !(ch >= "0" && ch <= "9")) {
      let cp = ch.codePointAt(0), k = 0;
      while (k < 10 && /\p{Nd}/u.test(String.fromCodePoint(cp - k - 1))) k++;
      out += String(k % 10);
    } else out += ch;
  }
  return out;
}

function deleetToken(tok) {
  const hasAlpha = Array.from(tok).some(isAlpha);
  const hasSub = Array.from(tok).some((c) => "013457@$!".includes(c));
  if (hasAlpha && hasSub && !tok.startsWith("http") && !tok.startsWith("www")) {
    return Array.from(tok).map((c) => LEET[c] ?? c).join("");
  }
  return tok;
}

export function normalize(text) {
  let t = text.normalize("NFKC").replace(ZERO_WIDTH, "");
  t = toAsciiDigits(t);
  t = t.toLowerCase().replace(HOMO_RE, (c) => HOMOGLYPHS[c]);
  t = t.replace(SPACED, (m) => m.replace(/[\s.\-_*]/gu, ""));
  t = t.replace(STRETCH, "$1");
  t = t.replace(/\s+/gu, " ").trim();
  const deleet = t.split(" ").map(deleetToken).join(" ");
  return { original: text, norm: t, deleet };
}
