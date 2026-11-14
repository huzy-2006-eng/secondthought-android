// The app's intent model must give the same answer as the Python one it was exported from.
import { readFileSync } from "node:fs";
import { loadEngine } from "../../src/engine/index.js";
import { nodeLoader } from "../node_loader.mjs";
const e = await loadEngine(nodeLoader, { blocklist: false });
const exp = JSON.parse(readFileSync(new URL("./expected.json", import.meta.url), "utf8"));
let same = 0;
for (const c of exp) {
  const p = Object.entries(e.intentScores(c.text)).sort((a, b) => b[1] - a[1])[0][0];
  if (p === c.pred) same++; else console.log("DIFF", c.text, c.pred, p);
}
console.log(`intent model parity: ${same}/${exp.length}`);
