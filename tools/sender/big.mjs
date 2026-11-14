// Bigger JS/Java agreement check: 600 real messages x 7 kinds of sender.
import { readFileSync, writeFileSync } from "node:fs"; import { gunzipSync } from "node:zlib";
import { initSenders, checkSender } from "../../src/engine/sender.js";
initSenders(JSON.parse(readFileSync(new URL("../../public/engine/senders.json", import.meta.url))));
const d = JSON.parse(gunzipSync(readFileSync(new URL("../parity/expected.json.gz", import.meta.url))));
const msgs = d.messages.filter((_, i) => i % 12 === 0).map((m) => m.text);
const senders = ["+91 98765 43210", "VM-HDFCBK-S", "JD-1CICIB", "VM-OFFERS-P", "VM-RWDPTS-S", "+447700900123", "AX-AXISBK-T"];
const cases = [], res = [];
for (const t of msgs) for (const s of senders) { const r = checkSender(s, t); cases.push({ sender: s, text: t }); res.push({ code: r ? r.code : null, level: r ? r.level : null, floor: r ? r.floor : 0 }); }
writeFileSync(new URL("big_cases.json", import.meta.url), JSON.stringify(cases));
writeFileSync(new URL("big_js.json", import.meta.url), JSON.stringify(res));
console.log("big cases:", cases.length);
