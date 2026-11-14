// Loads the on-device engine once, from the files bundled inside the app (public/engine/).
import { loadEngine } from "./index.js";

const base = (import.meta.env?.BASE_URL || "/") + "engine/";
const loader = {
  text: async (n) => { const r = await fetch(base + n); if (!r.ok) throw new Error(`engine file ${n}: ${r.status}`); return r.text(); },
  binary: async (n) => { const r = await fetch(base + n); if (!r.ok) throw new Error(`engine file ${n}: ${r.status}`); return r.arrayBuffer(); },
};

let promise = null;
/** The engine (rules + trained models + link model), loaded on first use and cached. */
export function getEngine() {
  if (!promise) promise = loadEngine(loader, { blocklist: "background" }).catch((e) => { promise = null; throw e; });
  return promise;
}

let scenarios = null;
export async function getScenarios() {
  if (!scenarios) scenarios = fetch(base + "scenarios.json").then((r) => r.json()).catch((e) => { scenarios = null; throw e; });
  return scenarios;
}
