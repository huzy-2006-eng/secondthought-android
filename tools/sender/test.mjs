// Sender-ID check: JS rules against tools/sender/cases.json (also used by the Java parity test).
import { readFileSync, writeFileSync } from "node:fs";
import { initSenders, checkSender, senderFromScreenshot } from "../../src/engine/sender.js";
initSenders(JSON.parse(readFileSync(new URL("../../public/engine/senders.json", import.meta.url))));
const cases = JSON.parse(readFileSync(new URL("cases.json", import.meta.url)));
let ok = 0; const got = [];
for (const c of cases) {
  const r = checkSender(c.sender, c.text);
  const code = r ? r.code : null, level = r ? r.level : undefined;
  got.push({ code, level: level ?? null, floor: r ? r.floor : 0 });
  const pass = code === c.code && (c.code === null || level === c.level);
  if (pass) ok++; else console.log("FAIL", JSON.stringify(c.sender), c.text.slice(0, 50), "→", code, level, r?.title);
}
writeFileSync(new URL("js_results.json", import.meta.url), JSON.stringify(got));
const shot = senderFromScreenshot("14:02 • VM-SBIINB\nDear Customer, your SBI YONO account will be suspended today.");
if (shot?.sender === "VM-SBIINB" && shot.text.startsWith("Dear")) ok++; else console.log("FAIL screenshot", shot);
console.log(`sender cases: ${ok}/${cases.length + 1}`);
process.exit(ok === cases.length + 1 ? 0 : 1);
